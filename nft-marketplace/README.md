# NFT Marketplace with Lazy Minting & Royalty Distribution

A comprehensive NFT marketplace implementation featuring lazy minting capabilities and automatic royalty distribution using OpenZeppelin contracts and Thirdweb SDK integration.

## 🚀 Features

### ✨ Core Features
- **Lazy Minting**: Mint NFTs on-demand with cryptographic signature verification
- **Royalty Distribution**: ERC2981-compliant royalties with automatic payment splitting
- **Batch Operations**: Mint multiple NFTs in a single transaction
- **Payment Splitting**: Automatic revenue distribution among multiple stakeholders
- **Security**: ReentrancyGuard, signature verification, and access controls

### 🔧 Technical Features
- **ERC721 Compliance**: Full ERC721 standard implementation with URI storage
- **EIP712 Signatures**: Typed structured data signing for secure lazy minting
- **OpenZeppelin Integration**: Battle-tested smart contract components
- **Upgradeable Royalties**: Configurable royalty rates per token or globally
- **Gas Optimized**: Efficient contract design for minimal gas costs

## 📋 Prerequisites

- Node.js >= 16.0.0
- npm or yarn
- Hardhat development environment
- Testnet ETH (for deployment and testing)

## 🛠️ Installation & Setup

1. **Clone and Install Dependencies**
   ```bash
   git clone <repository-url>
   cd nft-marketplace
   npm install
   ```

2. **Environment Configuration (Optional)**
   ```bash
   cp env.example .env
   ```
   
   Fill in your environment variables for testnet deployment:
   ```env
   PRIVATE_KEY=your_private_key_without_0x_prefix
   SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
   POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
   ETHERSCAN_API_KEY=your_etherscan_api_key
   POLYGONSCAN_API_KEY=your_polygonscan_api_key
   ```

   **Note**: For local testing, environment variables are optional. The hardhat configuration includes fallback values for testing.

3. **Compile Contracts**
   ```bash
   npm run compile
   ```

   If you see compilation success message:
   ```
   Compiled 30 Solidity files successfully (evm target: paris).
   ```

## 🧪 Testing

### Local Testing
```bash
# Run all tests
npm test

# Run tests with coverage (if configured)
npm run test:coverage

# Start local Hardhat node
npm run node

# Run batch minting demo
npm run demo-batch:local
```

### Testnet Testing
```bash
# Deploy to Sepolia testnet
npm run deploy:sepolia

# Test lazy minting on Sepolia
npm run test-lazy-mint:sepolia

# Deploy to Polygon Amoy testnet
npm run deploy:polygon

# Test lazy minting on Polygon
npm run test-lazy-mint:polygon
```

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. Hardhat Configuration Errors
**Problem**: `Invalid account: #0 for network: polygon_mumbai - private key too short`

**Solution**: This happens when `PRIVATE_KEY` environment variable is set but invalid. The project includes fallback configuration:
- For local testing: No environment variables needed
- For testnet: Ensure `PRIVATE_KEY` is exactly 64 characters (without 0x prefix)
- Or simply don't set `PRIVATE_KEY` for local testing

#### 2. OpenZeppelin Compatibility Issues
**Problem**: Compilation errors with `Ownable` constructor or `_burn` override

**Solution**: Already fixed in the contract! The project uses:
- `_transferOwnership(msg.sender)` instead of `Ownable(msg.sender)`
- Correct override hierarchy: `override(ERC721URIStorage, ERC721Royalty)`

#### 3. Hardhat Installation Issues
**Problem**: `Trying to use a non-local installation of Hardhat`

**Solution**: 
```bash
# Remove any global Hardhat installation
npm uninstall -g hardhat

# Install locally
npm install

# Use npx for commands
npx hardhat compile
```

#### 4. Dependency Warnings
**Expected**: You may see deprecation warnings during `npm install`. These are from underlying dependencies and don't affect functionality:
```
npm warn deprecated inflight@1.0.6: This module is not supported
npm warn deprecated glob@8.1.0: Glob versions prior to v9 are no longer supported
```

