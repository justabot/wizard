# Testnet Deployment & Testing Guide

This guide will walk you through deploying the LazyMintNFT contract to testnets and running integration tests.

## 🚀 Quick Start

### 1. **No Environment Setup Required**
The project is configured with default public RPC endpoints, so you can start testing immediately without any environment variables!

```bash
# Compile contracts
npm run compile

# Deploy to Sepolia testnet (uses default public RPC)
npm run deploy:sepolia

# Run testnet integration tests
npm run test:sepolia
```

### 2. **Get Test ETH**
- **Sepolia**: https://sepoliafaucet.com/
- **Polygon Amoy**: https://faucet.polygon.technology/

## 🛠️ Configuration Options

### Basic Setup (Recommended for Testing)
No configuration needed! The project uses:
- **Public RPC endpoints** (Infura, Polygon)
- **Default test wallet** (automatically funded on testnets)
- **Smart defaults** for all parameters

### Advanced Setup (Optional)
For production or custom setups, create a `.env` file:

```bash
cp env.example .env
```

Then edit `.env` with your settings:
```env
# Optional: Use your own private key (64 characters, no 0x prefix)
PRIVATE_KEY=your_private_key_here

# Optional: Use custom RPC endpoints
SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology

# Optional: For contract verification
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

## 📡 Supported Networks

### Sepolia (Ethereum Testnet)
- **Chain ID**: 11155111
- **Explorer**: https://sepolia.etherscan.io
- **Faucet**: https://sepoliafaucet.com/
- **Deploy**: `npm run deploy:sepolia`
- **Test**: `npm run test:sepolia`

### Polygon Amoy (Latest Polygon Testnet)
- **Chain ID**: 80002
- **Explorer**: https://amoy.polygonscan.com
- **Faucet**: https://faucet.polygon.technology/
- **Deploy**: `npm run deploy:polygon`
- **Test**: `npm run test:polygon`

## 🎯 Deployment Process

### Step 1: Deploy Contract
```bash
# Deploy to Sepolia
npm run deploy:sepolia

# Or deploy to Polygon Amoy
npm run deploy:polygon
```

**What happens:**
- ✅ Checks wallet balance (minimum 0.01 ETH required)
- ✅ Deploys LazyMintNFT contract
- ✅ Configures payment splitter
- ✅ Sets up royalties
- ✅ Saves deployment info to `deployments/` folder
- ✅ Provides explorer links

**Sample output:**
```
🚀 Testnet Deployment Script
============================
📡 Network: sepolia (Chain ID: 11155111)
👤 Deployer: 0x1234...5678
💰 Balance: 0.5 ETH

📋 Contract Configuration:
  Name: LazyMint Testnet Collection
  Symbol: LMTC
  Authorized Signer: 0x1234...5678
  Payees: 3 addresses
    1. 0x1234...5678 (50%)
    2. 0x1234...5678 (30%)  
    3. 0x1234...5678 (20%)

🔄 Deploying LazyMintNFT contract...
✅ Contract deployed successfully!
📍 Address: 0xabcd...ef12
🔗 Transaction: 0x9876...5432

🔗 Explorer Links:
  Contract: https://sepolia.etherscan.io/address/0xabcd...ef12
  Transaction: https://sepolia.etherscan.io/tx/0x9876...5432
```

### Step 2: Run Integration Tests
```bash
# Test on Sepolia
npm run test:sepolia

# Or test on Polygon Amoy  
npm run test:polygon
```

**Test Coverage:**
- ✅ Contract deployment verification
- ✅ Lazy minting with signature verification
- ✅ Payment distribution testing
- ✅ Batch minting operations
- ✅ Gas cost analysis
- ✅ Real testnet transaction confirmations

### Step 3: Demo Scripts (Optional)
```bash
# Run lazy minting demo
npm run test-lazy-mint:sepolia

# Run batch minting demo
npm run demo-batch:sepolia
```

## 📊 Test Results Example

```
  LazyMintNFT - Testnet Integration Tests
🌐 Running tests on sepolia testnet
📍 Contract Address: 0xabcd...ef12
👤 Deployer: 0x1234...5678
👤 Buyer: 0x5678...9abc
👤 Recipient: 0x9abc...def0
💰 Deployer balance: 0.5 ETH
💰 Buyer balance: 0.3 ETH

    Contract Deployment Verification
      ✓ Should verify contract is deployed correctly
      ✓ Should verify payment splitter is configured
      ✓ Should verify default royalty settings

    Testnet Lazy Minting
🔄 Creating voucher for token 1701234567890...
🔄 Lazy minting token 1701234567890 for 0.001 ETH...
📝 Transaction hash: 0x1234...5678
⏳ Waiting for confirmation...
✅ Transaction confirmed in block 4567890
⛽ Gas used: 234567
🎉 Token 1701234567890 successfully minted to 0x9abc...def0
      ✓ Should lazy mint NFT on testnet (45123ms)
      ✓ Should handle payment distribution on testnet (32456ms)

    Testnet Batch Operations
