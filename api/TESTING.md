# Running API Tests

The API uses **Mocha** for testing the Express routes and Temporal client interactions.

## Install dependencies

```
cd api
npm install
```

## Execute the tests

Run the full suite:

```
npm test
```

The tests use a 5-second timeout and run with ts-node to support TypeScript files.
Test files are located in the `test/` directory and follow the pattern `*.test.js`.

Note: The tests use a test task queue (`test-tq`) and mock the Temporal client
to avoid requiring a running Temporal server. 