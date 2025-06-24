import * as dotenv from 'dotenv';
import { createPublicClient, createWalletClient, http, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { TokenConfigV4Builder } from './src/config/builders.js';
import { FEE_CONFIGS, FeeConfigs, POOL_POSITIONS } from './src/constants.js';
import { Clanker } from './src/index.js';
import { ClankerToken_v4_abi } from './src/abi/v4/ClankerToken.js';

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
 * Direct Transfer Token Deployment Script for Base Sepolia
 * 
 * This script demonstrates how to:
 * 1. Deploy a V4 token with vault extension (30% controlled by deployer)
 * 2. Automatically transfer the 30% allocation to the target recipient
 * 3. No action required from the recipient - tokens appear directly in their wallet
 * 
 * Use case: Farcaster cast-based token launches where you want to reward
 * the cast author with 30% of tokens without requiring them to claim.
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

    console.log('\n🚀 Deploying Token with Direct Transfer (30% allocation)\n');

    // Configure the recipient (cast author in your use case)
    const castAuthorWallet = '0xc1C7C9C7A22885e323250e198c5f7374c0C9c5D5'; // Replace with cast author's wallet
    const allocationPercentage = 30; // 30% of total supply
    
    console.log('🎯 Cast author wallet:', castAuthorWallet);
    console.log('💰 Allocation percentage:', allocationPercentage + '%');

    // Build token configuration with vault extension
    const tokenConfig = new TokenConfigV4Builder()
      .withName('Farcaster Cast Token')
      .withSymbol('FCT')
      .withTokenAdmin(account.address) // You control the token admin
      // Temporarily removing vault extension due to deployment issues
      // Will handle transfer via token admin permissions instead
      .withPoolConfig({
        pairedToken: '0x4200000000000000000000000000000000000006', // WETH on Base Sepolia
        startingMarketCapInPairedToken: 10, // 10 ETH initial market cap
        positions: POOL_POSITIONS.Standard,
      })
      .withDynamicFeeConfig(FEE_CONFIGS[FeeConfigs.DynamicBasic])
      .build();

    console.log('⏳ Step 1: Deploying token with vault extension...');
    
    // Deploy the token with vault extension
    const tokenAddress = await clanker.deployToken(tokenConfig);
    
    console.log('✅ Token deployed successfully!');
    console.log('📍 Token address:', tokenAddress);
    console.log('🔍 View on Base Sepolia Scanner:', `https://sepolia.basescan.org/token/${tokenAddress}`);

    // Wait a moment for the deployment to settle
    console.log('\n⏳ Step 2: Preparing direct transfer...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Calculate the desired allocation amount (we'll check actual supply after deployment)
    const expectedTotalSupply = 100_000_000_000n; // 100 billion tokens (standard Clanker supply)
    const desiredAllocationAmount = (expectedTotalSupply * BigInt(allocationPercentage)) / 100n; // 30% in wei (18 decimals)
    
    console.log('💰 Desired allocation amount:', (Number(desiredAllocationAmount) / 1e18).toLocaleString(), 'tokens');

    // Check balances to understand token distribution
    const [adminBalance, actualTotalSupply] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: ClankerToken_v4_abi,
        functionName: 'balanceOf',
        args: [account.address],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: tokenAddress,
        abi: ClankerToken_v4_abi,
        functionName: 'totalSupply',
      }) as Promise<bigint>
    ]);

    console.log('📊 Total token supply:', (Number(actualTotalSupply) / 1e18).toLocaleString(), 'tokens');
    console.log('📊 Token admin balance:', (Number(adminBalance) / 1e18).toLocaleString(), 'tokens');

    if (adminBalance > 0n) {
      // Calculate how much we can transfer (either the desired amount or admin's full balance)
      const transferAmount = adminBalance >= desiredAllocationAmount ? desiredAllocationAmount : adminBalance;
      const transferPercentage = Number((transferAmount * 10000n) / actualTotalSupply) / 100; // Calculate actual percentage
      
      console.log('⏳ Step 3: Transferring tokens directly to cast author...');
      console.log('💰 Transfer amount:', (Number(transferAmount) / 1e18).toLocaleString(), 'tokens');
      console.log('📊 Transfer percentage:', transferPercentage.toFixed(2) + '%');
      
      // Transfer tokens directly to the cast author
      const transferTx = await wallet.writeContract({
        address: tokenAddress,
        abi: ClankerToken_v4_abi,
        functionName: 'transfer',
        args: [castAuthorWallet, transferAmount],
      });

      console.log('📝 Transfer transaction hash:', transferTx);
      console.log('⏳ Waiting for transfer confirmation...');

      // Wait for transaction confirmation
      const transferReceipt = await publicClient.waitForTransactionReceipt({ hash: transferTx });

      if (transferReceipt.status === 'success') {
        console.log('\n🎉 SUCCESS! Direct transfer completed!');
        console.log('✅ Token deployed and tokens transferred to cast author');
        console.log('📍 Token address:', tokenAddress);
        console.log('🎯 Recipient:', castAuthorWallet);
        console.log('💰 Amount transferred:', (Number(transferAmount) / 1e18).toLocaleString(), 'tokens');
        console.log('📊 Percentage transferred:', transferPercentage.toFixed(2) + '%');
        console.log('🔍 Transfer transaction:', `https://sepolia.basescan.org/tx/${transferTx}`);
        
        // Verify the transfer by checking recipient balance
        const recipientBalance = await publicClient.readContract({
          address: tokenAddress,
          abi: ClankerToken_v4_abi,
          functionName: 'balanceOf',
          args: [castAuthorWallet],
        }) as bigint;

        console.log('📊 Recipient balance:', (Number(recipientBalance) / 1e18).toLocaleString(), 'tokens');
        console.log('\n💡 The cast author now has tokens in their wallet without any action required!');
        
        if (transferAmount < desiredAllocationAmount) {
          console.log('\n⚠️  Note: Transferred less than requested 30% due to limited admin balance');
          console.log('💭 In standard Clanker deployments, most tokens go to liquidity pools');
          console.log('💡 Consider using airdrop extension for guaranteed allocations');
        }
        
      } else {
        console.log('❌ Transfer transaction failed');
        console.log('🔍 Transaction details:', `https://sepolia.basescan.org/tx/${transferTx}`);
      }
    } else {
      console.log('❌ Token admin has no balance to transfer');
      console.log('💭 In standard Clanker deployments, tokens are distributed to liquidity pools');
      console.log('💡 Recommended: Use airdrop extension for guaranteed token allocation');
      console.log('\n🔧 Alternative approach: Using airdrop extension with auto-claim service');
    }

  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Deployment or transfer failed:', error.message);
      
      // Provide helpful debugging information
      if (error.message.includes('insufficient funds')) {
        console.log('💡 Tip: Make sure you have enough ETH for gas fees');
      } else if (error.message.includes('execution reverted')) {
        console.log('💡 Tip: Check if the vault extension allocated tokens correctly');
      }
    } else {
      console.error('❌ Unknown error occurred');
    }
    process.exit(1);
  }
}

