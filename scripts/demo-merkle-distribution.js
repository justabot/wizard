const { ethers } = require("hardhat");

// Contract address from deployment
const CONTRACT_ADDRESS = "0xc7089d7018a4e7cC1BC6656FBe200858Be2c0346";

// Payee addresses and their distribution
const PAYEES = [
    {
        address: "0xbcCDF9Db6710F04Dfb53621CA430424486bddac7",
        percentage: 4000, // 40%
        role: "Artist"
    },
    {
        address: "0x01662d851ad095C2f5E308E212568806EA8A5887", 
        percentage: 3500, // 35%
        role: "Producer"
    },
    {
        address: "0x08D17700614FFDCFd00875C4115A956BC93DB4e2",
        percentage: 2500, // 25%
        role: "Collaborator"
    }
];

// Utility function to create Merkle Tree
function createMerkleTree(payees, tokenId) {
    const { MerkleTree } = require('merkletreejs');
    const { keccak256 } = require('ethers/lib/utils');
    
    // Create leaves: hash(tokenId + address + amount)
    // Calculate amounts based on total royalty pool
    const totalRoyalty = ethers.utils.parseEther("0.01"); // Reduced to 0.01 ETH total
    const leaves = payees.map(payee => {
        const amount = totalRoyalty.mul(payee.percentage).div(10000); // Calculate percentage of total
        const packed = ethers.utils.solidityPack(
            ['uint256', 'address', 'uint256'],
            [tokenId, payee.address, amount]
        );
        return keccak256(packed);
    });
    
    // Create tree
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();
    
    // Generate proofs for each payee
    const proofs = payees.map((payee, index) => {
        return tree.getHexProof(leaves[index]);
    });
    
    // Calculate amounts for return
    const amounts = payees.map(payee => {
        return totalRoyalty.mul(payee.percentage).div(10000);
    });
    
    return { tree, root, leaves, proofs, amounts };
}

