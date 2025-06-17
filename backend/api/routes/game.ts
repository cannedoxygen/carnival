import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { z } from 'zod';
import pino from 'pino';
import NodeCache from 'node-cache';
import { AuthenticatedRequest } from '../middleware/auth';
import { RandomnessService } from '../../services/randomness';
import { AnalyticsService } from '../../services/analytics';
import { io } from '../server';

const router = Router();
const logger = pino({ name: 'game-routes' });

// Cache for game states and contract data (TTL: 30 seconds)
const gameCache = new NodeCache({ stdTTL: 30 });

// Contract ABI for game interactions
const CARNIVAL_ABI = [
  "function playGame(uint8 _keyType, uint256 _doorNumber) external payable",
  "function getPlayerGameHistory(address player) external view returns (uint256[] memory)",
  "function getGameDetails(uint256 gameId) external view returns (tuple(address player, uint8 keyType, uint256 wager, uint256 doorSelected, uint8 result, uint256 payout, uint256 timestamp, uint256 requestId))",
  "function playerStats(address player) external view returns (tuple(uint256 totalGames, uint256 totalWins, uint256 totalLosses, uint256 totalBreakEvens, uint256 totalWagered, uint256 totalWon, uint256 lastPlayTime))",
  "function getKeyPrice(uint8 _keyType) external pure returns (uint256)",
  "function totalGamesPlayed() external view returns (uint256)",
  "function BRONZE_KEY_PRICE() external view returns (uint256)",
  "function SILVER_KEY_PRICE() external view returns (uint256)",
  "function GOLD_KEY_PRICE() external view returns (uint256)"
];

// Validation schemas
const PlayGameSchema = z.object({
  keyType: z.enum(['BRONZE', 'SILVER', 'GOLD']),
  doorNumber: z.number().min(1).max(3),
  signature: z.string().optional(),
  message: z.string().optional(),
  address: z.string().optional(),
  timestamp: z.number().optional()
});

const GameHistorySchema = z.object({
  address: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
});

// Key type mapping
const KeyTypeMapping = {
  'BRONZE': 0,
  'SILVER': 1,
  'GOLD': 2
} as const;

/**
 * Get contract instance
 */
function getContract(): ethers.Contract {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    throw new Error('CONTRACT_ADDRESS not set');
  }
  
  return new ethers.Contract(contractAddress, CARNIVAL_ABI, provider);
}

/**
 * GET /api/game/info
 * Get game information and prices
 */
