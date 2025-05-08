# scooter-demo
Temporal ridesharing demo application that integrates with Stripe's 
[Stripe's usage-based billing](https://docs.stripe.com/billing/subscriptions/usage-based).
It's implemented in TypeScript and you can see it in action during  
this demonstration from the Stripe Sessions conference (the demo starts 
at 13:09):

[![Integrating Temporal to manage your payment workflows](https://img.youtube.com/vi/2HoRDOgo6xM/0.jpg)](https://www.youtube.com/watch?v=2HoRDOgo6xM)


The application is implemented in TypeScript and composed of three parts, 
each in a corresponding subdirectory containing the relevant code.

| Subdirectory | Description
|--------------|------------------------------------------------------------------|
| `frontend`   | TODO - add description of frontend code                          |
| `api`        | TODO - add description of API code                               |
| `backend`    | Temporal Workflow and Activities for ride management and billing |


# TODO - need to revise the part below 
Create a concise (but comprehensive) set of instructions for how to launch
the application and recreate what we showed in the demo.


## Stripe Setup Instructions 
This demo highlights Temporal's durability and support for external 
interactions by modeling a pay-per-use ride. The Workflow uses Stripe 
for usage-based billing. See ([this document](docs/stripe-notes.md) for
step-by-step instructions for the prerequisite Stripe setup). 

## Why Temporal?
This is a natural fit for Temporal due to several key advantages:
* **Durable state tracking**: Temporal maintains state over time without 
  requiring external persistence. The session's duration, distance, 
  and accumulated cost are managed in-memory by the Workflow and 
  survive process restarts or crashes.
* **Interaction with external applications**:
  Signals from the mobile app or scooter firmware (e.g., addDistance, 
  endRide) allow real-time updates without polling or manual state 
  reconciliation. Similarly, Queries provide those external applications 
  with current information about the Workflow Execution (such as the 
  scooter ID, the current total cost of the ride, or the email address 
  of the rider). 
* **Built-in Timers**: This feature of Temporal is used to assess charges 
  based on time spent using the scooter, while the ride is in progress. 
  It has many other applications in this scenario, such as enforcing a 
  promptness of user response and to end the Workflow after a set 
  time limit (e.g., to limit charges associated with abandoned scooters). 
  This capability is built into Temporal and does not require cron jobs, 
  external schedulers, or separate infrastructure.
* **Exactly-once billing**: thanks to Temporal’s built-in retry semantics
  and idempotency built into the application, failures do not result in
  duplicated calls to Stripe's Billing API. 
* **Operational simplicity**: Temporal workflows encapsulate the full 
  lifecycle of the ride, using clear business logic expressed in code. 
  The Temporal Web UI provides observability, enabling you to see the
  current state and progress for each ride, regardless of whether they 
  have recently completed or are still running. 

-- 


### Running this sample

The sample is configured by default to connect to a 
[local Temporal Service](https://docs.temporal.io/cli#starting-the-temporal-server) running on `localhost:7233`. You can use this command to start it:

```command
temporal server start-dev
```

To instead connect to Temporal Cloud, set the following environment 
variables, replacing them with your own Temporal Cloud credentials.

With mTLS:

```bash
TEMPORAL_ADDRESS=testnamespace.sdvdw.tmprl.cloud:7233
TEMPORAL_NAMESPACE=testnamespace.sdvdw
TEMPORAL_CLIENT_CERT_PATH="/path/to/file.pem"
TEMPORAL_CLIENT_KEY_PATH="/path/to/file.key"
```

With an API key:
```bash
TEMPORAL_ADDRESS=us-west-2.aws.api.temporal.io:7233
TEMPORAL_NAMESPACE=testnamespace.sdvdw
TEMPORAL_API_KEY="your-api-key"
# ensure TEMPORAL_CLIENT_CERT_PATH and TEMPORAL_CLIENT_KEY_PATH are not set
```

`npm install` to install dependencies.

Run `npm run start` to start the Worker. (You can also use 
[Nodemon](https://www.npmjs.com/package/nodemon) to watch for 
changes and restart the Worker automatically by running 
`npm run start.watch`.)

## Demonstration Scenario Summary
Before performing any demonstration, you must do some one-time setup
in Stripe, as [documented in these instructions](../demo/stripe-notes.md)
to establish the Customer, Product, Meter, and Subscription associated 
with usage-based billing in Stripe. 

For all scenarios below, you will have at least two terminal windows
(or tabs). In each, set the `STRIPE_API_KEY` environment variable to
your Stripe secret API key.

In the first terminal, run the `npm install` command to install the
dependencies and `npm run start` to start the Worker, as described
above. In the second, follow the steps below to demonstrate a specific 
scenario.


### Happy Path
In this scenario, everything works as expected on the first try. There 
are no failures. The e-mail address must correspond to the one you set
up in Stripe, as per [these instructions](../demo/stripe-notes.md).

```command
npm run workflow -- --scooterId=1230 --emailAddress=maria@example.com
```

This starts the Workflow Execution, which bills the user some number 
of tokens for an initial "unlock the scooter" charge and consumes some
additional number of tokens for each subsequent 15 seconds of use. 

In a third terminal (where you need not set `STRIPE_API_KEY`, send the 
`addDistance` Signal one or more times during the ride (this represents
the scooter having traveled 100 feet, consuming some number of tokens 
that are then reported to Stripe's usage-based billing):

```command
npm run signal -- --scooterId=1230 --addDistance
```

When you are ready to end the ride, send the `endRide` signal. This will 
cause the Workflow Execution to end, at which point no additional tokens
will be consumed.

```command
npm run signal -- --scooterId=1230 --endRide
```


### Network Outage
In this scenario, the first Activity in the Workflow (which calls a 
Stripe API to look up the customer ID corresponding to the email 
address used to start the Workflow Execution) initially fails due 
to a (simulated) network outage. On the fourth attempt, the failure
resolves itself, after which the Activity will succeed.

The steps for this scenario are identical to the ones above, except 
for the scooter ID (the `FindStripeCustomerID` Activity will simulate
this outage only when invoked with a scooter ID of `1234`. 


**Start the Workflow Execution**
```command
npm run workflow -- --scooterId=1234 --emailAddress=maria@example.com
```

**Add 100 feet of distance traveled**
```command
npm run signal -- --scooterId=1234 --addDistance
```

**End the ride**
```command
npm run signal -- --scooterId=1234 --endRide
```

### Non-Retryable Failure
In this scenario, the Activity that invokes a Stripe API to look up 
the Customer ID corresponding to the email address fails because there 
is no record for that customer in Stripe. Unlike a network outage,
we'd prefer to end the Workflow Execution in this case instead of 
retrying the call again and again. 

Temporal's Retry Policies support not only defining the cadence of 
retry attempts, but also designating certain error types as non-retryable. 
The specific exception type in this scenario is `CustomerNotFoundException`
(defined in the `src/activities.ts` file) and the Retry Policy defined in 
`src/workflows.ts` specifies this type of exception as non-retryable.

**Start the Workflow Execution with an invalid e-mail address**
```command
npm run workflow -- --scooterId=1235 --emailAddress=bogus@example.com
```


### Discover and Fix a Bug in the Running Application
In this scenario, the `BeginRide` Activity that assesses the initial 
charge for unlocking the scooter attempts to do some validation on the 
scooter ID. The comment above the relevant line of code states that 
the scooter ID (a string) must consist only of digits, but the regular 
expression that performs this validation has a typo. It checks that 
each character is in the range 0-8 instead of 0-9, so it incorrectly
fails if the scooter ID contains a 9.

You can use this scenario to demonstrate how you can fix a bug in the 
application code, even for a Workflow Execution already in progress.
We especially recommend using the Temporal Web UI here, since its 
**Pending Activities** tab will show the error that's causing the
Activity Execution to fail and will also identify the specific line 
of code responsible.


**Start the Workflow Execution with a scooter ID that triggers the bug**
```command
npm run workflow -- --scooterId=1239 --emailAddress=maria@example.com
```

Wait for the Activity to fail, use the Temporal Web UI to identify the 
source of the failurem, and then fix the bug by changing `0-8` in the 
regex to `0-9`. Afterwards, you will need to kill and re-run the 
`npm run start` process you started in the other terminal for the change 
to take effect (if not using nodemon to do that automatically). Once 
you have done these things, you should find that the Activity will 
succeed upon the next retry attempt. 
