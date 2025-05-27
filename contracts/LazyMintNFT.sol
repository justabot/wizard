// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/finance/PaymentSplitter.sol";

/**
 * @title LazyMintNFT
 * @dev NFT contract with lazy minting capabilities and royalty distribution
 * Features:
 * - Lazy minting with signature verification
 * - Automatic royalty distribution via PaymentSplitter
 * - ERC2981 royalty standard compliance
 * - Batch minting support
 * - Configurable royalty rates
 */
contract LazyMintNFT is ERC721URIStorage, ERC721Royalty, Ownable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    // Events
    event LazyMinted(address indexed to, uint256 indexed tokenId, string tokenURI, uint256 price);
    event RoyaltyUpdated(uint256 indexed tokenId, address recipient, uint96 feeNumerator);
    event PaymentSplitterUpdated(address indexed newSplitter);

    // Lazy minting voucher structure
    struct LazyMintVoucher {
        uint256 tokenId;
        string uri;
        uint256 price;
        address recipient;
        uint96 royaltyFee; // Basis points (10000 = 100%)
        address royaltyRecipient;
        bytes signature;
    }

    // State variables
    mapping(uint256 => bool) public tokenExists;
    mapping(bytes => bool) public usedSignatures;
    
    PaymentSplitter public paymentSplitter;
    address public authorizedSigner;
    uint256 public nextTokenId = 1;
    
    // Default royalty settings
    uint96 public defaultRoyaltyFee = 500; // 5%
    address public defaultRoyaltyRecipient;

    // Payment splitter configuration
    address[] private _payees;
    uint256[] private _shares;

    constructor(
        string memory name,
        string memory symbol,
        address _authorizedSigner,
        address[] memory payees,
        uint256[] memory shares_
    ) ERC721(name, symbol) EIP712(name, "1.0.0") {
        require(_authorizedSigner != address(0), "Invalid signer address");
        require(payees.length == shares_.length, "Payees and shares length mismatch");
        require(payees.length > 0, "Must have at least one payee");

        _transferOwnership(msg.sender);
        authorizedSigner = _authorizedSigner;
        defaultRoyaltyRecipient = msg.sender;
        
        // Store payees and shares for potential PaymentSplitter updates
        _payees = payees;
        _shares = shares_;
        
        // Deploy initial PaymentSplitter
        paymentSplitter = new PaymentSplitter(payees, shares_);
        
        // Set default royalty
        _setDefaultRoyalty(defaultRoyaltyRecipient, defaultRoyaltyFee);
    }

    /**
     * @dev Lazy mint an NFT using a signed voucher
     * @param voucher The lazy mint voucher containing token data and signature
     */
    function lazyMint(LazyMintVoucher calldata voucher) external payable nonReentrant {
        require(msg.value >= voucher.price, "Insufficient payment");
        require(!usedSignatures[voucher.signature], "Signature already used");
        require(!tokenExists[voucher.tokenId], "Token already exists");
        
        // Verify the signature
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            keccak256("LazyMintVoucher(uint256 tokenId,string uri,uint256 price,address recipient,uint96 royaltyFee,address royaltyRecipient)"),
            voucher.tokenId,
            keccak256(bytes(voucher.uri)),
            voucher.price,
            voucher.recipient,
            voucher.royaltyFee,
            voucher.royaltyRecipient
        )));
        
        address signer = digest.recover(voucher.signature);
        require(signer == authorizedSigner, "Invalid signature");
        
        // Mark signature as used
        usedSignatures[voucher.signature] = true;
        tokenExists[voucher.tokenId] = true;
        
        // Mint the token
        _mint(voucher.recipient, voucher.tokenId);
        _setTokenURI(voucher.tokenId, voucher.uri);
        
        // Set token-specific royalty if different from default
        if (voucher.royaltyRecipient != address(0) && voucher.royaltyFee > 0) {
            _setTokenRoyalty(voucher.tokenId, voucher.royaltyRecipient, voucher.royaltyFee);
        }
        
        // Forward payment to PaymentSplitter
        if (msg.value > 0) {
            (bool success, ) = address(paymentSplitter).call{value: msg.value}("");
            require(success, "Payment transfer failed");
        }
        
        emit LazyMinted(voucher.recipient, voucher.tokenId, voucher.uri, voucher.price);
    }

    /**
     * @dev Batch lazy mint multiple NFTs
     * @param vouchers Array of lazy mint vouchers
     */
    function batchLazyMint(LazyMintVoucher[] calldata vouchers) external payable nonReentrant {
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
            
            // Verify the signature
            bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
                keccak256("LazyMintVoucher(uint256 tokenId,string uri,uint256 price,address recipient,uint96 royaltyFee,address royaltyRecipient)"),
                voucher.tokenId,
                keccak256(bytes(voucher.uri)),
                voucher.price,
                voucher.recipient,
                voucher.royaltyFee,
                voucher.royaltyRecipient
            )));
            
            address signer = digest.recover(voucher.signature);
            require(signer == authorizedSigner, "Invalid signature");
            
            // Mark signature as used
            usedSignatures[voucher.signature] = true;
            tokenExists[voucher.tokenId] = true;
            
            // Mint the token
            _mint(voucher.recipient, voucher.tokenId);
            _setTokenURI(voucher.tokenId, voucher.uri);
            
            // Set token-specific royalty if different from default
            if (voucher.royaltyRecipient != address(0) && voucher.royaltyFee > 0) {
                _setTokenRoyalty(voucher.tokenId, voucher.royaltyRecipient, voucher.royaltyFee);
            }
            
            emit LazyMinted(voucher.recipient, voucher.tokenId, voucher.uri, voucher.price);
        }
        
        // Forward payment to PaymentSplitter
        if (msg.value > 0) {
            (bool success, ) = address(paymentSplitter).call{value: msg.value}("");
            require(success, "Payment transfer failed");
        }
    }

    /**
     * @dev Regular mint function for owner (non-lazy)
     * @param to Address to mint to
     * @param uri Token URI
     */
    function mint(address to, string memory uri) external onlyOwner {
        uint256 tokenId = nextTokenId;
        nextTokenId++;
        
        tokenExists[tokenId] = true;
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        emit LazyMinted(to, tokenId, uri, 0);
    }

    /**
     * @dev Update the authorized signer
     * @param newSigner New authorized signer address
     */
    function setAuthorizedSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "Invalid signer address");
        authorizedSigner = newSigner;
    }

    /**
     * @dev Update default royalty settings
     * @param recipient Royalty recipient address
     * @param feeNumerator Royalty fee in basis points
     */
    function setDefaultRoyalty(address recipient, uint96 feeNumerator) external onlyOwner {
        defaultRoyaltyRecipient = recipient;
        defaultRoyaltyFee = feeNumerator;
        _setDefaultRoyalty(recipient, feeNumerator);
    }

    /**
     * @dev Update royalty for a specific token
     * @param tokenId Token ID
     * @param recipient Royalty recipient
     * @param feeNumerator Royalty fee in basis points
     */
    function setTokenRoyalty(uint256 tokenId, address recipient, uint96 feeNumerator) external onlyOwner {
        require(tokenExists[tokenId], "Token does not exist");
        _setTokenRoyalty(tokenId, recipient, feeNumerator);
        emit RoyaltyUpdated(tokenId, recipient, feeNumerator);
    }

    /**
     * @dev Update PaymentSplitter with new payees and shares
     * @param payees Array of payee addresses
     * @param shares_ Array of shares corresponding to payees
     */
    function updatePaymentSplitter(address[] memory payees, uint256[] memory shares_) external onlyOwner {
        require(payees.length == shares_.length, "Payees and shares length mismatch");
        require(payees.length > 0, "Must have at least one payee");
        
        _payees = payees;
        _shares = shares_;
        
        paymentSplitter = new PaymentSplitter(payees, shares_);
        emit PaymentSplitterUpdated(address(paymentSplitter));
    }

    /**
     * @dev Release payments to a specific payee
     * @param account Address of the payee
     */
    function release(address payable account) external {
        paymentSplitter.release(account);
    }

    /**
     * @dev Get releasable amount for a payee
     * @param account Address of the payee
     * @return Amount that can be released
     */
    function releasable(address account) external view returns (uint256) {
        return paymentSplitter.releasable(account);
    }

    /**
     * @dev Get shares of a payee
     * @param account Address of the payee
     * @return Number of shares
     */
    function shares(address account) external view returns (uint256) {
        return paymentSplitter.shares(account);
    }

    /**
     * @dev Get total shares
     * @return Total number of shares
     */
    function totalShares() external view returns (uint256) {
        return paymentSplitter.totalShares();
    }

    /**
     * @dev Get total released amount
     * @return Total amount released
     */
    function totalReleased() external view returns (uint256) {
        return paymentSplitter.totalReleased();
    }

    /**
     * @dev Get payee at index
     * @param index Index of the payee
     * @return Address of the payee
     */
    function payee(uint256 index) external view returns (address) {
        return paymentSplitter.payee(index);
    }

    // Override functions for multiple inheritance
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, ERC721Royalty) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _burn(uint256 tokenId) internal override(ERC721URIStorage, ERC721Royalty) {
        super._burn(tokenId);
    }

    // Receive function to accept direct payments
    receive() external payable {
        if (msg.value > 0) {
            (bool success, ) = address(paymentSplitter).call{value: msg.value}("");
            require(success, "Payment transfer failed");
        }
    }
} 