# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Clanker SDK** - a TypeScript SDK for deploying tokens on Base using the Clanker protocol. The project supports multiple protocol versions (V3, V3.1, V4) with V4 being the latest and most feature-rich.

## Development Commands

```bash
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

## Architecture

### Core Components

- **Main SDK Class**: `src/index.ts` - The `Clanker` class provides the primary interface for token deployment, rewards claiming, and simulation
- **Protocol Versions**: 
  - V3: Basic token deployment (`src/deployment/v3.ts`)
  - V4: Advanced deployment with hooks, vaults, airdrops (`src/deployment/v4.ts`)
- **Configuration Builders**: `src/config/builders.ts` - Fluent builders for token configurations
- **Extensions**: `src/extensions/` - Modular extensions for airdrops, dev buys, vaults

### Key Directories

- `src/abi/` - Contract ABIs organized by protocol version and external contracts (Uniswap)
- `src/types/` - TypeScript type definitions for all configurations and parameters
- `src/services/` - Core services like vanity address generation and transaction building
- `src/utils/` - Utilities for validation, merkle trees, address generation
- `examples/` - Example deployment scripts for different use cases

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