// socketServer.js - Updated to work with Express server
import { Server } from 'socket.io';
import http from 'http';

let io;

export function initializeSocketServer(httpServer) {
    // If httpServer is provided, use it; otherwise create a new one
    if (httpServer) {
        io = new Server(httpServer, {
            cors: {
                origin: "*", // Configure this for production
                methods: ["GET", "POST"]
            }
        });
    } else {
        // Fallback: create standalone server (for backward compatibility)
        const server = http.createServer();
        io = new Server(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        // Start standalone server on different port
        const SOCKET_PORT = process.env.SOCKET_PORT || 3001;
        server.listen(SOCKET_PORT, () => {
            console.log(`Standalone WebSocket server listening on port ${SOCKET_PORT}`);
        });
    }

    // Socket.io event handlers
    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });

        // Add your other socket events here
    });

    return io;
}

// Export the io instance for use in other modules
export function getIO() {
    if (!io) {
        throw new Error('Socket.io not initialized! Call initializeSocketServer first.');
    }
    return io;
}

// If you have a startServer function, update it
export function startServer(port) {
    console.log('Note: startServer is deprecated when using shared HTTP server');
    // This function might not be needed anymore if using shared server
}