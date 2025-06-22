# Base Sepolia Token Deployment

This guide shows how to deploy a token on Base Sepolia testnet using the Clanker SDK.

## Prerequisites

1. **Node.js/Bun**: Make sure you have Bun installed
2. **Base Sepolia ETH**: You need testnet ETH for gas fees
   - Get Base Sepolia ETH from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
3. **Private Key**: A wallet private key with Base Sepolia ETH

## Setup

1. **Install Dependencies**
   ```bash
   bun install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your private key:
   ```
   PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
   ```

## Deploy Token

Run the deployment script:

```bash
bun deploy-sepolia.ts
```

## What the Script Does

The `deploy-sepolia.ts` script:

1. **Connects to Base Sepolia** using your private key
2. **Deploys a V3 token** with minimal configuration:
   - Token Name: "Test Token"
   - Symbol: "TEST"
   - Initial Market Cap: 1 ETH (small for testnet)
   - Vault: 5% tokens locked for 7 days
   - No dev buy (saves gas)

3. **Returns deployment info** including:
   - Token contract address
   - Base Sepolia block explorer link

## Customization

Edit the `deploy-sepolia.ts` file to customize:

- **Token details**: name, symbol, description
- **Market cap**: `initialMarketCap` (in ETH)
- **Vesting**: `vault.percentage` and `vault.durationInDays`
- **Rewards**: `rewardsConfig` percentages

## Network Details

- **Chain**: Base Sepolia (testnet)
- **Chain ID**: 84532
- **RPC**: https://sepolia.base.org
- **Explorer**: https://sepolia.basescan.org

## Troubleshooting

**"Insufficient funds"**: Make sure your wallet has Base Sepolia ETH

**"Invalid private key"**: Ensure your private key starts with `0x`

**"Network error"**: Check your internet connection and RPC URL