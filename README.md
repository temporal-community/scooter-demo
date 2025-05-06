# Scooter Demo API

A Node.js/TypeScript API that interfaces with Temporal for managing scooter ride workflows. This API provides endpoints for starting, ending, and tracking scooter rides.

## Features

- Start a new scooter ride
- End an existing ride
- Track ride state and tokens consumed
- Add distance to ongoing rides
- Integration with Temporal for workflow management

## Prerequisites

- Node.js (v18 or higher recommended)
- npm
- Temporal server running locally or accessible via environment variables

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

## Configuration

Create a `.env` file in the root directory with the following variables:
```
TEMPORAL_HOST=localhost
TEMPORAL_PORT=7233
```

## Running the API

Development mode with hot reload:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## API Endpoints

- `POST /ride/start` - Start a new scooter ride
- `POST /ride/end` - End an existing ride
- `GET /ride/state/:workflowId` - Get current ride state
- `POST /ride/add-distance` - Add distance to an ongoing ride

## Development

- Build the project: `npm run build`
- Run linter: `npm run lint` 