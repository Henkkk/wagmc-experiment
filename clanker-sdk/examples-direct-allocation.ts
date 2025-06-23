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

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const RPC_URL = process.env.RPC_URL;

if (!PRIVATE_KEY) {
  throw new Error('Missing required environment variables. Please create a .env file with PRIVATE_KEY.');
}

/**
 * Comprehensive examples showing different methods for direct token allocation
 * 
 * This script demonstrates two main approaches:
 * 1. Vault Extension: Simple allocation with token admin control
 * 2. Airdrop Extension: Flexible allocation to any specific address
 */

// Common configuration
const recipientWallet = '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace'; // Replace with desired wallet
const allocationPercentage = 30; // 30% of total supply

async function setupClients() {
  const account = privateKeyToAccount(PRIVATE_KEY);
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

  const clanker = new Clanker({ wallet, publicClient });

  return { account, publicClient, wallet, clanker };
}

/**
 * Method 1: Using Vault Extension
 * 
 * ✅ Pros:
 * - Simple configuration
 * - Built-in vault management with lockup/vesting
 * - Gas efficient
 * 
 * ❌ Cons:
 * - Vault admin is always the token admin
 * - Cannot directly specify different recipient address
 * - Requires admin to transfer tokens to final recipient
 */
async function deployWithVaultExtension() {
  console.log('\n🏦 Method 1: Vault Extension Deployment\n');
  
  const { account, clanker } = await setupClients();
  
  console.log('📝 Deploying from:', account.address);
  console.log('🏦 Vault admin will be:', account.address, '(token admin)');
  console.log('💰 Vault will hold', allocationPercentage, '% of token supply');
  console.log('⚠️  Note: You\'ll need to transfer tokens from vault to final recipient after deployment');

  const tokenConfig = new TokenConfigV4Builder()
    .withName('Vault Example Token')
    .withSymbol('VAULT')
    .withTokenAdmin(account.address)
    .withVault({
      percentage: allocationPercentage, // 30% of token supply
      lockupDuration: 0, // 0 = immediate access (no lockup period)
      vestingDuration: 0, // 0 = immediate access (no vesting period)
    })
    .withPoolConfig({
      pairedToken: '0x4200000000000000000000000000000000000006', // WETH on Base Sepolia
      startingMarketCapInPairedToken: 10,
      positions: POOL_POSITIONS.Standard,
    })
    .withDynamicFeeConfig(FEE_CONFIGS[FeeConfigs.DynamicBasic])
    .build();

  const tokenAddress = await clanker.deployToken(tokenConfig);

  console.log('✅ Token deployed with vault extension!');
  console.log('📍 Token address:', tokenAddress);
  console.log('🏦 Vault contains', allocationPercentage, '% of supply, controlled by:', account.address);
  console.log('\n📝 Next steps:');
  console.log('   1. Call vault contract to transfer tokens to', recipientWallet);
  console.log('   2. Or implement admin controls for token distribution');

  return tokenAddress;
}

/**
 * Method 2: Using Airdrop Extension (Single Recipient)
 * 
 * ✅ Pros:
 * - Direct allocation to any specific address
 * - Recipient can claim immediately (with 0 lockup/vesting)
 * - More flexible than vault extension
 * - Can specify multiple recipients if needed
 * 
 * ❌ Cons:
 * - Requires merkle tree generation
 * - Recipient must actively claim tokens
 * - Slightly more gas for deployment
 */
async function deployWithAirdropExtension() {
  console.log('\n🎁 Method 2: Airdrop Extension Deployment (Single Recipient)\n');
  
  const { account, clanker } = await setupClients();
  
  console.log('📝 Deploying from:', account.address);
  console.log('🎯 Direct allocation to:', recipientWallet);
  console.log('💰 Allocation:', allocationPercentage, '% of token supply');

  // Calculate allocation amount (30% of 100 billion tokens)
  const totalSupply = 100_000_000_000; // Standard Clanker supply
  const allocationAmount = totalSupply * (allocationPercentage / 100);

  // Create single-recipient airdrop
  const airdropEntries: AirdropEntry[] = [
    { account: recipientWallet, amount: allocationAmount }
  ];

  const { root: merkleRoot } = createMerkleTree(airdropEntries);
  console.log('📊 Generated merkle root:', merkleRoot);
  console.log('💰 Allocation amount:', allocationAmount.toLocaleString(), 'tokens');

  const tokenConfig = new TokenConfigV4Builder()
    .withName('Airdrop Example Token')
    .withSymbol('AIRDROP')
    .withTokenAdmin(account.address)
    .withAirdrop({
      merkleRoot,
      lockupDuration: 86400, // 1 day minimum required by contract (86400 seconds)
      vestingDuration: 0, // 0 = immediate vesting after lockup
      entries: airdropEntries,
      percentage: allocationPercentage,
    })
    .withPoolConfig({
      pairedToken: '0x4200000000000000000000000000000000000006', // WETH on Base Sepolia
      startingMarketCapInPairedToken: 10,
      positions: POOL_POSITIONS.Standard,
    })
    .withDynamicFeeConfig(FEE_CONFIGS[FeeConfigs.DynamicBasic])
    .build();

  const tokenAddress = await clanker.deployToken(tokenConfig);

  console.log('✅ Token deployed with airdrop extension!');
  console.log('📍 Token address:', tokenAddress);
  console.log('🎁 Recipient can claim', allocationAmount.toLocaleString(), 'tokens after 1-day lockup');
  console.log('\n📝 Recipient claiming options:');
  console.log('   1. Use claim-airdrop.ts script');
  console.log('   2. Generate proof: bun generate-airdrop-proofs.ts', recipientWallet, allocationAmount.toString());
  console.log('   3. Use SDK: clanker.claimAirdrop()');

  return tokenAddress;
}

