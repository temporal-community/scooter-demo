# Running Frontend Tests

The frontend test suite uses **Mocha**, **Chai**, and the React Testing Library.

## Install dependencies

```
cd frontend
pnpm install   # or npm install
```

## Execute the tests

```
npm test
```

This runs Mocha with ts-node and jsdom so the React components can be tested in a
Node environment.
