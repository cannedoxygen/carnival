import { ethers } from "hardhat";
import { SimpsonsCarnival } from "../typechain-types";
import * as fs from "fs";
import * as path from "path";
import { networkConfigs } from "./deploy";

interface DeploymentInfo {
  network: string;
  contractAddress: string;
  deploymentTransaction: string;
  vrfCoordinator: string;
  subscriptionId: string;
  keyHash: string;
  timestamp: string;
  blockNumber: number;
}

async function loadDeploymentInfo(network: string): Promise<DeploymentInfo> {
  const deploymentsDir = path.join(__dirname, "../deployments");
  const filePath = path.join(deploymentsDir, `${network}.json`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`No deployment found for network: ${network}. Please run deployment first.`);
  }
  
  const deploymentData = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(deploymentData);
}

async function main() {
  console.log("=° Starting jackpot seeding...\n");
  
  const [seeder] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  
  console.log(`< Network: ${networkName} (Chain ID: ${network.chainId})`);
  console.log(`=d Seeder: ${seeder.address}`);
  console.log(`=³ Balance: ${ethers.formatEther(await ethers.provider.getBalance(seeder.address))} ETH\n`);
  
  // Load deployment info
  const deploymentInfo = await loadDeploymentInfo(networkName);
  console.log(`=Í Contract Address: ${deploymentInfo.contractAddress}`);
  
  // Connect to the deployed contract
  const SimpsonsCarnival = await ethers.getContractFactory("SimpsonsCarnival");
  const carnival = SimpsonsCarnival.attach(deploymentInfo.contractAddress) as SimpsonsCarnival;
  
  // Get current jackpot amount
  const currentJackpot = await carnival.jackpotPool();
  console.log(`<° Current Jackpot: ${ethers.formatEther(currentJackpot)} ETH`);
  
  // Parse seed amount from command line or use default
  const args = process.argv.slice(2);
  let seedAmount = "1.0"; // Default 1 ETH
  
  if (args.length > 0) {
    const amountArg = args.find(arg => arg.startsWith("--amount="));
    if (amountArg) {
      seedAmount = amountArg.split("=")[1];
    } else if (args[0] && !args[0].startsWith("--")) {
      seedAmount = args[0];
    }
  }
  
  // Validate seed amount
  try {
    const seedAmountWei = ethers.parseEther(seedAmount);
    const balance = await ethers.provider.getBalance(seeder.address);
    
    if (seedAmountWei > balance) {
      throw new Error(`Insufficient balance. Need ${seedAmount} ETH but only have ${ethers.formatEther(balance)} ETH`);
    }
    
    console.log(`=µ Seeding amount: ${seedAmount} ETH`);
    
    // Confirm the action
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log(`   You are about to seed ${seedAmount} ETH to the jackpot on ${networkName}`);
      console.log("This action cannot be undone and the funds will be part of the game jackpot.");
      
      // In a real implementation, you might want to add a confirmation prompt
      console.log("Proceeding with seeding...");
    }
    
    // Send ETH to the contract (will be added to jackpot via receive function)
    console.log("=€ Sending transaction...");
    const tx = await seeder.sendTransaction({
      to: deploymentInfo.contractAddress,
      value: seedAmountWei,
      gasLimit: 100000 // Set a reasonable gas limit
    });
    
    console.log(`=Ë Transaction hash: ${tx.hash}`);
    console.log("ó Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log(` Transaction confirmed in block ${receipt?.blockNumber}`);
    
    // Get updated jackpot amount
    const newJackpot = await carnival.jackpotPool();
    const increase = newJackpot - currentJackpot;
    
    console.log(`<‰ Jackpot seeding completed!`);
    console.log(`=È Jackpot increased by: ${ethers.formatEther(increase)} ETH`);
    console.log(`<° New jackpot total: ${ethers.formatEther(newJackpot)} ETH`);
    
    // Log the seeding activity
    const seedingLog = {
      network: networkName,
      contractAddress: deploymentInfo.contractAddress,
      seederAddress: seeder.address,
      amount: seedAmount,
      transactionHash: tx.hash,
      blockNumber: receipt?.blockNumber,
      timestamp: new Date().toISOString(),
      previousJackpot: ethers.formatEther(currentJackpot),
      newJackpot: ethers.formatEther(newJackpot)
    };
    
    // Save seeding log
    const logsDir = path.join(__dirname, "../logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const logPath = path.join(logsDir, `jackpot-seeding-${networkName}.json`);
    let existingLogs: any[] = [];
    
    if (fs.existsSync(logPath)) {
      existingLogs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    }
    
    existingLogs.push(seedingLog);
    fs.writeFileSync(logPath, JSON.stringify(existingLogs, null, 2));
    
    console.log(`=¾ Seeding log saved to: ${logPath}`);
    
    // Display post-seeding info
    console.log("\n=Ê Current Game Status:");
    console.log(`   Total Games Played: ${await carnival.totalGamesPlayed()}`);
    console.log(`   Total Keys Used: ${await carnival.totalKeysUsed()}`);
    console.log(`   Jackpot Trigger Count: ${await carnival.jackpotTriggerCount()}`);
    
    const lastJackpotWinner = await carnival.lastJackpotWinner();
    if (lastJackpotWinner !== ethers.ZeroAddress) {
      console.log(`   Last Jackpot Winner: ${lastJackpotWinner}`);
      console.log(`   Last Jackpot Amount: ${ethers.formatEther(await carnival.lastJackpotAmount())} ETH`);
    }
    
  } catch (error: any) {
    console.error("L Failed to seed jackpot:");
    
    if (error.message.includes("insufficient funds")) {
      console.error("   Insufficient ETH balance to seed the requested amount");
    } else if (error.message.includes("execution reverted")) {
      console.error("   Transaction reverted. The contract might be paused or have other restrictions");
    } else {
      console.error("   Error details:", error.message);
    }
    
    throw error;
  }
}

function showUsage() {
  console.log("\n=° Jackpot Seeding Script");
  console.log("\nUsage:");
  console.log("  npx hardhat run scripts/seed-jackpot.ts --network <network> [amount]");
  console.log("  npx hardhat run scripts/seed-jackpot.ts --network <network> --amount=<amount>");
  console.log("\nExamples:");
  console.log("  npx hardhat run scripts/seed-jackpot.ts --network localhost 0.5");
  console.log("  npx hardhat run scripts/seed-jackpot.ts --network sepolia --amount=1.0");
  console.log("  npx hardhat run scripts/seed-jackpot.ts --network mainnet --amount=5.0");
  console.log("\nDefault amount: 1.0 ETH");
  console.log("\nAvailable networks:");
  console.log("  - localhost/hardhat (local testing)");
  console.log("  - sepolia (testnet)");
  console.log("  - mainnet (Ethereum mainnet)");
  console.log("  - polygon (Polygon mainnet)");
  console.log("  - arbitrum (Arbitrum One)");
  console.log("  - optimism (Optimism mainnet)");
  console.log("  - base (Base mainnet)");
}

// Command line argument handling
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  showUsage();
  process.exit(0);
}

// Only run main if this script is executed directly
if (require.main === module) {
  main()
    .then(() => {
      console.log("\n<‰ Jackpot seeding completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nL Jackpot seeding failed:");
      console.error(error);
      console.log("\n=¡ Troubleshooting tips:");
      console.log("1. Make sure the contract is deployed on this network");
      console.log("2. Check that you have sufficient ETH balance");
      console.log("3. Verify the contract is not paused");
      console.log("4. Ensure your wallet is connected to the correct network");
      showUsage();
      process.exit(1);
    });
}

export { main as seedJackpot };