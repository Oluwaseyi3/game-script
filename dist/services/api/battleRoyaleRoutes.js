import express from 'express';
import { registerPlayer, recordPlayerExit, runBattleRoyale } from '../jobs/battleRoyal.js';
import { readBattleRoyaleState } from '../../battleStateManager.js';
import { ethers } from "ethers";
const router = express.Router();
// Get current Battle Royale state
router.get('/status', async (req, res) => {
    try {
        const brState = await readBattleRoyaleState();
        // Remove sensitive info for public API
        const publicState = {
            isActive: brState.isActive,
            tournamentId: brState.tournamentId,
            startTime: brState.startTime,
            endTime: brState.endTime,
            playerCount: brState.players.length,
            maxPlayers: 100, // From your constants
            prizePool: brState.prizePool,
            winners: brState.winners.map((w) => ({
                wallet: w.wallet.slice(0, 4) + '...' + w.wallet.slice(-4), // Mask full address
                tier: w.tier,
                reward: w.reward,
                exitTimeToPull: w.exitTimeToPull
            }))
        };
        res.json({ success: true, data: publicState });
    }
    catch (error) {
        console.error('Error getting Battle Royale status:', error);
        res.status(500).json({ success: false, message: 'Failed to get tournament status' });
    }
});
router.post('/register', async (req, res) => {
    try {
        const { wallet, signature, message } = req.body;
        if (!wallet) {
            res.status(400).json({ success: false, message: 'Wallet address required' });
            return;
        }
        if (!signature) {
            res.status(400).json({ success: false, message: 'Signature required' });
            return;
        }
        // Standard message format to prevent replay attacks
        const expectedMessage = message || `Register for Battle Royale with address: ${wallet}`;
        try {
            // In ethers v6, verifyMessage is directly on the ethers object
            const recoveredAddress = ethers.verifyMessage(expectedMessage, signature);
            // Check if the recovered address matches the claimed wallet address
            if (recoveredAddress.toLowerCase() !== wallet.toLowerCase()) {
                res.status(401).json({
                    success: false,
                    message: 'Invalid signature'
                });
                return;
            }
        }
        catch (verificationError) {
            res.status(401).json({
                success: false,
                message: 'Signature verification failed'
            });
            return;
        }
        // If we get here, the signature is valid
        const result = await registerPlayer(wallet);
        res.json(result);
    }
    catch (error) {
        console.error('Error registering for Battle Royale:', error);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});
// Record player exit
router.post('/exit', async (req, res) => {
    try {
        const { wallet, exitTx } = req.body;
        if (!wallet || !exitTx) {
            res.status(400).json({
                success: false,
                message: 'Wallet address and exit transaction signature required'
            });
            return;
        }
        // Here you would verify the transaction proof
        const result = await recordPlayerExit(wallet, exitTx);
        res.json(result);
    }
    catch (error) {
        console.error('Error recording exit:', error);
        res.status(500).json({ success: false, message: 'Failed to record exit' });
    }
});
// Admin endpoint to start a new Battle Royale tournament
router.post('/start', async (req, res) => {
    try {
        const { adminKey } = req.body;
        // Simple admin verification - replace with proper auth
        if (adminKey !== process.env.ADMIN_API_KEY) {
            res.status(403).json({ success: false, message: 'Unauthorized' });
            return;
        }
        // Start a new tournament in the background
        runBattleRoyale().catch(err => console.error('[API] Error starting Battle Royale:', err));
        res.json({ success: true, message: 'Battle Royale tournament started' });
    }
    catch (error) {
        console.error('Error starting Battle Royale:', error);
        res.status(500).json({ success: false, message: 'Failed to start tournament' });
    }
});
// Get leaderboard of current or most recent tournament
router.get('/leaderboard', async (req, res) => {
    try {
        const brState = await readBattleRoyaleState();
        // Initialize leaderboard with the appropriate type
        let leaderboard = [];
        if (!brState.isActive && brState.winners.length > 0) {
            // Tournament ended with winners
            leaderboard = brState.winners
                .sort((a, b) => a.exitTimeToPull - b.exitTimeToPull)
                .map((winner, index) => ({
                rank: index + 1,
                wallet: winner.wallet.slice(0, 4) + '...' + winner.wallet.slice(-4),
                tier: winner.tier,
                reward: winner.reward,
                exitTimeToPull: winner.exitTimeToPull
            }));
        }
        else if (brState.isActive) {
            // Active tournament - show who has exited so far
            leaderboard = brState.players
                .filter((p) => p.exitTime !== null)
                .sort((a, b) => (b.exitTime ?? 0) - (a.exitTime ?? 0))
                .map((player, index) => ({
                rank: index + 1,
                wallet: player.wallet.slice(0, 4) + '...' + player.wallet.slice(-4),
                exitTime: player.exitTime
            }));
        }
        res.json({
            success: true,
            data: {
                tournamentId: brState.tournamentId,
                isActive: brState.isActive,
                leaderboard
            }
        });
    }
    catch (error) {
        console.error('Error getting leaderboard:', error);
        res.status(500).json({ success: false, message: 'Failed to get leaderboard' });
    }
});
export default router;