// Main demonstration function
async function main() {
    console.log("🎨 Merkle Tree Royalty Distribution Demo");
    console.log("=========================================\n");

    // Get signers and contract
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log("📋 Demo Configuration:");
    console.log("• Network:", network.name);
    console.log("• Contract:", CONTRACT_ADDRESS);
    console.log("• Deployer:", deployer.address);
    
    // Check deployer balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("• Balance:", ethers.utils.formatEther(balance), "ETH\n");

    // Connect to deployed contract
    const MerkleRoyaltyNFT = await ethers.getContractFactory("MerkleRoyaltyNFT");
    const contract = MerkleRoyaltyNFT.attach(CONTRACT_ADDRESS);

    // Display payee information
    console.log("👥 Payee Configuration:");
    PAYEES.forEach((payee, index) => {
        console.log(`• Payee ${index + 1} (${payee.role}): ${payee.address} - ${payee.percentage/100}%`);
    });
    console.log();

    // Generate unique creation ID
    const tokenId = 1; // Use simple token ID instead of hash
    console.log("🆔 Token ID:", tokenId);

    // Create Merkle Tree
    console.log("\n🌳 Creating Merkle Tree...");
    const { tree, root, proofs, amounts } = createMerkleTree(PAYEES, tokenId);
    console.log("• Merkle Root:", root);
    console.log("• Tree Depth:", tree.getDepth());
    console.log("• Total Leaves:", PAYEES.length);

    // Prepare minting voucher
    const price = ethers.utils.parseEther("0.005"); // Reduced to 0.005 ETH
    const recipient = deployer.address;
    const royaltyFee = 1000; // 10%
    const uri = "https://gateway.pinata.cloud/ipfs/QmYourMetadataHash";

    console.log("\n📝 Creating Lazy Mint Voucher...");
    console.log("• Token ID:", tokenId.toString());
    console.log("• Price:", ethers.utils.formatEther(price), "ETH");
    console.log("• Royalty Fee:", (royaltyFee/100).toString() + "%");
    console.log("• Merkle Root:", root);

    // Create EIP712 domain and types
    const domain = {
        name: await contract.name(),
        version: "1",
        chainId: network.chainId,
        verifyingContract: contract.address
    };

    const types = {
        LazyMintVoucher: [
            { name: "tokenId", type: "uint256" },
            { name: "uri", type: "string" },
            { name: "price", type: "uint256" },
            { name: "recipient", type: "address" },
            { name: "merkleRoot", type: "bytes32" }
        ]
    };

    const voucher = {
        tokenId,
        uri,
        price,
        recipient,
        merkleRoot: root
    };

    // Sign voucher
    console.log("\n✍️ Signing voucher...");
    const signature = await deployer._signTypedData(domain, types, voucher);
    console.log("• Signature:", signature);

    // Create voucher with signature
    const voucherWithSig = {
        tokenId,
        uri,
        price,
        recipient,
        merkleRoot: root,
        signature
    };

    // Mint NFT with Merkle distribution
    console.log("\n🎨 Minting NFT with Merkle Distribution...");
    try {
        const mintTx = await contract.lazyMint(voucherWithSig, { 
            value: price,
            gasLimit: 300000 
        });
        
        console.log("• Transaction Hash:", mintTx.hash);
        console.log("⏳ Waiting for confirmation...");
        
        const receipt = await mintTx.wait();
        console.log("✅ NFT Minted Successfully!");
        console.log("• Block Number:", receipt.blockNumber);
        console.log("• Gas Used:", receipt.gasUsed.toString());
        
        // Get the contract balance after minting
        const contractBalance = await ethers.provider.getBalance(contract.address);
        console.log("• Contract Balance:", ethers.utils.formatEther(contractBalance), "ETH");
        
    } catch (error) {
        console.log("❌ Minting failed:", error.message);
        return;
    }

    // Wait a moment for the transaction to settle
    console.log("\n⏳ Waiting for transaction to settle...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Now demonstrate claims for each payee
    console.log("\n💰 Demonstrating Royalty Claims...");
    console.log("=====================================");

    // Get initial contract balance
    const initialBalance = await ethers.provider.getBalance(contract.address);
    console.log("Initial Contract Balance:", ethers.utils.formatEther(initialBalance), "ETH\n");

    // Simulate royalty payment by sending ETH to contract
    console.log("💵 Adding Royalty Funds to Token...");
    const royaltyPayment = ethers.utils.parseEther("0.01"); // Reduced to 0.01 ETH royalty
    
    try {
        const paymentTx = await contract.addRoyaltyFunds(tokenId, {
            value: royaltyPayment,
            gasLimit: 80000 // Increased gas limit
        });
        
        await paymentTx.wait();
        console.log("• Royalty Payment:", ethers.utils.formatEther(royaltyPayment), "ETH");
        console.log("• Transaction:", paymentTx.hash);
        
        const newBalance = await ethers.provider.getBalance(contract.address);
        console.log("• New Contract Balance:", ethers.utils.formatEther(newBalance), "ETH\n");
        
    } catch (error) {
        console.log("❌ Royalty payment failed:", error.message);
        return;
    }

    // Process claims for each payee
    for (let i = 0; i < PAYEES.length; i++) {
        const payee = PAYEES[i];
        const proof = proofs[i];
        const amount = amounts[i];
        
        console.log(`💎 Processing Claim for ${payee.role} (${payee.percentage/100}%)`);
        console.log("• Address:", payee.address);
        console.log("• Amount:", ethers.utils.formatEther(amount), "ETH");
        console.log("• Proof Length:", proof.length);

        try {
            // Get payee's initial balance
            const initialPayeeBalance = await ethers.provider.getBalance(payee.address);
            
            // Create claim object
            const claim = {
                tokenId: tokenId,
                recipient: payee.address,
                amount: amount,
                merkleProof: proof
            };
            
            // Execute claim
            const claimTx = await contract.claimRoyalty(claim, { gasLimit: 100000 });
            
            console.log("• Claim Transaction:", claimTx.hash);
            console.log("⏳ Waiting for confirmation...");
            
            const claimReceipt = await claimTx.wait();
            console.log("✅ Claim Successful!");
            console.log("• Block Number:", claimReceipt.blockNumber);
            console.log("• Gas Used:", claimReceipt.gasUsed.toString());
            
            // Check new balance
            const newPayeeBalance = await ethers.provider.getBalance(payee.address);
            const received = newPayeeBalance.sub(initialPayeeBalance);
            console.log("• Amount Received:", ethers.utils.formatEther(received), "ETH");
            
            // Check contract balance
            const contractBalance = await ethers.provider.getBalance(contract.address);
            console.log("• Remaining Contract Balance:", ethers.utils.formatEther(contractBalance), "ETH");
            
        } catch (error) {
            console.log("❌ Claim failed:", error.message);
            
            // Check if already claimed
            try {
                const alreadyClaimed = await contract.hasClaimedRoyalty(tokenId, payee.address);
                if (alreadyClaimed) {
                    console.log("ℹ️ This payee has already claimed their royalties");
                }
            } catch (checkError) {
                console.log("• Error checking claim status:", checkError.message);
            }
        }
        
        console.log(); // Empty line for readability
    }

    // Final summary
    console.log("📊 Distribution Summary");
    console.log("=======================");
    
    const finalContractBalance = await ethers.provider.getBalance(contract.address);
    console.log("• Final Contract Balance:", ethers.utils.formatEther(finalContractBalance), "ETH");
    
    // Check each payee's claimed status
    for (let i = 0; i < PAYEES.length; i++) {
        const payee = PAYEES[i];
        try {
            const claimed = await contract.hasClaimedRoyalty(tokenId, payee.address);
            const amount = amounts[i];
            console.log(`• ${payee.role} (${claimed ? "CLAIMED" : "NOT CLAIMED"}):`, ethers.utils.formatEther(amount), "ETH");
        } catch (error) {
            console.log(`• ${payee.role} Claim Status: Error checking`);
        }
    }

    // Explorer links
    console.log("\n🔗 Sepolia Explorer Links:");
    console.log("• Contract:", `https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`);
    PAYEES.forEach((payee, index) => {
        console.log(`• Payee ${index + 1}:`, `https://sepolia.etherscan.io/address/${payee.address}`);
    });

    console.log("\n🎉 Demo Completed Successfully!");
    console.log("💡 All payees should now see transactions in their wallets");
    console.log("📈 This demonstrates unlimited scalability with Merkle trees");
}

// Execute the demo
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Demo failed:", error);
            process.exit(1);
        });
}

module.exports = main; 