**Solution**: These warnings are expected and don't impact the project. The core functionality remains stable.

### Testing Process

1. **First-time Setup**:
   ```bash
   npm install          # Install dependencies
   npx hardhat compile  # Compile contracts
   npm test            # Run comprehensive tests
   ```

2. **Expected Test Output**:
   ```
   LazyMintNFT
     Contract Deployment
       ✓ Should set the correct owner
       ✓ Should set the correct authorized signer
       ✓ Should initialize payment splitter correctly
       ✓ Should set default royalty correctly
     
     Lazy Minting
       ✓ Should lazy mint NFT with valid voucher
       ✓ Should set token-specific royalty correctly
       ✓ Should fail with insufficient payment
       ✓ Should fail with invalid signature
       ✓ Should fail when reusing signature
     
     Payment Distribution
       ✓ Should distribute payments correctly through PaymentSplitter
   ```

3. **End-to-End Testing**:
   ```bash
   # Start local node (optional, for manual testing)
   npx hardhat node

   # Deploy locally
   npm run deploy:local

   # Test lazy minting functionality
   npm run test-lazy-mint:local
   ```

## 📦 Contract Architecture

### LazyMintNFT.sol
The main contract implementing:
- **ERC721URIStorage**: NFT standard with metadata URIs
- **ERC721Royalty**: ERC2981 royalty standard
- **PaymentSplitter**: Automatic revenue distribution
- **EIP712**: Structured data signing for vouchers

### Key Components

#### Lazy Mint Voucher Structure
```solidity
struct LazyMintVoucher {
    uint256 tokenId;
    string uri;
    uint256 price;
    address recipient;
    uint96 royaltyFee;
    address royaltyRecipient;
    bytes signature;
}
```

#### Payment Distribution
- Configurable payment splitting among multiple parties
- Automatic distribution of primary sales revenue
- Individual claim mechanism for gas efficiency

#### Royalty Management
- Default royalty settings for all tokens
- Per-token royalty overrides
- ERC2981 standard compliance for marketplace integration

## 🔄 Usage Examples

### 1. Creating a Lazy Mint Voucher

```javascript
const voucher = await createLazyMintVoucher(
    contract,
    authorizedSigner,
    tokenId,
    "ipfs://QmYourMetadata/token.json",
    ethers.parseEther("0.1"), // 0.1 ETH
    recipientAddress,
    500, // 5% royalty
    royaltyRecipientAddress
);
```

### 2. Lazy Minting

```javascript
// Single NFT
await contract.connect(buyer).lazyMint(voucher, { 
    value: voucher.price 
});

// Batch minting
await contract.connect(buyer).batchLazyMint(vouchers, { 
    value: totalPrice 
});
```

### 3. Payment Distribution

```javascript
// Check releasable amount
const amount = await contract.releasable(payeeAddress);

// Release payment
await contract.release(payeeAddress);
```

### 4. Royalty Configuration

```javascript
// Set default royalty (10%)
await contract.setDefaultRoyalty(recipientAddress, 1000);

// Set token-specific royalty (7.5%)
await contract.setTokenRoyalty(tokenId, recipientAddress, 750);
```

## 🌐 Deployment

### Local Deployment
```bash
npm run deploy:local
```

### Testnet Deployment
```bash
# Sepolia
npm run deploy:sepolia

# Polygon Amoy
npm run deploy:polygon
```

### Contract Verification
```bash
# After deployment, verify on Etherscan/Polygonscan
npm run verify:sepolia -- CONTRACT_ADDRESS "LazyMint Collection" "LMC" "SIGNER_ADDRESS" "[\"PAYEE1\",\"PAYEE2\"]" "[50,50]"
```

## 🔐 Security Features

