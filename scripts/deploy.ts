import { ethers } from "hardhat";
import { SimpsonsCarnival } from "../typechain-types";
import * as fs from "fs";
import * as path from "path";

interface DeploymentConfig {
  vrfCoordinator: string;
  subscriptionId: string;
  keyHash: string;
  initialJackpot?: string;
}

const networkConfigs: { [key: string]: DeploymentConfig } = {
  // Ethereum Mainnet
  mainnet: {
    vrfCoordinator: "0x271682DEB8C4E0901D1a1550aD2e64D568E69909",
    subscriptionId: process.env.VRF_SUBSCRIPTION_ID || "0",
    keyHash: "0x8af398995b04c28e9951adb9721ef74c74f93e6a478f39e7e0777be13527e7ef", // 200 gwei
  },
  // Sepolia Testnet
  sepolia: {
    vrfCoordinator: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
    subscriptionId: process.env.VRF_SUBSCRIPTION_ID || "0",
    keyHash: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // 30 gwei
  },
  // Polygon Mainnet
  polygon: {
    vrfCoordinator: "0xAE975071Be8F8eE67addBC1A82488F1C24858067",
    subscriptionId: process.env.VRF_SUBSCRIPTION_ID || "0",
    keyHash: "0x6e099d640cde6de9d40ac749b4b594126b0169747122711109c9985d47751f93", // 30 gwei
  },
  // Arbitrum One
  arbitrum: {
    vrfCoordinator: "0x41034678D6C633D8a95c75e1138A360a28bA15d1",
    subscriptionId: process.env.VRF_SUBSCRIPTION_ID || "0",
    keyHash: "0x68d24f9a037a649944964c2a1ebd0b2918f4a243d2a99701cc22b548cf2daff0", // 30 gwei
  },
  // Optimism
  optimism: {
    vrfCoordinator: "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634",  
    subscriptionId: process.env.VRF_SUBSCRIPTION_ID || "0",
    keyHash: "0x83250c5584ffa93feb6ee082981c5ebe484c865196750b39835ad4f13780435d", // 30 gwei
  },
  // Base
  base: {
    vrfCoordinator: "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634",
    subscriptionId: process.env.VRF_SUBSCRIPTION_ID || "0", 
    keyHash: "0x83250c5584ffa93feb6ee082981c5ebe484c865196750b39835ad4f13780435d", // 30 gwei
  },
  // Localhost/Hardhat (Mock values)
  localhost: {
    vrfCoordinator: "0x0000000000000000000000000000000000000000", // Will be replaced with mock
    subscriptionId: "1",
    keyHash: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
  },
  hardhat: {
    vrfCoordinator: "0x0000000000000000000000000000000000000000", // Will be replaced with mock
    subscriptionId: "1", 
    keyHash: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
  }
};

async function deployMockVRF() {
  console.log("<² Deploying Mock VRF Coordinator for local testing...");
  
  const MockVRFCoordinator = await ethers.getContractFactory("VRFCoordinatorV2Mock");
  const mockVRF = await MockVRFCoordinator.deploy(
    ethers.parseEther("0.25"), // 0.25 LINK base fee
    1e9 // 1 gwei gas price link
  );
  await mockVRF.waitForDeployment();
  
  const mockAddress = await mockVRF.getAddress();
  console.log(` Mock VRF Coordinator deployed to: ${mockAddress}`);
  
  // Create a subscription
  const subTx = await mockVRF.createSubscription();
  const subReceipt = await subTx.wait();
  const subscriptionId = subReceipt?.logs[0]?.topics[1] ? 
    parseInt(subReceipt.logs[0].topics[1], 16) : 1;
  
  console.log(` Created VRF subscription with ID: ${subscriptionId}`);
  
  // Fund the subscription
  await mockVRF.fundSubscription(subscriptionId, ethers.parseEther("100"));
  console.log(` Funded subscription with 100 LINK`);
  
  return { address: mockAddress, subscriptionId: subscriptionId.toString() };
}

async function saveDeploymentInfo(
  contractAddress: string, 
  network: string, 
  deploymentTx: string,
  config: DeploymentConfig & { subscriptionId: string }
) {
  const deploymentInfo = {
    network,
    contractAddress,
    deploymentTransaction: deploymentTx,
    vrfCoordinator: config.vrfCoordinator,
    subscriptionId: config.subscriptionId,
    keyHash: config.keyHash,
    timestamp: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber()
  };
  
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filePath = path.join(deploymentsDir, `${network}.json`);
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log(`=¾ Deployment info saved to: ${filePath}`);
  return deploymentInfo;
}

