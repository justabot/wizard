const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

describe("LazyMintNFT - Testnet Integration Tests", function () {
  let lazyMintNFT;
  let deployer, buyer, recipient;
  let contractAddress;
  let deploymentInfo;

  const TOKEN_URI_BASE = "ipfs://QmTestnet";
  const TOKEN_PRICE = ethers.utils.parseEther("0.001"); // Small amount for testnet
  const ROYALTY_FEE = 500; // 5%

  before(async function () {
    // This test suite is designed for testnet only
    if (hre.network.name === "hardhat") {
      this.skip();
    }

    console.log(`🌐 Running tests on ${hre.network.name} testnet`);

    // Load deployment info
    const deploymentFile = path.join(__dirname, '..', 'deployments', `${hre.network.name}-deployment.json`);
    
    if (!fs.existsSync(deploymentFile)) {
      throw new Error(`❌ Deployment file not found: ${deploymentFile}\nPlease deploy the contract first using:\nnpm run deploy:${hre.network.name}`);
    }

    deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    contractAddress = deploymentInfo.contractAddress;
    
    console.log(`📍 Contract Address: ${contractAddress}`);
    console.log(`🕒 Deployed: ${deploymentInfo.deployedAt}`);

    // Get signers
    [deployer, buyer, recipient] = await ethers.getSigners();
    
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`👤 Buyer: ${buyer.address}`);
    console.log(`👤 Recipient: ${recipient.address}`);

    // Connect to deployed contract
    const LazyMintNFT = await ethers.getContractFactory("LazyMintNFT");
    lazyMintNFT = LazyMintNFT.attach(contractAddress);

    // Verify contract is accessible
    try {
      const owner = await lazyMintNFT.owner();
      console.log(`✅ Contract owner: ${owner}`);
    } catch (error) {
      throw new Error(`❌ Cannot connect to contract at ${contractAddress}: ${error.message}`);
    }

    // Check balances
    const deployerBalance = await ethers.provider.getBalance(deployer.address);
    const buyerBalance = await ethers.provider.getBalance(buyer.address);
    
    console.log(`💰 Deployer balance: ${ethers.utils.formatEther(deployerBalance)} ETH`);
    console.log(`💰 Buyer balance: ${ethers.utils.formatEther(buyerBalance)} ETH`);

    // Ensure buyer has enough balance for testing
    const minBalance = ethers.utils.parseEther("0.01");
    if (buyerBalance.lt(minBalance)) {
      console.warn(`⚠️  Warning: Buyer balance is low. Some tests may fail.`);
    }
  });

  async function createLazyMintVoucher(tokenId, uri, price, recipientAddr, royaltyFee, royaltyRecipient) {
    const domain = {
      name: deploymentInfo.contractName,
      version: "1.0.0",
      chainId: await ethers.provider.getNetwork().then(n => n.chainId),
      verifyingContract: contractAddress
    };

    const types = {
      LazyMintVoucher: [
        { name: "tokenId", type: "uint256" },
        { name: "uri", type: "string" },
        { name: "price", type: "uint256" },
        { name: "recipient", type: "address" },
        { name: "royaltyFee", type: "uint96" },
        { name: "royaltyRecipient", type: "address" }
      ]
    };

    const voucher = {
      tokenId: tokenId,
      uri: uri,
      price: price,
      recipient: recipientAddr,
      royaltyFee: royaltyFee,
      royaltyRecipient: royaltyRecipient
    };

    const signature = await deployer._signTypedData(domain, types, voucher);
    return { ...voucher, signature };
  }

  describe("Contract Deployment Verification", function () {
    it("Should verify contract is deployed correctly", async function () {
      expect(await lazyMintNFT.owner()).to.equal(deploymentInfo.deployer);
      expect(await lazyMintNFT.authorizedSigner()).to.equal(deploymentInfo.authorizedSigner);
    });

    it("Should verify payment splitter is configured", async function () {
      const totalShares = await lazyMintNFT.totalShares();
      expect(totalShares).to.be.gt(0);

      console.log(`📊 Total shares: ${totalShares}`);
    });

    it("Should verify default royalty settings", async function () {
      const defaultRoyaltyFee = await lazyMintNFT.defaultRoyaltyFee();
      const defaultRoyaltyRecipient = await lazyMintNFT.defaultRoyaltyRecipient();
      
      expect(defaultRoyaltyFee).to.equal(500); // 5%
      expect(defaultRoyaltyRecipient).to.equal(deploymentInfo.deployer);

      console.log(`👑 Default royalty: ${defaultRoyaltyFee} basis points to ${defaultRoyaltyRecipient}`);
    });
  });

  describe("Testnet Lazy Minting", function () {
    it("Should lazy mint NFT on testnet", async function () {
      this.timeout(60000); // 60 seconds timeout for testnet transactions

      const tokenId = Date.now(); // Use timestamp for unique token ID
      const tokenUri = `${TOKEN_URI_BASE}/${tokenId}.json`;
      
      console.log(`🔄 Creating voucher for token ${tokenId}...`);
      
      const voucher = await createLazyMintVoucher(
        tokenId,
        tokenUri,
        TOKEN_PRICE,
        recipient.address,
        ROYALTY_FEE,
        recipient.address
      );

      console.log(`🔄 Lazy minting token ${tokenId} for ${ethers.utils.formatEther(TOKEN_PRICE)} ETH...`);

      // Record initial balances
      const recipientInitialBalance = await ethers.provider.getBalance(recipient.address);
      const buyerInitialBalance = await ethers.provider.getBalance(buyer.address);

      // Perform lazy mint
      const tx = await lazyMintNFT.connect(buyer).lazyMint(voucher, { 
        value: TOKEN_PRICE,
        gasLimit: 500000 // Set explicit gas limit for testnet
      });

      console.log(`📝 Transaction hash: ${tx.hash}`);
      console.log(`⏳ Waiting for confirmation...`);

      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
      console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);

      // Verify token was minted
      expect(await lazyMintNFT.ownerOf(tokenId)).to.equal(recipient.address);
      expect(await lazyMintNFT.tokenURI(tokenId)).to.equal(tokenUri);
      expect(await lazyMintNFT.tokenExists(tokenId)).to.be.true;

      console.log(`🎉 Token ${tokenId} successfully minted to ${recipient.address}`);

      // Verify royalty info
      const salePrice = ethers.utils.parseEther("1");
      const [royaltyRecipient, royaltyAmount] = await lazyMintNFT.royaltyInfo(tokenId, salePrice);
      
      expect(royaltyRecipient).to.equal(recipient.address);
      expect(royaltyAmount).to.equal(salePrice.mul(ROYALTY_FEE).div(10000));

      console.log(`👑 Royalty set: ${ethers.utils.formatEther(royaltyAmount)} ETH per 1 ETH sale to ${royaltyRecipient}`);
    });

    it("Should handle payment distribution on testnet", async function () {
      this.timeout(60000);

      const tokenId = Date.now() + 1; // Unique token ID
      const tokenUri = `${TOKEN_URI_BASE}/${tokenId}.json`;
      
      const voucher = await createLazyMintVoucher(
        tokenId,
        tokenUri,
        TOKEN_PRICE,
        recipient.address,
        ROYALTY_FEE,
        recipient.address
      );

      // Check releasable amounts before minting
      const payee1Address = await lazyMintNFT.payee(0);
      const initialReleasable = await lazyMintNFT.releasable(payee1Address);

      console.log(`💰 Initial releasable for payee 1: ${ethers.utils.formatEther(initialReleasable)} ETH`);

      // Perform lazy mint
      console.log(`🔄 Minting token ${tokenId} to test payment distribution...`);
      const tx = await lazyMintNFT.connect(buyer).lazyMint(voucher, { 
        value: TOKEN_PRICE,
        gasLimit: 500000
      });

      await tx.wait();
      console.log(`✅ Token ${tokenId} minted successfully`);

      // Check releasable amount after minting
      const finalReleasable = await lazyMintNFT.releasable(payee1Address);
      const increase = finalReleasable.sub(initialReleasable);

      console.log(`💰 Final releasable for payee 1: ${ethers.utils.formatEther(finalReleasable)} ETH`);
      console.log(`📈 Increase: ${ethers.utils.formatEther(increase)} ETH`);

      expect(increase).to.be.gt(0);
      
      // The increase should be based on the payee's share percentage
      const payeeShares = await lazyMintNFT.shares(payee1Address);
      const totalShares = await lazyMintNFT.totalShares();
      const expectedIncrease = TOKEN_PRICE.mul(payeeShares).div(totalShares);
      
      expect(increase).to.equal(expectedIncrease);
      console.log(`✅ Payment distribution working correctly`);
    });
  });

  describe("Testnet Batch Operations", function () {
    it("Should perform batch minting on testnet", async function () {
      this.timeout(120000); // 2 minutes timeout for batch operations

      const batchSize = 3;
      const vouchers = [];
      const baseTokenId = Date.now() + 10; // Ensure unique token IDs
      
      console.log(`🔄 Creating ${batchSize} vouchers for batch minting...`);

      for (let i = 0; i < batchSize; i++) {
        const tokenId = baseTokenId + i;
        const voucher = await createLazyMintVoucher(
          tokenId,
          `${TOKEN_URI_BASE}/batch/${tokenId}.json`,
          TOKEN_PRICE,
          recipient.address,
          ROYALTY_FEE,
          recipient.address
        );
        vouchers.push(voucher);
        console.log(`  📝 Voucher ${i + 1}: Token ${tokenId}`);
      }

      const totalPrice = TOKEN_PRICE.mul(batchSize);
      console.log(`💰 Total price: ${ethers.utils.formatEther(totalPrice)} ETH`);

      console.log(`🔄 Executing batch mint...`);
      const tx = await lazyMintNFT.connect(buyer).batchLazyMint(vouchers, { 
        value: totalPrice,
        gasLimit: 1000000 // Higher gas limit for batch operation
      });

      console.log(`📝 Batch transaction hash: ${tx.hash}`);
      console.log(`⏳ Waiting for confirmation...`);

      const receipt = await tx.wait();
      console.log(`✅ Batch transaction confirmed in block ${receipt.blockNumber}`);
      console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);

      // Verify all tokens were minted
      for (let i = 0; i < batchSize; i++) {
        const tokenId = baseTokenId + i;
        expect(await lazyMintNFT.ownerOf(tokenId)).to.equal(recipient.address);
        expect(await lazyMintNFT.tokenExists(tokenId)).to.be.true;
        console.log(`  ✅ Token ${tokenId} minted successfully`);
      }

      console.log(`🎉 Batch minting of ${batchSize} tokens completed successfully!`);
    });
  });

  describe("Gas Cost Analysis", function () {
    it("Should analyze gas costs for single mint", async function () {
      this.timeout(60000);

      const tokenId = Date.now() + 100;
      const voucher = await createLazyMintVoucher(
        tokenId,
        `${TOKEN_URI_BASE}/gas-test/${tokenId}.json`,
        TOKEN_PRICE,
        recipient.address,
        ROYALTY_FEE,
        recipient.address
      );

      // Estimate gas
      const estimatedGas = await lazyMintNFT.connect(buyer).estimateGas.lazyMint(voucher, { value: TOKEN_PRICE });
      console.log(`📊 Estimated gas for single mint: ${estimatedGas.toString()}`);

      // Get current gas price
      const gasPrice = await ethers.provider.getGasPrice();
      console.log(`⛽ Current gas price: ${ethers.utils.formatUnits(gasPrice, "gwei")} gwei`);

      // Calculate cost
      const estimatedCost = estimatedGas.mul(gasPrice);
      console.log(`💸 Estimated transaction cost: ${ethers.utils.formatEther(estimatedCost)} ETH`);

      // Execute and measure actual gas
      const tx = await lazyMintNFT.connect(buyer).lazyMint(voucher, { value: TOKEN_PRICE });
      const receipt = await tx.wait();
      
      console.log(`📊 Actual gas used: ${receipt.gasUsed.toString()}`);
      const actualCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      console.log(`💸 Actual transaction cost: ${ethers.utils.formatEther(actualCost)} ETH`);

      expect(receipt.gasUsed).to.be.lte(estimatedGas);
    });
  });

  after(function () {
    if (hre.network.name !== "hardhat") {
      console.log(`\n🎯 Testnet Integration Tests Completed!`);
      console.log(`📍 Contract: ${contractAddress}`);
      console.log(`🌐 Network: ${hre.network.name}`);
      console.log(`\n💡 Next Steps:`);
      console.log(`1. Check transactions on block explorer`);
      console.log(`2. Test marketplace integration`);
      console.log(`3. Verify contract on explorer (optional)`);
    }
  });
}); 