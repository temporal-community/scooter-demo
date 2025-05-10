# Temporal ridesharing demo application
This repository contains code for a ridesharing demo application that 
highlights Temporal's durability and support for external interactions.
It's implemented in TypeScript and integrates with Stripe's 
[Stripe's usage-based billing](https://docs.stripe.com/billing/subscriptions/usage-based).
Want to see it in action? Check out this demonstration from the Stripe 
Sessions conference (the demo starts at 13:09):

[![Integrating Temporal to manage your payment workflows](https://img.youtube.com/vi/2HoRDOgo6xM/0.jpg)](https://www.youtube.com/watch?v=2HoRDOgo6xM)


### Navigating the Codebase
The application is composed of three parts, each in its own subdirectory.

| Subdirectory | Description
|--------------|------------------------------------------------------------------|
| `frontend`   | Browser-based UI                                                 |
| `api`        | API that interfaces between the browser and Temporal workflows   |
| `backend`    | Temporal Workflow and Activities for ride management and billing |

## Running the Application

There are five steps to running the application:

1. Set up usage-based billing in Stripe
2. Start the Temporal Service 
3. Run the application backend
4. Run the application API
5. Run the application frontend


### Set Up Usage-Based Billing in Stripe
See ([this document](docs/stripe-setup.md) for step-by-step instructions 
for the prerequisite Stripe setup. 

### Start the Temporal Service

The sample is configured by default to connect to a 
[local Temporal Service](https://docs.temporal.io/cli#starting-the-temporal-server) running on `localhost:7233`. You can use this command to start it:

```command
temporal server start-dev
```

To instead connect to Temporal Cloud, set the following environment 
variables, replacing them with your own Temporal Cloud credentials.
The instructions below assume the use of a Bourne-compatible UNIX
shell (such as `bash`), so you'll need to adjust them slightly if
using a different shell (such as Windows `cmd.exe` or Powershell). 

With mTLS:

```bash
export TEMPORAL_ADDRESS=testnamespace.sdvdw.tmprl.cloud:7233
export TEMPORAL_NAMESPACE=testnamespace.sdvdw
export TEMPORAL_CLIENT_CERT_PATH="/path/to/file.pem"
export TEMPORAL_CLIENT_KEY_PATH="/path/to/file.key"
```

With an API key:
```bash
export TEMPORAL_ADDRESS=us-west-2.aws.api.temporal.io:7233
export TEMPORAL_NAMESPACE=testnamespace.sdvdw
export TEMPORAL_API_KEY="your-api-key"
```

If using API key authentication, ensure that the `TEMPORAL_CLIENT_CERT_PATH` 
and `TEMPORAL_CLIENT_KEY_PATH` environment variables are not set.


### Run the Application Backend

To run the application backend, first open a terminal and change to the 
`backend` directory. 

```command
cd backend
```

Next, set the `STRIPE_API_KEY` environment variable in that terminal to 
the value of your Stripe secret key. 

```bash
export STRIPE_API_KEY=sk_test_34RZ6V4AJr...kFq
```

Now, install the project dependencies:

```bash
npm install
```

Finally, start the Temporal Worker for the backend:

```
npm run start
```

### Run the Application API

Open another terminal and change to the `api` directory. 

```command
cd api
```

Install the application API dependencies:

```bash
npm install
```

Configure the application API by creating a `.env` file in the root 
directory with the following variables (adjust these if using Temporal
Cloud or other non-local Temporal Service):

```
TEMPORAL_HOST=localhost
TEMPORAL_PORT=7233
```

Start the API server in developer mode with hot reload:

```bash
npm run dev
```

### Run the Application Frontend

Open another terminal and change to the `frontend` directory. 

```command
cd frontend
```

Install the dependencies for the frontend:

```bash
pnpm install
```

Next, start the development server:

```bash
pnpm dev
```

The app should now be available at `http://localhost:5173`, although 
it may use a different port number if that one is already in use. 
You can navigate to the URL it displays to begin the demo.



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

Use scooter ID 1230 for this scenario.

This starts the Workflow Execution, which bills the user some number 
of tokens for an initial "unlock the scooter" charge and consumes some
additional number of tokens for each subsequent 15 seconds of use. 

When you are ready to end the ride, click the **End Ride** button in the 
UI.


### Network Outage
In this scenario, the first Activity in the Workflow (which calls a 
Stripe API to look up the customer ID corresponding to the email 
address used to start the Workflow Execution) initially fails due 
to a (simulated) network outage. On the fourth attempt, the failure
resolves itself, after which the Activity will succeed.

The steps for this scenario are identical to the ones above, except 
for the scooter ID, which must be `1234` (this triggers the failure). 


### Non-Retryable Failure
In this scenario, the Activity that invokes a Stripe API to look up 
the Customer ID corresponding to the email address fails because there 
is no record for that customer in Stripe. Unlike a network outage,
we'd prefer to end the Workflow Execution in this case instead of 
retrying the call again and again. 

For this scenario, use `1233` as the scooter ID and `test@example.com` 
as the email address when starting the ride. 

Temporal's Retry Policies support not only defining the cadence of 
retry attempts, but also designating certain error types as non-retryable. 
The specific exception type in this scenario is `CustomerNotFoundException`
(defined in the `src/activities.ts` file) and the Retry Policy defined in 
`src/workflows.ts` specifies this type of exception as non-retryable.


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

To trigger the bug, use a scooter ID that contains a 9, such as `1239`.

Wait for the Activity to fail, use the Temporal Web UI to identify the 
source of the failure, and then fix the bug by changing `0-8` in the 
regex to `0-9`. Afterwards, you will need to kill and re-run the 
`npm run start` process you started in the other terminal for the change 
to take effect (if not using nodemon to do that automatically). Once 
you have done these things, you should find that the Activity will 
succeed upon the next retry attempt. 


### Ride Awaits Approval to Continue (Human-in-the-Loop)
To prevent riders from incurring excessive charges if they forget to 
end the ride quickly enough, the Workflow is designed to pause the 
ride after 70 tokens have been consumed. In order to continue the 
ride, you must send the `approveRide` Signal to the Workflow Execution
You can do this by using the Temporal Web UI. If you prefer, you can 
also use the Temporal CLI, replacing `1000` in the command below with 
the scooter ID for your ride:

```bash
temporal workflow signal --workflow-id scooter-session-1000 --name approveRide
```


## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the MIT License.
