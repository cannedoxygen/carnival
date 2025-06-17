import { run, ethers } from "hardhat";
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
    throw new Error(`No deployment found for network: ${network}`);
  }
  
  const deploymentData = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(deploymentData);
}

async function main() {
  console.log("= Starting contract verification...\n");
  
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  
  console.log(`< Network: ${networkName} (Chain ID: ${network.chainId})`);
  
  // Skip verification for local networks
  if (networkName === "localhost" || networkName === "hardhat") {
    console.log("   Skipping verification for local network");
    return;
  }
  
  try {
    // Load deployment information
    console.log("=Â Loading deployment information...");
    const deploymentInfo = await loadDeploymentInfo(networkName);
    
    console.log(`=Í Contract Address: ${deploymentInfo.contractAddress}`);
    console.log(`= VRF Coordinator: ${deploymentInfo.vrfCoordinator}`);
    console.log(`<” Subscription ID: ${deploymentInfo.subscriptionId}`);
    console.log(`= Key Hash: ${deploymentInfo.keyHash}`);
    console.log(`ð Deployed at: ${deploymentInfo.timestamp}\n`);
    
    // Wait for a few block confirmations before verifying
    const currentBlock = await ethers.provider.getBlockNumber();
    const confirmations = currentBlock - deploymentInfo.blockNumber;
    
    if (confirmations < 5) {
      console.log(`ó Waiting for more confirmations... (${confirmations}/5)`);
      console.log("   This helps ensure the contract bytecode is propagated across the network");
      
      // Wait for additional blocks
      const targetConfirmations = 5;
      while ((await ethers.provider.getBlockNumber()) - deploymentInfo.blockNumber < targetConfirmations) {
        console.log(`   Current confirmations: ${(await ethers.provider.getBlockNumber()) - deploymentInfo.blockNumber}`);
        await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds
      }
    }
    
    console.log("=€ Starting verification process...");
    
    // Verify the main contract
    await run("verify:verify", {
      address: deploymentInfo.contractAddress,
      constructorArguments: [
        deploymentInfo.vrfCoordinator,
        deploymentInfo.subscriptionId,
        deploymentInfo.keyHash
      ],
    });
    
    console.log(" Contract verification completed successfully!");
    
    // Generate verification summary
    const summary = {
      network: networkName,
      contractAddress: deploymentInfo.contractAddress,
      verified: true,
      verificationTime: new Date().toISOString(),
      explorerUrl: getExplorerUrl(networkName, deploymentInfo.contractAddress)
    };
    
    // Save verification info
    const verificationDir = path.join(__dirname, "../deployments");
    const verificationPath = path.join(verificationDir, `${networkName}-verification.json`);
    fs.writeFileSync(verificationPath, JSON.stringify(summary, null, 2));
    
    console.log(`=¾ Verification info saved to: ${verificationPath}`);
    console.log(`< View on explorer: ${summary.explorerUrl}`);
    
  } catch (error: any) {
    console.error("L Verification failed:");
    
    if (error.message.includes("Already Verified")) {
      console.log(" Contract is already verified!");
      const deploymentInfo = await loadDeploymentInfo(networkName);
      console.log(`< View on explorer: ${getExplorerUrl(networkName, deploymentInfo.contractAddress)}`);
    } else if (error.message.includes("does not have bytecode")) {
      console.error("   The contract address may be incorrect or the deployment failed");
    } else if (error.message.includes("Fail - Unable to verify")) {
      console.error("   The contract could not be verified. This might be due to:");
      console.error("   - Incorrect constructor arguments");
      console.error("   - Compiler version mismatch");
      console.error("   - Different Solidity settings used during compilation");
    } else {
      console.error("   Error details:", error.message);
    }
    
    throw error;
  }
}

function getExplorerUrl(network: string, address: string): string {
  const explorers: { [key: string]: string } = {
    mainnet: `https://etherscan.io/address/${address}`,
    sepolia: `https://sepolia.etherscan.io/address/${address}`,
    polygon: `https://polygonscan.com/address/${address}`,
    arbitrum: `https://arbiscan.io/address/${address}`,
    optimism: `https://optimistic.etherscan.io/address/${address}`,
    base: `https://basescan.org/address/${address}`,
  };
  
  return explorers[network] || `https://etherscan.io/address/${address}`;
}

// Help function to show available networks
function showAvailableNetworks() {
  console.log("\n=Ë Available networks for verification:");
  console.log("   - mainnet (Ethereum Mainnet)");
  console.log("   - sepolia (Sepolia Testnet)");
  console.log("   - polygon (Polygon Mainnet)");
  console.log("   - arbitrum (Arbitrum One)");
  console.log("   - optimism (Optimism Mainnet)");
  console.log("   - base (Base Mainnet)");
  console.log("\nUsage: npx hardhat run scripts/verify.ts --network <network>");
}

// Command line argument handling
if (process.argv.includes("--help")) {
  showAvailableNetworks();
  process.exit(0);
}

// Only run main if this script is executed directly
if (require.main === module) {
  main()
    .then(() => {
      console.log("\n<‰ Verification process completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nL Verification process failed:");
      console.error(error);
      console.log("\n=¡ Troubleshooting tips:");
      console.log("1. Make sure the contract was deployed on this network");
      console.log("2. Check that your API keys are correctly configured");
      console.log("3. Verify that the contract has enough confirmations");
      console.log("4. Ensure constructor arguments match the deployment");
      process.exit(1);
    });
}

export { main as verify };