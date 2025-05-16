# Scooter Demo Contribution Guide

## Repository Layout
- `backend` - Temporal Worker and Activities for ride management. Contains automated tests in `test/`.
- `api` - Node.js API that exposes endpoints to interact with Temporal workflows.
- `frontend` - Browser-based UI built with React and Phaser.
- `docs` - Additional documentation such as `stripe-setup.md`.

## Running the Application
1. Start a local Temporal service:
   ```bash
   temporal server start-dev
   ```
   Or configure `TEMPORAL_*` environment variables to connect to Temporal Cloud.
2. Backend:
   ```bash
   cd backend
   export STRIPE_API_KEY=<your Stripe key>
   npm install
   npm run start
   ```
   See `backend/TESTING.md` for testing commands.
3. API:
   ```bash
   cd api
   npm install
   npm run dev
   ```
   Provide `TEMPORAL_HOST` and `TEMPORAL_PORT` in a `.env` file.
4. Frontend:
   ```bash
   cd frontend
   pnpm install   # or npm install
   pnpm dev
   ```
   The UI will be available at `http://localhost:5173`.

## Testing
- Backend tests use Mocha with Temporal's in-memory server.
  ```bash
  cd backend
  npm test            # run full suite
  npm run test.watch  # watch for changes
  npm run test.coverage  # coverage report
  ```

## Linting
- Run `npm run lint` in `api` and `backend`.
- Run `pnpm lint` in `frontend` (or `npm run lint`).

## Commit Messages and Pull Requests
- Use clear commit messages summarizing the change.
- Open a PR describing **what changed** and **why**.