- **Signature Verification**: EIP712 typed data signing prevents unauthorized minting
- **Reentrancy Protection**: ReentrancyGuard on all payable functions
- **Access Control**: Owner-only functions for critical operations
- **Signature Replay Protection**: Used signatures are tracked and prevented from reuse
- **Payment Validation**: Price and payment amount verification

## 🧩 Integration Examples

### Frontend Integration with ethers.js
```javascript
// Connect to contract
const contract = new ethers.Contract(
    contractAddress, 
    contractABI, 
    provider
);

// Create voucher signature
const signature = await signer._signTypedData(domain, types, voucher);

// Mint NFT
const tx = await contract.lazyMint(
    { ...voucher, signature },
    { value: voucher.price }
);
```

### Thirdweb SDK Integration
```javascript
import { ThirdwebSDK } from "@thirdweb-dev/sdk";

const sdk = new ThirdwebSDK("polygon");
const contract = await sdk.getContract(contractAddress);

// Use contract methods through Thirdweb
await contract.call("lazyMint", [voucher], { value: price });
```

## 📊 Test Results

The comprehensive test suite covers:
- ✅ Contract deployment and initialization
- ✅ Lazy minting with signature verification
- ✅ Batch minting operations (NEW!)
- ✅ Payment distribution and splitting
- ✅ Royalty management and ERC2981 compliance
- ✅ Access control and security features
- ✅ Error handling and edge cases

### Sample Test Output
```
LazyMintNFT
  Contract Deployment
    ✓ Should set the correct owner
    ✓ Should set the correct authorized signer
    ✓ Should initialize payment splitter correctly
    ✓ Should set default royalty correctly
  
  Lazy Minting
    ✓ Should lazy mint NFT with valid voucher
    ✓ Should set token-specific royalty correctly
    ✓ Should fail with insufficient payment
    ✓ Should fail with invalid signature
    ✓ Should fail when reusing signature
  
  Payment Distribution
    ✓ Should distribute payments correctly through PaymentSplitter
  
  Batch Operations
    ✓ Should batch mint multiple NFTs successfully
    ✓ Should distribute payments correctly for batch minting
    ✓ Should fail batch mint with insufficient payment
    ✓ Should fail if any signature in batch is invalid
    ✓ Should fail if any signature in batch is already used
    ✓ Should handle batch minting with different royalty settings
    ✓ Should handle empty batch array
  
  Royalty Management
    ✓ Should update default royalty settings
    ✓ Should only allow owner to mint directly
  
  ERC721 Compliance
    ✓ Should return correct token URI
    ✓ Should transfer tokens correctly

  21 passing (614ms)
```

## 🛠️ Development Notes

### OpenZeppelin Compatibility
- Uses OpenZeppelin v4.9.6
- Compatible constructor patterns for `Ownable`
- Correct override inheritance for multiple inheritance

### Hardhat Configuration
- Supports local development without environment variables
- Fallback private keys for testing
- Multiple network configurations (Sepolia, Polygon Amoy)

### Gas Optimization
- Efficient batch operations
- Minimal storage operations
- Optimized compiler settings

## 🛣️ Roadmap

- [ ] ERC1155 multi-token support
- [ ] Dutch auction mechanism
- [ ] Fixed-price marketplace
- [ ] Stripe integration for fiat payments
- [ ] IPFS metadata pinning service
- [ ] Frontend dashboard
- [ ] Mobile app integration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Useful Links

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Thirdweb Documentation](https://portal.thirdweb.com/)
- [ERC721 Standard](https://eips.ethereum.org/EIPS/eip-721)
- [ERC2981 Royalty Standard](https://eips.ethereum.org/EIPS/eip-2981)
- [EIP712 Typed Data](https://eips.ethereum.org/EIPS/eip-712)

---

**Ready to showcase your Web3 development skills!** 🚀

This implementation demonstrates:
- Advanced smart contract development
- Cryptographic signature verification
- Payment distribution mechanisms
- Gas-optimized operations
- Comprehensive testing
- Production-ready security features