/**
 * Method 3: Using Airdrop Extension (Multiple Recipients)
 * 
 * Shows how to allocate tokens to multiple recipients at once
 */
async function deployWithMultipleRecipientAirdrop() {
  console.log('\n👥 Method 3: Airdrop Extension Deployment (Multiple Recipients)\n');
  
  const { account, clanker } = await setupClients();
  
  console.log('📝 Deploying from:', account.address);
  console.log('👥 Multiple recipient allocation');

  // Calculate allocation amounts
  const totalSupply = 100_000_000_000;
  const allocations = [
    { account: recipientWallet, percentage: 20, amount: totalSupply * 0.20 }, // 20%
    { account: account.address, percentage: 10, amount: totalSupply * 0.10 }, // 10% to deployer
  ];

  const totalPercentage = allocations.reduce((sum, alloc) => sum + alloc.percentage, 0);
  console.log('💰 Total allocation:', totalPercentage, '% of token supply');

  // Create multi-recipient airdrop
  const airdropEntries: AirdropEntry[] = allocations.map(alloc => ({
    account: alloc.account,
    amount: alloc.amount
  }));

  const { root: merkleRoot } = createMerkleTree(airdropEntries);
  console.log('📊 Generated merkle root:', merkleRoot);
  
  allocations.forEach((alloc, index) => {
    console.log(`   Recipient ${index + 1}: ${alloc.account} → ${alloc.amount.toLocaleString()} tokens (${alloc.percentage}%)`);
  });

  const tokenConfig = new TokenConfigV4Builder()
    .withName('Multi-Airdrop Example Token')
    .withSymbol('MULTI')
    .withTokenAdmin(account.address)
    .withAirdrop({
      merkleRoot,
      lockupDuration: 86400, // 1 day minimum required by contract
      vestingDuration: 0, // 0 = immediate vesting after lockup
      entries: airdropEntries,
      percentage: totalPercentage,
    })
    .withPoolConfig({
      pairedToken: '0x4200000000000000000000000000000000000006',
      startingMarketCapInPairedToken: 10,
      positions: POOL_POSITIONS.Standard,
    })
    .withDynamicFeeConfig(FEE_CONFIGS[FeeConfigs.DynamicBasic])
    .build();

  const tokenAddress = await clanker.deployToken(tokenConfig);

  console.log('✅ Token deployed with multi-recipient airdrop!');
  console.log('📍 Token address:', tokenAddress);
  console.log('👥 All recipients can claim their tokens after 1-day lockup');

  return tokenAddress;
}

/**
 * Comparison and recommendations
 */
function showRecommendations() {
  console.log('\n📋 Method Comparison & Recommendations\n');
  
  console.log('🏦 Use VAULT EXTENSION when:');
  console.log('   • You (token admin) want to control token distribution');
  console.log('   • You need built-in lockup/vesting functionality');
  console.log('   • You want to manage distribution manually');
  console.log('   • Gas efficiency is important');
  
  console.log('\n🎁 Use AIRDROP EXTENSION when:');
  console.log('   • You want direct allocation to specific addresses');
  console.log('   • Recipients should claim tokens themselves');
  console.log('   • You need multiple recipients with different allocations');
  console.log('   • You can accept 1-day minimum lockup period');
  
  console.log('\n💡 For your use case (30% to specific wallet):');
  console.log('   → RECOMMENDED: Airdrop Extension (Method 2)');
  console.log('   → Provides direct allocation to your specified address');
  console.log('   → Recipient gets tokens immediately without admin intervention');
}

// Main execution
async function main() {
  try {
    console.log('🚀 Direct Token Allocation Examples\n');
    console.log('This script demonstrates different methods to allocate 30% of tokens to a specific wallet');
    
    // Show recommendations first
    showRecommendations();
    
    // Uncomment the method you want to test:
    
    // Method 1: Vault Extension
    // await deployWithVaultExtension();
    
    // Method 2: Single Recipient Airdrop (RECOMMENDED)
    await deployWithAirdropExtension();
    
    // Method 3: Multiple Recipients Airdrop
    // await deployWithMultipleRecipientAirdrop();
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Deployment failed:', error.message);
    } else {
      console.error('❌ Deployment failed with unknown error');
    }
    process.exit(1);
  }
}

// Export functions for individual use
export { 
  deployWithVaultExtension,
  deployWithAirdropExtension,
  deployWithMultipleRecipientAirdrop,
  showRecommendations
};

main().catch(console.error);