/**
 * Helper function to check token balances after deployment
 */
export async function checkTokenBalances(
  publicClient: PublicClient,
  tokenAddress: `0x${string}`,
  addresses: { label: string; address: `0x${string}` }[]
): Promise<void> {
  console.log('\n📊 Token Balance Summary:');
  
  for (const { label, address } of addresses) {
    try {
      const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: ClankerToken_v4_abi,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint;

      console.log(`   ${label}: ${(Number(balance) / 1e18).toLocaleString()} tokens`);
    } catch (error) {
      console.log(`   ${label}: Error reading balance`);
    }
  }
}

/**
 * Helper function to get token information
 */
export async function getTokenInfo(
  publicClient: PublicClient,
  tokenAddress: `0x${string}`
): Promise<void> {
  console.log('\n📋 Token Information:');
  
  try {
    const [name, symbol, totalSupply, admin] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: ClankerToken_v4_abi,
        functionName: 'name',
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: ClankerToken_v4_abi,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: ClankerToken_v4_abi,
        functionName: 'totalSupply',
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: ClankerToken_v4_abi,
        functionName: 'admin',
      }),
    ]);

    console.log(`   Name: ${name}`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Total Supply: ${(Number(totalSupply) / 1e18).toLocaleString()} tokens`);
    console.log(`   Admin: ${admin}`);
  } catch (error) {
    console.log('   Error reading token information');
  }
}

main().catch(console.error);