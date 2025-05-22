// services/jobs/battleRoyal.ts
import { MeteorClient } from "../blockchain/raydium/Meteora.js";
import { keypair, SOL_MINT, SOL_AMOUNT_TO_DEPOSIT_METEORA, perpTokenConfig, PERP_TOKEN_DEPOSIT_PERCENTAGE, BATTLE_ROYALE_BUY_IN, // Add this to constants (e.g. 0.2 SOL)
BATTLE_ROYALE_MAX_PLAYERS, // Add this to constants (e.g. 100)
BATTLE_ROYALE_DURATION, // Add this to constants (e.g. 30 * 60 * 1000) - 30 minutes
TREASURY_WALLET, // Add this to constants - your treasury wallet address
MIN_BUY_IN, // Add this to constants (e.g. 0.1 SOL)
 } from "../../constants.js";
import { sleep } from "../../utils.js";
import { readState, readBattleRoyaleState, writeBattleRoyaleState } from "../../battleStateManager.js";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { io } from "../socketServer.js";
// Utility
const timestamp = () => `[${new Date().toISOString()}]`;
/**
 * Verify a Solana transaction meets the Battle Royale buy-in requirements
 * @param signature Transaction signature to verify
 * @param playerWallet The player's wallet address
 * @returns Promise with verification result
 */
