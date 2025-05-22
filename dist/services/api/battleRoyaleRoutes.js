import express from 'express';
import { registerPlayer, recordPlayerExit, runBattleRoyale } from '../jobs/battleRoyal.js';
import { readBattleRoyaleState } from '../../battleStateManager.js';
import { ethers } from "ethers";
import { Connection, PublicKey } from "@solana/web3.js";
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
        const { wallet, transactionSignature, signature, message } = req.body;
        if (!wallet) {
            res.status(400).json({ success: false, message: 'Wallet address required' });
            return;
        }
        if (!transactionSignature) {
            res.status(400).json({
                success: false,
                message: 'Transaction signature required. Please send at least 0.1 SOL to the treasury wallet first.'
            });
            return;
        }
        // Optional: If you still want signature verification for additional security
        if (signature) {
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
        }
        // Register player with transaction verification
        const result = await registerPlayer(wallet, transactionSignature);
        res.json(result);
    }
    catch (error) {
        console.error('Error registering for Battle Royale:', error);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});
// Verify exit transaction (selling tokens back to SOL)
async function verifyExitTransaction(signature, playerWallet, tokenMint) {
    try {
        const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com");
        // Fetch the transaction details
        const transaction = await connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
        });
        if (!transaction) {
            return { success: false, reason: "Transaction not found" };
        }
        // Check if transaction was successful
        if (transaction.meta?.err) {
            return { success: false, reason: "Transaction failed on-chain" };
        }
        // Check that the transaction is recent (within last hour for exits)
        const ONE_HOUR_MS = 60 * 60 * 1000;
        const txTimestamp = transaction.blockTime ? transaction.blockTime * 1000 : 0;
        const currentTime = Date.now();
        if (currentTime - txTimestamp > ONE_HOUR_MS) {
            return {
                success: false,
                reason: "Exit transaction too old (must be within last hour)"
            };
        }
        // Get account keys properly for versioned transactions
        let accountKeys;
        if ('accountKeys' in transaction.transaction.message) {
            accountKeys = transaction.transaction.message.accountKeys;
        }
        else {
            accountKeys = transaction.transaction.message.getAccountKeys({
                accountKeysFromLookups: transaction.meta?.loadedAddresses
            }).keySegments().flat();
        }
        const playerPubkey = new PublicKey(playerWallet);
        // Look for the player's wallet in the transaction signers/accounts
        let playerInvolved = false;
        for (const key of accountKeys) {
            if (key.equals(playerPubkey)) {
                playerInvolved = true;
                break;
            }
        }
        if (!playerInvolved) {
            return {
                success: false,
                reason: "Player wallet not involved in this transaction"
            };
        }
        // Check token balance changes to verify they sold tokens
        const preTokenBalances = transaction.meta?.preTokenBalances || [];
        const postTokenBalances = transaction.meta?.postTokenBalances || [];
        // Find if player had tokens before and fewer/none after
        let hadTokensBefore = false;
        let hasFewerTokensAfter = false;
        for (const preBalance of preTokenBalances) {
            if (preBalance.mint === tokenMint &&
                preBalance.owner === playerWallet &&
                parseFloat(preBalance.uiTokenAmount.amount) > 0) {
                hadTokensBefore = true;
                // Find corresponding post balance
                const postBalance = postTokenBalances.find(post => post.mint === tokenMint && post.owner === playerWallet);
                const preAmount = parseFloat(preBalance.uiTokenAmount.amount);
                const postAmount = postBalance ? parseFloat(postBalance.uiTokenAmount.amount) : 0;
                if (postAmount < preAmount) {
                    hasFewerTokensAfter = true;
                }
                break;
            }
        }
        if (!hadTokensBefore) {
            return {
                success: false,
                reason: "Player had no tokens to sell"
            };
        }
        if (!hasFewerTokensAfter) {
            return {
                success: false,
                reason: "No token sale detected in transaction"
            };
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error verifying exit transaction:', error);
        return { success: false, reason: `Verification error: ${error.message}` };
    }
}
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
        // Get current tournament state to verify the token mint
        const brState = await readBattleRoyaleState();
        if (!brState.isActive) {
            res.status(400).json({
                success: false,
                message: 'No active tournament'
            });
            return;
        }
        if (!brState.tokenMint) {
            res.status(400).json({
                success: false,
                message: 'Tournament token not yet created'
            });
            return;
        }
        // Verify the exit transaction
        const txVerification = await verifyExitTransaction(exitTx, wallet, brState.tokenMint);
        if (!txVerification.success) {
            res.status(400).json({
                success: false,
                message: `Exit verification failed: ${txVerification.reason}`
            });
            return;
        }
        // Record the verified exit
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
