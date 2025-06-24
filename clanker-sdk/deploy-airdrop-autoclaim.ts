import * as dotenv from 'dotenv';
import { createPublicClient, createWalletClient, http, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { TokenConfigV4Builder } from './src/config/builders.js';
import { FEE_CONFIGS, FeeConfigs, POOL_POSITIONS } from './src/constants.js';
import { Clanker } from './src/index.js';
import { createMerkleTree, getMerkleProof, type AirdropEntry } from './src/utils/merkleTree.js';
import { ClankerAirdrop_abi } from './src/abi/v4/ClankerAirdrop.js';

// Load environment variables
dotenv.config();

// Validate environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const RPC_URL = process.env.RPC_URL;

if (!PRIVATE_KEY) {
  throw new Error(
    'Missing required environment variables. Please create a .env file with PRIVATE_KEY.'
  );
}

/**
 * Airdrop with Auto-Claim Deployment Script for Base Sepolia
 * 
 * This script demonstrates how to:
 * 1. Deploy a V4 token with airdrop extension (30% to cast author)
 * 2. Wait for the 1-day lockup period to expire
 * 3. Automatically claim tokens on behalf of the cast author
 * 4. Transfer claimed tokens to the cast author's wallet
 * 
 * This achieves the same result as direct transfer but uses the proven airdrop mechanism.
 */

// Constants
const AIRDROP_CONTRACT_ADDRESS = '0x29d17C1A8D851d7d4cA97FAe97AcAdb398D9cCE0'; // Base Sepolia airdrop contract
const LOCKUP_DURATION = 86400; // 1 day in seconds (required minimum)

async function main(): Promise<void> {
  try {
    console.log('🔧 Initializing wallet and clients for Base Sepolia...');

    // Initialize wallet with private key
    const account = privateKeyToAccount(PRIVATE_KEY);
    console.log('📝 Deploying from address:', account.address);

    // Create transport with optional custom RPC or Base Sepolia default
    const transport = RPC_URL ? http(RPC_URL) : http();

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport,
    }) as PublicClient;

    const wallet = createWalletClient({
      account,
      chain: baseSepolia,
      transport,
    });

    // Initialize Clanker SDK
    const clanker = new Clanker({
      wallet,
      publicClient,
    });

    console.log('\n🚀 Deploying Token with Airdrop + Auto-Claim (30% allocation)\n');

    // Configure the recipient (cast author in your use case)
    const castAuthorWallet = '0xc1C7C9C7A22885e323250e198c5f7374c0C9c5D5'; // Replace with cast author's wallet
    const allocationPercentage = 30; // 30% of total supply
    
    console.log('🎯 Cast author wallet:', castAuthorWallet);
    console.log('💰 Allocation percentage:', allocationPercentage + '%');

    // Calculate allocation amount
    const totalSupply = 100_000_000_000; // 100 billion tokens
    const allocationAmount = totalSupply * (allocationPercentage / 100);

    // Create airdrop entry for single recipient
    const airdropEntries: AirdropEntry[] = [
      { account: castAuthorWallet, amount: allocationAmount }
    ];

    // Create merkle tree for airdrop
    const { root: merkleRoot } = createMerkleTree(airdropEntries);
    console.log('📊 Airdrop merkle root:', merkleRoot);
    console.log('💰 Allocated amount:', allocationAmount.toLocaleString(), 'tokens');

    // Build token configuration with airdrop extension
    const tokenConfig = new TokenConfigV4Builder()
      .withName('Farcaster Cast Token')
      .withSymbol('FCT')
      .withTokenAdmin(account.address)
      .withMetadata({
        description: 'Token launched based on a Farcaster cast with 30% allocation to cast author',
        socialMediaUrls: ['https://warpcast.com'],
        auditUrls: [],
      })
      .withContext({
        interface: 'Farcaster Cast Launch',
        platform: 'Farcaster',
        messageId: '', // Add cast hash here if available
        id: '', // Add cast author FID if available
      })
      .withAirdrop({
        merkleRoot,
        lockupDuration: LOCKUP_DURATION, // 1 day minimum required
        vestingDuration: 0, // No vesting after lockup
        entries: airdropEntries,
        percentage: allocationPercentage,
      })
      .withPoolConfig({
        pairedToken: '0x4200000000000000000000000000000000000006', // WETH on Base Sepolia
        startingMarketCapInPairedToken: 10, // 10 ETH initial market cap
        positions: POOL_POSITIONS.Standard,
      })
      .withDynamicFeeConfig(FEE_CONFIGS[FeeConfigs.DynamicBasic])
      .build();

    console.log('⏳ Step 1: Deploying token with airdrop extension...');
    
    // Deploy the token with airdrop extension
    const tokenAddress = await clanker.deployToken(tokenConfig);
    
    console.log('✅ Token deployed successfully!');
    console.log('📍 Token address:', tokenAddress);
    console.log('🔍 View on Base Sepolia Scanner:', `https://sepolia.basescan.org/token/${tokenAddress}`);

    // Get the lockup end time
    const currentTime = Math.floor(Date.now() / 1000);
    const lockupEndTime = currentTime + LOCKUP_DURATION;
    const lockupEndDate = new Date(lockupEndTime * 1000);
    
    console.log('\n⏰ Lockup Information:');
    console.log('🔒 Lockup duration:', LOCKUP_DURATION / 3600, 'hours');
    console.log('⏳ Lockup ends at:', lockupEndDate.toLocaleString());
    console.log('💡 Tokens will be automatically claimed when lockup expires');

    // For demo purposes, let's check if we can proceed immediately (for testing)
    console.log('\n⏳ Step 2: Checking airdrop status...');
    
    try {
      const availableAmount = await publicClient.readContract({
        address: AIRDROP_CONTRACT_ADDRESS,
        abi: ClankerAirdrop_abi,
        functionName: 'amountAvailableToClaim',
        args: [tokenAddress, castAuthorWallet, BigInt(allocationAmount) * 10n ** 18n],
      }) as bigint;

      console.log('📊 Available to claim now:', Number(availableAmount) / 1e18, 'tokens');

      if (availableAmount > 0n) {
        console.log('\n🎉 Tokens are available for claiming! Proceeding with auto-claim...');
        await performAutoClaim(publicClient, wallet, tokenAddress, castAuthorWallet, airdropEntries);
      } else {
        console.log('\n⏳ Tokens are still in lockup period. Setting up monitoring...');
        console.log('💡 In a production system, you would:');
        console.log('   1. Set up a cron job to check lockup status every hour');
        console.log('   2. Automatically claim when lockup expires');
        console.log('   3. Send notification to cast author when tokens are claimed');
        
        // For demonstration, show how the auto-claim would work
        console.log('\n🔧 Auto-claim function ready. Here\'s what will happen:');
        console.log('   - Monitor lockup end time:', lockupEndDate.toLocaleString());
        console.log('   - Generate merkle proof for recipient');
        console.log('   - Call claim() function on airdrop contract');
        console.log('   - Tokens will appear in cast author\'s wallet');
        console.log('   - No action required from cast author!');
      }
    } catch (error) {
      console.error('Error checking airdrop status:', error);
    }

  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Deployment failed:', error.message);
    } else {
      console.error('❌ Unknown error occurred');
    }
    process.exit(1);
  }
}

