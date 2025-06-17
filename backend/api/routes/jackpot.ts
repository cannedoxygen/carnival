import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { z } from 'zod';
import pino from 'pino';
import NodeCache from 'node-cache';
import { AuthenticatedRequest, optionalAuthMiddleware, adminMiddleware } from '../middleware/auth';
import { AnalyticsService } from '../../services/analytics';
import { io } from '../server';

const router = Router();
const logger = pino({ name: 'jackpot-routes' });

// Cache for jackpot data (TTL: 15 seconds for current data, 5 minutes for history)
const jackpotCache = new NodeCache({ stdTTL: 15 });

// Contract ABI for jackpot interactions
const CARNIVAL_ABI = [
  "function jackpotPool() external view returns (uint256)",
  "function lastJackpotWinner() external view returns (address)",
  "function lastJackpotAmount() external view returns (uint256)",
  "function lastJackpotWinTime() external view returns (uint256)",
  "function jackpotTriggerCount() external view returns (uint256)",
  "function totalKeysUsed() external view returns (uint256)",
  "function setJackpotTriggerCount(uint256 _count) external",
  "event JackpotWon(address indexed winner, uint256 amount)",
  "event JackpotContribution(uint256 amount)"
];

// Validation schemas
const JackpotHistorySchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(['timestamp', 'amount', 'winner']).default('timestamp'),
  timeframe: z.enum(['all', 'daily', 'weekly', 'monthly']).default('all')
});

const TriggerCountSchema = z.object({
  count: z.number().min(1).max(10000)
});

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
 * Get signer for admin operations
 */
function getSigner(): ethers.Wallet {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const privateKey = process.env.ADMIN_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error('ADMIN_PRIVATE_KEY not set');
  }
  
  return new ethers.Wallet(privateKey, provider);
}

/**
 * GET /api/jackpot/current
 * Get current jackpot information
 */
