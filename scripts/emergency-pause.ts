import { ethers } from "hardhat";
import { SimpsonsCarnival } from "../typechain-types";
import * as fs from "fs";
import * as path from "path";

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

async function logEmergencyAction(
  action: string,
  network: string,
  contractAddress: string,
  adminAddress: string,
  transactionHash: string,
  reason?: string
) {
  const emergencyLog = {
    action,
    network,
    contractAddress,
    adminAddress,
    transactionHash,
    reason: reason || "Not specified",
    timestamp: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber()
  };
  
  const logsDir = path.join(__dirname, "../logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  const logPath = path.join(logsDir, `emergency-actions-${network}.json`);
  let existingLogs: any[] = [];
  
  if (fs.existsSync(logPath)) {
    existingLogs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  }
  
  existingLogs.push(emergencyLog);
  fs.writeFileSync(logPath, JSON.stringify(existingLogs, null, 2));
  
  console.log(`=Ë Emergency action logged to: ${logPath}`);
}

async function pauseContract(carnival: SimpsonsCarnival, reason?: string) {
  console.log("ø  Pausing contract...");
  
  if (reason) {
    console.log(`=Ý Reason: ${reason}`);
  }
  
  const tx = await carnival.pause();
  console.log(`=Ë Transaction hash: ${tx.hash}`);
  console.log("ó Waiting for confirmation...");
  
  const receipt = await tx.wait();
  console.log(` Contract paused in block ${receipt?.blockNumber}`);
  
  return tx.hash;
}

async function unpauseContract(carnival: SimpsonsCarnival, reason?: string) {
  console.log("¶  Unpausing contract...");
  
  if (reason) {
    console.log(`=Ý Reason: ${reason}`);
  }
  
  const tx = await carnival.unpause();
  console.log(`=Ë Transaction hash: ${tx.hash}`);
  console.log("ó Waiting for confirmation...");
  
  const receipt = await tx.wait();
  console.log(` Contract unpaused in block ${receipt?.blockNumber}`);
  
  return tx.hash;
}

async function emergencyWithdraw(carnival: SimpsonsCarnival, reason?: string) {
  console.log("=¸ Performing emergency withdrawal...");
  
  if (reason) {
    console.log(`=Ý Reason: ${reason}`);
  }
  
  // First ensure contract is paused
  const isPaused = await carnival.paused();
  if (!isPaused) {
    console.log("   Contract must be paused before emergency withdrawal");
    const pauseTxHash = await pauseContract(carnival, "Pre-emergency withdrawal pause");
    console.log(" Contract paused for emergency withdrawal");
  }
  
  const balanceBefore = await ethers.provider.getBalance(await carnival.getAddress());
  console.log(`=° Contract balance before withdrawal: ${ethers.formatEther(balanceBefore)} ETH`);
  
  const tx = await carnival.emergencyWithdraw();
  console.log(`=Ë Transaction hash: ${tx.hash}`);
  console.log("ó Waiting for confirmation...");
  
  const receipt = await tx.wait();
  console.log(` Emergency withdrawal completed in block ${receipt?.blockNumber}`);
  
  const balanceAfter = await ethers.provider.getBalance(await carnival.getAddress());
  console.log(`=° Contract balance after withdrawal: ${ethers.formatEther(balanceAfter)} ETH`);
  console.log(`=È Amount withdrawn: ${ethers.formatEther(balanceBefore - balanceAfter)} ETH`);
  
  return tx.hash;
}

async function setJackpotTriggerCount(carnival: SimpsonsCarnival, newCount: number, reason?: string) {
  console.log(`<° Setting jackpot trigger count to: ${newCount}`);
  
  if (reason) {
    console.log(`=Ý Reason: ${reason}`);
  }
  
  const currentCount = await carnival.jackpotTriggerCount();
  console.log(`=Ê Current trigger count: ${currentCount}`);
  
  const tx = await carnival.setJackpotTriggerCount(newCount);
  console.log(`=Ë Transaction hash: ${tx.hash}`);
  console.log("ó Waiting for confirmation...");
  
  const receipt = await tx.wait();
  console.log(` Jackpot trigger count updated in block ${receipt?.blockNumber}`);
  
  return tx.hash;
}

async function getContractStatus(carnival: SimpsonsCarnival) {
  console.log("\n=Ê Current Contract Status:");
  
  const isPaused = await carnival.paused();
  console.log(`   Paused: ${isPaused ? "Yes" : "No"}`);
  
  const owner = await carnival.owner();
  console.log(`   Owner: ${owner}`);
  
  const balance = await ethers.provider.getBalance(await carnival.getAddress());
  console.log(`   Contract Balance: ${ethers.formatEther(balance)} ETH`);
  
  const jackpotPool = await carnival.jackpotPool();
  console.log(`   Jackpot Pool: ${ethers.formatEther(jackpotPool)} ETH`);
  
  const totalGames = await carnival.totalGamesPlayed();
  console.log(`   Total Games: ${totalGames}`);
  
  const totalKeys = await carnival.totalKeysUsed();
  console.log(`   Total Keys Used: ${totalKeys}`);
  
  const jackpotTriggerCount = await carnival.jackpotTriggerCount();
  console.log(`   Jackpot Trigger Count: ${jackpotTriggerCount}`);
  
  const lastJackpotWinner = await carnival.lastJackpotWinner();
  if (lastJackpotWinner !== ethers.ZeroAddress) {
    console.log(`   Last Jackpot Winner: ${lastJackpotWinner}`);
    const lastJackpotAmount = await carnival.lastJackpotAmount();
    console.log(`   Last Jackpot Amount: ${ethers.formatEther(lastJackpotAmount)} ETH`);
    const lastJackpotTime = await carnival.lastJackpotWinTime();
    console.log(`   Last Jackpot Time: ${new Date(Number(lastJackpotTime) * 1000).toISOString()}`);
  }
}

async function main() {
  console.log("=¨ Emergency Contract Management Tool\n");
  
  const [admin] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  
  console.log(`< Network: ${networkName} (Chain ID: ${network.chainId})`);
  console.log(`=d Admin: ${admin.address}`);
  console.log(`=³ Balance: ${ethers.formatEther(await ethers.provider.getBalance(admin.address))} ETH\n`);
  
  // Load deployment info
  const deploymentInfo = await loadDeploymentInfo(networkName);
  console.log(`=Í Contract Address: ${deploymentInfo.contractAddress}`);
  
  // Connect to the deployed contract
  const SimpsonsCarnival = await ethers.getContractFactory("SimpsonsCarnival");
  const carnival = SimpsonsCarnival.attach(deploymentInfo.contractAddress) as SimpsonsCarnival;
  
  // Verify admin is the owner
  const owner = await carnival.owner();
  if (owner.toLowerCase() !== admin.address.toLowerCase()) {
    throw new Error(`L Access denied. Admin ${admin.address} is not the contract owner ${owner}`);
  }
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const action = args.find(arg => !arg.startsWith("--"))?.toLowerCase();
  const reasonArg = args.find(arg => arg.startsWith("--reason="));
  const reason = reasonArg ? reasonArg.split("=")[1] : undefined;
  
  if (!action) {
    showUsage();
    await getContractStatus(carnival);
    return;
  }
  
  let transactionHash: string;
  
  try {
    switch (action) {
      case "pause":
        transactionHash = await pauseContract(carnival, reason);
        await logEmergencyAction("PAUSE", networkName, deploymentInfo.contractAddress, admin.address, transactionHash, reason);
        break;
        
      case "unpause":
        transactionHash = await unpauseContract(carnival, reason);
        await logEmergencyAction("UNPAUSE", networkName, deploymentInfo.contractAddress, admin.address, transactionHash, reason);
        break;
        
      case "withdraw":
        transactionHash = await emergencyWithdraw(carnival, reason);
        await logEmergencyAction("EMERGENCY_WITHDRAW", networkName, deploymentInfo.contractAddress, admin.address, transactionHash, reason);
        break;
        
      case "set-trigger":
        const countArg = args.find(arg => arg.startsWith("--count="));
        if (!countArg) {
          throw new Error("L --count parameter is required for set-trigger action");
        }
        const newCount = parseInt(countArg.split("=")[1]);
        if (isNaN(newCount) || newCount <= 0) {
          throw new Error("L Count must be a positive number");
        }
        transactionHash = await setJackpotTriggerCount(carnival, newCount, reason);
        await logEmergencyAction("SET_TRIGGER_COUNT", networkName, deploymentInfo.contractAddress, admin.address, transactionHash, reason);
        break;
        
      case "status":
        await getContractStatus(carnival);
        return;
        
      default:
        console.error(`L Unknown action: ${action}`);
        showUsage();
        process.exit(1);
    }
    
    console.log("\n<‰ Emergency action completed successfully!");
    
    // Show updated status after action
    await getContractStatus(carnival);
    
  } catch (error: any) {
    console.error("L Emergency action failed:");
    
    if (error.message.includes("Ownable: caller is not the owner")) {
      console.error("   Only the contract owner can perform this action");
    } else if (error.message.includes("Pausable: paused")) {
      console.error("   Contract is already paused");
    } else if (error.message.includes("Pausable: not paused")) {
      console.error("   Contract is not paused");
    } else if (error.message.includes("Contract must be paused")) {
      console.error("   Contract must be paused for emergency withdrawal");
    } else {
      console.error("   Error details:", error.message);
    }
    
    throw error;
  }
}

function showUsage() {
  console.log("\n=¨ Emergency Contract Management");
  console.log("\nUsage:");
  console.log("  npx hardhat run scripts/emergency-pause.ts --network <network> <action> [options]");
  console.log("\nActions:");
  console.log("  pause              - Pause the contract (stops all game operations)");
  console.log("  unpause            - Unpause the contract (resumes game operations)");
  console.log("  withdraw           - Emergency withdrawal of all contract funds (requires paused state)");
  console.log("  set-trigger        - Set new jackpot trigger count (requires --count parameter)");
  console.log("  status             - Show current contract status");
  console.log("\nOptions:");
  console.log("  --reason=<text>    - Reason for the emergency action (logged)");
  console.log("  --count=<number>   - New trigger count (for set-trigger action)");
  console.log("\nExamples:");
  console.log('  npx hardhat run scripts/emergency-pause.ts --network sepolia pause --reason="Security incident"');
  console.log('  npx hardhat run scripts/emergency-pause.ts --network mainnet withdraw --reason="Exploit detected"');
  console.log("  npx hardhat run scripts/emergency-pause.ts --network localhost set-trigger --count=500");
  console.log("  npx hardhat run scripts/emergency-pause.ts --network polygon status");
  console.log("\n   WARNING: These actions can disrupt game operations and should only be used in emergencies!");
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
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nL Emergency management failed:");
      console.error(error);
      console.log("\n=¡ Troubleshooting tips:");
      console.log("1. Make sure you are the contract owner");
      console.log("2. Check that the contract is deployed on this network");
      console.log("3. Verify your wallet is connected to the correct network");
      console.log("4. Ensure you have sufficient gas for the transaction");
      showUsage();
      process.exit(1);
    });
}

export { main as emergencyPause };