async function main() {
  console.log("<ª Starting Carnival deployment...\n");
  
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  
  console.log(`< Network: ${networkName} (Chain ID: ${network.chainId})`);
  console.log(`=d Deployer: ${deployer.address}`);
  console.log(`=° Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);
  
  // Get network configuration
  let config = networkConfigs[networkName];
  
  if (!config) {
    console.error(`L No configuration found for network: ${networkName}`);
    console.log("Available networks:", Object.keys(networkConfigs));
    process.exit(1);
  }
  
  // Deploy mock VRF for local networks
  if (networkName === "localhost" || networkName === "hardhat") {
    const mockVRF = await deployMockVRF();
    config = {
      ...config,
      vrfCoordinator: mockVRF.address,
      subscriptionId: mockVRF.subscriptionId
    };
  }
  
  // Validate required environment variables for mainnet deployments
  if (networkName !== "localhost" && networkName !== "hardhat") {
    if (!process.env.VRF_SUBSCRIPTION_ID) {
      console.error("L VRF_SUBSCRIPTION_ID environment variable is required for mainnet deployments");
      process.exit(1);
    }
    config.subscriptionId = process.env.VRF_SUBSCRIPTION_ID;
  }
  
  console.log("<›  Deployment Configuration:");
  console.log(`   VRF Coordinator: ${config.vrfCoordinator}`);
  console.log(`   Subscription ID: ${config.subscriptionId}`);
  console.log(`   Key Hash: ${config.keyHash}\n`);
  
  // Deploy the main contract
  console.log("=€ Deploying SimpsonsCarnival contract...");
  
  const SimpsonsCarnival = await ethers.getContractFactory("SimpsonsCarnival");
  const carnival = await SimpsonsCarnival.deploy(
    config.vrfCoordinator,
    config.subscriptionId,
    config.keyHash
  );
  
  console.log("ó Waiting for deployment confirmation...");
  await carnival.waitForDeployment();
  
  const contractAddress = await carnival.getAddress();
  const deploymentTx = carnival.deploymentTransaction()?.hash || "";
  
  console.log(` SimpsonsCarnival deployed to: ${contractAddress}`);
  console.log(`=Ë Transaction hash: ${deploymentTx}\n`);
  
  // Save deployment information
  const deploymentInfo = await saveDeploymentInfo(contractAddress, networkName, deploymentTx, config);
  
  // Add contract to VRF subscription for local deployments
  if (networkName === "localhost" || networkName === "hardhat") {
    console.log("= Adding contract as VRF consumer...");
    const MockVRFCoordinator = await ethers.getContractFactory("VRFCoordinatorV2Mock");
    const mockVRF = MockVRFCoordinator.attach(config.vrfCoordinator);
    await mockVRF.addConsumer(config.subscriptionId, contractAddress);
    console.log(" Contract added as VRF consumer");
  }
  
  // Seed initial jackpot if specified
  if (config.initialJackpot) {
    console.log(`\n=° Seeding initial jackpot with ${config.initialJackpot} ETH...`);
    const seedTx = await deployer.sendTransaction({
      to: contractAddress,
      value: ethers.parseEther(config.initialJackpot)
    });
    await seedTx.wait();
    console.log(" Initial jackpot seeded");
  }
  
  // Display post-deployment instructions
  console.log("\n<‰ Deployment completed successfully!");
  console.log("\n=Ë Next Steps:");
  console.log("1. Verify the contract on the block explorer:");
  console.log(`   npx hardhat run scripts/verify.ts --network ${networkName}`);
  
  if (networkName !== "localhost" && networkName !== "hardhat") {
    console.log("2. Add the contract as a consumer to your VRF subscription:");
    console.log(`   Visit: https://vrf.chain.link/`);
    console.log(`   Subscription ID: ${config.subscriptionId}`);
    console.log(`   Consumer Address: ${contractAddress}`);
    console.log("3. Fund your VRF subscription with LINK tokens");
  }
  
  console.log("4. Update your frontend configuration with the new contract address");
  console.log("5. Run the integration tests to verify everything works:");
  console.log(`   npm run test:integration`);
  
  // Return deployment info for use in other scripts
  return {
    contractAddress,
    network: networkName,
    config: deploymentInfo
  };
}

// Only run main if this script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\nL Deployment failed:");
      console.error(error);
      process.exit(1);
    });
}

export { main as deploy, networkConfigs };