// meteor_client.ts
import anchorPkg from "@coral-xyz/anchor";
const { BN } = anchorPkg;
// Keep all other imports the same
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { createSignerFromKeypair, generateSigner, percentAmount, signerIdentity, } from "@metaplex-foundation/umi";
import { createAndMint, mplTokenMetadata, TokenStandard, } from "@metaplex-foundation/mpl-token-metadata";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
// import { BN } from "@coral-xyz/anchor"; <- Remove this
import { rpcConnection, SOLANA_RPC_URL, TOKENA_PROGRAM_ID, TOKENB_PROGRAM_ID, } from "../../../constants.js";
import { CpAmm, derivePoolAddress, derivePositionAddress, derivePositionNftAccount, } from "@meteora-ag/cp-amm-sdk";
import { AuthorityType, createSetAuthorityInstruction, } from "@solana/spl-token";
import { sleep, uploadMetadata } from "../../../utils.js";
const SHOULD_REVOKE_AUTHORITY = true;
export class MeteorClient {
    constructor(walletSecret) {
        this.connection = rpcConnection;
        this.wallet = Keypair.fromSecretKey(Uint8Array.from(walletSecret));
        // Initialize Umi for token creation
        this.umi = createUmi(SOLANA_RPC_URL).use(mplTokenMetadata());
        const userWallet = this.umi.eddsa.createKeypairFromSecretKey(new Uint8Array(walletSecret));
        const userWalletSigner = createSignerFromKeypair(this.umi, userWallet);
        this.umi.use(signerIdentity(userWalletSigner));
        // Initialize the Meteor CP-AMM SDK
        this.cpAmm = new CpAmm(this.connection);
    }
    /**
     * Create a new SPL token mint and attach metadata
     * @param opts - Token options including name, symbol, supply, etc.
     * @returns PublicKey of the new mint and transaction ID
     */
    // async createTokenWithMetadata(opts: {
    //   name: string;
    //   symbol: string;
    //   decimals?: number;
    //   supply?: number;
    //   description?: string;
    //   image?: string;
    //   twitter?: string;
    //   telegram?: string;
    //   website?: string;
    // }) {
    //   try {
    //     const mint = generateSigner(this.umi);
    //     // Prepare metadata
    //     const metadata = {
    //       name: opts.name,
    //       symbol: opts.symbol,
    //       description: opts.description,
    //       image: opts.image,
    //       website: opts.website,
    //       twitter: opts.twitter,
    //       telegram: opts.telegram,
    //     };
    //     // Calculate token supply with decimals
    //     const totalSupplyWithDecimals = new BN(opts.supply || 10000000000)
    //       .mul(new BN(10).pow(new BN(opts.decimals || 9)))
    //       .toString();
    //     const uri = await uploadMetadata(metadata);
    //     // Create token with metadata and mint the supply
    //     const tx = await createAndMint(this.umi, {
    //       mint,
    //       authority: this.umi.identity,
    //       name: opts.name,
    //       symbol: opts.symbol,
    //       uri: uri,
    //       sellerFeeBasisPoints: percentAmount(0),
    //       decimals: opts.decimals || 9,
    //       amount: BigInt(totalSupplyWithDecimals),
    //       //@ts-ignore
    //       tokenOwner: this.wallet.publicKey,
    //       tokenStandard: TokenStandard.Fungible,
    //     }).send(this.umi);
    //     console.log(`Successfully minted tokens (${mint.publicKey})`);
    //     await sleep(8000);
    //     if (SHOULD_REVOKE_AUTHORITY) {
    //       const revokeTransaction = new Transaction();
    //       revokeTransaction.add(
    //         createSetAuthorityInstruction(
    //           new PublicKey(mint.publicKey.toString()),
    //           this.wallet.publicKey,
    //           AuthorityType.MintTokens,
    //           null
    //         )
    //       );
    //       // Add instruction to revoke freeze authority
    //       revokeTransaction.add(
    //         createSetAuthorityInstruction(
    //           new PublicKey(mint.publicKey.toString()),
    //           this.wallet.publicKey,
    //           AuthorityType.FreezeAccount,
    //           null
    //         )
    //       );
    //       // Sign and send the transaction
    //       const revokeAuthorityTxId = await this.signAndBroadcastTx(
    //         revokeTransaction
    //       );
    //       console.log(
    //         `Successfully revoked mint and freeze authorities (${mint.publicKey})`
    //       );
    //     }
    //     return {
    //       mintAddress: mint.publicKey.toString(),
    //       txId: tx,
    //     };
    //   } catch (error) {
    //     console.error("Error minting tokens:", error);
    //     throw error;
    //   }
    // }
    // async createTokenWithMetadata(opts: {
    //   name: string;
    //   symbol: string;
    //   decimals?: number;
    //   supply?: number;
    //   description?: string;
    //   image?: string;
    //   twitter?: string;
    //   telegram?: string;
    //   website?: string;
    // }) {
    //   try {
    //     const mint = generateSigner(this.umi);
    //     // Prepare metadata
    //     const metadata = {
    //       name: opts.name,
    //       symbol: opts.symbol,
    //       description: opts.description,
    //       image: opts.image,
    //       website: opts.website,
    //       twitter: opts.twitter,
    //       telegram: opts.telegram,
    //     };
    //     // Calculate token supply with decimals
    //     const totalSupplyWithDecimals = new BN(opts.supply || 10000000000)
    //       .mul(new BN(10).pow(new BN(opts.decimals || 9)))
    //       .toString();
    //     const uri = await uploadMetadata(metadata);
    //     // Create token with metadata and mint the supply
    //     const tx = await createAndMint(this.umi, {
    //       mint,
    //       authority: this.umi.identity,
    //       name: opts.name,
    //       symbol: opts.symbol,
    //       uri: uri,
    //       sellerFeeBasisPoints: percentAmount(0),
    //       decimals: opts.decimals || 9,
    //       amount: BigInt(totalSupplyWithDecimals),
    //       //@ts-ignore
    //       tokenOwner: this.wallet.publicKey,
    //       tokenStandard: TokenStandard.Fungible,
    //     }).send(this.umi);
    //     console.log(`Successfully minted tokens (${mint.publicKey})`);
    //     await sleep(8000);
    //     if (SHOULD_REVOKE_AUTHORITY) {
    //       const revokeTransaction = new Transaction();
    //       // Convert UMI identity to regular PublicKey for the authority
    //       const currentAuthority = new PublicKey(this.umi.identity.publicKey.toString());
    //       revokeTransaction.add(
    //         createSetAuthorityInstruction(
    //           new PublicKey(mint.publicKey.toString()),
    //           currentAuthority,  // <-- Use UMI identity as current authority
    //           AuthorityType.MintTokens,
    //           null
    //         )
    //       );
    //       // Add instruction to revoke freeze authority
    //       revokeTransaction.add(
    //         createSetAuthorityInstruction(
    //           new PublicKey(mint.publicKey.toString()),
    //           currentAuthority,  // <-- Use UMI identity as current authority
    //           AuthorityType.FreezeAccount,
    //           null
    //         )
    //       );
    //       // Sign and send the transaction
    //       const revokeAuthorityTxId = await this.signAndBroadcastTx(
    //         revokeTransaction
    //       );
    //       console.log(
    //         `Successfully revoked mint and freeze authorities (${mint.publicKey})`
    //       );
    //     }
    //     return {
    //       mintAddress: mint.publicKey.toString(),
    //       txId: tx,
    //     };
    //   } catch (error) {
    //     console.error("Error minting tokens:", error);
    //     throw error;
    //   }
    // }
    /**
   * Create a new SPL token mint and attach metadata
   * @param opts - Token options including name, symbol, supply, etc.
   * @returns PublicKey of the new mint and transaction ID
   */
    // async createTokenWithMetadata(opts: {
    //   name: string;
    //   symbol: string;
    //   decimals?: number;
    //   supply?: number;
    //   description?: string;
    //   image?: string;
    //   twitter?: string;
    //   telegram?: string;
    //   website?: string;
    // }) {
    //   try {
    //     const mint = generateSigner(this.umi);
    //     // Prepare metadata
    //     const metadata = {
    //       name: opts.name,
    //       symbol: opts.symbol,
    //       description: opts.description,
    //       image: opts.image,
    //       website: opts.website,
    //       twitter: opts.twitter,
    //       telegram: opts.telegram,
    //     };
    //     // Calculate token supply with decimals
    //     const totalSupplyWithDecimals = new BN(opts.supply || 10000000000)
    //       .mul(new BN(10).pow(new BN(opts.decimals || 9)))
    //       .toString();
    //     const uri = await uploadMetadata(metadata);
    //     // Create token with metadata and mint the supply
    //     const tx = await createAndMint(this.umi, {
    //       mint,
    //       authority: this.umi.identity,
    //       name: opts.name,
    //       symbol: opts.symbol,
    //       uri: uri,
    //       sellerFeeBasisPoints: percentAmount(0),
    //       decimals: opts.decimals || 9,
    //       amount: BigInt(totalSupplyWithDecimals),
    //       //@ts-ignore
    //       tokenOwner: this.wallet.publicKey,
    //       tokenStandard: TokenStandard.Fungible,
    //     }).send(this.umi);
    //     console.log(`Successfully minted tokens (${mint.publicKey})`);
    //     await sleep(8000);
    //     if (SHOULD_REVOKE_AUTHORITY) {
    //       // Get the mint account info to confirm the current mint authority
    //       const mintInfo = await this.connection.getAccountInfo(new PublicKey(mint.publicKey.toString()));
    //       if (!mintInfo) {
    //         throw new Error("Mint account not found");
    //       }
    //       // Create a transaction to revoke mint and freeze authorities
    //       const revokeTransaction = new Transaction();
    //       // Use the wallet public key as the current authority
    //       // This is the key that signed the mint creation transaction via UMI
    //       revokeTransaction.add(
    //         createSetAuthorityInstruction(
    //           new PublicKey(mint.publicKey.toString()),
    //           this.wallet.publicKey,  // Use wallet public key as current authority
    //           AuthorityType.MintTokens,
    //           null
    //         )
    //       );
    //       // Add instruction to revoke freeze authority
    //       revokeTransaction.add(
    //         createSetAuthorityInstruction(
    //           new PublicKey(mint.publicKey.toString()),
    //           this.wallet.publicKey,  // Use wallet public key as current authority
    //           AuthorityType.FreezeAccount,
    //           null
    //         )
    //       );
    //       // Sign and send the transaction
    //       const revokeAuthorityTxId = await this.signAndBroadcastTx(
    //         revokeTransaction
    //       );
    //       console.log(
    //         `Successfully revoked mint and freeze authorities (${mint.publicKey})`
    //       );
    //     }
    //     return {
    //       mintAddress: mint.publicKey.toString(),
    //       txId: tx,
    //     };
    //   } catch (error) {
    //     console.error("Error minting tokens:", error);
    //     throw error;
    //   }
    // }
    async createTokenWithMetadata(opts) {
        try {
            const mint = generateSigner(this.umi);
            // Prepare metadata
            const metadata = {
                name: opts.name,
                symbol: opts.symbol,
                description: opts.description,
                image: opts.image,
                website: opts.website,
                twitter: opts.twitter,
                telegram: opts.telegram,
            };
            // Calculate token supply with decimals
            const totalSupplyWithDecimals = new BN(opts.supply || 10000000000)
                .mul(new BN(10).pow(new BN(opts.decimals || 9)))
                .toString();
            const uri = await uploadMetadata(metadata);
            // Create token with metadata and mint the supply
            const tx = await createAndMint(this.umi, {
                mint,
                authority: this.umi.identity,
                name: opts.name,
                symbol: opts.symbol,
                uri: uri,
                sellerFeeBasisPoints: percentAmount(0),
                decimals: opts.decimals || 9,
                amount: BigInt(totalSupplyWithDecimals),
                //@ts-ignore
                tokenOwner: this.wallet.publicKey,
                tokenStandard: TokenStandard.Fungible,
            }).send(this.umi);
            console.log(`Successfully minted tokens (${mint.publicKey})`);
            // Add a longer delay to ensure network propagation - increased from 8 to 15 seconds
            await sleep(15000);
            if (SHOULD_REVOKE_AUTHORITY) {
                // Implement a retry mechanism for getting the mint account info
                const maxAttempts = 5;
                let mintInfo = null;
                let attempt = 0;
                while (attempt < maxAttempts) {
                    try {
                        // Get the mint account info to confirm the current mint authority
                        mintInfo = await this.connection.getAccountInfo(new PublicKey(mint.publicKey.toString()));
                        if (mintInfo) {
                            // Found the account, break out of retry loop
                            break;
                        }
                        console.log(`Mint account not yet available, attempt ${attempt + 1}/${maxAttempts}`);
                    }
                    catch (e) {
                        console.log(`Error fetching mint account, attempt ${attempt + 1}/${maxAttempts}:`, e);
                    }
                    // Increase delay between retries
                    await sleep(5000 * (attempt + 1));
                    attempt++;
                }
                if (!mintInfo) {
                    throw new Error("Mint account not found after multiple attempts");
                }
                // Now we've confirmed the mint account exists, create a transaction to revoke authorities
                const revokeTransaction = new Transaction();
                // Use the wallet public key as the current authority
                revokeTransaction.add(createSetAuthorityInstruction(new PublicKey(mint.publicKey.toString()), this.wallet.publicKey, // Use wallet public key as current authority
                AuthorityType.MintTokens, null));
                // Add instruction to revoke freeze authority
                revokeTransaction.add(createSetAuthorityInstruction(new PublicKey(mint.publicKey.toString()), this.wallet.publicKey, // Use wallet public key as current authority
                AuthorityType.FreezeAccount, null));
                // Sign and send the transaction with more retries
                const revokeAuthorityTxId = await this.signAndBroadcastTx(revokeTransaction);
                console.log(`Successfully revoked mint and freeze authorities (${mint.publicKey})`);
            }
            return {
                mintAddress: mint.publicKey.toString(),
                txId: tx,
            };
        }
        catch (error) {
            console.error("Error minting tokens:", error);
            throw error;
        }
    }
    /**
     * Create a pool using the Meteor CP-AMM
     * @param opts - Pool creation options
     * @returns Pool ID and transaction ID
     */
    async createPool(opts) {
        try {
            // Generate a new keypair for the position NFT
            const positionNftKeypair = Keypair.generate();
            const configs = await this.cpAmm.getAllConfigs();
            if (configs.length === 0) {
                throw new Error("No configuration accounts found");
            }
            const configAccount = configs[0].publicKey;
            const configState = await this.cpAmm.fetchConfigState(configAccount);
            // Calculate initial price based on the token amounts
            // For simplicity, we'll use a 1:1 ratio adjusted for decimals
            const tokenAMint = new PublicKey(opts.tokenA);
            const tokenBMint = new PublicKey(opts.tokenB);
            // Get token info for decimals
            const tokenAInfo = await this.connection.getParsedAccountInfo(tokenAMint);
            const tokenBInfo = await this.connection.getParsedAccountInfo(tokenBMint);
            // @ts-ignore - Extract decimals from parsed info
            const tokenADecimals = tokenAInfo.value?.data.parsed.info.decimals || 9;
            // @ts-ignore - Extract decimals from parsed info
            const tokenBDecimals = tokenBInfo.value?.data.parsed.info.decimals || 9;
            // Calculate initial price (tokenB per tokenA)
            // const initPrice =
            //   (opts.mintBamount / opts.mintAamount) *
            //   10 ** (tokenADecimals - tokenBDecimals);
            // const { initSqrtPrice, liquidityDelta } =
            //   this.cpAmm.preparePoolCreationParams({
            //     tokenAAmount: tokenAAmount,
            //     tokenBAmount: tokenBAmount,
            //     minSqrtPrice: configState.sqrtMinPrice,
            //     maxSqrtPrice: configState.sqrtMaxPrice,
            //   });
            // // Create a custom pool
            // const poolFees: PoolFeesParams = {
            //   baseFee: {
            //     feeSchedulerMode: 0, // Linear
            //     cliffFeeNumerator: new BN(500000), // 0.5% fee (denominator is 10^8)
            //     numberOfPeriod: 0,
            //     reductionFactor: new BN(0),
            //     periodFrequency: new BN(0),
            //   },
            //   protocolFeePercent: 0,
            //   partnerFeePercent: 0,
            //   referralFeePercent: 0,
            //   dynamicFee: null,
            // };
            // const { tx, pool, position } = await this.cpAmm.createCustomPool({
            //   payer: this.wallet.publicKey,
            //   creator: this.wallet.publicKey,
            //   positionNft: positionNftKeypair.publicKey,
            //   tokenAMint: tokenAMint,
            //   tokenBMint: tokenBMint,
            //   tokenAAmount: tokenAAmount,
            //   tokenBAmount: tokenBAmount,
            //   sqrtMinPrice: configState.sqrtMinPrice,
            //   sqrtMaxPrice: configState.sqrtMaxPrice,
            //   initSqrtPrice,
            //   liquidityDelta,
            //   poolFees,
            //   hasAlphaVault: false,
            //   collectFeeMode: 0,
            //   activationPoint: new BN(0),
            //   activationType: 0,
            //   tokenAProgram:
            //     opts.tokenAProgram ||
            //     new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
            //   tokenBProgram:
            //     opts.tokenBProgram ||
            //     new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
            // });
            // Prepare parameters for pool creation
            const mintAmount = new BN(opts.mintAamount);
            const decimals = new BN(10).pow(new BN(tokenADecimals));
            const tokenAAmount = mintAmount.mul(decimals);
            const tokenBAmount = new BN(opts.mintBamount * 10 ** tokenBDecimals);
            const pool = derivePoolAddress(configAccount, tokenAMint, tokenBMint);
            const { initSqrtPrice, liquidityDelta } = this.cpAmm.preparePoolCreationParams({
                tokenAAmount: tokenAAmount,
                tokenBAmount: tokenBAmount,
                minSqrtPrice: configState.sqrtMinPrice,
                maxSqrtPrice: configState.sqrtMaxPrice,
            });
            const createPoolTx = await this.cpAmm.createPool({
                payer: this.wallet.publicKey,
                creator: this.wallet.publicKey,
                config: configAccount,
                positionNft: positionNftKeypair.publicKey,
                tokenAMint,
                tokenBMint,
                activationPoint: null,
                tokenAAmount: tokenAAmount,
                tokenBAmount: tokenBAmount,
                initSqrtPrice,
                liquidityDelta: liquidityDelta,
                tokenAProgram: TOKENA_PROGRAM_ID,
                tokenBProgram: TOKENB_PROGRAM_ID,
            });
            console.log(positionNftKeypair.publicKey.toString());
            const txId = await this.signAndBroadcastTx(createPoolTx, positionNftKeypair);
            console.log("Pool created", {
                poolId: pool.toString(),
                positionId: positionNftKeypair.publicKey,
                txId,
            });
            // Return the pool ID, position ID, and transaction ID
            return {
                poolId: pool.toString(),
                positionId: positionNftKeypair.publicKey.toString(),
                txId,
            };
        }
        catch (error) {
            console.error("Error creating pool:", error);
            throw error;
        }
    }
    /**
     * Add liquidity to an existing position
     * @param poolId - ID of the pool
     * @param positionId - ID of the position
     * @param tokenAAmount - Amount of token A to add
     * @param tokenBAmount - Amount of token B to add
     */
    async addLiquidity(poolId, positionId, tokenAAmount, tokenBAmount) {
        try {
            const pool = new PublicKey(poolId);
            const position = new PublicKey(positionId);
            // Get pool and position states
            const poolState = await this.cpAmm.fetchPoolState(pool);
            // Calculate liquidity delta based on token amounts
            const { liquidityDelta } = this.cpAmm.getDepositQuote({
                inAmount: new BN(tokenAAmount),
                isTokenA: true,
                minSqrtPrice: poolState.sqrtMinPrice,
                maxSqrtPrice: poolState.sqrtMaxPrice,
                sqrtPrice: poolState.sqrtPrice,
            });
            // Find the position NFT account
            const positionNftAccount = derivePositionNftAccount(position);
            // Add liquidity
            const addLiquidityTx = await this.cpAmm.addLiquidity({
                owner: this.wallet.publicKey,
                pool,
                position,
                positionNftAccount: positionNftAccount,
                liquidityDelta,
                maxAmountTokenA: new BN(tokenAAmount),
                maxAmountTokenB: new BN(tokenBAmount),
                tokenAAmountThreshold: new BN(0), // No minimum threshold
                tokenBAmountThreshold: new BN(0), // No minimum threshold
                tokenAMint: poolState.tokenAMint,
                tokenBMint: poolState.tokenBMint,
                tokenAVault: poolState.tokenAVault,
                tokenBVault: poolState.tokenBVault,
                tokenAProgram: TOKENA_PROGRAM_ID,
                tokenBProgram: TOKENB_PROGRAM_ID,
            });
            const tx = addLiquidityTx;
            const txId = await this.signAndBroadcastTx(tx);
            console.log("Liquidity added", { txId });
            return { txId, positionId };
        }
        catch (error) {
            console.error("Error adding liquidity:", error);
            throw error;
        }
    }
    /**
     * Remove all liquidity from a position
     * @param poolId - ID of the pool
     * @param positionId - ID of the position
     */
    async removeAllLiquidity(poolId, positionId) {
        try {
            const pool = new PublicKey(poolId);
            const positionNft = new PublicKey(positionId);
            const poolState = await this.cpAmm.fetchPoolState(pool);
            const position = derivePositionAddress(positionNft);
            console.log(position);
            // Remove all liquidity
            const removeAllLiquidityTx = await this.cpAmm.removeAllLiquidity({
                owner: this.wallet.publicKey,
                pool,
                position,
                positionNftAccount: derivePositionNftAccount(positionNft),
                tokenAAmountThreshold: new BN(0), // No minimum threshold
                tokenBAmountThreshold: new BN(0), // No minimum threshold
                tokenAMint: poolState.tokenAMint,
                tokenBMint: poolState.tokenBMint,
                tokenAVault: poolState.tokenAVault,
                tokenBVault: poolState.tokenBVault,
                tokenAProgram: TOKENA_PROGRAM_ID,
                tokenBProgram: TOKENB_PROGRAM_ID,
                vestings: [],
                currentPoint: new BN(0),
            });
            // Build and send the transaction
            const tx = removeAllLiquidityTx;
            const txId = await this.signAndBroadcastTx(tx);
            console.log("Liquidity removed", { txId });
            return { txId };
        }
        catch (error) {
            console.error("Error removing liquidity:", error);
            throw error;
        }
    }
    /**
     * Close a position after all liquidity has been removed
     * @param positionId - ID of the position
     */
    async closePosition(poolId, positionId) {
        try {
            const positionNft = new PublicKey(positionId);
            const position = derivePositionAddress(positionNft);
            const positionNftAccount = derivePositionNftAccount(positionNft);
            // const positionNftAccount = await this.connection.getTokenAccountsByOwner(
            //   this.wallet.publicKey,
            //   { mint: positionState.nftMint }
            // );
            // if (positionNftAccount.value.length === 0) {
            //   throw new Error("Position NFT account not found");
            // }
            const closePositionTx = await this.cpAmm.closePosition({
                owner: this.wallet.publicKey,
                pool: new PublicKey(poolId),
                position,
                positionNftMint: positionNft,
                positionNftAccount: positionNftAccount,
            });
            const tx = closePositionTx;
            const txId = await this.signAndBroadcastTx(tx);
            console.log("Position closed", { txId });
            return { txId };
        }
        catch (error) {
            console.error("Error closing position:", error);
            throw error;
        }
    }
    /**
     * Removes all liquidity from a position and then closes it in one operation
     * @param poolId - ID of the pool
     * @param positionId - ID of the position NFT
     */
    async removeAllLiquidityAndClosePosition(poolId, positionId) {
        try {
            const pool = new PublicKey(poolId);
            const positionNft = new PublicKey(positionId);
            // Derive the position account from the position NFT mint
            const position = derivePositionAddress(positionNft);
            const positionNftAccount = derivePositionNftAccount(positionNft);
            // Get pool state and position state
            const poolState = await this.cpAmm.fetchPoolState(pool);
            const positionState = await this.cpAmm.fetchPositionState(position);
            // Check if position has any liquidity
            const totalLiquidity = positionState.unlockedLiquidity
                .add(positionState.vestedLiquidity)
                .add(positionState.permanentLockedLiquidity);
            if (totalLiquidity.isZero()) {
                // If no liquidity, just close the position
                console.log("Position has no liquidity, proceeding to close");
                const closePositionTx = await this.cpAmm.closePosition({
                    owner: this.wallet.publicKey,
                    pool,
                    position,
                    positionNftMint: positionNft,
                    positionNftAccount,
                });
                const txId = await this.signAndBroadcastTx(closePositionTx);
                console.log("Position closed", { txId });
                return { txId };
            }
            // Position has liquidity, we need to remove it first then close
            console.log("Position has liquidity, removing liquidity then closing");
            // Use the SDK's built-in removeAllLiquidityAndClosePosition method which does both operations in one transaction
            const tx = await this.cpAmm.removeAllLiquidityAndClosePosition({
                owner: this.wallet.publicKey,
                position,
                positionNftAccount,
                positionState,
                poolState,
                tokenAAmountThreshold: new BN(0),
                tokenBAmountThreshold: new BN(0),
                vestings: [], // If there are any vestings, you would get them using getAllVestingsByPosition
                currentPoint: new BN(Math.floor(Date.now() / 1000)), // Current timestamp in seconds
            });
            const txId = await this.signAndBroadcastTx(tx);
            console.log("Successfully removed liquidity and closed position", {
                txId,
            });
            return { txId };
        }
        catch (error) {
            console.error("Error removing liquidity and closing position:", error);
            throw error;
        }
    }
    // Can you help me write a meteora client function that cremoves liquidity and closes all accounts at once
    // async signAndBroadcastTx(tx: Transaction, otherSigner?: Keypair) {
    //   let attempts = 0;
    //   const maxAttempts = 3;
    //   while (attempts < maxAttempts) {
    //     try {
    //       attempts++;
    //       console.log(`Transaction attempt ${attempts}/${maxAttempts}`);
    //       // Always get a fresh blockhash for each attempt
    //       const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash({
    //         commitment: "confirmed"
    //       });
    //       console.log(`Using blockhash: ${blockhash.substring(0, 10)}... (valid until height: ${lastValidBlockHeight})`);
    //       tx.feePayer = this.wallet.publicKey;
    //       tx.recentBlockhash = blockhash;
    //       // Sign the transaction
    //       if (otherSigner) {
    //         tx.sign(this.wallet, otherSigner);
    //       } else {
    //         tx.sign(this.wallet);
    //       }
    //       console.log(`Sending from ${this.wallet.publicKey.toString()}`);
    //       // Send with retry options
    //       const txId = await this.connection.sendRawTransaction(tx.serialize(), {
    //         skipPreflight: false,
    //         preflightCommitment: "confirmed",
    //         maxRetries: 2
    //       });
    //       console.log(`Transaction sent: ${txId}`);
    //       // Wait for confirmation
    //       const confirmation = await this.connection.confirmTransaction({
    //         signature: txId,
    //         blockhash,
    //         lastValidBlockHeight
    //       }, "confirmed");
    //       if (confirmation.value.err) {
    //         throw new Error(`Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`);
    //       }
    //       console.log(`Transaction confirmed: ${txId}`);
    //       return txId;
    //     } catch (error: any) {
    //       console.error(`Transaction attempt ${attempts} failed: ${error.message || error}`);
    //       if (attempts >= maxAttempts) {
    //         throw error;
    //       }
    //       // Wait before retry with exponential backoff
    //       const backoffMs = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
    //       console.log(`Waiting ${backoffMs}ms before retrying transaction...`);
    //       await new Promise(resolve => setTimeout(resolve, backoffMs));
    //     }
    //   }
    //   throw new Error('Failed to send transaction after maximum attempts');
    // }
    async signAndBroadcastTx(tx, otherSigner) {
        let attempts = 0;
        const maxAttempts = 5; // Increased from 3 to 5
        const initialBackoffMs = 2000; // Increased initial backoff
        while (attempts < maxAttempts) {
            try {
                attempts++;
                console.log(`Transaction attempt ${attempts}/${maxAttempts}`);
                // Always get a fresh blockhash for each attempt with longer commitment
                const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash({
                    commitment: "finalized" // Using finalized instead of confirmed for more reliable blockhash
                });
                console.log(`Using blockhash: ${blockhash.substring(0, 10)}... (valid until height: ${lastValidBlockHeight})`);
                tx.feePayer = this.wallet.publicKey;
                tx.recentBlockhash = blockhash;
                // Pre-simulate the transaction to catch errors before sending
                try {
                    const simulation = await this.connection.simulateTransaction(tx);
                    if (simulation.value.err) {
                        console.error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
                        throw new Error(`Simulation error: ${JSON.stringify(simulation.value.err)}`);
                    }
                }
                catch (simError) {
                    console.error(`Failed to simulate transaction: ${simError}`);
                    // Continue anyway, as some simulation errors can still result in successful txs
                }
                // Sign the transaction
                if (otherSigner) {
                    tx.sign(this.wallet, otherSigner);
                }
                else {
                    tx.sign(this.wallet);
                }
                console.log(`Sending from ${this.wallet.publicKey.toString()}`);
                // Use higher priority fee to increase chances of inclusion
                // Note: This requires @solana/web3.js v1.31.0 or later
                const txId = await this.connection.sendRawTransaction(tx.serialize(), {
                    skipPreflight: false,
                    preflightCommitment: "confirmed",
                    maxRetries: 5 // Increased internal retries
                });
                console.log(`Transaction sent: ${txId}`);
                // More robust confirmation with longer timeout
                try {
                    // Wait for confirmation with a timeout
                    const timeoutMs = 45000; // 45 seconds
                    const confirmationPromise = this.connection.confirmTransaction({
                        signature: txId,
                        blockhash,
                        lastValidBlockHeight
                    }, "confirmed");
                    // Create a timeout promise
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Transaction confirmation timeout")), timeoutMs));
                    // Race between confirmation and timeout
                    const confirmation = await Promise.race([confirmationPromise, timeoutPromise]);
                    if ('value' in confirmation && confirmation.value.err) {
                        throw new Error(`Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`);
                    }
                    console.log(`Transaction confirmed: ${txId}`);
                    return txId;
                }
                catch (confirmError) {
                    console.error(`Transaction confirmation error: ${confirmError}`);
                    // Check if the transaction was actually confirmed despite the error
                    try {
                        const status = await this.connection.getSignatureStatus(txId);
                        if (status && status.value && status.value.confirmationStatus === 'confirmed') {
                            console.log(`Transaction was actually confirmed despite confirmation error: ${txId}`);
                            return txId;
                        }
                    }
                    catch (statusError) {
                        console.error(`Failed to check transaction status: ${statusError}`);
                    }
                    throw new Error(`Transaction confirmation failed: ${confirmError}`);
                }
            }
            catch (error) {
                console.error(`Transaction attempt ${attempts} failed: ${error.message || error}`);
                if (attempts >= maxAttempts) {
                    throw error;
                }
                // Wait before retry with exponential backoff, but with higher initial delay
                const backoffMs = Math.min(initialBackoffMs * Math.pow(2, attempts - 1), 30000);
                console.log(`Waiting ${backoffMs}ms before retrying transaction...`);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
        }
        throw new Error('Failed to send transaction after maximum attempts');
    }
}
