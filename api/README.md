# Temporal Scooter Rideshare Demo API

**NOTE: This demo requires the frontend and backend to be 
running. See the top-level README for details on how to run those **

This is a Node.js/TypeScript API that interfaces with Temporal for 
managing scooter ride workflows. This API provides endpoints for 
starting, ending, and tracking scooter rides.

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

## API Endpoints

- `POST /ride/start` - Start a new scooter ride
- `POST /ride/end` - End an existing ride
- `GET /ride/state/:workflowId` - Get current ride state
- `POST /ride/add-distance` - Add distance to an ongoing ride

## Development

- Build the project: `npm run build`
- Run linter: `npm run lint` 