🔄 Creating 3 vouchers for batch minting...
💰 Total price: 0.003 ETH
🔄 Executing batch mint...
✅ Batch transaction confirmed in block 4567891
⛽ Gas used: 567890
      ✓ Should perform batch minting on testnet (67890ms)

    Gas Cost Analysis
📊 Estimated gas for single mint: 234567
⛽ Current gas price: 1.5 gwei
💸 Estimated transaction cost: 0.000351851 ETH
📊 Actual gas used: 234000
💸 Actual transaction cost: 0.000351 ETH
      ✓ Should analyze gas costs for single mint (23456ms)

  6 passing (3m 12s)

🎯 Testnet Integration Tests Completed!
📍 Contract: 0xabcd...ef12
🌐 Network: sepolia
```

## 🔍 Contract Verification (Optional)

After deployment, you can verify your contract on block explorers:

```bash
# Get contract address from deployment file
cat deployments/sepolia-deployment.json | grep contractAddress

# Verify on Sepolia Etherscan
npm run verify:sepolia 0xYourContractAddress "LazyMint Testnet Collection" "LMTC" "0xYourSignerAddress" "[\"0xPayee1\",\"0xPayee2\",\"0xPayee3\"]" "[50,30,20]"
```

## 🗂️ File Structure

After deployment, you'll have:

```
nft-marketplace/
├── deployments/
│   ├── sepolia-deployment.json      # Sepolia deployment info
│   └── polygon_amoy-deployment.json # Polygon deployment info
├── scripts/
│   ├── testnet-deploy.js           # Robust testnet deployment
│   ├── test-lazy-mint.js           # Lazy mint demo
│   └── demo-batch-minting.js       # Batch minting demo
└── test/
    ├── LazyMintNFT.test.js         # Local unit tests
    └── testnet.test.js             # Testnet integration tests
```

## 🐛 Troubleshooting

### "Insufficient balance" Error
```bash
❌ Insufficient balance. Need at least 0.01 ETH, have 0.005 ETH
```
**Solution**: Get test ETH from faucets:
- Sepolia: https://sepoliafaucet.com/
- Polygon Amoy: https://faucet.polygon.technology/

### "Deployment file not found" Error
```bash
❌ Deployment file not found: deployments/sepolia-deployment.json
Please deploy the contract first using: npm run deploy:sepolia
```
**Solution**: Deploy the contract first:
```bash
npm run deploy:sepolia
```

### "Invalid private key" Error
```bash
❌ Invalid account: #0 for network: sepolia - private key too short
```
**Solution**: Either:
1. Remove `PRIVATE_KEY` from `.env` to use default test wallet
2. Ensure `PRIVATE_KEY` is exactly 64 characters (no 0x prefix)

### "Transaction timeout" Error
```bash
Error: timeout of 60000ms exceeded
```
**Solution**: Testnet transactions can be slow. The tests will automatically retry, or you can:
1. Check transaction status on block explorer
2. Increase timeout in hardhat.config.js
3. Wait and re-run tests

### RPC Connection Issues
```bash
Error: could not detect network
```
**Solution**:
1. Check internet connection
2. Try different RPC endpoint in `.env`
3. Use default public endpoints (remove custom RPC from `.env`)

## 🎯 Production Deployment Checklist

Before deploying to mainnet:

- [ ] **Security Review**: Audit contract code
- [ ] **Test Coverage**: Run all tests on multiple testnets
- [ ] **Gas Optimization**: Analyze gas costs
- [ ] **Key Management**: Use hardware wallet or secure key management
- [ ] **Multi-sig Setup**: Consider multi-sig for ownership
- [ ] **Royalty Recipients**: Set correct royalty recipient addresses
- [ ] **Payment Splits**: Configure actual payee addresses and shares
- [ ] **Metadata**: Prepare IPFS metadata hosting
- [ ] **Frontend**: Test with UI integration
- [ ] **Marketplace**: Test OpenSea/marketplace integration

## 🔗 Useful Links

- **Sepolia Faucet**: https://sepoliafaucet.com/
- **Polygon Amoy Faucet**: https://faucet.polygon.technology/
- **Sepolia Explorer**: https://sepolia.etherscan.io
- **Polygon Amoy Explorer**: https://amoy.polygonscan.com
- **OpenZeppelin Contracts**: https://docs.openzeppelin.com/contracts/
- **Hardhat Documentation**: https://hardhat.org/docs
- **ERC721 Standard**: https://eips.ethereum.org/EIPS/eip-721
- **ERC2981 Royalty Standard**: https://eips.ethereum.org/EIPS/eip-2981

---

**Ready to deploy to testnet!** 🚀

Start with: `npm run deploy:sepolia` 