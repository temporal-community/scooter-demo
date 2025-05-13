# Running Backend Tests

The backend uses **Mocha** together with Temporal's `@temporalio/testing` package.
Tests start an in-memory Temporal test server and exercise the
`ScooterRideWorkflow` and its Activities.

## Install dependencies

```
cd backend
npm install
```

## Execute the tests

Run the full suite:

```
npm test
```

Watch files for changes:

```
npm run test.watch
```

Generate a coverage report:

```
npm run test.coverage
```

The tests themselves can be found in the `test/` directory.
