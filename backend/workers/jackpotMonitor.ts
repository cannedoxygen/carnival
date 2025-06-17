import { ethers } from 'ethers';
import { Server as SocketIOServer } from 'socket.io';
import pino from 'pino';
import { EventEmitter } from 'events';
import { AnalyticsService } from '../services/analytics';

const logger = pino({ name: 'jackpot-monitor' });

interface ContractEvent {
  eventName: string;
  args: any;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
}

export class JackpotMonitor extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private io: SocketIOServer;
  private analyticsService?: AnalyticsService;
  private isRunning = false;
  private lastProcessedBlock = 0;
  private monitorInterval?: NodeJS.Timeout;
  private retryCount = 0;
  private maxRetries = 5;

  private readonly CARNIVAL_ABI = [
    "event KeyPurchased(address indexed player, uint8 keyType, uint256 price)",
    "event GameStarted(address indexed player, uint256 indexed gameId, uint256 requestId, uint256 doorSelected)",
    "event GameCompleted(address indexed player, uint256 indexed gameId, uint8 result, uint256 payout)",
    "event JackpotWon(address indexed winner, uint256 amount)",
    "event JackpotContribution(uint256 amount)",
    "event RandomnessRequested(uint256 requestId)",
    "event RandomnessFulfilled(uint256 requestId, uint256 randomWord)"
  ];

  constructor(provider: ethers.JsonRpcProvider, contractAddress: string, io: SocketIOServer) {
    super();
    this.provider = provider;
    this.io = io;
    this.contract = new ethers.Contract(contractAddress, this.CARNIVAL_ABI, provider);
    
    // Initialize analytics service
    this.analyticsService = new AnalyticsService();
  }

  /**
   * Start monitoring blockchain events
   */
  async start(): Promise<void> {
    try {
      if (this.isRunning) {
        logger.warn('JackpotMonitor is already running');
        return;
      }

      // Initialize analytics service
      if (this.analyticsService) {
        await this.analyticsService.initialize();
      }

      // Get current block number
      this.lastProcessedBlock = await this.provider.getBlockNumber();
      logger.info({ blockNumber: this.lastProcessedBlock }, 'Starting jackpot monitor');

      // Set up event listeners
      this.setupEventListeners();

      // Start monitoring loop
      this.isRunning = true;
      this.monitorInterval = setInterval(() => {
        this.monitorEvents();
      }, 10000); // Check every 10 seconds

      // Monitor historical events (last 1000 blocks)
      await this.processHistoricalEvents(1000);

      this.emit('started');
      logger.info('JackpotMonitor started successfully');
      
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to start jackpot monitor');
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    try {
      this.isRunning = false;
      
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval);
      }

      // Remove all event listeners
      this.contract.removeAllListeners();

      // Shutdown analytics service
      if (this.analyticsService) {
        await this.analyticsService.shutdown();
      }

      this.emit('stopped');
      logger.info('JackpotMonitor stopped');
      
    } catch (error) {
      logger.error({ error: error.message }, 'Error stopping jackpot monitor');
    }
  }

  /**
   * Set up event listeners for real-time monitoring
   */
  private setupEventListeners(): void {
    // Key purchase events
    this.contract.on('KeyPurchased', async (player, keyType, price, event) => {
      await this.handleKeyPurchased(player, keyType, price, event);
    });

    // Game started events
    this.contract.on('GameStarted', async (player, gameId, requestId, doorSelected, event) => {
      await this.handleGameStarted(player, gameId, requestId, doorSelected, event);
    });

    // Game completed events
    this.contract.on('GameCompleted', async (player, gameId, result, payout, event) => {
      await this.handleGameCompleted(player, gameId, result, payout, event);
    });

    // Jackpot won events
    this.contract.on('JackpotWon', async (winner, amount, event) => {
      await this.handleJackpotWon(winner, amount, event);
    });

    // Jackpot contribution events
    this.contract.on('JackpotContribution', async (amount, event) => {
      await this.handleJackpotContribution(amount, event);
    });

    // Randomness events
    this.contract.on('RandomnessRequested', async (requestId, event) => {
      await this.handleRandomnessRequested(requestId, event);
    });

    this.contract.on('RandomnessFulfilled', async (requestId, randomWord, event) => {
      await this.handleRandomnessFulfilled(requestId, randomWord, event);
    });

    logger.info('Event listeners set up');
  }

  /**
   * Monitor for new events
   */
  private async monitorEvents(): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      
      if (currentBlock > this.lastProcessedBlock) {
        await this.processBlockRange(this.lastProcessedBlock + 1, currentBlock);
        this.lastProcessedBlock = currentBlock;
      }

      this.retryCount = 0; // Reset retry count on success
      
    } catch (error) {
      this.retryCount++;
      logger.error({ 
        error: error.message, 
        retryCount: this.retryCount 
      }, 'Error monitoring events');

      if (this.retryCount >= this.maxRetries) {
        logger.error('Max retries reached, stopping monitor');
        await this.stop();
        return;
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
      setTimeout(() => {
        if (this.isRunning) {
          this.monitorEvents();
        }
      }, delay);
    }
  }

  /**
   * Process events in a block range
   */
  private async processBlockRange(fromBlock: number, toBlock: number): Promise<void> {
    try {
      const filter = {
        address: this.contract.target,
        fromBlock,
        toBlock
      };

      const logs = await this.provider.getLogs(filter);
      
      for (const log of logs) {
        try {
          const parsedLog = this.contract.interface.parseLog({
            topics: log.topics,
            data: log.data
          });

          if (parsedLog) {
            await this.processEvent(parsedLog, log);
          }
        } catch (parseError) {
          logger.warn({ 
            error: parseError.message, 
            logIndex: log.logIndex 
          }, 'Failed to parse log');
        }
      }

      logger.debug({ fromBlock, toBlock, eventCount: logs.length }, 'Processed block range');
      
    } catch (error) {
      logger.error({ error: error.message, fromBlock, toBlock }, 'Error processing block range');
      throw error;
    }
  }

  /**
   * Process historical events
   */
  private async processHistoricalEvents(blockCount: number): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - blockCount);
      
      logger.info({ fromBlock, currentBlock }, 'Processing historical events');
      
      await this.processBlockRange(fromBlock, currentBlock);
      
    } catch (error) {
      logger.error({ error: error.message }, 'Error processing historical events');
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(parsedLog: any, log: any): Promise<void> {
    const eventName = parsedLog.name;
    const args = parsedLog.args;
    
    const block = await this.provider.getBlock(log.blockNumber);
    const timestamp = block ? block.timestamp * 1000 : Date.now();

    const contractEvent: ContractEvent = {
      eventName,
      args,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      timestamp
    };

    // Handle each event type
    switch (eventName) {
      case 'KeyPurchased':
        await this.handleKeyPurchased(args.player, args.keyType, args.price, contractEvent);
        break;
      case 'GameStarted':
        await this.handleGameStarted(args.player, args.gameId, args.requestId, args.doorSelected, contractEvent);
        break;
      case 'GameCompleted':
        await this.handleGameCompleted(args.player, args.gameId, args.result, args.payout, contractEvent);
        break;
      case 'JackpotWon':
        await this.handleJackpotWon(args.winner, args.amount, contractEvent);
        break;
      case 'JackpotContribution':
        await this.handleJackpotContribution(args.amount, contractEvent);
        break;
      case 'RandomnessRequested':
        await this.handleRandomnessRequested(args.requestId, contractEvent);
        break;
      case 'RandomnessFulfilled':
        await this.handleRandomnessFulfilled(args.requestId, args.randomWord, contractEvent);
        break;
    }
  }

  /**
   * Handle key purchased event
   */
  private async handleKeyPurchased(player: string, keyType: number, price: bigint, event: any): Promise<void> {
    const keyTypes = ['BRONZE', 'SILVER', 'GOLD'];
    const keyTypeName = keyTypes[keyType] || 'UNKNOWN';
    
    logger.info({
      player,
      keyType: keyTypeName,
      price: ethers.formatEther(price),
      txHash: event.transactionHash
    }, 'Key purchased');

    // Emit real-time event
    this.io.to('game-updates').emit('keyPurchased', {
      player,
      keyType: keyTypeName,
      price: ethers.formatEther(price),
      timestamp: new Date().toISOString()
    });

    this.emit('keyPurchased', { player, keyType: keyTypeName, price });
  }

  /**
   * Handle game started event
   */
  private async handleGameStarted(player: string, gameId: bigint, requestId: bigint, doorSelected: bigint, event: any): Promise<void> {
    logger.info({
      player,
      gameId: gameId.toString(),
      requestId: requestId.toString(),
      doorSelected: doorSelected.toString(),
      txHash: event.transactionHash
    }, 'Game started');

    // Emit real-time event
    this.io.to('game-updates').emit('gameStarted', {
      player,
      gameId: gameId.toString(),
      requestId: requestId.toString(),
      doorSelected: doorSelected.toString(),
      timestamp: new Date().toISOString()
    });

    this.emit('gameStarted', { player, gameId, requestId, doorSelected });
  }

  /**
   * Handle game completed event
   */
  private async handleGameCompleted(player: string, gameId: bigint, result: number, payout: bigint, event: any): Promise<void> {
    const results = ['PENDING', 'WIN', 'BREAK_EVEN', 'LOSE'];
    const resultName = results[result] || 'UNKNOWN';
    
    logger.info({
      player,
      gameId: gameId.toString(),
      result: resultName,
      payout: ethers.formatEther(payout),
      txHash: event.transactionHash
    }, 'Game completed');

    // Track analytics
    if (this.analyticsService) {
      await this.analyticsService.trackGameComplete(
        player,
        'UNKNOWN', // We'd need to track key type separately
        resultName,
        ethers.formatEther(payout),
        event.transactionHash
      );
    }

    // Emit real-time event
    this.io.to('game-updates').emit('gameCompleted', {
      player,
      gameId: gameId.toString(),
      result: resultName,
      payout: ethers.formatEther(payout),
      timestamp: new Date().toISOString()
    });

    this.emit('gameCompleted', { player, gameId, result: resultName, payout });
  }

  /**
   * Handle jackpot won event
   */
  private async handleJackpotWon(winner: string, amount: bigint, event: any): Promise<void> {
    logger.info({
      winner,
      amount: ethers.formatEther(amount),
      txHash: event.transactionHash
    }, 'JACKPOT WON!');

    // Track analytics
    if (this.analyticsService) {
      await this.analyticsService.trackJackpotWin(
        winner,
        ethers.formatEther(amount),
        event.transactionHash
      );
    }

    // Emit real-time event to all clients
    this.io.emit('jackpotWon', {
      winner,
      amount: ethers.formatEther(amount),
      timestamp: new Date().toISOString(),
      celebration: true
    });

    this.emit('jackpotWon', { winner, amount });
  }

  /**
   * Handle jackpot contribution event
   */
  private async handleJackpotContribution(amount: bigint, event: any): Promise<void> {
    logger.info({
      amount: ethers.formatEther(amount),
      txHash: event.transactionHash
    }, 'Jackpot contribution');

    // Emit real-time event
    this.io.to('jackpot-updates').emit('jackpotContribution', {
      amount: ethers.formatEther(amount),
      timestamp: new Date().toISOString()
    });

    this.emit('jackpotContribution', { amount });
  }

  /**
   * Handle randomness requested event
   */
  private async handleRandomnessRequested(requestId: bigint, event: any): Promise<void> {
    logger.info({
      requestId: requestId.toString(),
      txHash: event.transactionHash
    }, 'Randomness requested');

    // Emit real-time event
    this.io.to('game-updates').emit('randomnessRequested', {
      requestId: requestId.toString(),
      timestamp: new Date().toISOString()
    });

    this.emit('randomnessRequested', { requestId });
  }

  /**
   * Handle randomness fulfilled event
   */
  private async handleRandomnessFulfilled(requestId: bigint, randomWord: bigint, event: any): Promise<void> {
    logger.info({
      requestId: requestId.toString(),
      randomWord: randomWord.toString(),
      txHash: event.transactionHash
    }, 'Randomness fulfilled');

    // Emit real-time event
    this.io.to('game-updates').emit('randomnessFulfilled', {
      requestId: requestId.toString(),
      randomWord: randomWord.toString(),
      timestamp: new Date().toISOString()
    });

    this.emit('randomnessFulfilled', { requestId, randomWord });
  }

  /**
   * Get monitoring status
   */
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      lastProcessedBlock: this.lastProcessedBlock,
      retryCount: this.retryCount,
      contractAddress: this.contract.target
    };
  }
}