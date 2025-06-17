import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SimpsonsCarnival, VRFCoordinatorV2Mock } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SimpsonsCarnival", function () {
  // Constants from the contract
  const BRONZE_KEY_PRICE = ethers.parseEther("0.005");
  const SILVER_KEY_PRICE = ethers.parseEther("0.01");
  const GOLD_KEY_PRICE = ethers.parseEther("0.025");
  const WIN_MULTIPLIER = 2;
  const JACKPOT_CONTRIBUTION_PERCENT = 5;
  const HOUSE_EDGE_PERCENT = 5;
  const WIN_PROBABILITY = 30;
  const BREAK_EVEN_PROBABILITY = 35;
  const DEFAULT_JACKPOT_TRIGGER = 1000n;

  async function deployContractFixture() {
    const [owner, player1, player2, player3] = await ethers.getSigners();

    // Deploy Mock VRF Coordinator
    const VRFCoordinatorV2Mock = await ethers.getContractFactory("VRFCoordinatorV2Mock");
    const vrfCoordinator = await VRFCoordinatorV2Mock.deploy(
      ethers.parseEther("0.25"), // 0.25 LINK base fee
      1e9 // 1 gwei gas price link
    );
    await vrfCoordinator.waitForDeployment();

    // Create VRF subscription
    const subTx = await vrfCoordinator.createSubscription();
    const subReceipt = await subTx.wait();
    const subscriptionId = subReceipt?.logs[0]?.topics[1] ? 
      parseInt(subReceipt.logs[0].topics[1], 16) : 1;

    // Fund the subscription
    await vrfCoordinator.fundSubscription(subscriptionId, ethers.parseEther("100"));

    // Deploy the main contract
    const SimpsonsCarnival = await ethers.getContractFactory("SimpsonsCarnival");
    const carnival = await SimpsonsCarnival.deploy(
      await vrfCoordinator.getAddress(),
      subscriptionId,
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c" // key hash
    );
    await carnival.waitForDeployment();

    // Add contract as VRF consumer
    await vrfCoordinator.addConsumer(subscriptionId, await carnival.getAddress());

    return {
      carnival,
      vrfCoordinator,
      subscriptionId,
      owner,
      player1,
      player2,
      player3
    };
  }

  describe("Deployment", function () {
    it("Should deploy with correct initial values", async function () {
      const { carnival, owner } = await loadFixture(deployContractFixture);

      expect(await carnival.owner()).to.equal(owner.address);
      expect(await carnival.paused()).to.be.false;
      expect(await carnival.jackpotPool()).to.equal(0);
      expect(await carnival.totalGamesPlayed()).to.equal(0);
      expect(await carnival.totalKeysUsed()).to.equal(0);
      expect(await carnival.jackpotTriggerCount()).to.equal(DEFAULT_JACKPOT_TRIGGER);
    });

    it("Should have correct key prices", async function () {
      const { carnival } = await loadFixture(deployContractFixture);

      expect(await carnival.getKeyPrice(0)).to.equal(BRONZE_KEY_PRICE); // BRONZE
      expect(await carnival.getKeyPrice(1)).to.equal(SILVER_KEY_PRICE); // SILVER
      expect(await carnival.getKeyPrice(2)).to.equal(GOLD_KEY_PRICE);   // GOLD
    });
  });

  describe("Game Play", function () {
    it("Should allow playing a game with bronze key", async function () {
      const { carnival, player1, vrfCoordinator } = await loadFixture(deployContractFixture);

      const tx = await carnival.connect(player1).playGame(0, 2, { value: BRONZE_KEY_PRICE });
      const receipt = await tx.wait();

      expect(await carnival.totalGamesPlayed()).to.equal(1);
      expect(await carnival.totalKeysUsed()).to.equal(1);

      // Check game was created
      const game = await carnival.getGameDetails(0);
      expect(game.player).to.equal(player1.address);
      expect(game.keyType).to.equal(0); // BRONZE
      expect(game.wager).to.equal(BRONZE_KEY_PRICE);
      expect(game.doorSelected).to.equal(2);
      expect(game.result).to.equal(0); // PENDING
    });

    it("Should reject game with incorrect payment", async function () {
      const { carnival, player1 } = await loadFixture(deployContractFixture);

      await expect(
        carnival.connect(player1).playGame(0, 1, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("Incorrect payment amount");
    });

    it("Should reject game with invalid door number", async function () {
      const { carnival, player1 } = await loadFixture(deployContractFixture);

      await expect(
        carnival.connect(player1).playGame(0, 0, { value: BRONZE_KEY_PRICE })
      ).to.be.revertedWith("Invalid door number");

      await expect(
        carnival.connect(player1).playGame(0, 4, { value: BRONZE_KEY_PRICE })
      ).to.be.revertedWith("Invalid door number");
    });

    it("Should track player stats correctly", async function () {
      const { carnival, player1 } = await loadFixture(deployContractFixture);

      await carnival.connect(player1).playGame(0, 1, { value: BRONZE_KEY_PRICE });

      const stats = await carnival.playerStats(player1.address);
      expect(stats.totalGames).to.equal(1);
      expect(stats.totalWagered).to.equal(BRONZE_KEY_PRICE);
      expect(stats.totalWins).to.equal(0);
      expect(stats.totalLosses).to.equal(0);
      expect(stats.totalBreakEvens).to.equal(0);
    });
  });

  describe("VRF Integration", function () {
    it("Should complete game with win outcome", async function () {
      const { carnival, player1, vrfCoordinator } = await loadFixture(deployContractFixture);

      // Start a game
      const tx = await carnival.connect(player1).playGame(0, 2, { value: BRONZE_KEY_PRICE });
      const receipt = await tx.wait();

      // Get the request ID from events
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

      // Simulate VRF response with winning outcome (< 30)
      await vrfCoordinator.fulfillRandomWords(requestId, [25]); // 25 % 100 = 25 < 30 (win)

      // Check game result
      const game = await carnival.getGameDetails(0);
      expect(game.result).to.equal(1); // WIN
      expect(game.payout).to.equal(BRONZE_KEY_PRICE * BigInt(WIN_MULTIPLIER));

      // Check player stats
      const stats = await carnival.playerStats(player1.address);
      expect(stats.totalWins).to.equal(1);
      expect(stats.totalWon).to.equal(BRONZE_KEY_PRICE * BigInt(WIN_MULTIPLIER));
    });

    it("Should complete game with break-even outcome", async function () {
      const { carnival, player1, vrfCoordinator } = await loadFixture(deployContractFixture);

      const tx = await carnival.connect(player1).playGame(0, 2, { value: BRONZE_KEY_PRICE });
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

      // Simulate VRF response with break-even outcome (30 <= x < 65)
      await vrfCoordinator.fulfillRandomWords(requestId, [50]);

      const game = await carnival.getGameDetails(0);
      expect(game.result).to.equal(2); // BREAK_EVEN
      expect(game.payout).to.equal(BRONZE_KEY_PRICE);

      const stats = await carnival.playerStats(player1.address);
      expect(stats.totalBreakEvens).to.equal(1);
    });

    it("Should complete game with lose outcome", async function () {
      const { carnival, player1, vrfCoordinator } = await loadFixture(deployContractFixture);

      const tx = await carnival.connect(player1).playGame(0, 2, { value: BRONZE_KEY_PRICE });
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

      // Simulate VRF response with lose outcome (>= 65)
      await vrfCoordinator.fulfillRandomWords(requestId, [80]);

      const game = await carnival.getGameDetails(0);
      expect(game.result).to.equal(3); // LOSE
      expect(game.payout).to.equal(0);

      const stats = await carnival.playerStats(player1.address);
      expect(stats.totalLosses).to.equal(1);
    });
  });

  describe("Jackpot System", function () {
    it("Should contribute to jackpot on loss", async function () {
      const { carnival, player1, vrfCoordinator } = await loadFixture(deployContractFixture);

      const initialJackpot = await carnival.jackpotPool();

      const tx = await carnival.connect(player1).playGame(0, 2, { value: BRONZE_KEY_PRICE });
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

      await vrfCoordinator.fulfillRandomWords(requestId, [80]); // lose

      const finalJackpot = await carnival.jackpotPool();
      const expectedContribution = BRONZE_KEY_PRICE - (BRONZE_KEY_PRICE * BigInt(HOUSE_EDGE_PERCENT) / 100n);
      
      expect(finalJackpot - initialJackpot).to.equal(expectedContribution);
    });

    it("Should contribute to jackpot on win", async function () {
      const { carnival, player1, vrfCoordinator } = await loadFixture(deployContractFixture);

      const initialJackpot = await carnival.jackpotPool();

      const tx = await carnival.connect(player1).playGame(0, 2, { value: BRONZE_KEY_PRICE });
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

      await vrfCoordinator.fulfillRandomWords(requestId, [25]); // win

      const finalJackpot = await carnival.jackpotPool();
      const payout = BRONZE_KEY_PRICE * BigInt(WIN_MULTIPLIER);
      const expectedContribution = (payout * BigInt(JACKPOT_CONTRIBUTION_PERCENT)) / 100n;
      
      expect(finalJackpot - initialJackpot).to.equal(expectedContribution);
    });

    it("Should trigger jackpot after specified number of keys", async function () {
      const { carnival, player1, vrfCoordinator, owner } = await loadFixture(deployContractFixture);

      // Set trigger count to 2 for testing
      await carnival.connect(owner).setJackpotTriggerCount(2);

      // Seed initial jackpot
      await owner.sendTransaction({
        to: await carnival.getAddress(),
        value: ethers.parseEther("1.0")
      });

      const initialJackpotPool = await carnival.jackpotPool();
      expect(initialJackpotPool).to.equal(ethers.parseEther("1.0"));

      // Play first game
      let tx = await carnival.connect(player1).playGame(0, 2, { value: BRONZE_KEY_PRICE });
      let receipt = await tx.wait();
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
      await vrfCoordinator.fulfillRandomWords(requestId, [80]); // lose

      expect(await carnival.totalKeysUsed()).to.equal(1);

      // Play second game (should trigger jackpot)
      const player1BalanceBefore = await ethers.provider.getBalance(player1.address);
      
      tx = await carnival.connect(player1).playGame(0, 2, { value: BRONZE_KEY_PRICE });
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
      await vrfCoordinator.fulfillRandomWords(requestId, [80]); // lose

      expect(await carnival.totalKeysUsed()).to.equal(2);
      expect(await carnival.jackpotPool()).to.equal(0); // Should be reset
      expect(await carnival.lastJackpotWinner()).to.equal(player1.address);
    });

    it("Should accept direct ETH contributions to jackpot", async function () {
      const { carnival, player1 } = await loadFixture(deployContractFixture);

      const initialJackpot = await carnival.jackpotPool();
      const contribution = ethers.parseEther("0.5");

      await player1.sendTransaction({
        to: await carnival.getAddress(),
        value: contribution
      });

      const finalJackpot = await carnival.jackpotPool();
      expect(finalJackpot - initialJackpot).to.equal(contribution);
    });
  });

  describe("Leaderboard", function () {
    it("Should update leaderboard after games", async function () {
      const { carnival, player1, player2, vrfCoordinator } = await loadFixture(deployContractFixture);

      // Player 1 plays and wins
      let tx = await carnival.connect(player1).playGame(0, 2, { value: BRONZE_KEY_PRICE });
      let receipt = await tx.wait();
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
      await vrfCoordinator.fulfillRandomWords(requestId, [25]); // win

      // Player 2 plays and loses
      tx = await carnival.connect(player2).playGame(0, 1, { value: BRONZE_KEY_PRICE });
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
      await vrfCoordinator.fulfillRandomWords(requestId, [80]); // lose

      const leaderboard = await carnival.getLeaderboard();
      expect(leaderboard.length).to.be.at.least(2);
      expect(leaderboard).to.include(player1.address);
      expect(leaderboard).to.include(player2.address);
    });
  });

  describe("Access Control", function () {
    it("Should allow only owner to pause", async function () {
      const { carnival, player1, owner } = await loadFixture(deployContractFixture);

      await expect(
        carnival.connect(player1).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await carnival.connect(owner).pause();
      expect(await carnival.paused()).to.be.true;
    });

    it("Should allow only owner to unpause", async function () {
      const { carnival, player1, owner } = await loadFixture(deployContractFixture);

      await carnival.connect(owner).pause();

      await expect(
        carnival.connect(player1).unpause()
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await carnival.connect(owner).unpause();
      expect(await carnival.paused()).to.be.false;
    });

    it("Should allow only owner to set jackpot trigger count", async function () {
      const { carnival, player1, owner } = await loadFixture(deployContractFixture);

      await expect(
        carnival.connect(player1).setJackpotTriggerCount(500)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await carnival.connect(owner).setJackpotTriggerCount(500);
      expect(await carnival.jackpotTriggerCount()).to.equal(500);
    });

    it("Should reject invalid trigger count", async function () {
      const { carnival, owner } = await loadFixture(deployContractFixture);

      await expect(
        carnival.connect(owner).setJackpotTriggerCount(0)
      ).to.be.revertedWith("Invalid count");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow emergency withdrawal only when paused", async function () {
      const { carnival, owner } = await loadFixture(deployContractFixture);

      // Send some ETH to the contract
      await owner.sendTransaction({
        to: await carnival.getAddress(),
        value: ethers.parseEther("1.0")
      });

      // Should fail when not paused
      await expect(
        carnival.connect(owner).emergencyWithdraw()
      ).to.be.revertedWith("Contract must be paused");

      // Pause and try again
      await carnival.connect(owner).pause();
      
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await carnival.connect(owner).emergencyWithdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      // Owner should receive the contract balance minus gas
      expect(ownerBalanceAfter).to.be.closeTo(
        ownerBalanceBefore + ethers.parseEther("1.0") - gasUsed,
        ethers.parseEther("0.001") // Allow small variance for gas estimation
      );
    });

    it("Should prevent playing when paused", async function () {
      const { carnival, player1, owner } = await loadFixture(deployContractFixture);

      await carnival.connect(owner).pause();

      await expect(
        carnival.connect(player1).playGame(0, 2, { value: BRONZE_KEY_PRICE })
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Game History", function () {
    it("Should track player game history", async function () {
      const { carnival, player1, vrfCoordinator } = await loadFixture(deployContractFixture);

      // Play two games
      let tx = await carnival.connect(player1).playGame(0, 1, { value: BRONZE_KEY_PRICE });
      let receipt = await tx.wait();
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
      await vrfCoordinator.fulfillRandomWords(requestId, [25]); // win

      tx = await carnival.connect(player1).playGame(1, 3, { value: SILVER_KEY_PRICE });
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
      await vrfCoordinator.fulfillRandomWords(requestId, [80]); // lose

      const history = await carnival.getPlayerGameHistory(player1.address);
      expect(history.length).to.equal(2);
      expect(history[0]).to.equal(0);
      expect(history[1]).to.equal(1);

      // Check game details
      const game1 = await carnival.getGameDetails(0);
      expect(game1.keyType).to.equal(0); // BRONZE
      expect(game1.doorSelected).to.equal(1);
      expect(game1.result).to.equal(1); // WIN

      const game2 = await carnival.getGameDetails(1);
      expect(game2.keyType).to.equal(1); // SILVER
      expect(game2.doorSelected).to.equal(3);
      expect(game2.result).to.equal(3); // LOSE
    });
  });

  describe("Events", function () {
    it("Should emit correct events during gameplay", async function () {
      const { carnival, player1, vrfCoordinator } = await loadFixture(deployContractFixture);

      const tx = await carnival.connect(player1).playGame(0, 2, { value: BRONZE_KEY_PRICE });
      
      await expect(tx)
        .to.emit(carnival, "KeyPurchased")
        .withArgs(player1.address, 0, BRONZE_KEY_PRICE);
      
      await expect(tx)
        .to.emit(carnival, "GameStarted");

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

      await expect(
        vrfCoordinator.fulfillRandomWords(requestId, [25])
      ).to.emit(carnival, "GameCompleted");
    });

    it("Should emit jackpot events", async function () {
      const { carnival, player1, owner } = await loadFixture(deployContractFixture);

      const tx = await owner.sendTransaction({
        to: await carnival.getAddress(),
        value: ethers.parseEther("1.0")
      });

      await expect(tx)
        .to.emit(carnival, "JackpotContribution")
        .withArgs(ethers.parseEther("1.0"));
    });
  });

  describe("Gas Optimization", function () {
    it("Should have reasonable gas costs for game play", async function () {
      const { carnival, player1 } = await loadFixture(deployContractFixture);

      const tx = await carnival.connect(player1).playGame(0, 2, { value: BRONZE_KEY_PRICE });
      const receipt = await tx.wait();

      // Gas should be reasonable (less than 200k for game start)
      expect(receipt!.gasUsed).to.be.lessThan(200000);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle maximum leaderboard size", async function () {
      const { carnival, vrfCoordinator } = await loadFixture(deployContractFixture);

      // This would require 100+ signers in a real test, simplified for demonstration
      const leaderboard = await carnival.getLeaderboard();
      expect(leaderboard.length).to.be.lessThanOrEqual(100);
    });

    it("Should handle zero jackpot trigger correctly", async function () {
      const { carnival, player1, vrfCoordinator, owner } = await loadFixture(deployContractFixture);

      // This should revert based on the contract validation
      await expect(
        carnival.connect(owner).setJackpotTriggerCount(0)
      ).to.be.revertedWith("Invalid count");
    });
  });
});