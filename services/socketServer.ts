// services/socketServer.ts - WebSocket Server for Real-Time Updates

import { Server } from 'socket.io';
import http from 'http';
import { readBattleRoyaleState } from '../battleStateManager.js';
import express from 'express';
import battleRoyaleRoutes from './api/battleRoyaleRoutes.js';

// Create Express app
const app = express();
app.use(express.json());

// Use Battle Royale routes
app.use('/api/battle-royale', battleRoyaleRoutes);

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO server
export const io = new Server(server, {
    cors: {
        origin: '*', // In production, limit this to your frontend domain
        methods: ['GET', 'POST']
    }
});

// Initialize WebSocket server
export function initializeSocketServer() {
    // Set up Socket.IO connection handler
    io.on('connection', async (socket) => {
        console.log('Client connected:', socket.id);

        // Send current tournament status on connection
        try {
            const brState = await readBattleRoyaleState();

            socket.emit('tournamentStatus', {
                isActive: brState.isActive,
                tournamentId: brState.tournamentId,
                startTime: brState.startTime,
                endTime: brState.endTime,
                playerCount: brState.players.length,
                exitedCount: brState.players.filter((p: any) => p.exitTime !== null).length
            });
        } catch (error) {
            console.error('Error sending tournament status on connection:', error);
        }

        // Join tournament room
        socket.on('joinTournament', async (tournamentId) => {
            try {
                // Verify tournament exists and is active
                const brState = await readBattleRoyaleState();

                if (brState.tournamentId === tournamentId) {
                    socket.join(`tournament-${tournamentId}`);
                    console.log(`Client ${socket.id} joined tournament ${tournamentId}`);

                    // Send initial data
                    const tournamentData = {
                        id: brState.tournamentId,
                        status: brState.isActive ? 'active' : 'ended',
                        playerCount: brState.players.length,
                        exitedCount: brState.players.filter((p: any) => p.exitTime !== null).length,
                        startTime: brState.startTime,
                        endTime: brState.endTime,

                    };

                    socket.emit('tournamentData', tournamentData);

                    // Send recent exits (last 10)
                    const recentExits = brState.players
                        .filter((p: any) => p.exitTime !== null)
                        .sort((a: any, b: any) => (b.exitTime || 0) - (a.exitTime || 0))
                        .slice(0, 10)
                        .map((player: any) => ({
                            wallet: player.wallet.slice(0, 4) + '...' + player.wallet.slice(-4),
                            exitTimeAgo: Math.floor((Date.now() - (player.exitTime || 0)) / 1000) + 's ago'
                        }));

                    socket.emit('recentExits', recentExits);
                } else {
                    socket.emit('error', { message: 'Tournament not found or not active' });
                }
            } catch (error) {
                console.error('Error joining tournament room:', error);
                socket.emit('error', { message: 'Failed to join tournament' });
            }
        });

        // Register for notifications about specific wallet activity
        socket.on('watchWallet', (wallet) => {
            socket.join(`wallet-${wallet}`);
            console.log(`Client ${socket.id} watching wallet ${wallet}`);
        });

        // Handle client disconnection
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    return server;
}

// Start the server
export function startServer(port = 3000) {
    server.listen(port, () => {
        console.log(`Server running with WebSockets on port ${port}`);
    });

    return server;
}

export default {
    io,
    initializeSocketServer,
    startServer,
    app,
    server
};