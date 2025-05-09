# Temporal Scooter Rideshare Demo Frontend

**NOTE: This demo requires the API and backend to be running.
See the top-level README for information about how to start those. **

This is a playful browser-based demo that simulates a scooter rideshare 
experience with a 2D side-scrolling game interface. This demo showcases 
how Temporal-backed ride Workflows can be integrated into a modern web 
application.

## Features

- 🛴 Interactive 2D side-scrolling scooter ride
- 🎮 Simple controls (use → arrow key to move)
- 📊 Live ride statistics (distance, time, cost)
- 🎨 Parallax scrolling background
- 🎯 Mock API integration ready for Temporal workflows

## Tech Stack

- React 18 + TypeScript
- Vite for fast development
- Phaser 3 for 2D game engine
- Zustand for state management
- Tailwind CSS + daisyUI for styling
- MSW (Mock Service Worker) for API mocking

## Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm

## Project Structure

```
scooter-demo/
├─ public/
│  └─ assets/            # sprites, bg layers, fonts
├─ src/
│  ├─ api/              # API integration
│  ├─ components/       # React components
│  ├─ stores/          # Zustand state management
│  ├─ types/           # TypeScript definitions
│  └─ ...
```

## API Integration

The demo includes a mock API that can be replaced with real endpoints. 
The API contract includes:

- `POST /ride/start` - Start a new ride
- `POST /ride/end` - End current ride
- `GET /ride/state` - Get current ride status

