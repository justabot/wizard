require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

// Default dummy private key for testing (never use in production)
const DEFAULT_PRIVATE_KEY = "0123456789012345678901234567890123456789012345678901234567890123";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC || "https://eth-sepolia.g.alchemy.com/v2/demo",
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 64) ? [`0x${process.env.PRIVATE_KEY}`] : [`0x${DEFAULT_PRIVATE_KEY}`],
      chainId: 11155111,
      gasPrice: "auto",
    },
    polygon_amoy: {
      url: process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology",
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 64) ? [`0x${process.env.PRIVATE_KEY}`] : [`0x${DEFAULT_PRIVATE_KEY}`],
      chainId: 80002,
      gasPrice: "auto",
    },
    polygon_mumbai: {
      url: process.env.POLYGON_MUMBAI_RPC || "https://rpc-mumbai.maticvigil.com",
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 64) ? [`0x${process.env.PRIVATE_KEY}`] : [`0x${DEFAULT_PRIVATE_KEY}`],
      chainId: 80001,
      gasPrice: "auto",
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "YourApiKeyToken",
      polygon: process.env.POLYGONSCAN_API_KEY || "YourApiKeyToken",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "YourApiKeyToken",
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "YourApiKeyToken",
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 120000 // 2 minutes timeout for testnet tests
  }
};