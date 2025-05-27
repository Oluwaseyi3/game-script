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
// Optional API: Countdown to next Battle Royale
app.get('/api/nextBattleRoyale', (req, res) => {
    const next = getNextBattleRoyaleTime();
    res.json({
        nextLaunchUTC: next.toISOString(),
        countdownSeconds: Math.floor((next.getTime() - new Date().getTime()) / 1000),
    });
});
// Create HTTP server
const server = http.createServer(app);
// Battle Royale schedule (Perprug Contest) - runs at 00:00, 08:00, and 16:00 UTC daily
cron.schedule('0 0,8,16 * * *', () => {
    console.log('Starting scheduled Battle Royale tournament (Perprug Contest)...');
    runBattleRoyale().catch(err => console.error('Error starting scheduled Battle Royale tournament (Perprug Contest):', err));
});
// Countdown logic
function getNextBattleRoyaleTime() {
    const now = new Date();
    const hours = [0, 8, 16]; // Scheduled times in UTC
    for (const hour of hours) {
        const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0));
        if (next > now)
            return next;
    }
    // If none left today, return next day's 00:00 UTC
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
}
function logNextLaunchCountdown() {
    const next = getNextBattleRoyaleTime();
    const now = new Date();
    const diffMs = next.getTime() - now.getTime();
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    console.log(`Next Battle Royale (Perprug Contest) starts in ${hours}h ${minutes}m ${seconds}s at ${next.toISOString()}`);
}
// Start 30-second interval live countdown
logNextLaunchCountdown();
setInterval(logNextLaunchCountdown, 30 * 1000);
// Start the server
const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`REST API available at http://localhost:${PORT}/api/battleRoyale`);
    console.log('Scheduled "Perprug Contest" (Battle Royale) will run at 00:00, 08:00, and 16:00 UTC daily.');
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
