const { ethers } = require("hardhat");

async function createLazyMintVoucher(contract, signer, tokenId, uri, price, recipient, royaltyFee, royaltyRecipient) {
  const contractAddress = await contract.getAddress();
  const chainId = await ethers.provider.getNetwork().then(n => n.chainId);
  
  const domain = {
    name: "LazyMint Collection",
    version: "1.0.0",
    chainId: chainId,
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
    recipient: recipient,
    royaltyFee: royaltyFee,
    royaltyRecipient: royaltyRecipient
  };

  console.log("Creating voucher for token:", tokenId);
  console.log("- URI:", uri);
  console.log("- Price:", ethers.formatEther(price), "ETH");
  console.log("- Recipient:", recipient);
  console.log("- Royalty Fee:", royaltyFee, "basis points");
  console.log("- Royalty Recipient:", royaltyRecipient);

  const signature = await signer.signTypedData(domain, types, voucher);
  return { ...voucher, signature };
}

async function main() {
  console.log("Testing Lazy Minting functionality...\n");

  // Get signers
  const [deployer, buyer1, buyer2] = await ethers.getSigners();
  
  console.log("=== Accounts ===");
  console.log("Deployer/Signer:", deployer.address);
  console.log("Buyer 1:", buyer1.address);
  console.log("Buyer 2:", buyer2.address);
  
  // Check if we have a deployed contract address
  let contractAddress;
  if (process.env.CONTRACT_ADDRESS) {
    contractAddress = process.env.CONTRACT_ADDRESS;
    console.log("Using existing contract at:", contractAddress);
  } else {
    console.log("No CONTRACT_ADDRESS provided, deploying new contract...");
    const deployResult = await require("./deploy.js")();
    contractAddress = deployResult.contractAddress;
  }

  // Get contract instance
  const LazyMintNFT = await ethers.getContractFactory("LazyMintNFT");
  const contract = LazyMintNFT.attach(contractAddress);

  console.log("\n=== Contract Info ===");
  console.log("Contract Address:", contractAddress);
  console.log("Owner:", await contract.owner());
  console.log("Authorized Signer:", await contract.authorizedSigner());
  console.log("Payment Splitter:", await contract.paymentSplitter());

  // Create some test vouchers
  const tokenPrice = ethers.parseEther("0.01"); // 0.01 ETH
  const royaltyFee = 500; // 5%

  console.log("\n=== Creating Lazy Mint Vouchers ===");

  // Voucher 1: Single token for buyer1
  const voucher1 = await createLazyMintVoucher(
    contract,
    deployer, // Authorized signer
    1,
    "ipfs://QmTest1/metadata.json",
    tokenPrice,
    buyer1.address,
    royaltyFee,
    buyer1.address
  );

  // Voucher 2: Single token for buyer2 with different royalty
  const voucher2 = await createLazyMintVoucher(
    contract,
    deployer,
    2,
    "ipfs://QmTest2/metadata.json",
    tokenPrice,
    buyer2.address,
    750, // 7.5% royalty
    deployer.address // Deployer gets royalties
  );

  // Voucher 3 & 4: For batch minting
  const voucher3 = await createLazyMintVoucher(
    contract,
    deployer,
    3,
    "ipfs://QmTest3/metadata.json",
    tokenPrice,
    buyer1.address,
    royaltyFee,
    buyer1.address
  );

  const voucher4 = await createLazyMintVoucher(
    contract,
    deployer,
    4,
    "ipfs://QmTest4/metadata.json",
    tokenPrice,
    buyer1.address,
    royaltyFee,
    buyer1.address
  );

  console.log("\n=== Testing Single Lazy Mint ===");

  // Test 1: Single lazy mint by buyer1
  try {
    console.log("Buyer1 balance before:", ethers.formatEther(await ethers.provider.getBalance(buyer1.address)), "ETH");
    
    const tx1 = await contract.connect(buyer1).lazyMint(voucher1, { value: tokenPrice });
    const receipt1 = await tx1.wait();
    
    console.log("✅ Token 1 lazy minted successfully!");
    console.log("Transaction hash:", receipt1.hash);
    console.log("Gas used:", receipt1.gasUsed.toString());
    console.log("Owner of token 1:", await contract.ownerOf(1));
    console.log("Token 1 URI:", await contract.tokenURI(1));
    
    // Check royalty info
    const [royaltyRecipient, royaltyAmount] = await contract.royaltyInfo(1, ethers.parseEther("1"));
    console.log("Royalty for 1 ETH sale:", ethers.formatEther(royaltyAmount), "ETH to", royaltyRecipient);
    
  } catch (error) {
    console.log("❌ Error minting token 1:", error.message);
  }

  // Test 2: Single lazy mint by buyer2
  try {
    console.log("\nBuyer2 balance before:", ethers.formatEther(await ethers.provider.getBalance(buyer2.address)), "ETH");
    
    const tx2 = await contract.connect(buyer2).lazyMint(voucher2, { value: tokenPrice });
    const receipt2 = await tx2.wait();
    
    console.log("✅ Token 2 lazy minted successfully!");
    console.log("Transaction hash:", receipt2.hash);
    console.log("Gas used:", receipt2.gasUsed.toString());
    console.log("Owner of token 2:", await contract.ownerOf(2));
    console.log("Token 2 URI:", await contract.tokenURI(2));
    
    // Check royalty info
    const [royaltyRecipient, royaltyAmount] = await contract.royaltyInfo(2, ethers.parseEther("1"));
    console.log("Royalty for 1 ETH sale:", ethers.formatEther(royaltyAmount), "ETH to", royaltyRecipient);
    
  } catch (error) {
    console.log("❌ Error minting token 2:", error.message);
  }

  console.log("\n=== Testing Batch Lazy Mint ===");

  // Test 3: Batch lazy mint
  try {
    const batchVouchers = [voucher3, voucher4];
    const totalPrice = tokenPrice * BigInt(2);
    
    console.log("Batch minting tokens 3 & 4, total price:", ethers.formatEther(totalPrice), "ETH");
    
    const tx3 = await contract.connect(buyer1).batchLazyMint(batchVouchers, { value: totalPrice });
    const receipt3 = await tx3.wait();
    
    console.log("✅ Batch lazy mint successful!");
    console.log("Transaction hash:", receipt3.hash);
    console.log("Gas used:", receipt3.gasUsed.toString());
    console.log("Owner of token 3:", await contract.ownerOf(3));
    console.log("Owner of token 4:", await contract.ownerOf(4));
    
  } catch (error) {
    console.log("❌ Error batch minting:", error.message);
  }

  console.log("\n=== Testing Payment Distribution ===");

  // Check payment splitter balances
  try {
    const payee1 = await contract.payee(0);
    const payee2 = await contract.payee(1);
    const payee3 = await contract.payee(2);
    
    console.log("Payment distribution status:");
    console.log("- Payee 1 (" + payee1 + ") releasable:", ethers.formatEther(await contract.releasable(payee1)), "ETH");
    console.log("- Payee 2 (" + payee2 + ") releasable:", ethers.formatEther(await contract.releasable(payee2)), "ETH");
    console.log("- Payee 3 (" + payee3 + ") releasable:", ethers.formatEther(await contract.releasable(payee3)), "ETH");
    
    // Release payment to first payee
    const payee1BalanceBefore = await ethers.provider.getBalance(payee1);
    await contract.release(payee1);
    const payee1BalanceAfter = await ethers.provider.getBalance(payee1);
    
    console.log("✅ Released payment to payee 1");
    console.log("Amount received:", ethers.formatEther(payee1BalanceAfter - payee1BalanceBefore), "ETH");
    
  } catch (error) {
    console.log("❌ Error checking/releasing payments:", error.message);
  }

  console.log("\n=== Testing Error Cases ===");

  // Test 4: Try to reuse a signature
  try {
    await contract.connect(buyer1).lazyMint(voucher1, { value: tokenPrice });
    console.log("❌ Signature reuse should have failed but didn't!");
  } catch (error) {
    console.log("✅ Signature reuse correctly rejected:", error.message);
  }

  // Test 5: Try insufficient payment
  try {
    const lowPriceVoucher = await createLazyMintVoucher(
      contract,
      deployer,
      5,
      "ipfs://QmTest5/metadata.json",
      tokenPrice,
      buyer1.address,
      royaltyFee,
      buyer1.address
    );
    
    await contract.connect(buyer1).lazyMint(lowPriceVoucher, { value: tokenPrice / BigInt(2) });
    console.log("❌ Insufficient payment should have failed but didn't!");
  } catch (error) {
    console.log("✅ Insufficient payment correctly rejected:", error.message);
  }

  console.log("\n=== Summary ===");
  console.log("Contract Address:", contractAddress);
  console.log("Total tokens minted:", 4);
  console.log("Test completed! 🎉");
  
  // Show final contract stats
  const totalReleased = await contract.totalReleased();
  const contractBalance = await ethers.provider.getBalance(contractAddress);
  
  console.log("Payment Splitter stats:");
  console.log("- Total released:", ethers.formatEther(totalReleased), "ETH");
  console.log("- Contract balance:", ethers.formatEther(contractBalance), "ETH");
}

// Execute the test
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = main; 