router.get('/current', async (req: Request, res: Response) => {
  try {
    const cacheKey = 'current-jackpot';
    const cached = jackpotCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const contract = getContract();
    
    const [
      jackpotPool,
      lastJackpotWinner,
      lastJackpotAmount,
      lastJackpotWinTime,
      jackpotTriggerCount,
      totalKeysUsed
    ] = await Promise.all([
      contract.jackpotPool(),
      contract.lastJackpotWinner(),
      contract.lastJackpotAmount(),
      contract.lastJackpotWinTime(),
      contract.jackpotTriggerCount(),
      contract.totalKeysUsed()
    ]);
    
    // Calculate progress to next jackpot
    const keysToNextJackpot = Number(jackpotTriggerCount) - (Number(totalKeysUsed) % Number(jackpotTriggerCount));
    const progressPercentage = ((Number(totalKeysUsed) % Number(jackpotTriggerCount)) / Number(jackpotTriggerCount)) * 100;
    
    // Estimate time to next jackpot based on recent activity
    const analyticsService = new AnalyticsService();
    const recentActivity = await analyticsService.getRecentGameRate();
    const estimatedMinutesToJackpot = recentActivity.gamesPerHour > 0 
      ? (keysToNextJackpot / recentActivity.gamesPerHour) * 60
      : null;
    
    const currentJackpot = {
      pool: {
        amount: ethers.formatEther(jackpotPool),
        amountWei: jackpotPool.toString(),
        usdEstimate: null // Could integrate with price API
      },
      lastWin: {
        winner: lastJackpotWinner !== ethers.ZeroAddress ? lastJackpotWinner : null,
        amount: lastJackpotAmount > 0 ? ethers.formatEther(lastJackpotAmount) : null,
        timestamp: lastJackpotWinTime > 0 
          ? new Date(Number(lastJackpotWinTime) * 1000).toISOString()
          : null,
        timeAgo: lastJackpotWinTime > 0 
          ? Date.now() - (Number(lastJackpotWinTime) * 1000)
          : null
      },
      nextJackpot: {
        triggerCount: Number(jackpotTriggerCount),
        totalKeysUsed: Number(totalKeysUsed),
        keysRemaining: keysToNextJackpot,
        progressPercentage: Math.round(progressPercentage * 100) / 100,
        estimatedTime: estimatedMinutesToJackpot ? {
          minutes: Math.round(estimatedMinutesToJackpot),
          hours: Math.round(estimatedMinutesToJackpot / 60 * 100) / 100,
          displayString: estimatedMinutesToJackpot < 60 
            ? `~${Math.round(estimatedMinutesToJackpot)} minutes`
            : `~${Math.round(estimatedMinutesToJackpot / 60 * 10) / 10} hours`
        } : null
      },
      statistics: {
        averageJackpotValue: lastJackpotAmount > 0 ? ethers.formatEther(lastJackpotAmount) : '0',
        totalJackpotsWon: lastJackpotWinTime > 0 ? 1 : 0, // This would need to be tracked separately for full history
        daysSinceLastJackpot: lastJackpotWinTime > 0 
          ? Math.floor((Date.now() - (Number(lastJackpotWinTime) * 1000)) / (1000 * 60 * 60 * 24))
          : null
      },
      timestamp: new Date().toISOString()
    };
    
    jackpotCache.set(cacheKey, currentJackpot);
    res.json(currentJackpot);
    
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get current jackpot');
    res.status(500).json({
      error: 'Failed to retrieve current jackpot information',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/jackpot/history
 * Get jackpot win history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const validation = JackpotHistorySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error.issues,
        timestamp: new Date().toISOString()
      });
    }
    
    const { limit, offset, sortBy, timeframe } = validation.data;
    const cacheKey = `jackpot-history-${limit}-${offset}-${sortBy}-${timeframe}`;
    const cached = jackpotCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    // Get jackpot events from analytics service
    const analyticsService = new AnalyticsService();
    const jackpotHistory = await analyticsService.getJackpotHistory({
      limit,
      offset,
      sortBy,
      timeframe
    });
    
    const response = {
      history: jackpotHistory.events,
      pagination: {
        total: jackpotHistory.total,
        limit,
        offset,
        hasMore: offset + limit < jackpotHistory.total
      },
      statistics: {
        totalValue: jackpotHistory.totalValue,
        averageValue: jackpotHistory.averageValue,
        largestJackpot: jackpotHistory.largestJackpot,
        timeframe
      },
      timestamp: new Date().toISOString()
    };
    
    // Cache for 5 minutes for history data
    jackpotCache.set(cacheKey, response, 300);
    res.json(response);
    
  } catch (error) {
    logger.error({ error: error.message, query: req.query }, 'Failed to get jackpot history');
    res.status(500).json({
      error: 'Failed to retrieve jackpot history',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/jackpot/winners
 * Get recent jackpot winners
 */
router.get('/winners', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const cacheKey = `jackpot-winners-${limit}`;
    const cached = jackpotCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const analyticsService = new AnalyticsService();
    const winners = await analyticsService.getRecentJackpotWinners(limit);
    
    const response = {
      winners,
      metadata: {
        total: winners.length,
        limit,
        lastUpdated: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
    
    // Cache for 2 minutes
    jackpotCache.set(cacheKey, response, 120);
    res.json(response);
    
  } catch (error) {
    logger.error({ error: error.message, query: req.query }, 'Failed to get jackpot winners');
    res.status(500).json({
      error: 'Failed to retrieve jackpot winners',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/jackpot/probability
 * Calculate jackpot win probability for a player
 */
router.get('/probability/:address?', optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetAddress = req.params.address || req.userAddress;
    
    if (!targetAddress) {
      return res.status(400).json({
        error: 'Address required',
        timestamp: new Date().toISOString()
      });
    }
    
    const cacheKey = `jackpot-probability-${targetAddress}`;
    const cached = jackpotCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const contract = getContract();
    const analyticsService = new AnalyticsService();
    
    const [
      jackpotTriggerCount,
      totalKeysUsed,
      playerStats
    ] = await Promise.all([
      contract.jackpotTriggerCount(),
      contract.totalKeysUsed(),
      analyticsService.getPlayerStats(targetAddress)
    ]);
    
    const keysToNextJackpot = Number(jackpotTriggerCount) - (Number(totalKeysUsed) % Number(jackpotTriggerCount));
    
    // Calculate probability based on player's recent activity
    const recentGamesPerHour = playerStats.recentActivity?.gamesPerHour || 0;
    const avgGamesPerHour = await analyticsService.getAverageGameRate();
    
    // Probability that this player wins the next jackpot
    const playerChance = recentGamesPerHour > 0 && avgGamesPerHour > 0 
      ? (recentGamesPerHour / avgGamesPerHour) * 100
      : 0;
    
    // Estimated odds
    const estimatedOdds = playerChance > 0 ? Math.round(100 / playerChance) : null;
    
    const probability = {
      player: targetAddress,
      nextJackpot: {
        keysRemaining: keysToNextJackpot,
        triggerCount: Number(jackpotTriggerCount)
      },
      playerChance: {
        percentage: Math.round(playerChance * 100) / 100,
        odds: estimatedOdds ? `1 in ${estimatedOdds}` : 'No recent activity',
        confidence: recentGamesPerHour > 0 ? 'Medium' : 'Low'
      },
      factors: {
        recentActivity: recentGamesPerHour,
        globalActivity: avgGamesPerHour,
        playerShare: recentGamesPerHour > 0 && avgGamesPerHour > 0 
          ? Math.round((recentGamesPerHour / avgGamesPerHour) * 10000) / 100
          : 0
      },
      disclaimer: 'Probabilities are estimates based on recent activity patterns and should not be considered guaranteed outcomes.',
      timestamp: new Date().toISOString()
    };
    
    // Cache for 1 minute
    jackpotCache.set(cacheKey, probability, 60);
    res.json(probability);
    
  } catch (error) {
    logger.error({ 
      error: error.message, 
      address: req.params.address,
      requester: req.userAddress 
    }, 'Failed to calculate jackpot probability');
    
    res.status(500).json({
      error: 'Failed to calculate jackpot probability',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/jackpot/leaderboard
 * Get leaderboard of biggest jackpot winners
 */
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const cacheKey = `jackpot-leaderboard-${limit}`;
    const cached = jackpotCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const analyticsService = new AnalyticsService();
    const leaderboard = await analyticsService.getJackpotLeaderboard(limit);
    
    const response = {
      leaderboard,
      metadata: {
        total: leaderboard.length,
        limit,
        basedOn: 'Total jackpot winnings',
        lastUpdated: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
    
    // Cache for 10 minutes
    jackpotCache.set(cacheKey, response, 600);
    res.json(response);
    
  } catch (error) {
    logger.error({ error: error.message, query: req.query }, 'Failed to get jackpot leaderboard');
    res.status(500).json({
      error: 'Failed to retrieve jackpot leaderboard',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/jackpot/contribute
 * Allow users to contribute to jackpot pool (frontend will handle transaction)
 */
router.post('/contribute', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount } = req.body;
    
    if (!amount || isNaN(parseFloat(amount))) {
      return res.status(400).json({
        error: 'Valid amount required',
        timestamp: new Date().toISOString()
      });
    }
    
    const contributionAmount = ethers.parseEther(amount.toString());
    const playerAddress = req.userAddress!;
    
    // Generate transaction data for frontend
    const transaction = {
      to: process.env.CONTRACT_ADDRESS,
      value: contributionAmount.toString(),
      data: '0x' // Simple ETH transfer to contract
    };
    
    // Track contribution intent
    const analyticsService = new AnalyticsService();
    await analyticsService.trackJackpotContribution(playerAddress, amount);
    
    // Emit real-time event
    io.to('jackpot-updates').emit('contributionPrepared', {
      contributor: playerAddress,
      amount,
      timestamp: new Date().toISOString()
    });
    
    logger.info({ 
      contributor: playerAddress, 
      amount 
    }, 'Jackpot contribution prepared');
    
    res.json({
      success: true,
      contribution: {
        contributor: playerAddress,
        amount,
        transaction
      },
      message: 'Contribution prepared. Sign and send transaction to contribute to jackpot.',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error({ 
      error: error.message, 
      contributor: req.userAddress,
      body: req.body 
    }, 'Failed to prepare jackpot contribution');
    
    res.status(500).json({
      error: 'Failed to prepare jackpot contribution',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/jackpot/admin/set-trigger-count
 * Admin endpoint to update jackpot trigger count
 */
router.post('/admin/set-trigger-count', adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = TriggerCountSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.issues,
        timestamp: new Date().toISOString()
      });
    }
    
    const { count } = validation.data;
    const adminAddress = req.userAddress!;
    
    // Get contract with signer
    const signer = getSigner();
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS!, CARNIVAL_ABI, signer);
    
    // Estimate gas
    const gasEstimate = await contract.setJackpotTriggerCount.estimateGas(count);
    
    // Execute transaction
    const tx = await contract.setJackpotTriggerCount(count, {
      gasLimit: gasEstimate
    });
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    // Clear cache
    jackpotCache.flushAll();
    
    // Track admin action
    const analyticsService = new AnalyticsService();
    await analyticsService.trackAdminAction(adminAddress, 'setJackpotTriggerCount', { count, txHash: tx.hash });
    
    // Emit real-time event
    io.to('jackpot-updates').emit('triggerCountUpdated', {
      admin: adminAddress,
      newCount: count,
      txHash: tx.hash,
      timestamp: new Date().toISOString()
    });
    
    logger.info({ 
      admin: adminAddress, 
      count, 
      txHash: tx.hash 
    }, 'Jackpot trigger count updated');
    
    res.json({
      success: true,
      update: {
        admin: adminAddress,
        newTriggerCount: count,
        previousValue: 'Not tracked', // Would need to query before update
        transaction: {
          hash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString()
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error({ 
      error: error.message, 
      admin: req.userAddress,
      body: req.body 
    }, 'Failed to update jackpot trigger count');
    
    res.status(500).json({
      error: 'Failed to update jackpot trigger count',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/jackpot/events/live
 * Server-sent events for live jackpot updates
 */
router.get('/events/live', (req: Request, res: Response) => {
  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
  
  // Send initial data
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);
  
  // Set up periodic updates
  const interval = setInterval(async () => {
    try {
      const contract = getContract();
      const [jackpotPool, totalKeysUsed, jackpotTriggerCount] = await Promise.all([
        contract.jackpotPool(),
        contract.totalKeysUsed(),
        contract.jackpotTriggerCount()
      ]);
      
      const keysToNext = Number(jackpotTriggerCount) - (Number(totalKeysUsed) % Number(jackpotTriggerCount));
      const progress = ((Number(totalKeysUsed) % Number(jackpotTriggerCount)) / Number(jackpotTriggerCount)) * 100;
      
      const update = {
        type: 'jackpot_update',
        data: {
          pool: ethers.formatEther(jackpotPool),
          keysToNext,
          progress: Math.round(progress * 100) / 100,
          totalKeys: Number(totalKeysUsed)
        },
        timestamp: new Date().toISOString()
      };
      
      res.write(`data: ${JSON.stringify(update)}\n\n`);
    } catch (error) {
      logger.error({ error: error.message }, 'Error in live jackpot events');
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Update failed' })}\n\n`);
    }
  }, 10000); // Update every 10 seconds
  
  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(interval);
    logger.info('Live jackpot events client disconnected');
  });
  
  logger.info('Live jackpot events client connected');
});

export default router;