router.get('/info', async (req: Request, res: Response) => {
  try {
    const cacheKey = 'game-info';
    const cached = gameCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const contract = getContract();
    
    const [bronzePrice, silverPrice, goldPrice, totalGames] = await Promise.all([
      contract.BRONZE_KEY_PRICE(),
      contract.SILVER_KEY_PRICE(),
      contract.GOLD_KEY_PRICE(),
      contract.totalGamesPlayed()
    ]);
    
    const gameInfo = {
      keyPrices: {
        BRONZE: ethers.formatEther(bronzePrice),
        SILVER: ethers.formatEther(silverPrice),
        GOLD: ethers.formatEther(goldPrice)
      },
      totalGamesPlayed: totalGames.toString(),
      gameRules: {
        winProbability: 30,
        breakEvenProbability: 35,
        loseProbability: 35,
        winMultiplier: 2,
        doors: 3
      },
      timestamp: new Date().toISOString()
    };
    
    gameCache.set(cacheKey, gameInfo);
    res.json(gameInfo);
    
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get game info');
    res.status(500).json({
      error: 'Failed to retrieve game information',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/game/play
 * Start a new game
 */
router.post('/play', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = PlayGameSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.issues,
        timestamp: new Date().toISOString()
      });
    }
    
    const { keyType, doorNumber } = validation.data;
    const playerAddress = req.userAddress!;
    
    // Get contract and key price
    const contract = getContract();
    const keyPrice = await contract.getKeyPrice(KeyTypeMapping[keyType]);
    
    // Check if player has sufficient balance (this is just for info, actual check is on-chain)
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const balance = await provider.getBalance(playerAddress);
    
    if (balance < keyPrice) {
      return res.status(400).json({
        error: 'Insufficient balance',
        required: ethers.formatEther(keyPrice),
        current: ethers.formatEther(balance),
        timestamp: new Date().toISOString()
      });
    }
    
    // Prepare transaction data
    const gameData = {
      player: playerAddress,
      keyType,
      doorNumber,
      keyPrice: ethers.formatEther(keyPrice),
      timestamp: new Date().toISOString()
    };
    
    // Generate transaction for frontend to sign
    const contractInterface = new ethers.Interface(CARNIVAL_ABI);
    const txData = contractInterface.encodeFunctionData('playGame', [
      KeyTypeMapping[keyType],
      doorNumber
    ]);
    
    const transaction = {
      to: process.env.CONTRACT_ADDRESS,
      data: txData,
      value: keyPrice.toString(),
      gasLimit: '300000' // Estimated gas limit
    };
    
    // Track analytics
    const analyticsService = new AnalyticsService();
    await analyticsService.trackGameStart(playerAddress, keyType, doorNumber);
    
    // Emit real-time event
    io.to('game-updates').emit('gameStarted', {
      player: playerAddress,
      keyType,
      doorNumber,
      timestamp: gameData.timestamp
    });
    
    logger.info({ 
      player: playerAddress, 
      keyType, 
      doorNumber 
    }, 'Game preparation completed');
    
    res.json({
      success: true,
      gameData,
      transaction,
      message: 'Game prepared. Sign and send transaction to play.',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error({ 
      error: error.message, 
      player: req.userAddress,
      body: req.body 
    }, 'Failed to prepare game');
    
    res.status(500).json({
      error: 'Failed to prepare game',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/game/history/:address?
 * Get game history for a player
 */
router.get('/history/:address?', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetAddress = req.params.address || req.userAddress;
    
    if (!targetAddress) {
      return res.status(400).json({
        error: 'Address required',
        timestamp: new Date().toISOString()
      });
    }
    
    const validation = GameHistorySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error.issues,
        timestamp: new Date().toISOString()
      });
    }
    
    const { limit, offset } = validation.data;
    const cacheKey = `game-history-${targetAddress}-${limit}-${offset}`;
    const cached = gameCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const contract = getContract();
    
    // Get game IDs for player
    const gameIds = await contract.getPlayerGameHistory(targetAddress);
    
    // Paginate results
    const paginatedIds = gameIds.slice(offset, offset + limit);
    
    // Get game details for each ID
    const gameDetails = await Promise.all(
      paginatedIds.map(async (gameId: bigint) => {
        const details = await contract.getGameDetails(gameId);
        return {
          gameId: gameId.toString(),
          player: details.player,
          keyType: ['BRONZE', 'SILVER', 'GOLD'][details.keyType],
          wager: ethers.formatEther(details.wager),
          doorSelected: details.doorSelected.toString(),
          result: ['PENDING', 'WIN', 'BREAK_EVEN', 'LOSE'][details.result],
          payout: ethers.formatEther(details.payout),
          timestamp: new Date(Number(details.timestamp) * 1000).toISOString(),
          requestId: details.requestId.toString()
        };
      })
    );
    
    const response = {
      games: gameDetails,
      pagination: {
        total: gameIds.length,
        limit,
        offset,
        hasMore: offset + limit < gameIds.length
      },
      timestamp: new Date().toISOString()
    };
    
    gameCache.set(cacheKey, response, 10); // Cache for 10 seconds
    res.json(response);
    
  } catch (error) {
    logger.error({ 
      error: error.message, 
      address: req.params.address,
      query: req.query 
    }, 'Failed to get game history');
    
    res.status(500).json({
      error: 'Failed to retrieve game history',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/game/stats/:address?
 * Get player statistics
 */
router.get('/stats/:address?', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetAddress = req.params.address || req.userAddress;
    
    if (!targetAddress) {
      return res.status(400).json({
        error: 'Address required',
        timestamp: new Date().toISOString()
      });
    }
    
    const cacheKey = `player-stats-${targetAddress}`;
    const cached = gameCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const contract = getContract();
    const stats = await contract.playerStats(targetAddress);
    
    const playerStats = {
      player: targetAddress,
      totalGames: stats.totalGames.toString(),
      totalWins: stats.totalWins.toString(),
      totalLosses: stats.totalLosses.toString(),
      totalBreakEvens: stats.totalBreakEvens.toString(),
      totalWagered: ethers.formatEther(stats.totalWagered),
      totalWon: ethers.formatEther(stats.totalWon),
      lastPlayTime: stats.lastPlayTime > 0 
        ? new Date(Number(stats.lastPlayTime) * 1000).toISOString()
        : null,
      winRate: stats.totalGames > 0 
        ? (Number(stats.totalWins) / Number(stats.totalGames) * 100).toFixed(2)
        : '0.00',
      netProfit: ethers.formatEther(stats.totalWon - stats.totalWagered),
      timestamp: new Date().toISOString()
    };
    
    gameCache.set(cacheKey, playerStats, 15); // Cache for 15 seconds
    res.json(playerStats);
    
  } catch (error) {
    logger.error({ 
      error: error.message, 
      address: req.params.address 
    }, 'Failed to get player stats');
    
    res.status(500).json({
      error: 'Failed to retrieve player statistics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/game/status/:gameId
 * Get specific game status
 */
router.get('/status/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    
    if (!gameId || isNaN(Number(gameId))) {
      return res.status(400).json({
        error: 'Invalid game ID',
        timestamp: new Date().toISOString()
      });
    }
    
    const cacheKey = `game-status-${gameId}`;
    const cached = gameCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const contract = getContract();
    const details = await contract.getGameDetails(gameId);
    
    const gameStatus = {
      gameId,
      player: details.player,
      keyType: ['BRONZE', 'SILVER', 'GOLD'][details.keyType],
      wager: ethers.formatEther(details.wager),
      doorSelected: details.doorSelected.toString(),
      result: ['PENDING', 'WIN', 'BREAK_EVEN', 'LOSE'][details.result],
      payout: ethers.formatEther(details.payout),
      timestamp: new Date(Number(details.timestamp) * 1000).toISOString(),
      requestId: details.requestId.toString(),
      isComplete: details.result !== 0, // 0 = PENDING
      timestamp: new Date().toISOString()
    };
    
    // Cache completed games longer
    const cacheTTL = gameStatus.isComplete ? 300 : 5;
    gameCache.set(cacheKey, gameStatus, cacheTTL);
    
    res.json(gameStatus);
    
  } catch (error) {
    logger.error({ 
      error: error.message, 
      gameId: req.params.gameId 
    }, 'Failed to get game status');
    
    res.status(500).json({
      error: 'Failed to retrieve game status',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/game/verify-transaction
 * Verify a game transaction was successful
 */
router.post('/verify-transaction', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { txHash } = req.body;
    
    if (!txHash) {
      return res.status(400).json({
        error: 'Transaction hash required',
        timestamp: new Date().toISOString()
      });
    }
    
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return res.status(404).json({
        error: 'Transaction not found',
        timestamp: new Date().toISOString()
      });
    }
    
    const isSuccess = receipt.status === 1;
    const blockTimestamp = (await provider.getBlock(receipt.blockNumber))?.timestamp;
    
    // Parse logs to extract game events
    const contractInterface = new ethers.Interface(CARNIVAL_ABI);
    const logs = receipt.logs
      .filter(log => log.address.toLowerCase() === process.env.CONTRACT_ADDRESS?.toLowerCase())
      .map(log => {
        try {
          return contractInterface.parseLog(log);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    
    const response = {
      txHash,
      success: isSuccess,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      timestamp: blockTimestamp ? new Date(blockTimestamp * 1000).toISOString() : null,
      events: logs.map(log => ({
        name: log?.name,
        args: log?.args ? Object.keys(log.args).reduce((acc, key) => {
          if (isNaN(Number(key))) {
            acc[key] = log.args[key].toString();
          }
          return acc;
        }, {} as any) : {}
      })),
      timestamp: new Date().toISOString()
    };
    
    // Track analytics
    if (isSuccess) {
      const analyticsService = new AnalyticsService();
      await analyticsService.trackGameTransaction(req.userAddress!, txHash, receipt.gasUsed.toString());
    }
    
    res.json(response);
    
  } catch (error) {
    logger.error({ 
      error: error.message, 
      txHash: req.body.txHash,
      player: req.userAddress 
    }, 'Failed to verify transaction');
    
    res.status(500).json({
      error: 'Failed to verify transaction',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;