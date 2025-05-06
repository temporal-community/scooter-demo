import express from 'express';
import cors from 'cors';
import { getEnvConfig } from './env';
import apiRoutes from './routes';
import { getTemporalClient } from './temporalClient'; // Import to initialize on startup

const app = express();
const env = getEnvConfig();

// Middleware
app.use(cors()); // Enable CORS for all routes - adjust for production
app.use(express.json()); // Parse JSON request bodies

// API Routes
app.use('/api', apiRoutes); // Prefix all API routes with /api

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Initialize Temporal Client on startup and start server
async function startServer() {
  try {
    console.log('Initializing Temporal client...');
    await getTemporalClient(); // Initialize client and connection pool
    console.log('Temporal client initialized successfully.');

    app.listen(env.port, () => {
      console.log(`Scooter Demo API server running on http://localhost:${env.port}`);
      console.log(`Temporal Address: ${env.temporalAddress}`);
      console.log(`Temporal Namespace: ${env.temporalNamespace}`);
      console.log(`Default Task Queue for new workflows: ${env.temporalTaskQueue}`);
    });
  } catch (error) {
    console.error('Failed to start the server or initialize Temporal client:', error);
    process.exit(1); // Exit if Temporal client can't be initialized
  }
}

startServer();
