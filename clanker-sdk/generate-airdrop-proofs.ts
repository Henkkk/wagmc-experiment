import { createMerkleTree, getMerkleProof, type AirdropEntry } from './src/utils/merkleTree.js';

/**
 * Utility script to generate merkle proofs for airdrop recipients
 * This can be used to generate proofs for any recipient in the airdrop
 */

// The same airdrop entries used during deployment
// This MUST match exactly what was used during deployment
const airdropEntries: AirdropEntry[] = [
  { account: '0x...', amount: 1000 }, // Replace with actual deployer address
];

function generateProofsForAllRecipients() {
  console.log('🌳 Generating merkle tree and proofs for all recipients...\n');

  // Create the merkle tree
  const { tree, root, entries } = createMerkleTree(airdropEntries);
  
  console.log('📊 Merkle Root:', root);
  console.log('📊 Total Recipients:', airdropEntries.length);
  console.log('📊 Total Airdrop Amount:', airdropEntries.reduce((sum, entry) => sum + entry.amount, 0), 'tokens\n');

  // Generate proofs for each recipient
  airdropEntries.forEach((entry, index) => {
    console.log(`👤 Recipient ${index + 1}:`);
    console.log(`   Address: ${entry.account}`);
    console.log(`   Amount: ${entry.amount} tokens`);
    
    try {
      const proof = getMerkleProof(tree, entries, entry.account, entry.amount);
      console.log(`   Proof: [${proof.map(p => `"${p}"`).join(', ')}]`);
      console.log(`   Proof Length: ${proof.length} elements`);
    } catch (error) {
      console.log(`   ❌ Error generating proof: ${error}`);
    }
    console.log('');
  });
}

function generateProofForSpecificRecipient(address: `0x${string}`, amount: number) {
  console.log(`🔐 Generating proof for ${address} (${amount} tokens)...\n`);

  const { tree, root, entries } = createMerkleTree(airdropEntries);
  
  try {
    const proof = getMerkleProof(tree, entries, address, amount);
    
    console.log('📊 Merkle Root:', root);
    console.log('👤 Recipient:', address);
    console.log('💰 Amount:', amount, 'tokens');
    console.log('🔐 Proof:');
    console.log(`[${proof.map(p => `"${p}"`).join(', ')}]`);
    console.log('\n📋 Ready to use in claim function:');
    console.log(`Address: ${address}`);
    console.log(`Amount (wei): ${BigInt(amount) * 10n ** 18n}`);
    console.log(`Proof: [${proof.map(p => `"${p}"`).join(', ')}]`);
    
  } catch (error) {
    console.log(`❌ Error: ${error}`);
  }
}

// Export functions for use in other scripts
export { generateProofsForAllRecipients, generateProofForSpecificRecipient, airdropEntries };

// Run if called directly (for Bun)
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Generate proofs for all recipients
    generateProofsForAllRecipients();
  } else if (args.length === 2) {
    // Generate proof for specific recipient
    const address = args[0] as `0x${string}`;
    const amount = parseInt(args[1]);
    
    if (!address.startsWith('0x') || address.length !== 42) {
      console.error('❌ Invalid address format. Must be a valid Ethereum address (0x...)');
      process.exit(1);
    }
    
    if (isNaN(amount) || amount <= 0) {
      console.error('❌ Invalid amount. Must be a positive number');
      process.exit(1);
    }
    
    generateProofForSpecificRecipient(address, amount);
  } else {
    console.log('Usage:');
    console.log('  Generate proofs for all recipients: bun generate-airdrop-proofs.ts');
    console.log('  Generate proof for specific recipient: bun generate-airdrop-proofs.ts <address> <amount>');
    console.log('');
    console.log('Examples:');
    console.log('  bun generate-airdrop-proofs.ts');
    console.log('  bun generate-airdrop-proofs.ts 0x742d35Cc6634C0532925a3b8D4ed6c4e5e2A2b9e 1000');
  }
}