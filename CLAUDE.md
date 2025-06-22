# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains both the **Clanker SDK** and **Clanker Smart Contracts**:

- **`clanker-sdk/`** - TypeScript SDK for deploying tokens on Base using the Clanker protocol. Supports multiple protocol versions (V3, V3.1, V4) with V4 being the latest and most feature-rich.
- **`v4.0-contracts/`** - Solidity smart contracts for Clanker V4.0 protocol including core deployment contracts, hooks, extensions, and utilities.

## Development Commands

### Clanker SDK (`clanker-sdk/`)
```bash
# Navigate to SDK directory
cd clanker-sdk

# Install dependencies
bun i

# Lint and typecheck
bun lint                    # Runs biome check and TypeScript compilation
bun format                  # Auto-format code with biome

# Build
bun publish-package         # Build with tsup and publish to npm

# Run examples
bun examples/v4/availableRewards.ts
bun examples/v4/deployV4.ts

# Run tests
bun test

# CLI usage
bun src/cli/create-clanker  # Interactive token deployment
```

### Smart Contracts (`v4.0-contracts/`)
```bash
# Navigate to contracts directory
cd v4.0-contracts

# Install dependencies
forge install

# Build contracts
forge build

# Run tests
forge test

# Deploy contracts (requires environment configuration)
forge script script/Deploy.s.sol --rpc-url <RPC_URL> --private-key <PRIVATE_KEY>
```

## Architecture

### Clanker SDK (`clanker-sdk/`)

#### Core Components

- **Main SDK Class**: `src/index.ts` - The `Clanker` class provides the primary interface for token deployment, rewards claiming, and simulation
- **Protocol Versions**: 
  - V3: Basic token deployment (`src/deployment/v3.ts`)
  - V4: Advanced deployment with hooks, vaults, airdrops (`src/deployment/v4.ts`)
- **Configuration Builders**: `src/config/builders.ts` - Fluent builders for token configurations
- **Extensions**: `src/extensions/` - Modular extensions for airdrops, dev buys, vaults

#### Key Directories

- `src/abi/` - Contract ABIs organized by protocol version and external contracts (Uniswap)
- `src/types/` - TypeScript type definitions for all configurations and parameters
- `src/services/` - Core services like vanity address generation and transaction building
- `src/utils/` - Utilities for validation, merkle trees, address generation
- `examples/` - Example deployment scripts for different use cases

### Smart Contracts (`v4.0-contracts/`)

#### Core Contracts

- **`src/Clanker.sol`** - Main deployment contract for V4.0 protocol
- **`src/ClankerToken.sol`** - ERC-20 token implementation with Clanker-specific features
- **`src/ClankerFeeLocker.sol`** - Fee collection and distribution mechanism

#### Extensions

- **`src/extensions/ClankerAirdrop.sol`** - Merkle tree-based token airdrops
- **`src/extensions/ClankerVault.sol`** - Token vesting and lockup functionality
- **`src/extensions/ClankerUniv4EthDevBuy.sol`** - Automated initial token purchases

#### Hooks

- **`src/hooks/ClankerHook.sol`** - Base Uniswap V4 hook implementation
- **`src/hooks/ClankerHookDynamicFee.sol`** - Dynamic fee adjustment hook
- **`src/hooks/ClankerHookStaticFee.sol`** - Static fee configuration hook

#### Utilities

- **`src/utils/ClankerDeployer.sol`** - Deployment utility contract
- **`src/lp-lockers/ClankerLpLockerMultiple.sol`** - LP token locking mechanisms
- **`src/mev-modules/ClankerMevBlockDelay.sol`** - MEV protection module

### Protocol Architecture

The SDK abstracts multiple Clanker protocol versions:

1. **V3**: Standard ERC-20 deployment with Uniswap V3 liquidity
2. **V4**: Advanced protocol with:
   - Uniswap V4 hooks integration
   - Fee configuration and rewards distribution
   - Token vaults with lockup/vesting
   - Airdrop functionality with merkle proofs
   - LP locking mechanisms

### Configuration System

Token deployments use structured configuration objects:
- `TokenConfig` (V3) - Basic token parameters
- `TokenConfigV4` (V4) - Comprehensive configuration including hooks, fees, rewards
- Builder pattern available via `TokenConfigV4Builder` for fluent configuration

### Extension System

V4 deployments support modular extensions:
- `AirdropExtension` - Handles merkle tree airdrops
- `DevBuyExtension` - Automated initial token purchases  
- `VaultExtension` - Token vesting and lockup functionality

## Testing

- Uses Bun's built-in test runner
- Tests located in `test/` directory
- Focus on deployment transaction building and validation
- Run with `bun test`

## Build Configuration

- **TypeScript**: ES2024 target, node module resolution
- **Bundling**: tsup with ESM output, TypeScript declarations
- **Linting**: Biome for formatting and linting (see `biome.json`)
- **CLI**: Built as executable with shebang for `npx` usage

## Key External Dependencies

- **viem**: Ethereum client library for blockchain interactions
- **zod**: Runtime type validation and schema definitions  
- **@openzeppelin/merkle-tree**: Merkle tree implementation for airdrops
- **inquirer**: Interactive CLI prompts for token creation