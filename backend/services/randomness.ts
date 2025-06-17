import { ethers } from 'ethers';
import pino from 'pino';
import { EventEmitter } from 'events';

const logger = pino({ name: 'randomness-service' });

interface RandomnessRequest {
  requestId: string;
  requester: string;
  timestamp: number;
  fulfilled: boolean;
  randomWord?: string;
  gasLimit?: string;
}

interface VRFConfig {
  coordinatorAddress: string;
  subscriptionId: string;
  keyHash: string;
  callbackGasLimit: number;
  requestConfirmations: number;
}

export class RandomnessService extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private vrfConfig: VRFConfig;
  private pendingRequests: Map<string, RandomnessRequest> = new Map();
  private requestHistory: RandomnessRequest[] = [];
  private isInitialized = false;

  // Chainlink VRF Coordinator ABI (minimal)
  private readonly VRF_COORDINATOR_ABI = [
    "function requestRandomWords(bytes32 keyHash, uint64 subId, uint16 requestConfirmations, uint32 callbackGasLimit, uint32 numWords) external returns (uint256 requestId)",
    "function getRequestConfig() external view returns (uint16, uint32, bytes32[] memory)",
    "function getSubscription(uint64 subId) external view returns (uint96 balance, uint64 reqCount, address owner, address[] memory consumers)",
    "event RandomWordsRequested(bytes32 indexed keyHash, uint256 requestId, uint256 preSeed, uint64 indexed subId, uint16 minimumRequestConfirmations, uint32 callbackGasLimit, uint32 numWords, address indexed sender)",
    "event RandomWordsFulfilled(uint256 indexed requestId, uint256 outputSeed, uint96 payment, bool success)"
  ];

  constructor(provider: ethers.JsonRpcProvider, vrfConfig: VRFConfig) {
    super();
    this.provider = provider;
    this.vrfConfig = vrfConfig;
  }

  /**
   * Initialize the randomness service
   */
  async initialize(): Promise<void> {
    try {
      // Validate VRF configuration
      await this.validateVRFConfig();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      logger.info('Randomness service initialized');
      
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to initialize randomness service');
      throw error;
    }
  }

  /**
   * Request random words from Chainlink VRF
   */
  async requestRandomWords(
    requester: string,
    numWords: number = 1,
    callbackGasLimit?: number
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Randomness service not initialized');
    }

    try {
      const coordinator = new ethers.Contract(
        this.vrfConfig.coordinatorAddress,
        this.VRF_COORDINATOR_ABI,
        this.provider
      );

      // Estimate gas for the request
      const gasLimit = callbackGasLimit || this.vrfConfig.callbackGasLimit;
      
      // This would typically be called by the contract, not directly
      // For monitoring purposes, we'll simulate the request
      const requestId = this.generateRequestId();
      
      const request: RandomnessRequest = {
        requestId,
        requester: requester.toLowerCase(),
        timestamp: Date.now(),
        fulfilled: false,
        gasLimit: gasLimit.toString()
      };

      this.pendingRequests.set(requestId, request);
      this.requestHistory.push(request);

      logger.info({
        requestId,
        requester,
        numWords,
        gasLimit
      }, 'Random words requested');

      this.emit('randomnessRequested', {
        requestId,
        requester,
        numWords,
        gasLimit,
        timestamp: request.timestamp
      });

      return requestId;
      
    } catch (error) {
      logger.error({ 
        error: error.message, 
        requester,
        numWords 
      }, 'Failed to request random words');
      throw error;
    }
  }

  /**
   * Handle randomness fulfillment
   */
  async handleRandomnessFulfilled(requestId: string, randomWord: string): Promise<void> {
    try {
      const request = this.pendingRequests.get(requestId);
      
      if (!request) {
        logger.warn({ requestId }, 'Received fulfillment for unknown request');
        return;
      }

      // Update request
      request.fulfilled = true;
      request.randomWord = randomWord;

      // Remove from pending
      this.pendingRequests.delete(requestId);

      logger.info({
        requestId,
        requester: request.requester,
        randomWord,
        fulfillmentTime: Date.now() - request.timestamp
      }, 'Random words fulfilled');

      this.emit('randomnessFulfilled', {
        requestId,
        requester: request.requester,
        randomWord,
        fulfillmentTime: Date.now() - request.timestamp
      });
      
    } catch (error) {
      logger.error({ 
        error: error.message, 
        requestId,
        randomWord 
      }, 'Failed to handle randomness fulfillment');
    }
  }

  /**
   * Get VRF subscription info
   */
  async getSubscriptionInfo(): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Randomness service not initialized');
    }

    try {
      const coordinator = new ethers.Contract(
        this.vrfConfig.coordinatorAddress,
        this.VRF_COORDINATOR_ABI,
        this.provider
      );

      const subscription = await coordinator.getSubscription(this.vrfConfig.subscriptionId);
      
      return {
        balance: ethers.formatEther(subscription.balance),
        requestCount: subscription.reqCount.toString(),
        owner: subscription.owner,
        consumers: subscription.consumers,
        subscriptionId: this.vrfConfig.subscriptionId
      };
      
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get subscription info');
      throw error;
    }
  }

  /**
   * Get request status
   */
  getRequestStatus(requestId: string): RandomnessRequest | null {
    // Check pending requests first
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      return pending;
    }

    // Check history
    return this.requestHistory.find(req => req.requestId === requestId) || null;
  }

  /**
   * Get pending requests
   */
  getPendingRequests(): RandomnessRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  /**
   * Get request statistics
   */
  getStatistics(): any {
    const now = Date.now();
    const last24Hours = now - (24 * 60 * 60 * 1000);
    const last1Hour = now - (60 * 60 * 1000);

    const recent24h = this.requestHistory.filter(req => req.timestamp > last24Hours);
    const recent1h = this.requestHistory.filter(req => req.timestamp > last1Hour);
    
    const fulfilled24h = recent24h.filter(req => req.fulfilled);
    const avgFulfillmentTime = fulfilled24h.length > 0 
      ? fulfilled24h.reduce((sum, req) => {
          const fulfillTime = req.fulfilled ? (req.timestamp + 30000) - req.timestamp : 0; // Estimate
          return sum + fulfillTime;
        }, 0) / fulfilled24h.length
      : 0;

    return {
      totalRequests: this.requestHistory.length,
      pendingRequests: this.pendingRequests.size,
      requestsLast24h: recent24h.length,
      requestsLastHour: recent1h.length,
      fulfillmentRate: this.requestHistory.length > 0 
        ? (this.requestHistory.filter(req => req.fulfilled).length / this.requestHistory.length) * 100
        : 0,
      avgFulfillmentTime: Math.round(avgFulfillmentTime),
      vrfConfig: this.vrfConfig
    };
  }

  /**
   * Validate randomness (simple entropy check)
   */
  validateRandomness(randomWord: string): boolean {
    try {
      const num = BigInt(randomWord);
      
      // Basic checks
      if (num === 0n || num === BigInt('0xffffffffffffffffffffffffffffffff')) {
        return false;
      }

      // Check for patterns (simplified)
      const hex = num.toString(16).padStart(64, '0');
      const uniqueChars = new Set(hex).size;
      
      // Should have decent entropy (at least 8 unique hex chars)
      return uniqueChars >= 8;
      
    } catch (error) {
      return false;
    }
  }

  /**
   * Get random number in range
   */
  getRandomInRange(randomWord: string, min: number, max: number): number {
    if (!this.validateRandomness(randomWord)) {
      throw new Error('Invalid random word');
    }

    const range = max - min + 1;
    const randomBig = BigInt(randomWord);
    const result = Number(randomBig % BigInt(range)) + min;
    
    return result;
  }

  /**
   * Check if VRF is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        return false;
      }

      // Check if we can connect to VRF coordinator
      const coordinator = new ethers.Contract(
        this.vrfConfig.coordinatorAddress,
        this.VRF_COORDINATOR_ABI,
        this.provider
      );

      // Try to get request config
      await coordinator.getRequestConfig();
      
      // Check subscription balance
      const subscription = await this.getSubscriptionInfo();
      const balance = parseFloat(subscription.balance);
      
      // Consider healthy if balance > 0.01 ETH
      return balance > 0.01;
      
    } catch (error) {
      logger.error({ error: error.message }, 'VRF health check failed');
      return false;
    }
  }

  /**
   * Clean up old requests
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const cutoff = now - maxAge;

    // Clean up old pending requests (likely failed)
    for (const [requestId, request] of this.pendingRequests.entries()) {
      if (request.timestamp < cutoff) {
        logger.warn({ requestId }, 'Removing stale pending request');
        this.pendingRequests.delete(requestId);
      }
    }

    // Keep only recent history
    this.requestHistory = this.requestHistory.filter(req => req.timestamp > cutoff);
    
    logger.debug('Cleaned up old randomness requests');
  }

  /**
   * Validate VRF configuration
   */
  private async validateVRFConfig(): Promise<void> {
    try {
      const coordinator = new ethers.Contract(
        this.vrfConfig.coordinatorAddress,
        this.VRF_COORDINATOR_ABI,
        this.provider
      );

      // Check if coordinator is accessible
      await coordinator.getRequestConfig();
      
      // Check subscription
      const subscription = await coordinator.getSubscription(this.vrfConfig.subscriptionId);
      
      if (subscription.balance === 0n) {
        logger.warn('VRF subscription has zero balance');
      }

      logger.info({
        coordinator: this.vrfConfig.coordinatorAddress,
        subscriptionId: this.vrfConfig.subscriptionId,
        balance: ethers.formatEther(subscription.balance)
      }, 'VRF configuration validated');
      
    } catch (error) {
      logger.error({ error: error.message }, 'VRF configuration validation failed');
      throw new Error('Invalid VRF configuration');
    }
  }

  /**
   * Generate a request ID (for simulation)
   */
  private generateRequestId(): string {
    return ethers.keccak256(
      ethers.solidityPacked(
        ['uint256', 'uint256', 'address'],
        [Date.now(), Math.random() * 1000000, this.vrfConfig.coordinatorAddress]
      )
    );
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      pendingRequests: this.pendingRequests.size,
      totalRequests: this.requestHistory.length,
      vrfConfig: this.vrfConfig
    };
  }
}