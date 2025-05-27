// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title MerkleRoyaltyNFT
 * @dev NFT contract with lazy minting and Merkle Tree royalty distribution
 * Features:
 * - Lazy minting with signature verification
 * - Scalable Merkle Tree royalty distribution (supports millions of payees)
 * - ERC2981 royalty standard compliance
 * - Batch operations support
 * - Gas-efficient payment claims
 * - Anti-replay protection
 */
contract MerkleRoyaltyNFT is ERC721URIStorage, ERC721Royalty, Ownable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    // Events
    event LazyMinted(address indexed to, uint256 indexed tokenId, string tokenURI, uint256 price);
    event RoyaltyDistributionCreated(uint256 indexed tokenId, bytes32 merkleRoot, uint256 totalAmount);
    event RoyaltyClaimed(uint256 indexed tokenId, address indexed recipient, uint256 amount);
    event PrimaryPaymentReceived(uint256 indexed tokenId, uint256 amount);

    // Lazy minting voucher structure
    struct LazyMintVoucher {
        uint256 tokenId;
        string uri;
        uint256 price;
        address recipient;
        bytes32 merkleRoot; // Merkle root for royalty distribution
        bytes signature;
    }

    // Royalty claim structure
    struct RoyaltyClaim {
        uint256 tokenId;
        address recipient;
        uint256 amount;
        bytes32[] merkleProof;
    }

    // State variables
    mapping(uint256 => bool) public tokenExists;
    mapping(bytes => bool) public usedSignatures;
    mapping(uint256 => bytes32) public tokenMerkleRoots; // Token ID => Merkle root
    mapping(uint256 => uint256) public tokenRoyaltyPools; // Token ID => Total ETH available for distribution
    mapping(uint256 => mapping(address => bool)) public hasClaimed; // Token ID => recipient => claimed status
    
    address public authorizedSigner;
    uint256 public nextTokenId = 1;
    
    // Default royalty settings (used for ERC2981 compliance)
    uint96 public defaultRoyaltyFee = 1000; // 10% (helps with marketplace compatibility)
    
    constructor(
        string memory name,
        string memory symbol,
        address _authorizedSigner
    ) ERC721(name, symbol) EIP712(name, "1") {
        authorizedSigner = _authorizedSigner;
        _transferOwnership(msg.sender);
        
        // Set default royalty to this contract for ERC2981 compliance
        _setDefaultRoyalty(address(this), defaultRoyaltyFee);
    }

    /**
     * @dev Lazy mint with Merkle root for royalty distribution
     * @param voucher Lazy mint voucher containing token details and merkle root
     */
    function lazyMint(LazyMintVoucher calldata voucher) external payable nonReentrant {
        require(msg.value >= voucher.price, "Insufficient payment");
        require(!usedSignatures[voucher.signature], "Signature already used");
        require(!tokenExists[voucher.tokenId], "Token already exists");
        require(voucher.merkleRoot != bytes32(0), "Invalid merkle root");
        
        // Verify the signature
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            keccak256("LazyMintVoucher(uint256 tokenId,string uri,uint256 price,address recipient,bytes32 merkleRoot)"),
            voucher.tokenId,
            keccak256(bytes(voucher.uri)),
            voucher.price,
            voucher.recipient,
            voucher.merkleRoot
        )));
        
        address signer = digest.recover(voucher.signature);
        require(signer == authorizedSigner, "Invalid signature");
        
        // Mark signature as used and token as existing
        usedSignatures[voucher.signature] = true;
        tokenExists[voucher.tokenId] = true;
        
        // Store merkle root for this token
        tokenMerkleRoots[voucher.tokenId] = voucher.merkleRoot;
        
        // Mint the token
        _mint(voucher.recipient, voucher.tokenId);
        _setTokenURI(voucher.tokenId, voucher.uri);
        
        // Add payment to royalty pool for this token
        if (msg.value > 0) {
            tokenRoyaltyPools[voucher.tokenId] += msg.value;
            emit PrimaryPaymentReceived(voucher.tokenId, msg.value);
            emit RoyaltyDistributionCreated(voucher.tokenId, voucher.merkleRoot, msg.value);
        }
        
        emit LazyMinted(voucher.recipient, voucher.tokenId, voucher.uri, voucher.price);
    }

    /**
     * @dev Batch lazy mint multiple NFTs
     * @param vouchers Array of lazy mint vouchers
     */
    function batchLazyMint(LazyMintVoucher[] calldata vouchers) external payable nonReentrant {
        require(vouchers.length > 0, "Empty vouchers array");
        
        uint256 totalPrice = 0;
        
        // Calculate total price
        for (uint256 i = 0; i < vouchers.length; i++) {
            totalPrice += vouchers[i].price;
        }
        
        require(msg.value >= totalPrice, "Insufficient payment for batch");
        
        // Process each voucher
        for (uint256 i = 0; i < vouchers.length; i++) {
            LazyMintVoucher calldata voucher = vouchers[i];
            
            require(!usedSignatures[voucher.signature], "Signature already used");
            require(!tokenExists[voucher.tokenId], "Token already exists");
            require(voucher.merkleRoot != bytes32(0), "Invalid merkle root");
            
            // Verify the signature
            bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
                keccak256("LazyMintVoucher(uint256 tokenId,string uri,uint256 price,address recipient,bytes32 merkleRoot)"),
                voucher.tokenId,
                keccak256(bytes(voucher.uri)),
                voucher.price,
                voucher.recipient,
                voucher.merkleRoot
            )));
            
            address signer = digest.recover(voucher.signature);
            require(signer == authorizedSigner, "Invalid signature");
            
            // Mark signature as used and token as existing
            usedSignatures[voucher.signature] = true;
            tokenExists[voucher.tokenId] = true;
            
            // Store merkle root for this token
            tokenMerkleRoots[voucher.tokenId] = voucher.merkleRoot;
            
            // Mint the token
            _mint(voucher.recipient, voucher.tokenId);
            _setTokenURI(voucher.tokenId, voucher.uri);
            
            // Add payment to royalty pool for this token
            if (voucher.price > 0) {
                tokenRoyaltyPools[voucher.tokenId] += voucher.price;
                emit PrimaryPaymentReceived(voucher.tokenId, voucher.price);
                emit RoyaltyDistributionCreated(voucher.tokenId, voucher.merkleRoot, voucher.price);
            }
            
            emit LazyMinted(voucher.recipient, voucher.tokenId, voucher.uri, voucher.price);
        }
    }

    /**
     * @dev Claim royalty payment using Merkle proof
     * @param claim Royalty claim with merkle proof
     */
    function claimRoyalty(RoyaltyClaim calldata claim) external nonReentrant {
        require(tokenExists[claim.tokenId], "Token does not exist");
        require(!hasClaimed[claim.tokenId][claim.recipient], "Already claimed");
        require(claim.amount > 0, "Invalid claim amount");
        require(tokenRoyaltyPools[claim.tokenId] >= claim.amount, "Insufficient royalty pool");
        
        // Verify merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(claim.tokenId, claim.recipient, claim.amount));
        require(
            MerkleProof.verify(claim.merkleProof, tokenMerkleRoots[claim.tokenId], leaf),
            "Invalid merkle proof"
        );
        
        // Mark as claimed
        hasClaimed[claim.tokenId][claim.recipient] = true;
        
        // Deduct from royalty pool
        tokenRoyaltyPools[claim.tokenId] -= claim.amount;
        
        // Transfer payment
        (bool success, ) = payable(claim.recipient).call{value: claim.amount}("");
        require(success, "Payment transfer failed");
        
        emit RoyaltyClaimed(claim.tokenId, claim.recipient, claim.amount);
    }

    /**
     * @dev Batch claim royalties for multiple tokens/recipients
     * @param claims Array of royalty claims
     */
    function batchClaimRoyalties(RoyaltyClaim[] calldata claims) external nonReentrant {
        require(claims.length > 0, "Empty claims array");
        
        for (uint256 i = 0; i < claims.length; i++) {
            RoyaltyClaim calldata claim = claims[i];
            
            require(tokenExists[claim.tokenId], "Token does not exist");
            require(!hasClaimed[claim.tokenId][claim.recipient], "Already claimed");
            require(claim.amount > 0, "Invalid claim amount");
            require(tokenRoyaltyPools[claim.tokenId] >= claim.amount, "Insufficient royalty pool");
            
            // Verify merkle proof
            bytes32 leaf = keccak256(abi.encodePacked(claim.tokenId, claim.recipient, claim.amount));
            require(
                MerkleProof.verify(claim.merkleProof, tokenMerkleRoots[claim.tokenId], leaf),
                "Invalid merkle proof"
            );
            
            // Mark as claimed
            hasClaimed[claim.tokenId][claim.recipient] = true;
            
            // Deduct from royalty pool
            tokenRoyaltyPools[claim.tokenId] -= claim.amount;
            
            // Transfer payment
            (bool success, ) = payable(claim.recipient).call{value: claim.amount}("");
            require(success, "Payment transfer failed");
            
            emit RoyaltyClaimed(claim.tokenId, claim.recipient, claim.amount);
        }
    }

    /**
     * @dev Add funds to a token's royalty pool (for secondary sales)
     * @param tokenId Token to add royalties for
     */
    function addRoyaltyFunds(uint256 tokenId) external payable {
        require(tokenExists[tokenId], "Token does not exist");
        require(msg.value > 0, "No payment sent");
        
        tokenRoyaltyPools[tokenId] += msg.value;
        emit PrimaryPaymentReceived(tokenId, msg.value);
    }

    /**
     * @dev Update merkle root for a token (only owner)
     * @param tokenId Token ID to update
     * @param newMerkleRoot New merkle root
     */
    function updateMerkleRoot(uint256 tokenId, bytes32 newMerkleRoot) external onlyOwner {
        require(tokenExists[tokenId], "Token does not exist");
        require(newMerkleRoot != bytes32(0), "Invalid merkle root");
        
        tokenMerkleRoots[tokenId] = newMerkleRoot;
        emit RoyaltyDistributionCreated(tokenId, newMerkleRoot, tokenRoyaltyPools[tokenId]);
    }

    /**
     * @dev Set authorized signer for lazy minting
     * @param _authorizedSigner New authorized signer address
     */
    function setAuthorizedSigner(address _authorizedSigner) external onlyOwner {
        require(_authorizedSigner != address(0), "Invalid signer address");
        authorizedSigner = _authorizedSigner;
    }

    /**
     * @dev Emergency withdraw function (only owner)
     * @param tokenId Token ID to withdraw remaining funds from
     */
    function emergencyWithdraw(uint256 tokenId) external onlyOwner {
        require(tokenExists[tokenId], "Token does not exist");
        uint256 amount = tokenRoyaltyPools[tokenId];
        require(amount > 0, "No funds to withdraw");
        
        tokenRoyaltyPools[tokenId] = 0;
        
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    // Required overrides for multiple inheritance
    function _burn(uint256 tokenId) internal override(ERC721URIStorage, ERC721Royalty) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, ERC721Royalty) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // ERC2981 compliance - returns this contract as royalty recipient
    function royaltyInfo(uint256 tokenId, uint256 salePrice) public view override returns (address, uint256) {
        require(tokenExists[tokenId], "Token does not exist");
        return (address(this), (salePrice * defaultRoyaltyFee) / _feeDenominator());
    }

    // View functions
    function getMerkleRoot(uint256 tokenId) external view returns (bytes32) {
        return tokenMerkleRoots[tokenId];
    }

    function getRoyaltyPool(uint256 tokenId) external view returns (uint256) {
        return tokenRoyaltyPools[tokenId];
    }

    function hasClaimedRoyalty(uint256 tokenId, address recipient) external view returns (bool) {
        return hasClaimed[tokenId][recipient];
    }
} 