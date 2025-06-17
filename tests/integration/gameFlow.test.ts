import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SimpsonsCarnival, VRFCoordinatorV2Mock } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Full Game Flow Integration Tests", function () {
  // Test duration constants
  const TEST_TIMEOUT = 60000; // 1 minute

  async function deployFullSystemFixture() {
    const [owner, player1, player2, player3, houseAccount] = await ethers.getSigners();

    // Deploy Mock VRF Coordinator
    const VRFCoordinatorV2Mock = await ethers.getContractFactory("VRFCoordinatorV2Mock");
    const vrfCoordinator = await VRFCoordinatorV2Mock.deploy(
      ethers.parseEther("0.25"),
      1e9
    );
    await vrfCoordinator.waitForDeployment();

    // Create and fund VRF subscription
    const subTx = await vrfCoordinator.createSubscription();
    const subReceipt = await subTx.wait();
    const subscriptionId = subReceipt?.logs[0]?.topics[1] ? 
      parseInt(subReceipt.logs[0].topics[1], 16) : 1;

    await vrfCoordinator.fundSubscription(subscriptionId, ethers.parseEther("100"));

    // Deploy main contract
    const SimpsonsCarnival = await ethers.getContractFactory("SimpsonsCarnival");
    const carnival = await SimpsonsCarnival.deploy(
      await vrfCoordinator.getAddress(),
      subscriptionId,
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c"
    );
    await carnival.waitForDeployment();

    // Add contract as VRF consumer
    await vrfCoordinator.addConsumer(subscriptionId, await carnival.getAddress());

    // Seed initial jackpot
    await owner.sendTransaction({
      to: await carnival.getAddress(),
      value: ethers.parseEther("5.0")
    });

    return {
      carnival,
      vrfCoordinator,
      subscriptionId,
      owner,
      player1,
      player2,
      player3,
      houseAccount
    };
  }

  describe("Complete Game Sessions", function () {
    it("Should handle a full game session with multiple players", async function () {
      this.timeout(TEST_TIMEOUT);
      
      const { carnival, vrfCoordinator, player1, player2, player3 } = 
        await loadFixture(deployFullSystemFixture);

      const initialJackpot = await carnival.jackpotPool();
      console.log(`Initial jackpot: ${ethers.formatEther(initialJackpot)} ETH`);

      // Player 1: Bronze key game - should win
      console.log("Player 1 playing bronze key game...");
      let tx = await carnival.connect(player1).playGame(0, 1, { 
        value: ethers.parseEther("0.005") 
      });
      let receipt = await tx.wait();
      
      // Extract request ID and fulfill with winning outcome
      let gameStartedEvent = receipt?.logs.find(log => {
        try {
          const parsed = carnival.interface.parseLog(log);
          return parsed?.name === "GameStarted";
        } catch {
          return false;
        }
      });
      let parsedEvent = carnival.interface.parseLog(gameStartedEvent!);
      let requestId = parsedEvent?.args.requestId;
      
      await vrfCoordinator.fulfillRandomWords(requestId, [15]); // Win (< 30)

      // Verify game result
      let game = await carnival.getGameDetails(0);
      expect(game.result).to.equal(1); // WIN
      console.log(`Player 1 won: ${ethers.formatEther(game.payout)} ETH`);

      // Player 2: Silver key game - should break even
      console.log("Player 2 playing silver key game...");
      tx = await carnival.connect(player2).playGame(1, 2, { 
        value: ethers.parseEther("0.01") 
      });
      receipt = await tx.wait();
      
      gameStartedEvent = receipt?.logs.find(log => {
        try {
          const parsed = carnival.interface.parseLog(log);
          return parsed?.name === "GameStarted";
        } catch {
          return false;
        }
      });
      parsedEvent = carnival.interface.parseLog(gameStartedEvent!);
      requestId = parsedEvent?.args.requestId;
      
      await vrfCoordinator.fulfillRandomWords(requestId, [45]); // Break even (30-65)

      game = await carnival.getGameDetails(1);
      expect(game.result).to.equal(2); // BREAK_EVEN
      console.log(`Player 2 broke even: ${ethers.formatEther(game.payout)} ETH`);

      // Player 3: Gold key game - should lose
      console.log("Player 3 playing gold key game...");
      tx = await carnival.connect(player3).playGame(2, 3, { 
        value: ethers.parseEther("0.025") 
      });
      receipt = await tx.wait();
      
      gameStartedEvent = receipt?.logs.find(log => {
        try {
          const parsed = carnival.interface.parseLog(log);
          return parsed?.name === "GameStarted";
        } catch {
          return false;
        }
      });
      parsedEvent = carnival.interface.parseLog(gameStartedEvent!);
      requestId = parsedEvent?.args.requestId;
      
      await vrfCoordinator.fulfillRandomWords(requestId, [75]); // Lose (>= 65)

      game = await carnival.getGameDetails(2);
      expect(game.result).to.equal(3); // LOSE
      console.log(`Player 3 lost: ${ethers.formatEther(game.payout)} ETH`);

      // Verify total stats
      expect(await carnival.totalGamesPlayed()).to.equal(3);
      expect(await carnival.totalKeysUsed()).to.equal(3);

      // Verify jackpot increased from losses and win contributions
      const finalJackpot = await carnival.jackpotPool();
      expect(finalJackpot).to.be.greaterThan(initialJackpot);
      console.log(`Final jackpot: ${ethers.formatEther(finalJackpot)} ETH`);

      // Verify leaderboard
      const leaderboard = await carnival.getLeaderboard();
      expect(leaderboard.length).to.equal(3);
      expect(leaderboard).to.include(player1.address);
      expect(leaderboard).to.include(player2.address);
      expect(leaderboard).to.include(player3.address);
    });

    it("Should trigger jackpot correctly in game session", async function () {
      this.timeout(TEST_TIMEOUT);
      
      const { carnival, vrfCoordinator, player1, owner } = 
        await loadFixture(deployFullSystemFixture);

      // Set low trigger count for testing
      await carnival.connect(owner).setJackpotTriggerCount(3);

      const initialJackpot = await carnival.jackpotPool();
      console.log(`Initial jackpot for trigger test: ${ethers.formatEther(initialJackpot)} ETH`);

      const player1InitialBalance = await ethers.provider.getBalance(player1.address);

      // Play games until jackpot triggers
      for (let i = 0; i < 3; i++) {
        console.log(`Playing game ${i + 1}/3...`);
        
        const tx = await carnival.connect(player1).playGame(0, 1, { 
          value: ethers.parseEther("0.005") 
        });
        const receipt = await tx.wait();
        
        const gameStartedEvent = receipt?.logs.find(log => {
          try {
            const parsed = carnival.interface.parseLog(log);
            return parsed?.name === "GameStarted";
          } catch {
            return false;
          }
        });
        const parsedEvent = carnival.interface.parseLog(gameStartedEvent!);
        const requestId = parsedEvent?.args.requestId;
        
        // Make them lose to contribute to jackpot
        await vrfCoordinator.fulfillRandomWords(requestId, [80]);
        
        console.log(`Games played: ${await carnival.totalKeysUsed()}`);
      }

      // After 3rd game, jackpot should have triggered
      expect(await carnival.jackpotPool()).to.equal(0); // Reset after trigger
      expect(await carnival.lastJackpotWinner()).to.equal(player1.address);

      const lastJackpotAmount = await carnival.lastJackpotAmount();
      console.log(`Jackpot triggered! Amount: ${ethers.formatEther(lastJackpotAmount)} ETH`);
      
      // Player should have received the jackpot (minus gas costs for playing)
      const player1FinalBalance = await ethers.provider.getBalance(player1.address);
      // Account for the 3 game costs but add jackpot win
      const expectedMinBalance = player1InitialBalance - ethers.parseEther("0.015") + lastJackpotAmount - ethers.parseEther("0.01"); // Gas buffer
      expect(player1FinalBalance).to.be.greaterThan(expectedMinBalance);
    });
  });

  describe("Multi-Player Competitive Scenarios", function () {
    it("Should handle simultaneous games from multiple players", async function () {
      this.timeout(TEST_TIMEOUT);
      
      const { carnival, vrfCoordinator, player1, player2, player3 } = 
        await loadFixture(deployFullSystemFixture);

      // All players start games simultaneously
      console.log("Starting simultaneous games...");
      
      const [tx1, tx2, tx3] = await Promise.all([
        carnival.connect(player1).playGame(0, 1, { value: ethers.parseEther("0.005") }),
        carnival.connect(player2).playGame(1, 2, { value: ethers.parseEther("0.01") }),
        carnival.connect(player3).playGame(2, 3, { value: ethers.parseEther("0.025") })
      ]);

      const [receipt1, receipt2, receipt3] = await Promise.all([
        tx1.wait(),
        tx2.wait(),
        tx3.wait()
      ]);

      // Extract request IDs
      const extractRequestId = (receipt: any) => {
        const gameStartedEvent = receipt?.logs.find((log: any) => {
          try {
            const parsed = carnival.interface.parseLog(log);
            return parsed?.name === "GameStarted";
          } catch {
            return false;
          }
        });
        const parsedEvent = carnival.interface.parseLog(gameStartedEvent!);
        return parsedEvent?.args.requestId;
      };

      const requestId1 = extractRequestId(receipt1);
      const requestId2 = extractRequestId(receipt2);
      const requestId3 = extractRequestId(receipt3);

      // Fulfill all VRF requests
      await Promise.all([
        vrfCoordinator.fulfillRandomWords(requestId1, [25]), // Win
        vrfCoordinator.fulfillRandomWords(requestId2, [50]), // Break even
        vrfCoordinator.fulfillRandomWords(requestId3, [80])  // Lose
      ]);

      // Verify all games completed correctly
      const game1 = await carnival.getGameDetails(0);
      const game2 = await carnival.getGameDetails(1);
      const game3 = await carnival.getGameDetails(2);

      expect(game1.result).to.equal(1); // WIN
      expect(game2.result).to.equal(2); // BREAK_EVEN
      expect(game3.result).to.equal(3); // LOSE

      console.log("All simultaneous games completed successfully");
    });

    it("Should maintain accurate statistics across multiple sessions", async function () {
      this.timeout(TEST_TIMEOUT);
      
      const { carnival, vrfCoordinator, player1, player2 } = 
        await loadFixture(deployFullSystemFixture);

      // Player 1 plays multiple games
      const player1Games = 5;
      const player1Wins = 2;
      const player1BreakEvens = 1;
      const player1Losses = 2;

      const outcomes = [25, 35, 75, 15, 85]; // win, break-even, lose, win, lose

      for (let i = 0; i < player1Games; i++) {
        const tx = await carnival.connect(player1).playGame(0, 1, { 
          value: ethers.parseEther("0.005") 
        });
        const receipt = await tx.wait();
        
        const gameStartedEvent = receipt?.logs.find(log => {
          try {
            const parsed = carnival.interface.parseLog(log);
            return parsed?.name === "GameStarted";
          } catch {
            return false;
          }
        });
        const parsedEvent = carnival.interface.parseLog(gameStartedEvent!);
        const requestId = parsedEvent?.args.requestId;
        
        await vrfCoordinator.fulfillRandomWords(requestId, [outcomes[i]]);
      }

      // Player 2 plays fewer games
      const player2Games = 3;
      const player2Outcomes = [20, 70, 40]; // win, lose, break-even

      for (let i = 0; i < player2Games; i++) {
        const tx = await carnival.connect(player2).playGame(1, 2, { 
          value: ethers.parseEther("0.01") 
        });
        const receipt = await tx.wait();
        
        const gameStartedEvent = receipt?.logs.find(log => {
          try {
            const parsed = carnival.interface.parseLog(log);
            return parsed?.name === "GameStarted";
          } catch {
            return false;
          }
        });
        const parsedEvent = carnival.interface.parseLog(gameStartedEvent!);
        const requestId = parsedEvent?.args.requestId;
        
        await vrfCoordinator.fulfillRandomWords(requestId, [player2Outcomes[i]]);
      }

      // Verify player 1 stats
      const player1Stats = await carnival.playerStats(player1.address);
      expect(player1Stats.totalGames).to.equal(player1Games);
      expect(player1Stats.totalWins).to.equal(player1Wins);
      expect(player1Stats.totalBreakEvens).to.equal(player1BreakEvens);
      expect(player1Stats.totalLosses).to.equal(player1Losses);
      expect(player1Stats.totalWagered).to.equal(ethers.parseEther("0.025")); // 5 * 0.005

      // Verify player 2 stats
      const player2Stats = await carnival.playerStats(player2.address);
      expect(player2Stats.totalGames).to.equal(player2Games);
      expect(player2Stats.totalWins).to.equal(1);
      expect(player2Stats.totalBreakEvens).to.equal(1);
      expect(player2Stats.totalLosses).to.equal(1);
      expect(player2Stats.totalWagered).to.equal(ethers.parseEther("0.03")); // 3 * 0.01

      // Verify global stats
      expect(await carnival.totalGamesPlayed()).to.equal(player1Games + player2Games);
      expect(await carnival.totalKeysUsed()).to.equal(player1Games + player2Games);

      console.log("All statistics verified across multiple sessions");
    });
  });

  describe("Economic Model Validation", function () {
    it("Should maintain correct house edge and jackpot contributions", async function () {
      this.timeout(TEST_TIMEOUT);
      
      const { carnival, vrfCoordinator, player1, owner } = 
        await loadFixture(deployFullSystemFixture);

      const initialContractBalance = await ethers.provider.getBalance(await carnival.getAddress());
      const initialJackpot = await carnival.jackpotPool();

      // Play multiple losing games to test house edge
      const numGames = 10;
      const betAmount = ethers.parseEther("0.01"); // Silver key

      for (let i = 0; i < numGames; i++) {
        const tx = await carnival.connect(player1).playGame(1, 2, { value: betAmount });
        const receipt = await tx.wait();
        
        const gameStartedEvent = receipt?.logs.find(log => {
          try {
            const parsed = carnival.interface.parseLog(log);
            return parsed?.name === "GameStarted";
          } catch {
            return false;
          }
        });
        const parsedEvent = carnival.interface.parseLog(gameStartedEvent!);
        const requestId = parsedEvent?.args.requestId;
        
        await vrfCoordinator.fulfillRandomWords(requestId, [80]); // Always lose
      }

      const finalContractBalance = await ethers.provider.getBalance(await carnival.getAddress());
      const finalJackpot = await carnival.jackpotPool();

      // Calculate expected values
      const totalWagered = betAmount * BigInt(numGames);
      const expectedHouseEdge = (totalWagered * 5n) / 100n; // 5% house edge
      const expectedJackpotContribution = totalWagered - expectedHouseEdge;

      // Verify house edge is captured
      const contractBalanceIncrease = finalContractBalance - initialContractBalance;
      expect(contractBalanceIncrease).to.be.approximately(
        totalWagered, 
        ethers.parseEther("0.001") // Small tolerance
      );

      // Verify jackpot contributions
      const jackpotIncrease = finalJackpot - initialJackpot;
      expect(jackpotIncrease).to.be.approximately(
        expectedJackpotContribution,
        ethers.parseEther("0.001") // Small tolerance
      );

      console.log(`House edge captured: ${ethers.formatEther(expectedHouseEdge)} ETH`);
      console.log(`Jackpot contribution: ${ethers.formatEther(jackpotIncrease)} ETH`);
    });

    it("Should handle win payouts and contributions correctly", async function () {
      this.timeout(TEST_TIMEOUT);
      
      const { carnival, vrfCoordinator, player1 } = 
        await loadFixture(deployFullSystemFixture);

      const player1InitialBalance = await ethers.provider.getBalance(player1.address);
      const initialJackpot = await carnival.jackpotPool();
      
      const betAmount = ethers.parseEther("0.025"); // Gold key
      
      // Play a winning game
      const tx = await carnival.connect(player1).playGame(2, 3, { value: betAmount });
      const receipt = await tx.wait();
      
      const gameStartedEvent = receipt?.logs.find(log => {
        try {
          const parsed = carnival.interface.parseLog(log);
          return parsed?.name === "GameStarted";
        } catch {
          return false;
        }
      });
      const parsedEvent = carnival.interface.parseLog(gameStartedEvent!);
      const requestId = parsedEvent?.args.requestId;
      
      await vrfCoordinator.fulfillRandomWords(requestId, [20]); // Win

      const player1FinalBalance = await ethers.provider.getBalance(player1.address);
      const finalJackpot = await carnival.jackpotPool();

      // Calculate expected payout
      const expectedPayout = betAmount * 2n; // 2x multiplier
      const expectedJackpotContribution = (expectedPayout * 5n) / 100n; // 5% of payout

      // Player should receive payout minus gas costs
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const expectedPlayerBalance = player1InitialBalance - betAmount + expectedPayout - gasUsed;
      
      expect(player1FinalBalance).to.be.approximately(
        expectedPlayerBalance,
        ethers.parseEther("0.001") // Gas estimation tolerance
      );

      // Jackpot should increase by 5% of payout
      const jackpotIncrease = finalJackpot - initialJackpot;
      expect(jackpotIncrease).to.equal(expectedJackpotContribution);

      console.log(`Win payout: ${ethers.formatEther(expectedPayout)} ETH`);
      console.log(`Jackpot contribution from win: ${ethers.formatEther(expectedJackpotContribution)} ETH`);
    });
  });

  describe("Edge Cases and Error Scenarios", function () {
    it("Should handle contract pause gracefully during active games", async function () {
      this.timeout(TEST_TIMEOUT);
      
      const { carnival, vrfCoordinator, player1, owner } = 
        await loadFixture(deployFullSystemFixture);

      // Start a game
      const tx = await carnival.connect(player1).playGame(0, 1, { 
        value: ethers.parseEther("0.005") 
      });
      const receipt = await tx.wait();
      
      // Pause the contract
      await carnival.connect(owner).pause();

      // Should not be able to start new games
      await expect(
        carnival.connect(player1).playGame(0, 1, { value: ethers.parseEther("0.005") })
      ).to.be.revertedWith("Pausable: paused");

      // But existing games should still complete via VRF
      const gameStartedEvent = receipt?.logs.find(log => {
        try {
          const parsed = carnival.interface.parseLog(log);
          return parsed?.name === "GameStarted";
        } catch {
          return false;
        }
      });
      const parsedEvent = carnival.interface.parseLog(gameStartedEvent!);
      const requestId = parsedEvent?.args.requestId;
      
      // VRF fulfillment should still work
      await vrfCoordinator.fulfillRandomWords(requestId, [25]);

      const game = await carnival.getGameDetails(0);
      expect(game.result).to.equal(1); // WIN

      console.log("Game completed successfully even after contract pause");
    });

    it("Should handle emergency withdrawal scenario", async function () {
      this.timeout(TEST_TIMEOUT);
      
      const { carnival, owner } = await loadFixture(deployFullSystemFixture);

      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
      const contractBalance = await ethers.provider.getBalance(await carnival.getAddress());

      // Emergency scenario: pause and withdraw
      await carnival.connect(owner).pause();
      
      const withdrawTx = await carnival.connect(owner).emergencyWithdraw();
      const withdrawReceipt = await withdrawTx.wait();
      const gasUsed = withdrawReceipt!.gasUsed * withdrawReceipt!.gasPrice;

      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      const finalContractBalance = await ethers.provider.getBalance(await carnival.getAddress());

      // Contract should be drained
      expect(finalContractBalance).to.equal(0);

      // Owner should receive contract balance minus gas
      expect(finalOwnerBalance).to.be.approximately(
        initialOwnerBalance + contractBalance - gasUsed,
        ethers.parseEther("0.001") // Gas estimation tolerance
      );

      console.log(`Emergency withdrawal successful: ${ethers.formatEther(contractBalance)} ETH recovered`);
    });
  });

  describe("Performance and Gas Optimization", function () {
    it("Should maintain reasonable gas costs under load", async function () {
      this.timeout(TEST_TIMEOUT);
      
      const { carnival, vrfCoordinator, player1 } = 
        await loadFixture(deployFullSystemFixture);

      const gasUsages: bigint[] = [];

      // Play multiple games and track gas usage
      for (let i = 0; i < 5; i++) {
        const tx = await carnival.connect(player1).playGame(0, 1, { 
          value: ethers.parseEther("0.005") 
        });
        const receipt = await tx.wait();
        gasUsages.push(receipt!.gasUsed);

        // Complete the game
        const gameStartedEvent = receipt?.logs.find(log => {
          try {
            const parsed = carnival.interface.parseLog(log);
            return parsed?.name === "GameStarted";
          } catch {
            return false;
          }
        });
        const parsedEvent = carnival.interface.parseLog(gameStartedEvent!);
        const requestId = parsedEvent?.args.requestId;
        
        await vrfCoordinator.fulfillRandomWords(requestId, [Math.floor(Math.random() * 100)]);
      }

      // Verify gas usage is consistent and reasonable
      const avgGasUsage = gasUsages.reduce((a, b) => a + b) / BigInt(gasUsages.length);
      const maxGasUsage = gasUsages.reduce((a, b) => a > b ? a : b);

      console.log(`Average gas usage: ${avgGasUsage}`);
      console.log(`Maximum gas usage: ${maxGasUsage}`);

      // Should be under 200k gas per game
      expect(maxGasUsage).to.be.lessThan(200000);
      
      // Gas usage should be consistent (within 10% variance)
      for (const gasUsage of gasUsages) {
        const variance = gasUsage > avgGasUsage ? 
          (gasUsage - avgGasUsage) : (avgGasUsage - gasUsage);
        const percentVariance = (variance * 100n) / avgGasUsage;
        expect(percentVariance).to.be.lessThan(10);
      }
    });
  });
});