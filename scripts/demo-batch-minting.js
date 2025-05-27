const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Batch Minting Demo");
  console.log("=====================");

  // Get signers
  const [deployer, signer, collector1, collector2, payee1, payee2, payee3] = await ethers.getSigners();

  console.log("📋 Accounts:");
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Authorized Signer: ${signer.address}`);
  console.log(`Collector 1: ${collector1.address}`);
  console.log(`Collector 2: ${collector2.address}`);

  // Deploy contract
  console.log("\n📦 Deploying LazyMintNFT contract...");
  
  const LazyMintNFT = await ethers.getContractFactory("LazyMintNFT");
  const payees = [payee1.address, payee2.address, payee3.address];
  const shares = [50, 30, 20]; // 50%, 30%, 20%
  
  const contract = await LazyMintNFT.deploy(
    "Batch Demo Collection",
    "BDC",
    signer.address,
    payees,
    shares
  );
  
  await contract.deployed();
  console.log(`✅ Contract deployed at: ${contract.address}`);

  // Helper function to create vouchers
  async function createVoucher(tokenId, uri, price, recipient, royaltyFee = 500, royaltyRecipient = deployer.address) {
    const domain = {
      name: "Batch Demo Collection",
      version: "1.0.0",
      chainId: await ethers.provider.getNetwork().then(n => n.chainId),
      verifyingContract: contract.address
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
      tokenId,
      uri,
      price,
      recipient,
      royaltyFee,
      royaltyRecipient
    };

    const signature = await signer._signTypedData(domain, types, voucher);
    return { ...voucher, signature };
  }

  // Demo 1: Basic Batch Minting
  console.log("\n🎯 Demo 1: Basic Batch Minting (3 NFTs)");
  console.log("=========================================");

  const basicVouchers = [];
  const nftPrice = ethers.utils.parseEther("0.1");
  
  for (let i = 1; i <= 3; i++) {
    const voucher = await createVoucher(
      i,
      `ipfs://QmDemo${i}/metadata.json`,
      nftPrice,
      collector1.address,
      500, // 5% royalty
      deployer.address
    );
    basicVouchers.push(voucher);
    console.log(`📝 Created voucher for Token ${i}`);
  }

  const totalPrice1 = nftPrice.mul(3);
  console.log(`💰 Total price: ${ethers.utils.formatEther(totalPrice1)} ETH`);

  // Execute batch mint
  console.log("🔄 Executing batch mint...");
  const tx1 = await contract.connect(collector1).batchLazyMint(basicVouchers, { value: totalPrice1 });
  await tx1.wait();
  
  console.log("✅ Batch mint completed!");
  console.log(`📦 Minted tokens 1-3 to ${collector1.address}`);

  // Verify minting
  for (let i = 1; i <= 3; i++) {
    const owner = await contract.ownerOf(i);
    const uri = await contract.tokenURI(i);
    console.log(`   Token ${i}: Owner=${owner.slice(0,8)}..., URI=${uri}`);
  }

  // Demo 2: Batch Minting with Different Prices and Recipients
  console.log("\n🎯 Demo 2: Variable Price Batch Minting");
  console.log("=======================================");

  const variableVouchers = [];
  const prices = [
    ethers.utils.parseEther("0.15"), // Premium NFT
    ethers.utils.parseEther("0.25"), // Rare NFT
    ethers.utils.parseEther("0.1")   // Standard NFT
  ];
  
  const recipients = [collector1.address, collector2.address, collector1.address];
  const royaltyFees = [750, 1000, 500]; // 7.5%, 10%, 5%

  for (let i = 0; i < 3; i++) {
    const tokenId = i + 4; // Continue from token 4
    const voucher = await createVoucher(
      tokenId,
      `ipfs://QmSpecial${tokenId}/metadata.json`,
      prices[i],
      recipients[i],
      royaltyFees[i],
      deployer.address
    );
    variableVouchers.push(voucher);
    console.log(`📝 Created voucher for Token ${tokenId}: ${ethers.utils.formatEther(prices[i])} ETH, ${royaltyFees[i]/100}% royalty`);
  }

  const totalPrice2 = prices.reduce((sum, price) => sum.add(price), ethers.BigNumber.from(0));
  console.log(`💰 Total price: ${ethers.utils.formatEther(totalPrice2)} ETH`);

  // Execute batch mint (collector2 pays for all but gets one)
  console.log("🔄 Executing variable price batch mint...");
  const tx2 = await contract.connect(collector2).batchLazyMint(variableVouchers, { value: totalPrice2 });
  await tx2.wait();
  
  console.log("✅ Variable price batch mint completed!");

  // Verify minting and royalties
  for (let i = 4; i <= 6; i++) {
    const owner = await contract.ownerOf(i);
    const uri = await contract.tokenURI(i);
    const [royaltyRecipient, royaltyAmount] = await contract.royaltyInfo(i, ethers.utils.parseEther("1"));
    
    console.log(`   Token ${i}:`);
    console.log(`     Owner: ${owner.slice(0,8)}...`);
    console.log(`     URI: ${uri}`);
    console.log(`     Royalty: ${ethers.utils.formatEther(royaltyAmount)} ETH per 1 ETH sale`);
  }

  // Demo 3: Payment Distribution Check
  console.log("\n🎯 Demo 3: Payment Distribution Analysis");
  console.log("=======================================");

  const grandTotal = totalPrice1.add(totalPrice2);
  console.log(`💰 Total revenue: ${ethers.utils.formatEther(grandTotal)} ETH`);

  // Check releasable amounts for each payee
  for (let i = 0; i < payees.length; i++) {
    const releasable = await contract.releasable(payees[i]);
    const percentage = shares[i];
    console.log(`   Payee ${i+1} (${percentage}%): ${ethers.utils.formatEther(releasable)} ETH releasable`);
  }

  // Demo 4: Release Payments
  console.log("\n🎯 Demo 4: Payment Release");
  console.log("=========================");

  for (let i = 0; i < payees.length; i++) {
    const payeeAddress = payees[i];
    const initialBalance = await ethers.provider.getBalance(payeeAddress);
    
    console.log(`🔄 Releasing payment to payee ${i+1}...`);
    await contract.release(payeeAddress);
    
    const finalBalance = await ethers.provider.getBalance(payeeAddress);
    const received = finalBalance.sub(initialBalance);
    console.log(`✅ Payee ${i+1} received: ${ethers.utils.formatEther(received)} ETH`);
  }

  // Final Summary
  console.log("\n📊 Final Summary");
  console.log("================");
  console.log(`✅ Total NFTs minted: 6`);
  console.log(`✅ Total revenue generated: ${ethers.utils.formatEther(grandTotal)} ETH`);
  console.log(`✅ Revenue distributed among 3 payees`);
  console.log(`✅ All batch operations completed successfully`);
  
  console.log("\n🎉 Batch Minting Demo Completed!");
  console.log(`📋 Contract Address: ${contract.address}`);
  console.log(`📋 Deployer: ${deployer.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Demo failed:", error);
    process.exit(1);
  }); 