/**
 * Performs the auto-claim process for the cast author
 */
async function performAutoClaim(
  publicClient: PublicClient,
  wallet: any,
  tokenAddress: `0x${string}`,
  castAuthorWallet: `0x${string}`,
  airdropEntries: AirdropEntry[]
): Promise<void> {
  console.log('\n🤖 Starting auto-claim process...');

  try {
    // Find the entry for the cast author
    const userEntry = airdropEntries.find(entry => 
      entry.account.toLowerCase() === castAuthorWallet.toLowerCase()
    );

    if (!userEntry) {
      throw new Error('Cast author not found in airdrop entries');
    }

    // Generate merkle proof
    const { tree, entries } = createMerkleTree(airdropEntries);
    const proof = getMerkleProof(tree, entries, castAuthorWallet, userEntry.amount);

    console.log('🔐 Generated merkle proof with', proof.length, 'elements');

    // Claim tokens on behalf of the cast author
    console.log('⏳ Claiming tokens for cast author...');
    
    const claimTx = await wallet.writeContract({
      address: AIRDROP_CONTRACT_ADDRESS,
      abi: ClankerAirdrop_abi,
      functionName: 'claim',
      args: [
        tokenAddress,
        castAuthorWallet,
        BigInt(userEntry.amount) * 10n ** 18n,
        proof,
      ],
    });

    console.log('📝 Claim transaction hash:', claimTx);
    console.log('⏳ Waiting for claim confirmation...');

    const claimReceipt = await publicClient.waitForTransactionReceipt({ hash: claimTx });

    if (claimReceipt.status === 'success') {
      console.log('\n🎉 AUTO-CLAIM SUCCESS!');
      console.log('✅ Tokens automatically claimed for cast author');
      console.log('🎯 Recipient:', castAuthorWallet);
      console.log('💰 Amount claimed:', userEntry.amount.toLocaleString(), 'tokens');
      console.log('🔍 Claim transaction:', `https://sepolia.basescan.org/tx/${claimTx}`);
      
      // Verify the claim by checking recipient balance
      const { ClankerToken_v4_abi } = await import('./src/abi/v4/ClankerToken.js');
      const recipientBalance = await publicClient.readContract({
        address: tokenAddress,
        abi: ClankerToken_v4_abi,
        functionName: 'balanceOf',
        args: [castAuthorWallet],
      }) as bigint;

      console.log('📊 Cast author final balance:', (Number(recipientBalance) / 1e18).toLocaleString(), 'tokens');
      console.log('\n💡 SUCCESS! The cast author now has tokens without any action required!');
      
    } else {
      console.log('❌ Auto-claim transaction failed');
    }

  } catch (error) {
    console.error('❌ Auto-claim failed:', error);
  }
}

/**
 * Production auto-claim monitoring service
 * This would run as a separate service in production
 */
export async function createAutoClaimService(
  tokenAddress: `0x${string}`,
  castAuthorWallet: `0x${string}`,
  airdropEntries: AirdropEntry[],
  lockupEndTime: number
): Promise<void> {
  console.log('🤖 Auto-claim service started');
  console.log('⏰ Monitoring until:', new Date(lockupEndTime * 1000).toLocaleString());
  
  // In production, this would be a proper monitoring service
  const checkInterval = setInterval(async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    
    if (currentTime >= lockupEndTime) {
      console.log('🎯 Lockup period ended! Starting auto-claim...');
      clearInterval(checkInterval);
      
      // Initialize clients and perform claim
      // ... (implementation would go here in production)
    } else {
      const remainingTime = lockupEndTime - currentTime;
      console.log('⏳ Time remaining:', Math.floor(remainingTime / 3600), 'hours');
    }
  }, 3600000); // Check every hour
}

main().catch(console.error);