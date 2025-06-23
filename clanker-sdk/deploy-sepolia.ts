import * as dotenv from 'dotenv';
import { createPublicClient, createWalletClient, http, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { TokenConfigV4Builder } from './src/config/builders.js';
import { FEE_CONFIGS, FeeConfigs, POOL_POSITIONS } from './src/constants.js';
import { Clanker } from './src/index.js';
import { createMerkleTree, type AirdropEntry } from './src/utils/merkleTree.js';

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
 * V4 token deployment script for Base Sepolia testnet
 * This example demonstrates:
 * - V4 token deployment on Base Sepolia with advanced features
 * - Builder pattern for token configuration
 * - Pool configuration with dynamic fees
 * - Airdrop extension for direct token allocation (30% to specific wallet)
 * - Single-recipient airdrop with immediate availability (no lockup/vesting)
 * - Environment variable setup for private key
 */
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

    console.log('\n🚀 Deploying V4 Token on Base Sepolia Testnet\n');

    // Define the recipient wallet address for 30% token allocation
    const recipientWallet = '0xc1C7C9C7A22885e323250e198c5f7374c0C9c5D5'; // Replace with your desired wallet
    console.log('💰 30% of tokens will be sent to:', recipientWallet);

    // Calculate total token allocation (30% = 30,000 tokens out of 100,000 total supply)
    const totalSupply = 100_000_000_000; // 100 billion tokens (standard Clanker supply)
    const allocationAmount = totalSupply * 0.30; // 30% allocation

    // Create airdrop entry for single recipient
    const airdropEntries: AirdropEntry[] = [
      { account: recipientWallet, amount: allocationAmount }
    ];

    // Create merkle tree for airdrop
    const { root: merkleRoot } = createMerkleTree(airdropEntries);
    console.log('📊 Airdrop merkle root:', merkleRoot);
    console.log('💰 Allocated amount:', allocationAmount.toLocaleString(), 'tokens');

    // Build token configuration using the V4 builder pattern
    const tokenConfig = new TokenConfigV4Builder()
      .withName('Test Token V4 Direct Allocation 4')
      .withSymbol('TEST4-AIRDROP 12345')
      //.withImage('ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')
      .withTokenAdmin(account.address)
      // .withMetadata({
      //   description: '',
      //   socialMediaUrls: [],
      //   auditUrls: [],
      // })
      // .withContext({
      //   interface: '',
      //   platform: '',
      //   messageId: '',
      //   id: '',
      // })
      .withAirdrop({
         merkleRoot,
         lockupDuration: 86400, // 1 day minimum required by contract (86400 seconds)
         vestingDuration: 0, // 0 = immediate vesting after lockup 
         entries: airdropEntries,
         percentage: 30, // 30% of token supply for direct allocation
       })
      // .withDevBuy({
      //   ethAmount: 0, // No initial buy for testing
      // })
      // .withRewardsRecipients({
      //   recipients: [
      //     {
      //       recipient: account.address,
      //       admin: account.address,
      //       bps: 5000, // 50% creator reward
      //     },
      //     {
      //       recipient: '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace',
      //       admin: '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace',
      //       bps: 5000, // 50% interface reward
      //     },
      //   ],
      // })
      .withPoolConfig({
        pairedToken: '0x4200000000000000000000000000000000000006', // WETH on Base Sepolia
        startingMarketCapInPairedToken: 10, // 10 ETH initial market cap (aligns with Standard positions)
        positions: POOL_POSITIONS.Standard,
      })
      .withDynamicFeeConfig(FEE_CONFIGS[FeeConfigs.DynamicBasic])
      .build();

    // Deploy the token with V4 configuration
    const tokenAddress = await clanker.deployToken(tokenConfig);

    console.log('✅ Token deployed successfully!');
    console.log('📍 Token address:', tokenAddress);
    console.log(
      '🔍 View on Base Sepolia Scanner:',
      `https://sepolia.basescan.org/token/${tokenAddress}`
    );
    console.log('🌐 Network: Base Sepolia (Testnet)');
    console.log('🎁 Direct allocation configured for:', recipientWallet);
    console.log('💰 Allocation amount:', allocationAmount.toLocaleString(), 'tokens (30% of supply)');
    console.log('🔒 Lockup period: 1 day (required minimum)');
    console.log('⚡ After lockup: Tokens are immediately claimable (no vesting)');
    console.log('\n📝 To claim tokens, the recipient can:');
    console.log('   1. Use the claim-airdrop.ts script');
    console.log('   2. Generate proof with: bun generate-airdrop-proofs.ts', recipientWallet, allocationAmount.toString());
    console.log('   3. Or use the Clanker SDK claimAirdrop() method');
    console.log('\n⏰ Important: Tokens can only be claimed after the 1-day lockup period expires!');
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Deployment failed:', error.message);
    } else {
      console.error('❌ Deployment failed with unknown error');
    }
    process.exit(1);
  }
}

main().catch(console.error);
