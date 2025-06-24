import * as dotenv from 'dotenv';
import { createPublicClient, createWalletClient, http, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { ClankerAirdrop_abi } from './src/abi/v4/ClankerAirdrop.js';
import { createMerkleTree, getMerkleProof, type AirdropEntry } from './src/utils/merkleTree.js';

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
 * Airdrop claiming script for Base Sepolia testnet
 * This example demonstrates:
 * - How to recreate the merkle tree from the original airdrop entries
 * - How to generate merkle proofs for specific recipients
 * - How to claim airdrop tokens using the proof
 * - How to check available amounts to claim
 */
async function main(): Promise<void> {
  try {
    console.log('🔧 Initializing wallet and clients for Base Sepolia...');

    // Initialize wallet with private key
    const account = privateKeyToAccount(PRIVATE_KEY);
    console.log('📝 Claiming from address:', account.address);

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

    console.log('\n🎁 Claiming Airdrop Tokens\n');

    // Replace these with your actual deployment values
    const TOKEN_ADDRESS = '0xfA6CD9ED389bbA42191E64fCBE01eC804DC16d44'; // Replace with your deployed token address
    const AIRDROP_CONTRACT_ADDRESS = '0x29d17C1A8D851d7d4cA97FAe97AcAdb398D9cCE0'; // Replace with the airdrop contract address

    // Recreate the same airdrop entries used during deployment
    // This MUST match exactly what was used during deployment
    const totalSupply = 100_000_000_000; // 100 billion tokens (standard Clanker supply)
    const allocationAmount = totalSupply * 0.30; // 30% allocation = 30 billion tokens
    
    const airdropEntries: AirdropEntry[] = [
      { account: account.address, amount: allocationAmount }, // 30 billion tokens to deployer (30% of supply)
    ];

    // Recreate the merkle tree (must be identical to deployment)
    const { tree, entries } = createMerkleTree(airdropEntries);
    console.log('📊 Recreated merkle tree');

    // Find the entry for the current account
    const userEntry = airdropEntries.find(entry => 
      entry.account.toLowerCase() === account.address.toLowerCase()
    );

    if (!userEntry) {
      console.log('❌ No airdrop allocation found for address:', account.address);
      return;
    }

    console.log('✅ Found airdrop allocation:', userEntry.amount, 'tokens');

    // Generate merkle proof for this user
    const proof = getMerkleProof(tree, entries, account.address, userEntry.amount);
    console.log('🔐 Generated merkle proof with', proof.length, 'elements');

    // Check how much is available to claim
    const availableAmount = await publicClient.readContract({
      address: AIRDROP_CONTRACT_ADDRESS,
      abi: ClankerAirdrop_abi,
      functionName: 'amountAvailableToClaim',
      args: [TOKEN_ADDRESS, account.address, BigInt(userEntry.amount) * 10n ** 18n], // Convert to token decimals
    }) as bigint;

    console.log('💰 Available to claim:', availableAmount.toString(), 'wei');
    console.log('💰 Available to claim (human readable):', Number(availableAmount) / 1e18, 'tokens');

    if (availableAmount === 0n) {
      console.log('ℹ️  No tokens available to claim (may be in lockup/vesting period or already claimed)');
      
      // Check airdrop details
      const airdropInfo = await publicClient.readContract({
        address: AIRDROP_CONTRACT_ADDRESS,
        abi: ClankerAirdrop_abi,
        functionName: 'airdrops',
        args: [TOKEN_ADDRESS],
      }) as readonly [string, bigint, bigint, bigint, bigint];

      console.log('📊 Airdrop info:');
      console.log('  - Lockup end time:', new Date(Number(airdropInfo[3]) * 1000));
      console.log('  - Vesting end time:', new Date(Number(airdropInfo[4]) * 1000));
      console.log('  - Total supply:', airdropInfo[1].toString());
      console.log('  - Total claimed:', airdropInfo[2].toString());
      
      return;
    }

    // Claim the tokens
    console.log('🚀 Claiming airdrop tokens...');

    const claimTx = await wallet.writeContract({
      address: AIRDROP_CONTRACT_ADDRESS,
      abi: ClankerAirdrop_abi,
      functionName: 'claim',
      args: [
        TOKEN_ADDRESS,
        account.address,
        BigInt(userEntry.amount) * 10n ** 18n, // Convert to token decimals
        proof,
      ],
    });

    console.log('📝 Claim transaction hash:', claimTx);
    console.log('⏳ Waiting for confirmation...');

    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: claimTx });
    
    if (receipt.status === 'success') {
      console.log('✅ Airdrop claimed successfully!');
      console.log('🔍 View transaction:', `https://sepolia.basescan.org/tx/${claimTx}`);
    } else {
      console.log('❌ Claim transaction failed');
    }

  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Claim failed:', error.message);
    } else {
      console.error('❌ Claim failed with unknown error');
    }
    process.exit(1);
  }
}

// Helper function to check airdrop status without claiming
export async function checkAirdropStatus(
  publicClient: PublicClient,
  tokenAddress: `0x${string}`,
  airdropContractAddress: `0x${string}`,
  userAddress: `0x${string}`,
  allocatedAmount: bigint
): Promise<void> {
  try {
    const availableAmount = await publicClient.readContract({
      address: airdropContractAddress,
      abi: ClankerAirdrop_abi,
      functionName: 'amountAvailableToClaim',
      args: [tokenAddress, userAddress, allocatedAmount],
    }) as bigint;

    const airdropInfo = await publicClient.readContract({
      address: airdropContractAddress,
      abi: ClankerAirdrop_abi,
      functionName: 'airdrops',
      args: [tokenAddress],
    }) as readonly [string, bigint, bigint, bigint, bigint];

    console.log('\n📊 Airdrop Status for', userAddress);
    console.log('💰 Allocated amount:', Number(allocatedAmount) / 1e18, 'tokens');
    console.log('💰 Available to claim:', Number(availableAmount) / 1e18, 'tokens');
    console.log('🔒 Lockup end time:', new Date(Number(airdropInfo[3]) * 1000));
    console.log('⏳ Vesting end time:', new Date(Number(airdropInfo[4]) * 1000));
    console.log('📊 Total airdrop supply:', Number(airdropInfo[1]) / 1e18, 'tokens');
    console.log('📊 Total claimed so far:', Number(airdropInfo[2]) / 1e18, 'tokens');
  } catch (error) {
    console.error('❌ Failed to check airdrop status:', error);
  }
}

main().catch(console.error);