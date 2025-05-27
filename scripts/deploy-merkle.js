const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying MerkleRoyaltyNFT with Merkle Tree Distribution...\n");

    // Get deployment configuration
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log("📋 Deployment Details:");
    console.log("• Network:", network.name);
    console.log("• Chain ID:", network.chainId.toString());
    console.log("• Deployer:", deployer.address);
    
    // Check deployer balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("• Balance:", ethers.utils.formatEther(balance), "ETH");
    
    if (balance.lt(ethers.utils.parseEther("0.01"))) {
        console.log("❌ Insufficient balance for deployment");
        process.exit(1);
    }

    // Contract configuration
    const contractName = "MerkleRoyalty Collection";
    const contractSymbol = "MRC";
    const authorizedSigner = deployer.address; // Use deployer as authorized signer

    console.log("\n🎨 Contract Configuration:");
    console.log("• Name:", contractName);
    console.log("• Symbol:", contractSymbol);
    console.log("• Authorized Signer:", authorizedSigner);

    // Deploy the contract
    console.log("\n⏳ Deploying contract...");
    
    const MerkleRoyaltyNFT = await ethers.getContractFactory("MerkleRoyaltyNFT");
    const contract = await MerkleRoyaltyNFT.deploy(
        contractName,
        contractSymbol,
        authorizedSigner
    );

    console.log("⏳ Waiting for deployment transaction to be mined...");
    await contract.deployed();
    
    const contractAddress = contract.address;
    const deployTx = contract.deployTransaction;
    
    console.log("✅ Contract deployed successfully!");
    console.log("• Contract Address:", contractAddress);
    console.log("• Transaction Hash:", deployTx.hash);
    console.log("• Block Number:", deployTx.blockNumber);

    // Verify contract configuration
    console.log("\n🔍 Verifying deployment...");
    
    const owner = await contract.owner();
    const signer = await contract.authorizedSigner();
    const defaultRoyalty = await contract.defaultRoyaltyFee();
    
    console.log("• Owner:", owner);
    console.log("• Authorized Signer:", signer);
    console.log("• Default Royalty:", (defaultRoyalty / 100).toString() + "%");

    // Test contract interfaces
    console.log("\n🧪 Testing contract interfaces...");
    
    // Check ERC165 support
    const ERC721_INTERFACE_ID = "0x80ac58cd";
    const ERC2981_INTERFACE_ID = "0x2a55205a";
    
    const supportsERC721 = await contract.supportsInterface(ERC721_INTERFACE_ID);
    const supportsERC2981 = await contract.supportsInterface(ERC2981_INTERFACE_ID);
    
    console.log("• ERC721 Support:", supportsERC721 ? "✅" : "❌");
    console.log("• ERC2981 Support:", supportsERC2981 ? "✅" : "❌");

    // Save deployment information
    const deploymentInfo = {
        network: network.name,
        chainId: network.chainId.toString(),
        contractAddress: contractAddress,
        deployer: deployer.address,
        authorizedSigner: authorizedSigner,
        contractName: contractName,
        contractSymbol: contractSymbol,
        transactionHash: deployTx.hash,
        blockNumber: deployTx.blockNumber,
        defaultRoyaltyFee: defaultRoyalty.toString(),
        deployedAt: new Date().toISOString(),
        contractType: "MerkleRoyaltyNFT"
    };

    // Create deployments directory if it doesn't exist
    const fs = require('fs');
    const path = require('path');
    const deploymentsDir = path.join(__dirname, '../deployments');
    
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    // Save deployment record
    const deploymentFile = path.join(deploymentsDir, `merkle-${network.name}-deployment.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    
    console.log("\n💾 Deployment record saved to:", deploymentFile);

    // Generate explorer links
    if (network.chainId === 11155111n) { // Sepolia
        console.log("\n🔗 Explorer Links:");
        console.log("• Contract:", `https://sepolia.etherscan.io/address/${contractAddress}`);
        console.log("• Transaction:", `https://sepolia.etherscan.io/tx/${deployTx.hash}`);
    } else if (network.chainId === 80002n) { // Polygon Amoy
        console.log("\n🔗 Explorer Links:");
        console.log("• Contract:", `https://amoy.polygonscan.com/address/${contractAddress}`);
        console.log("• Transaction:", `https://amoy.polygonscan.com/tx/${deployTx.hash}`);
    }

    // Verification command
    console.log("\n📝 Contract Verification:");
    console.log("Run this command to verify on explorer:");
    console.log(`npx hardhat verify --network ${network.name} ${contractAddress} "${contractName}" "${contractSymbol}" "${authorizedSigner}"`);

    console.log("\n🎉 Deployment completed successfully!");
    console.log("💡 Key Benefits of Merkle Distribution:");
    console.log("   • Supports MILLIONS of royalty payees");
    console.log("   • Constant deployment cost regardless of payee count");
    console.log("   • Gas-efficient claims with merkle proofs");
    console.log("   • Dynamic royalty distribution updates");
    
    return contractAddress;
}

// Execute deployment
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Deployment failed:", error);
            process.exit(1);
        });
}

module.exports = main; 