async function verifyBuyInTransaction(signature, playerWallet) {
    try {
        // Connect to Solana network
        const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com");
        // Fetch the transaction details
        const transaction = await connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
        });
        // Check if transaction exists
        if (!transaction) {
            return { success: false, reason: "Transaction not found" };
        }
        // Check transaction timestamp - 2 days = 48 hours = 172,800,000 milliseconds
        const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
        const txTimestamp = transaction.blockTime ? transaction.blockTime * 1000 : 0;
        const currentTime = Date.now();
        if (currentTime - txTimestamp > TWO_DAYS_MS) {
            const hoursOld = Math.floor((currentTime - txTimestamp) / (60 * 60 * 1000));
            return {
                success: false,
                reason: `Transaction too old (${hoursOld} hours old, maximum age is 48 hours)`
            };
        }
        // Convert addresses to PublicKey objects
        const fromPubkey = new PublicKey(playerWallet);
        const toPubkey = new PublicKey(TREASURY_WALLET);
        // The minimum amount in lamports (SOL's smallest unit)
        const minLamports = MIN_BUY_IN * LAMPORTS_PER_SOL;
        // Check for a valid transfer by examining account changes
        const preBalances = transaction.meta?.preBalances || [];
        const postBalances = transaction.meta?.postBalances || [];
        // Get account keys properly for versioned transactions
        let accountKeys;
        if ('accountKeys' in transaction.transaction.message) {
            // Legacy transaction
            accountKeys = transaction.transaction.message.accountKeys;
        }
        else {
            // Versioned transaction - we need to get the account keys from the loaded addresses
            accountKeys = transaction.transaction.message.getAccountKeys({
                accountKeysFromLookups: transaction.meta?.loadedAddresses
            }).keySegments().flat();
        }
        // Find the indices of the from and to accounts
        let fromIndex = -1;
        let toIndex = -1;
        for (let i = 0; i < accountKeys.length; i++) {
            if (accountKeys[i].equals(fromPubkey)) {
                fromIndex = i;
            }
            if (accountKeys[i].equals(toPubkey)) {
                toIndex = i;
            }
        }
        let foundValidTransfer = false;
        if (fromIndex !== -1 && toIndex !== -1) {
            // Calculate the SOL transferred
            const fromBalanceChange = preBalances[fromIndex] - postBalances[fromIndex];
            const toBalanceChange = postBalances[toIndex] - preBalances[toIndex];
            // Check if the transfer amount meets our minimum requirement
            // We check the recipient's balance increase to be more accurate
            if (toBalanceChange >= minLamports) {
                foundValidTransfer = true;
            }
        }
        if (!foundValidTransfer) {
            return {
                success: false,
                reason: `No valid transfer of at least ${MIN_BUY_IN} SOL from player to treasury found`
            };
        }
        // Check if transaction was successful
        if (transaction.meta?.err) {
            return { success: false, reason: "Transaction failed on-chain" };
        }
        // All checks passed
        return { success: true };
    }
    catch (error) {
        console.error(`${timestamp()} Error verifying transaction:`, error);
        return { success: false, reason: `Verification error: ${error.message}` };
    }
}
// Initialize a new Battle Royale tournament
async function initBattleRoyale() {
    console.log(`${timestamp()} Initializing new Battle Royale tournament...`);
    const state = await readState();
    const meteoraClient = new MeteorClient(keypair.secretKey);
    // Create a unique tournament ID
    const tournamentId = `BR-${state.iteration}-${Date.now()}`;
    // Initialize tournament state
    const battleRoyaleState = {
        isActive: true,
        tournamentId,
        tokenMint: null,
        poolId: null,
        positionId: null,
        startTime: null,
        endTime: null,
        players: [],
        prizePool: 0,
        winners: [],
        liquidityWithdrawn: false
    };
    await writeBattleRoyaleState(battleRoyaleState);
    console.log(`${timestamp()} Battle Royale tournament initialized with ID: ${tournamentId}`);
    return battleRoyaleState;
}
// Handle player registration for Battle Royale
export async function registerPlayer(playerWallet, transactionSignature // New parameter to receive transaction signature
) {
    const brState = await readBattleRoyaleState();
    // Check if tournament is active
    if (!brState.isActive) {
        return { success: false, message: "No active tournament" };
    }
    // Check if max players reached
    if (brState.players.length >= BATTLE_ROYALE_MAX_PLAYERS) {
        return { success: false, message: "Tournament is full" };
    }
    // Check if player already registered
    const playerExists = brState.players.some((p) => p.wallet === playerWallet);
    if (playerExists) {
        return { success: false, message: "Already registered" };
    }
    try {
        // Verify the transaction if signature is provided
        if (!transactionSignature) {
            return {
                success: false,
                message: `Please deposit at least ${MIN_BUY_IN} SOL to ${TREASURY_WALLET} to join the tournament`
            };
        }
        // Verify the transaction meets all requirements
        const txVerification = await verifyBuyInTransaction(transactionSignature, playerWallet);
        if (!txVerification.success) {
            return {
                success: false,
                message: `Transaction verification failed: ${txVerification.reason}`
            };
        }
        // If verification passed, add player to tournament
        brState.players.push({
            wallet: playerWallet,
            entryTime: Date.now(),
            exitTime: null,
            exitTx: null,
            buyInTx: transactionSignature // Store the transaction signature
        });
        // Update prize pool
        brState.prizePool += BATTLE_ROYALE_BUY_IN;
        await writeBattleRoyaleState(brState);
        return {
            success: true,
            message: `Successfully registered for tournament ${brState.tournamentId}`
        };
    }
    catch (error) {
        console.error(`${timestamp()} Error registering player:`, error);
        return { success: false, message: "Registration failed" };
    }
}
// Handle player exiting before the rugpull
export async function recordPlayerExit(playerWallet, exitTx) {
    const brState = await readBattleRoyaleState();
    // Check if tournament is active
    if (!brState.isActive) {
        return { success: false, message: "No active tournament" };
    }
    // Find player
    const playerIndex = brState.players.findIndex((p) => p.wallet === playerWallet);
    if (playerIndex === -1) {
        return { success: false, message: "Player not registered" };
    }
    // Check if player already exited
    if (brState.players[playerIndex].exitTime !== null) {
        return { success: false, message: "Already exited" };
    }
    // Record exit time
    const exitTime = Date.now();
    brState.players[playerIndex].exitTime = exitTime;
    brState.players[playerIndex].exitTx = exitTx;
    await writeBattleRoyaleState(brState);
    return {
        success: true,
        message: `Exit recorded at ${new Date(exitTime).toISOString()}`
    };
}
async function calculateWinners(rugpullTime) {
    const brState = await readBattleRoyaleState();
    // Filter players who exited before rugpull
    const successfulPlayers = brState.players.filter((p) => p.exitTime !== null && p.exitTime < rugpullTime);
    if (successfulPlayers.length === 0) {
        console.log(`${timestamp()} No winners in this tournament.`);
        return []; // Return empty array instead of undefined
    }
    // Sort by exit time (closest to rugpull first)
    successfulPlayers.sort((a, b) => {
        const timeToRugpullA = rugpullTime - (a.exitTime || 0);
        const timeToRugpullB = rugpullTime - (b.exitTime || 0);
        return timeToRugpullA - timeToRugpullB;
    });
    const winners = [];
    // Distribute rewards based on tiers
    const prizePool = brState.prizePool;
    // Diamond Nerves (last 30 seconds): 40% of the pool
    const diamondCutoff = rugpullTime - 30000;
    const diamondWinners = successfulPlayers.filter((p) => (p.exitTime || 0) >= diamondCutoff);
    // Platinum Nerves (30-60 seconds before): 30% of the pool
    const platinumCutoff = rugpullTime - 60000;
    const platinumWinners = successfulPlayers.filter((p) => (p.exitTime || 0) >= platinumCutoff && (p.exitTime || 0) < diamondCutoff);
    // Gold Nerves (60-120 seconds before): 20% of the pool
    const goldCutoff = rugpullTime - 120000;
    const goldWinners = successfulPlayers.filter((p) => (p.exitTime || 0) >= goldCutoff && (p.exitTime || 0) < platinumCutoff);
    // Silver Nerves (all other successful exits): 10% of the pool
    const silverWinners = successfulPlayers.filter((p) => (p.exitTime || 0) < goldCutoff);
    // Calculate individual rewards
    if (diamondWinners.length > 0) {
        const diamondShare = prizePool * 0.4;
        const individualDiamondReward = diamondShare / diamondWinners.length;
        diamondWinners.forEach((player) => {
            winners.push({
                wallet: player.wallet,
                tier: "Diamond",
                reward: individualDiamondReward,
                exitTimeToPull: rugpullTime - (player.exitTime || 0)
            });
        });
    }
    if (platinumWinners.length > 0) {
        const platinumShare = prizePool * 0.3;
        const individualPlatinumReward = platinumShare / platinumWinners.length;
        platinumWinners.forEach((player) => {
            winners.push({
                wallet: player.wallet,
                tier: "Platinum",
                reward: individualPlatinumReward,
                exitTimeToPull: rugpullTime - (player.exitTime || 0)
            });
        });
    }
    if (goldWinners.length > 0) {
        const goldShare = prizePool * 0.2;
        const individualGoldReward = goldShare / goldWinners.length;
        goldWinners.forEach((player) => {
            winners.push({
                wallet: player.wallet,
                tier: "Gold",
                reward: individualGoldReward,
                exitTimeToPull: rugpullTime - (player.exitTime || 0)
            });
        });
    }
    if (silverWinners.length > 0) {
        const silverShare = prizePool * 0.1;
        const individualSilverReward = silverShare / silverWinners.length;
        silverWinners.forEach((player) => {
            winners.push({
                wallet: player.wallet,
                tier: "Silver",
                reward: individualSilverReward,
                exitTimeToPull: rugpullTime - (player.exitTime || 0)
            });
        });
    }
    // Update state with winners
    brState.winners = winners;
    await writeBattleRoyaleState(brState);
    console.log(`${timestamp()} Winners calculated:`, winners.length);
    // Return the winners array
    return winners;
}
// Execute Battle Royale tournament 
export async function runBattleRoyale() {
    console.log(`${timestamp()} Starting Battle Royale tournament...`);
    // Initialize new tournament
    const brState = await initBattleRoyale();
    const meteoraClient = new MeteorClient(keypair.secretKey);
    // --- Step 1: Create the Battle Royale token ---
    const state = await readState();
    const tokenSymbol = `BPERP${state.iteration}`;
    const tokenName = "BATTLE PERPRUG";
    const tokenConfig = {
        ...perpTokenConfig,
        name: tokenName,
        symbol: tokenSymbol,
    };
    try {
        console.log(`${timestamp()} Creating Battle Royale token ${tokenSymbol}...`);
        const { mintAddress, txId } = await meteoraClient.createTokenWithMetadata(tokenConfig);
        if (!mintAddress || !txId)
            throw new Error("Invalid token creation result.");
        brState.tokenMint = mintAddress;
        await writeBattleRoyaleState(brState);
        console.log(`${timestamp()} Battle Royale token created: ${mintAddress}. Tx: ${txId}`);
    }
    catch (err) {
        console.error(`${timestamp()} Battle Royale token creation failed:`, err);
        brState.isActive = false;
        await writeBattleRoyaleState(brState);
        throw err;
    }
    await sleep(5000); // Ensure token is propagated
    // --- Step 2: Create Meteora Pool ---
    const tokenA = brState.tokenMint;
    const tokenB = SOL_MINT;
    const mintAamount = Math.floor(perpTokenConfig.supply * PERP_TOKEN_DEPOSIT_PERCENTAGE);
    const mintBamount = SOL_AMOUNT_TO_DEPOSIT_METEORA;
    try {
        console.log(`${timestamp()} Creating Battle Royale pool...`);
        const { poolId, positionId, txId } = await meteoraClient.createPool({
            tokenA,
            tokenB,
            mintAamount,
            mintBamount,
        });
        if (!poolId || !positionId || !txId)
            throw new Error("Invalid pool creation result.");
        brState.poolId = poolId;
        brState.positionId = positionId;
        await writeBattleRoyaleState(brState);
        console.log(`${timestamp()} Battle Royale pool created: Pool ID = ${poolId}. Tx: ${txId}`);
    }
    catch (err) {
        console.error(`${timestamp()} Battle Royale pool creation failed:`, err);
        brState.isActive = false;
        await writeBattleRoyaleState(brState);
        throw err;
    }
    // --- Step 3: Set tournament start and end time ---
    const startTime = Date.now();
    const endTime = startTime + BATTLE_ROYALE_DURATION;
    brState.startTime = startTime;
    brState.endTime = endTime;
    await writeBattleRoyaleState(brState);
    console.log(`${timestamp()} Battle Royale tournament started at ${new Date(startTime).toISOString()}`);
    console.log(`${timestamp()} Tournament will end at ${new Date(endTime).toISOString()}`);
    // --- Step 4: Schedule rugpull ---
    const delay = BATTLE_ROYALE_DURATION;
    console.log(`${timestamp()} Scheduling Battle Royale rugpull in ${(delay / 60000).toFixed(1)} minutes`);
    setTimeout(async () => {
        try {
            // Execute rugpull
            console.log(`${timestamp()} Executing Battle Royale rugpull...`);
            // Withdraw liquidity
            await meteoraClient.removeAllLiquidity(brState.poolId, brState.positionId);
            console.log(`${timestamp()} Liquidity removed from Battle Royale pool ${brState.poolId}`);
            brState.liquidityWithdrawn = true;
            await writeBattleRoyaleState(brState);
            // Calculate rugpull time (slightly earlier than now to ensure we catch all valid exits)
            const rugpullTime = Date.now() - 1000;
            // Calculate winners
            await calculateWinners(rugpullTime);
            // End tournament
            brState.isActive = false;
            await writeBattleRoyaleState(brState);
            console.log(`${timestamp()} Battle Royale tournament ${brState.tournamentId} completed`);
            // Distribute rewards to winners (implement this part for your application)
            // This would connect to your frontend to allow winners to claim rewards
        }
        catch (err) {
            console.error(`${timestamp()} Battle Royale rugpull failed:`, err);
            // Even if rugpull fails, end the tournament
            brState.isActive = false;
            await writeBattleRoyaleState(brState);
        }
    }, delay);
    // Optional: Add "tremors" (small liquidity fluctuations) during the tournament
    // scheduleRugpullTremors(brState.poolId!, brState.positionId!, startTime, endTime);
    return brState;
}
// Check if a player is registered for the current tournament
export async function checkPlayerRegistration(tournamentId, wallet) {
    try {
        const brState = await readBattleRoyaleState();
        // Check if tournament exists and matches
        if (brState.tournamentId !== tournamentId) {
            return {
                success: false,
                registered: false,
                hasExited: false
            };
        }
        // Find player
        const player = brState.players.find((p) => p.wallet === wallet);
        return {
            success: true,
            registered: !!player,
            hasExited: player ? player.exitTime !== null : false
        };
    }
    catch (error) {
        console.error(`Error checking player registration:`, error);
        return {
            success: false,
            registered: false,
            hasExited: false
        };
    }
}
// Get leaderboard for current tournament
export async function getLeaderboard() {
    try {
        const brState = await readBattleRoyaleState();
        // For active tournaments, sort by exit time (newest first)
        if (brState.isActive) {
            // Get players who have exited
            const exitedPlayers = brState.players
                .filter((p) => p.exitTime !== null)
                .sort((a, b) => (b.exitTime || 0) - (a.exitTime || 0))
                .map((player, index) => {
                // Calculate time since exit for display
                const timeSinceExit = player.exitTime ?
                    Math.floor((Date.now() - player.exitTime) / 1000) : 0;
                return {
                    rank: index + 1,
                    wallet: player.wallet.slice(0, 4) + '...' + player.wallet.slice(-4),
                    exitTimeAgo: `${timeSinceExit}s ago`,
                    exitTime: player.exitTime
                };
            });
            return {
                success: true,
                tournamentId: brState.tournamentId,
                isActive: true,
                leaderboard: exitedPlayers
            };
        }
        else {
            const leaderboard = brState.winners
                .sort((a, b) => {
                // First sort by tier (Diamond > Platinum > Gold > Silver)
                const tierOrder = { "Diamond": 0, "Platinum": 1, "Gold": 2, "Silver": 3 };
                // Assert that a.tier and b.tier are valid tier keys
                const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
                if (tierDiff !== 0)
                    return tierDiff;
                // Then sort by exit time proximity to rugpull
                return a.exitTimeToPull - b.exitTimeToPull;
            })
                .map((winner, index) => ({
                rank: index + 1,
                wallet: winner.wallet.slice(0, 4) + '...' + winner.wallet.slice(-4),
                tier: winner.tier,
                reward: winner.reward.toFixed(4) + " SOL",
                exitTimeToPull: formatTimeDifference(winner.exitTimeToPull)
            }));
            return {
                success: true,
                tournamentId: brState.tournamentId,
                isActive: false,
                leaderboard
            };
        }
    }
    catch (error) {
        console.error('Error getting leaderboard:', error);
        return {
            success: false,
            tournamentId: '',
            isActive: false,
            leaderboard: []
        };
    }
}
// Helper function to format time difference in a readable way
function formatTimeDifference(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    if (ms < 60000)
        return `${Math.floor(ms / 1000)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}
// Force end a tournament (admin function)
export async function forceEndTournament(adminKey) {
    // Verify admin key
    if (adminKey !== process.env.ADMIN_API_KEY) {
        return { success: false, message: "Unauthorized" };
    }
    try {
        const brState = await readBattleRoyaleState();
        if (!brState.isActive) {
            return { success: false, message: "No active tournament" };
        }
        // Mark tournament as inactive
        brState.isActive = false;
        brState.endTime = Date.now();
        await writeBattleRoyaleState(brState);
        // Try to withdraw liquidity if it hasn't been done yet
        if (!brState.liquidityWithdrawn && brState.poolId && brState.positionId) {
            try {
                const meteoraClient = new MeteorClient(keypair.secretKey);
                await meteoraClient.removeAllLiquidity(brState.poolId, brState.positionId);
                brState.liquidityWithdrawn = true;
                await writeBattleRoyaleState(brState);
                console.log(`${timestamp()} Liquidity removed from Battle Royale pool ${brState.poolId}`);
            }
            catch (err) {
                console.error(`${timestamp()} Error removing liquidity during force end:`, err);
            }
        }
        // Calculate winners based on current time
        const winners = await calculateWinners(brState.endTime);
        brState.winners = winners;
        await writeBattleRoyaleState(brState);
        // Broadcast tournament ending
        io.to(`tournament-${brState.tournamentId}`).emit('tournamentEnded', {
            tournamentId: brState.tournamentId,
            endTime: brState.endTime,
            forcedEnd: true
        });
        return {
            success: true,
            message: `Tournament ${brState.tournamentId} force ended`
        };
    }
    catch (error) {
        console.error('Error force ending tournament:', error);
        return { success: false, message: "Failed to force end tournament" };
    }
}
export default {
    runBattleRoyale,
    registerPlayer,
    recordPlayerExit,
    getLeaderboard,
    checkPlayerRegistration,
    forceEndTournament
};
