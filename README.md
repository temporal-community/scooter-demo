# Temporal Scooter Rideshare Demo Frontend

**NOTE: This demo requires the API and backend to be running.**

Found here:
* API: https://github.com/steveandroulakis/scooter-demo-api
* Backend: https://github.com/tomwheeler/scooter-demo-backend

A playful browser-based demo that simulates a scooter rideshare experience with a 2D side-scrolling game interface. This demo showcases how Temporal-backed ride workflows can be integrated into a modern web application.

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

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/scooter-demo.git
cd scooter-demo
```

2. Install dependencies:
```bash
pnpm install
```

## Development

Start the development server:

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`

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

The demo includes a mock API that can be replaced with real endpoints. The API contract includes:

- `POST /ride/start` - Start a new ride
- `POST /ride/end` - End current ride
- `GET /ride/state` - Get current ride status

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the MIT License.
