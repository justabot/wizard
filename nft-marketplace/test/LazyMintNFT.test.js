const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LazyMintNFT", function () {
  let lazyMintNFT;
  let owner, signer, recipient, payee1, payee2, payee3, buyer;
  let contractAddress;

  const TOKEN_URI = "ipfs://QmTest123";
  const TOKEN_PRICE = ethers.utils.parseEther("0.1");
  const ROYALTY_FEE = 500; // 5%

  beforeEach(async function () {
    // Get signers
    [owner, signer, recipient, payee1, payee2, payee3, buyer] = await ethers.getSigners();

    // Deploy LazyMintNFT contract
    const LazyMintNFT = await ethers.getContractFactory("LazyMintNFT");
    
    // Setup payment splitter with 3 payees
    const payees = [payee1.address, payee2.address, payee3.address];
    const shares = [50, 30, 20]; // 50%, 30%, 20%
    
    lazyMintNFT = await LazyMintNFT.deploy(
      "LazyMint Collection",
      "LMC",
      signer.address,
      payees,
      shares
    );
    
    await lazyMintNFT.deployed();
    contractAddress = lazyMintNFT.address;
  });

  describe("Contract Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await lazyMintNFT.owner()).to.equal(owner.address);
    });

    it("Should set the correct authorized signer", async function () {
      expect(await lazyMintNFT.authorizedSigner()).to.equal(signer.address);
    });

    it("Should initialize payment splitter correctly", async function () {
      const paymentSplitterAddress = await lazyMintNFT.paymentSplitter();
      expect(paymentSplitterAddress).to.not.equal(ethers.constants.AddressZero);
      
      // Check shares
      expect(await lazyMintNFT.shares(payee1.address)).to.equal(50);
      expect(await lazyMintNFT.shares(payee2.address)).to.equal(30);
      expect(await lazyMintNFT.shares(payee3.address)).to.equal(20);
      expect(await lazyMintNFT.totalShares()).to.equal(100);
    });

    it("Should set default royalty correctly", async function () {
      expect(await lazyMintNFT.defaultRoyaltyFee()).to.equal(500);
      expect(await lazyMintNFT.defaultRoyaltyRecipient()).to.equal(owner.address);
    });
  });

  describe("Lazy Minting", function () {
    async function createLazyMintVoucher(tokenId, uri, price, recipientAddr, royaltyFee, royaltyRecipient) {
      const domain = {
        name: "LazyMint Collection",
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

      const signature = await signer._signTypedData(domain, types, voucher);
      return { ...voucher, signature };
    }

    it("Should lazy mint NFT with valid voucher", async function () {
      const tokenId = 1;
      const voucher = await createLazyMintVoucher(
        tokenId,
        TOKEN_URI,
        TOKEN_PRICE,
        recipient.address,
        ROYALTY_FEE,
        recipient.address
      );

      // Lazy mint
      await expect(
        lazyMintNFT.connect(buyer).lazyMint(voucher, { value: TOKEN_PRICE })
      )
        .to.emit(lazyMintNFT, "LazyMinted")
        .withArgs(recipient.address, tokenId, TOKEN_URI, TOKEN_PRICE);

      // Verify token was minted
      expect(await lazyMintNFT.ownerOf(tokenId)).to.equal(recipient.address);
      expect(await lazyMintNFT.tokenURI(tokenId)).to.equal(TOKEN_URI);
      expect(await lazyMintNFT.tokenExists(tokenId)).to.be.true;
    });

    it("Should set token-specific royalty correctly", async function () {
      const tokenId = 1;
      const voucher = await createLazyMintVoucher(
        tokenId,
        TOKEN_URI,
        TOKEN_PRICE,
        recipient.address,
        ROYALTY_FEE,
        recipient.address
      );

      await lazyMintNFT.connect(buyer).lazyMint(voucher, { value: TOKEN_PRICE });

      // Check royalty info
      const salePrice = ethers.utils.parseEther("1");
      const [royaltyRecipient, royaltyAmount] = await lazyMintNFT.royaltyInfo(tokenId, salePrice);
      
      expect(royaltyRecipient).to.equal(recipient.address);
      expect(royaltyAmount).to.equal(salePrice.mul(ROYALTY_FEE).div(10000));
    });

    it("Should fail with insufficient payment", async function () {
      const tokenId = 1;
      const voucher = await createLazyMintVoucher(
        tokenId,
        TOKEN_URI,
        TOKEN_PRICE,
        recipient.address,
        ROYALTY_FEE,
        recipient.address
      );

      const insufficientPayment = ethers.utils.parseEther("0.05");
      
      await expect(
        lazyMintNFT.connect(buyer).lazyMint(voucher, { value: insufficientPayment })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should fail with invalid signature", async function () {
      const tokenId = 1;
      
      // Create voucher but sign with wrong signer
      const voucher = await createLazyMintVoucher(
        tokenId,
        TOKEN_URI,
        TOKEN_PRICE,
        recipient.address,
        ROYALTY_FEE,
        recipient.address
      );
      
      // Tamper with the signature by using a different signer
      const domain = {
        name: "LazyMint Collection",
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

      const invalidSignature = await owner._signTypedData(domain, types, {
        tokenId: voucher.tokenId,
        uri: voucher.uri,
        price: voucher.price,
        recipient: voucher.recipient,
        royaltyFee: voucher.royaltyFee,
        royaltyRecipient: voucher.royaltyRecipient
      });

      const invalidVoucher = { ...voucher, signature: invalidSignature };

      await expect(
        lazyMintNFT.connect(buyer).lazyMint(invalidVoucher, { value: TOKEN_PRICE })
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should fail when reusing signature", async function () {
      const tokenId = 1;
      const voucher = await createLazyMintVoucher(
        tokenId,
        TOKEN_URI,
        TOKEN_PRICE,
        recipient.address,
        ROYALTY_FEE,
        recipient.address
      );

      // First lazy mint should succeed
      await lazyMintNFT.connect(buyer).lazyMint(voucher, { value: TOKEN_PRICE });

      // Second attempt with same signature should fail
      await expect(
        lazyMintNFT.connect(buyer).lazyMint(voucher, { value: TOKEN_PRICE })
      ).to.be.revertedWith("Signature already used");
    });
  });

  describe("Payment Distribution", function () {
    async function createLazyMintVoucher(tokenId, uri, price, recipientAddr, royaltyFee, royaltyRecipient) {
      const domain = {
        name: "LazyMint Collection",
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

      const signature = await signer._signTypedData(domain, types, voucher);
      return { ...voucher, signature };
    }

    it("Should distribute payments correctly through PaymentSplitter", async function () {
      const tokenId = 1;
      const voucher = await createLazyMintVoucher(
        tokenId,
        TOKEN_URI,
        TOKEN_PRICE,
        recipient.address,
        ROYALTY_FEE,
        recipient.address
      );

      // Record initial balances
      const payee1InitialBalance = await ethers.provider.getBalance(payee1.address);
      const payee2InitialBalance = await ethers.provider.getBalance(payee2.address);
      const payee3InitialBalance = await ethers.provider.getBalance(payee3.address);

      // Lazy mint
      await lazyMintNFT.connect(buyer).lazyMint(voucher, { value: TOKEN_PRICE });

      // Check releasable amounts
      const payee1Releasable = await lazyMintNFT.releasable(payee1.address);
      const payee2Releasable = await lazyMintNFT.releasable(payee2.address);
      const payee3Releasable = await lazyMintNFT.releasable(payee3.address);

      // Expected amounts based on shares (50%, 30%, 20%)
      const expectedPayee1 = TOKEN_PRICE.mul(50).div(100);
      const expectedPayee2 = TOKEN_PRICE.mul(30).div(100);
      const expectedPayee3 = TOKEN_PRICE.mul(20).div(100);

      expect(payee1Releasable).to.equal(expectedPayee1);
      expect(payee2Releasable).to.equal(expectedPayee2);
      expect(payee3Releasable).to.equal(expectedPayee3);

      // Release payments
      await lazyMintNFT.release(payee1.address);
      await lazyMintNFT.release(payee2.address);
      await lazyMintNFT.release(payee3.address);

      // Check final balances
      const payee1FinalBalance = await ethers.provider.getBalance(payee1.address);
      const payee2FinalBalance = await ethers.provider.getBalance(payee2.address);
      const payee3FinalBalance = await ethers.provider.getBalance(payee3.address);

      expect(payee1FinalBalance.sub(payee1InitialBalance)).to.equal(expectedPayee1);
      expect(payee2FinalBalance.sub(payee2InitialBalance)).to.equal(expectedPayee2);
      expect(payee3FinalBalance.sub(payee3InitialBalance)).to.equal(expectedPayee3);
    });
  });

  describe("Royalty Management", function () {
    it("Should update default royalty settings", async function () {
      const newRecipient = payee1.address;
      const newFee = 1000; // 10%

      await lazyMintNFT.connect(owner).setDefaultRoyalty(newRecipient, newFee);

      expect(await lazyMintNFT.defaultRoyaltyRecipient()).to.equal(newRecipient);
      expect(await lazyMintNFT.defaultRoyaltyFee()).to.equal(newFee);
    });

    it("Should only allow owner to mint directly", async function () {
      // Should succeed with owner
      await lazyMintNFT.connect(owner).mint(recipient.address, TOKEN_URI);
      expect(await lazyMintNFT.ownerOf(1)).to.equal(recipient.address);

      // Should fail with non-owner
      await expect(
        lazyMintNFT.connect(buyer).mint(recipient.address, TOKEN_URI)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("ERC721 Compliance", function () {
    beforeEach(async function () {
      // Mint a token for testing
      await lazyMintNFT.connect(owner).mint(recipient.address, TOKEN_URI);
    });

    it("Should return correct token URI", async function () {
      expect(await lazyMintNFT.tokenURI(1)).to.equal(TOKEN_URI);
    });

    it("Should transfer tokens correctly", async function () {
      await lazyMintNFT.connect(recipient).transferFrom(recipient.address, buyer.address, 1);
      expect(await lazyMintNFT.ownerOf(1)).to.equal(buyer.address);
    });
  });
});
