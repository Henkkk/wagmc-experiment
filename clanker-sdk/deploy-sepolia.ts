import * as dotenv from 'dotenv';
import { createPublicClient, createWalletClient, http, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { TokenConfigV4Builder } from './src/config/builders.js';
import { FEE_CONFIGS, FeeConfigs, POOL_POSITIONS } from './src/constants.js';
import { Clanker } from './src/index.js';

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
 * - Vault extension with lockup and vesting
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

    // Build token configuration using the V4 builder pattern
    const tokenConfig = new TokenConfigV4Builder()
      .withName('Test Token V4')
      .withSymbol('TEST4')
      .withImage('ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')
      .withTokenAdmin(account.address)
      .withMetadata({
        description: 'V4 test token deployed on Base Sepolia using Clanker SDK',
        socialMediaUrls: [],
        auditUrls: [],
      })
      .withContext({
        interface: 'Clanker SDK',
        platform: 'Test Deployment',
        messageId: 'sepolia-test-v4',
        id: 'TEST4-1',
      })
      .withVault({
        percentage: 5, // 5% of token supply (minimal for testing)
        lockupDuration: 604800, // 7 days in seconds (short for testing)
        vestingDuration: 604800, // 7 days in seconds (short for testing)
      })
      .withDevBuy({
        ethAmount: 0, // No initial buy for testing
      })
      .withRewardsRecipients({
        recipients: [
          {
            recipient: account.address,
            admin: account.address,
            bps: 5000, // 50% creator reward
          },
          {
            recipient: '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace',
            admin: '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace',
            bps: 5000, // 50% interface reward
          },
        ],
      })
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
