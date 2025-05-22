// server.ts - Main Server Entry Point
import dotenv from 'dotenv';
import { runBattleRoyale } from './services/jobs/battleRoyal.js';
import { initializeSocketServer, startServer } from './services/socketServer.js';
// Load environment variables
dotenv.config();
// Initialize WebSocket server
const socketServer = initializeSocketServer();
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
    }
    catch (err) {
        console.error('Error during Battle Royale tournament test run:', err);
    }
})();
// Start the server
const PORT = process.env.PORT || 3000;
startServer(Number(PORT));
// Export server for testing
export default socketServer;
