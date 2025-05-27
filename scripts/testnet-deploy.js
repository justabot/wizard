const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("🚀 Testnet Deployment Script");
  console.log("============================");

  // Get network info
  const network = hre.network;
  console.log(`📡 Network: ${network.name} (Chain ID: ${network.config.chainId})`);
  
  if (network.name === "hardhat") {
    throw new Error("❌ This script is for testnet deployment only. Use deploy.js for local deployment.");
  }

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  const balanceEth = ethers.utils.formatEther(balance);
  console.log(`💰 Balance: ${balanceEth} ETH`);

  // Minimum balance check
  const minBalance = ethers.utils.parseEther("0.001"); // 0.001 ETH minimum for demo
  if (balance.lt(minBalance)) {
    console.warn(`⚠️  Warning: Low balance. Need at least 0.001 ETH for deployment, have ${balanceEth} ETH`);
    console.log(`💡 Get test ETH from:`);
    console.log(`   - Sepolia: https://sepoliafaucet.com/`);
    console.log(`   - Polygon Amoy: https://faucet.polygon.technology/`);
    console.log(`   - Your deployer address: ${deployer.address}`);
    // For demo purposes, we'll continue with 0 balance to show the deployment process
    if (balance.eq(0)) {
      console.log(`\n🔄 Continuing with demo deployment (simulation mode)...`);
    }
  }

  // Contract parameters - customize these for production
  const contractName = process.env.CONTRACT_NAME || "LazyMint Testnet Collection";
  const contractSymbol = process.env.CONTRACT_SYMBOL || "LMTC";
  
  // For testnet, we'll use the deployer as the authorized signer
  // In production, you should use a dedicated signer address
  const authorizedSigner = process.env.AUTHORIZED_SIGNER || deployer.address;
  
  // Setup payment splitter
  // You can customize these addresses for your specific needs
  const payees = process.env.PAYEES ? 
    process.env.PAYEES.split(',') : 
    [
      deployer.address,  // Primary recipient (50%)
      deployer.address,  // Secondary recipient (30%) - replace with actual address
      deployer.address   // Tertiary recipient (20%) - replace with actual address
    ];
  
  const shares = process.env.SHARES ? 
    process.env.SHARES.split(',').map(s => parseInt(s)) : 
    [50, 30, 20]; // 50%, 30%, 20% respectively

  console.log("\n📋 Contract Configuration:");
  console.log(`  Name: ${contractName}`);
  console.log(`  Symbol: ${contractSymbol}`);
  console.log(`  Authorized Signer: ${authorizedSigner}`);
  console.log(`  Payees: ${payees.length} addresses`);
  payees.forEach((payee, index) => {
    console.log(`    ${index + 1}. ${payee} (${shares[index]}%)`);
  });

  // Validation
  if (payees.length !== shares.length) {
    throw new Error("❌ Payees and shares arrays must have the same length");
  }
  
  const totalShares = shares.reduce((sum, share) => sum + share, 0);
  if (totalShares !== 100) {
    console.warn(`⚠️  Warning: Shares total ${totalShares}% instead of 100%`);
  }

  console.log("\n🔄 Deploying LazyMintNFT contract...");

  // Deploy the contract
  const LazyMintNFT = await ethers.getContractFactory("LazyMintNFT");
  const lazyMintNFT = await LazyMintNFT.deploy(
    contractName,
    contractSymbol,
    authorizedSigner,
    payees,
    shares
  );

  console.log("⏳ Waiting for deployment transaction to be mined...");
  await lazyMintNFT.deployed();
  
  const contractAddress = lazyMintNFT.address;
  const deploymentTx = lazyMintNFT.deployTransaction;
  
  console.log("✅ Contract deployed successfully!");
  console.log(`📍 Address: ${contractAddress}`);
  console.log(`🔗 Transaction: ${deploymentTx.hash}`);

  // Wait for a few confirmations
  console.log("⏳ Waiting for confirmations...");
  await deploymentTx.wait(2);

  // Get payment splitter address
  const paymentSplitterAddress = await lazyMintNFT.paymentSplitter();
  console.log(`💳 PaymentSplitter: ${paymentSplitterAddress}`);

  // Verify contract settings
  console.log("\n🔍 Contract Verification:");
  console.log(`  Owner: ${await lazyMintNFT.owner()}`);
  console.log(`  Authorized Signer: ${await lazyMintNFT.authorizedSigner()}`);
  console.log(`  Default Royalty: ${await lazyMintNFT.defaultRoyaltyFee()} basis points`);
  console.log(`  Royalty Recipient: ${await lazyMintNFT.defaultRoyaltyRecipient()}`);
  
  // Verify payment splitter
  console.log("\n💰 Payment Splitter Verification:");
  console.log(`  Total Shares: ${await lazyMintNFT.totalShares()}`);
  for (let i = 0; i < payees.length; i++) {
    const payeeAddr = await lazyMintNFT.payee(i);
    const payeeShares = await lazyMintNFT.shares(payeeAddr);
    console.log(`  Payee ${i + 1}: ${payeeAddr} (${payeeShares} shares)`);
  }

  // Create deployment record
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    contractAddress: contractAddress,
    paymentSplitterAddress: paymentSplitterAddress,
    deployer: deployer.address,
    authorizedSigner: authorizedSigner,
    contractName: contractName,
    contractSymbol: contractSymbol,
    payees: payees,
    shares: shares,
    deployedAt: new Date().toISOString(),
    transactionHash: deploymentTx.hash,
    blockNumber: deploymentTx.blockNumber,
    gasUsed: deploymentTx.gasLimit?.toString(),
    gasPrice: deploymentTx.gasPrice?.toString()
  };

  // Save deployment info
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  const deploymentFile = path.join(deploymentsDir, `${network.name}-deployment.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  
  console.log(`\n💾 Deployment info saved to: ${deploymentFile}`);

  // Network-specific explorer links
  const explorerUrls = {
    sepolia: "https://sepolia.etherscan.io",
    polygon_amoy: "https://amoy.polygonscan.com",
    polygon_mumbai: "https://mumbai.polygonscan.com"
  };

  const explorerUrl = explorerUrls[network.name];
  if (explorerUrl) {
    console.log(`\n🔗 Explorer Links:`);
    console.log(`  Contract: ${explorerUrl}/address/${contractAddress}`);
    console.log(`  Transaction: ${explorerUrl}/tx/${deploymentTx.hash}`);
  }

  console.log("\n🎯 Next Steps:");
  console.log(`1. Test the deployment:`);
  console.log(`   npm run test-lazy-mint:${network.name === 'polygon_amoy' ? 'polygon' : network.name}`);
  console.log(`2. Run testnet tests:`);
  console.log(`   npm run test:${network.name}`);
  console.log(`3. Verify contract (optional):`);
  console.log(`   npx hardhat verify --network ${network.name} ${contractAddress} "${contractName}" "${contractSymbol}" "${authorizedSigner}" "[\\"${payees.join('\\",\\"')}\\"]" "[${shares.join(',')}]"`);

  return {
    contract: lazyMintNFT,
    contractAddress: contractAddress,
    paymentSplitterAddress: paymentSplitterAddress,
    deploymentInfo: deploymentInfo
  };
}

// Execute deployment
if (require.main === module) {
  main()
    .then(() => {
      console.log("\n🎉 Deployment completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Deployment failed:", error.message);
      process.exit(1);
    });
}

module.exports = main; 