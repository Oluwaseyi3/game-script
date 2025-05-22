// server.ts - Main Server Entry Point
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import http from 'http';
import cron from 'node-cron';
import { runBattleRoyale } from './services/jobs/battleRoyal.js';

import battleRoyaleRoutes from './services/api/battleRoyaleRoutes.js'; // Adjust path as needed

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse JSON bodies

// Mount API routes
app.use('/api/battleRoyale', battleRoyaleRoutes);
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server on the same HTTP server


// Battle Royale schedule - runs at specific times (e.g., 12PM and 8PM UTC daily)
// cron.schedule('0 12,20 * * *', () => {
//   console.log('Starting scheduled Battle Royale tournament...');
//   runBattleRoyale().catch(err =>
//     console.error('Error starting Battle Royale tournament:', err)
//   );
// });

// Run a test Battle Royale tournament on startup
(async () => {
    console.log('Starting Battle Royale tournament (test run)...');
    try {
        await runBattleRoyale();
        console.log('Battle Royale tournament completed.');
    } catch (err) {
        console.error('Error during Battle Royale tournament test run:', err);
    }
})();

// Start the server
const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`REST API available at http://localhost:${PORT}/api/battleRoyale`);
    console.log(`WebSocket server available at ws://localhost:${PORT}`);
});

// Graceful shutdown for Render
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

// Export for testing
export { app, server };