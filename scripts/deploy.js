const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying LazyMintNFT contract...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(balance), "ETH");

  // Contract parameters
  const contractName = "LazyMint Collection";
  const contractSymbol = "LMC";
  
  // Use deployer as authorized signer for demo purposes
  // In production, you might want to use a dedicated signer
  const authorizedSigner = deployer.address;
  
  // Setup payment splitter - you can modify these addresses and shares
  const payees = [
    deployer.address,  // Replace with actual payee addresses
    deployer.address,  // For demo, using deployer address
    deployer.address   // For demo, using deployer address
  ];
  
  const shares = [50, 30, 20]; // 50%, 30%, 20% respectively
  
  console.log("Contract parameters:");
  console.log("- Name:", contractName);
  console.log("- Symbol:", contractSymbol);
  console.log("- Authorized Signer:", authorizedSigner);
  console.log("- Payees:", payees);
  console.log("- Shares:", shares);

  // Deploy the contract
  const LazyMintNFT = await ethers.getContractFactory("LazyMintNFT");
  const lazyMintNFT = await LazyMintNFT.deploy(
    contractName,
    contractSymbol,
    authorizedSigner,
    payees,
    shares
  );

  await lazyMintNFT.deployed();
  
  const contractAddress = lazyMintNFT.address;
  console.log("LazyMintNFT deployed to:", contractAddress);

  // Get payment splitter address
  const paymentSplitterAddress = await lazyMintNFT.paymentSplitter();
  console.log("PaymentSplitter deployed to:", paymentSplitterAddress);

  // Verify contract settings
  console.log("\n=== Contract Verification ===");
  console.log("Owner:", await lazyMintNFT.owner());
  console.log("Authorized Signer:", await lazyMintNFT.authorizedSigner());
  console.log("Default Royalty Fee:", await lazyMintNFT.defaultRoyaltyFee(), "basis points");
  console.log("Default Royalty Recipient:", await lazyMintNFT.defaultRoyaltyRecipient());
  
  // Verify payment splitter
  console.log("\n=== Payment Splitter Verification ===");
  console.log("Total Shares:", await lazyMintNFT.totalShares());
  for (let i = 0; i < payees.length; i++) {
    const payeeAddr = await lazyMintNFT.payee(i);
    const payeeShares = await lazyMintNFT.shares(payeeAddr);
    console.log(`Payee ${i + 1}: ${payeeAddr} - ${payeeShares} shares`);
  }

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: contractAddress,
    paymentSplitterAddress: paymentSplitterAddress,
    deployer: deployer.address,
    authorizedSigner: authorizedSigner,
    contractName: contractName,
    contractSymbol: contractSymbol,
    payees: payees,
    shares: shares,
    deployedAt: new Date().toISOString(),
    transactionHash: lazyMintNFT.deployTransaction.hash
  };

  console.log("\n=== Deployment Summary ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Instructions for verification (if on a testnet)
  if (hre.network.name !== "hardhat") {
    console.log("\n=== Next Steps ===");
    console.log("1. Test lazy minting with the example script:");
    console.log("   npx hardhat run scripts/test-lazy-mint.js --network", hre.network.name);
    console.log("\n2. Fund the contract for testing:");
    console.log("   Send some test ETH to:", contractAddress);
  }

  return {
    contract: lazyMintNFT,
    contractAddress: contractAddress,
    paymentSplitterAddress: paymentSplitterAddress
  };
}

// Execute deployment
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = main; 