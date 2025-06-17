import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { z } from 'zod';
import pino from 'pino';
import NodeCache from 'node-cache';
import { AuthenticatedRequest, optionalAuthMiddleware } from '../middleware/auth';
import { AnalyticsService } from '../../services/analytics';

const router = Router();
const logger = pino({ name: 'stats-routes' });

// Cache for statistics (TTL: 60 seconds for most stats, 5 minutes for leaderboards)
const statsCache = new NodeCache({ stdTTL: 60 });

// Contract ABI for stats interactions
const CARNIVAL_ABI = [
  "function getLeaderboard() external view returns (address[] memory)",
  "function playerStats(address player) external view returns (tuple(uint256 totalGames, uint256 totalWins, uint256 totalLosses, uint256 totalBreakEvens, uint256 totalWagered, uint256 totalWon, uint256 lastPlayTime))",
  "function totalGamesPlayed() external view returns (uint256)",
  "function totalKeysUsed() external view returns (uint256)",
  "function jackpotPool() external view returns (uint256)",
  "function lastJackpotWinner() external view returns (address)",
  "function lastJackpotAmount() external view returns (uint256)",
  "function lastJackpotWinTime() external view returns (uint256)"
];

// Validation schemas
const LeaderboardSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  sortBy: z.enum(['totalWon', 'totalGames', 'winRate']).default('totalWon'),
  timeframe: z.enum(['all', 'daily', 'weekly', 'monthly']).default('all')
});

const StatsQuerySchema = z.object({
  timeframe: z.enum(['daily', 'weekly', 'monthly', 'all']).default('all'),
  metrics: z.array(z.string()).default(['games', 'revenue', 'players'])
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
 * GET /api/stats/global
 * Get global game statistics
 */
router.get('/global', async (req: Request, res: Response) => {
  try {
    const validation = StatsQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error.issues,
        timestamp: new Date().toISOString()
      });
    }
    
    const { timeframe } = validation.data;
    const cacheKey = `global-stats-${timeframe}`;
    const cached = statsCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const contract = getContract();
    const analyticsService = new AnalyticsService();
    
    const [
      totalGames,
      totalKeysUsed,
      jackpotPool,
      lastJackpotWinner,
      lastJackpotAmount,
      lastJackpotWinTime
    ] = await Promise.all([
      contract.totalGamesPlayed(),
      contract.totalKeysUsed(),
      contract.jackpotPool(),
      contract.lastJackpotWinner(),
      contract.lastJackpotAmount(),
      contract.lastJackpotWinTime()
    ]);
    
    // Get analytics data
    const analyticsData = await analyticsService.getGlobalStats(timeframe);
    
    const globalStats = {
      contract: {
        totalGames: totalGames.toString(),
        totalKeysUsed: totalKeysUsed.toString(),
        jackpotPool: ethers.formatEther(jackpotPool),
        lastJackpotWinner: lastJackpotWinner !== ethers.ZeroAddress ? lastJackpotWinner : null,
        lastJackpotAmount: lastJackpotAmount > 0 ? ethers.formatEther(lastJackpotAmount) : null,
        lastJackpotWinTime: lastJackpotWinTime > 0 
          ? new Date(Number(lastJackpotWinTime) * 1000).toISOString() 
          : null
      },
      analytics: analyticsData,
      calculated: {
        averageGameValue: totalGames > 0 
          ? (parseFloat(analyticsData.totalVolume) / Number(totalGames)).toFixed(6)
          : '0',
        jackpotFillPercentage: analyticsData.totalVolume 
          ? ((parseFloat(ethers.formatEther(jackpotPool)) / parseFloat(analyticsData.totalVolume)) * 100).toFixed(2)
          : '0'
      },
      timestamp: new Date().toISOString()
    };
    
    statsCache.set(cacheKey, globalStats);
    res.json(globalStats);
    
  } catch (error) {
    logger.error({ error: error.message, query: req.query }, 'Failed to get global stats');
    res.status(500).json({
      error: 'Failed to retrieve global statistics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/stats/leaderboard
 * Get leaderboard data
 */
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const validation = LeaderboardSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error.issues,
        timestamp: new Date().toISOString()
      });
    }
    
    const { limit, sortBy, timeframe } = validation.data;
    const cacheKey = `leaderboard-${limit}-${sortBy}-${timeframe}`;
    const cached = statsCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const contract = getContract();
    const leaderboardAddresses = await contract.getLeaderboard();
    
    // Get detailed stats for each player
    const leaderboardData = await Promise.all(
      leaderboardAddresses.slice(0, limit).map(async (address: string, index: number) => {
        const stats = await contract.playerStats(address);
        
        const winRate = stats.totalGames > 0 
          ? (Number(stats.totalWins) / Number(stats.totalGames) * 100)
          : 0;
        
        const netProfit = Number(ethers.formatEther(stats.totalWon - stats.totalWagered));
        
        return {
          rank: index + 1,
          address,
          totalGames: stats.totalGames.toString(),
          totalWins: stats.totalWins.toString(),
          totalLosses: stats.totalLosses.toString(),
          totalBreakEvens: stats.totalBreakEvens.toString(),
          totalWagered: ethers.formatEther(stats.totalWagered),
          totalWon: ethers.formatEther(stats.totalWon),
          winRate: winRate.toFixed(2),
          netProfit: netProfit.toFixed(6),
          lastPlayTime: stats.lastPlayTime > 0 
            ? new Date(Number(stats.lastPlayTime) * 1000).toISOString()
            : null
        };
      })
    );
    
    // Sort by requested metric
    let sortedLeaderboard = [...leaderboardData];
    switch (sortBy) {
      case 'totalGames':
        sortedLeaderboard.sort((a, b) => Number(b.totalGames) - Number(a.totalGames));
        break;
      case 'winRate':
        sortedLeaderboard.sort((a, b) => Number(b.winRate) - Number(a.winRate));
        break;
      case 'totalWon':
      default:
        sortedLeaderboard.sort((a, b) => Number(b.totalWon) - Number(a.totalWon));
        break;
    }
    
    // Update ranks after sorting
    sortedLeaderboard = sortedLeaderboard.map((player, index) => ({
      ...player,
      rank: index + 1
    }));
    
    const response = {
      leaderboard: sortedLeaderboard,
      metadata: {
        total: leaderboardAddresses.length,
        limit,
        sortBy,
        timeframe,
        lastUpdated: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
    
    // Cache leaderboard for 5 minutes
    statsCache.set(cacheKey, response, 300);
    res.json(response);
    
  } catch (error) {
    logger.error({ error: error.message, query: req.query }, 'Failed to get leaderboard');
    res.status(500).json({
      error: 'Failed to retrieve leaderboard',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/stats/player/:address
 * Get detailed player statistics with analytics
 */
router.get('/player/:address', optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({
        error: 'Invalid address format',
        timestamp: new Date().toISOString()
      });
    }
    
    const cacheKey = `player-detailed-stats-${address}`;
    const cached = statsCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const contract = getContract();
    const analyticsService = new AnalyticsService();
    
    // Get on-chain stats
    const stats = await contract.playerStats(address);
    
    // Get analytics data
    const analyticsData = await analyticsService.getPlayerStats(address);
    
    // Calculate additional metrics
    const winRate = stats.totalGames > 0 
      ? (Number(stats.totalWins) / Number(stats.totalGames) * 100)
      : 0;
    
    const breakEvenRate = stats.totalGames > 0 
      ? (Number(stats.totalBreakEvens) / Number(stats.totalGames) * 100)
      : 0;
    
    const lossRate = stats.totalGames > 0 
      ? (Number(stats.totalLosses) / Number(stats.totalGames) * 100)
      : 0;
    
    const netProfit = Number(ethers.formatEther(stats.totalWon - stats.totalWagered));
    const averageWager = stats.totalGames > 0 
      ? (Number(ethers.formatEther(stats.totalWagered)) / Number(stats.totalGames))
      : 0;
    
    // Get leaderboard position
    const leaderboard = await contract.getLeaderboard();
    const leaderboardPosition = leaderboard.findIndex((addr: string) => 
      addr.toLowerCase() === address.toLowerCase()
    ) + 1;
    
    const playerStats = {
      player: address,
      onChainStats: {
        totalGames: stats.totalGames.toString(),
        totalWins: stats.totalWins.toString(),
        totalLosses: stats.totalLosses.toString(),
        totalBreakEvens: stats.totalBreakEvens.toString(),
        totalWagered: ethers.formatEther(stats.totalWagered),
        totalWon: ethers.formatEther(stats.totalWon),
        lastPlayTime: stats.lastPlayTime > 0 
          ? new Date(Number(stats.lastPlayTime) * 1000).toISOString()
          : null
      },
      calculatedMetrics: {
        winRate: winRate.toFixed(2),
        breakEvenRate: breakEvenRate.toFixed(2),
        lossRate: lossRate.toFixed(2),
        netProfit: netProfit.toFixed(6),
        averageWager: averageWager.toFixed(6),
        leaderboardPosition: leaderboardPosition || null
      },
      analytics: analyticsData,
      privacy: {
        isOwnStats: req.userAddress?.toLowerCase() === address.toLowerCase(),
        canViewPrivateData: req.userAddress?.toLowerCase() === address.toLowerCase()
      },
      timestamp: new Date().toISOString()
    };
    
    statsCache.set(cacheKey, playerStats, 30); // Cache for 30 seconds
    res.json(playerStats);
    
  } catch (error) {
    logger.error({ 
      error: error.message, 
      address: req.params.address,
      requester: req.userAddress 
    }, 'Failed to get player stats');
    
    res.status(500).json({
      error: 'Failed to retrieve player statistics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/stats/analytics/hourly
 * Get hourly analytics data
 */
router.get('/analytics/hourly', async (req: Request, res: Response) => {
  try {
    const hours = Math.min(parseInt(req.query.hours as string) || 24, 168); // Max 7 days
    const cacheKey = `hourly-analytics-${hours}`;
    const cached = statsCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const analyticsService = new AnalyticsService();
    const hourlyData = await analyticsService.getHourlyStats(hours);
    
    const response = {
      data: hourlyData,
      metadata: {
        hours,
        dataPoints: hourlyData.length,
        startTime: hourlyData.length > 0 ? hourlyData[0].timestamp : null,
        endTime: hourlyData.length > 0 ? hourlyData[hourlyData.length - 1].timestamp : null
      },
      timestamp: new Date().toISOString()
    };
    
    // Cache for 5 minutes
    statsCache.set(cacheKey, response, 300);
    res.json(response);
    
  } catch (error) {
    logger.error({ error: error.message, query: req.query }, 'Failed to get hourly analytics');
    res.status(500).json({
      error: 'Failed to retrieve hourly analytics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/stats/compare
 * Compare player statistics
 */
router.get('/compare', async (req: Request, res: Response) => {
  try {
    const addresses = req.query.addresses as string;
    
    if (!addresses) {
      return res.status(400).json({
        error: 'Addresses parameter required',
        timestamp: new Date().toISOString()
      });
    }
    
    const addressList = addresses.split(',').map(addr => addr.trim()).slice(0, 5); // Max 5 addresses
    
    // Validate all addresses
    for (const addr of addressList) {
      if (!ethers.isAddress(addr)) {
        return res.status(400).json({
          error: `Invalid address format: ${addr}`,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    const cacheKey = `compare-stats-${addressList.sort().join(',')}`;
    const cached = statsCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const contract = getContract();
    
    const comparisons = await Promise.all(
      addressList.map(async (address) => {
        const stats = await contract.playerStats(address);
        
        const winRate = stats.totalGames > 0 
          ? (Number(stats.totalWins) / Number(stats.totalGames) * 100)
          : 0;
        
        const netProfit = Number(ethers.formatEther(stats.totalWon - stats.totalWagered));
        
        return {
          address,
          totalGames: Number(stats.totalGames.toString()),
          totalWins: Number(stats.totalWins.toString()),
          totalWagered: parseFloat(ethers.formatEther(stats.totalWagered)),
          totalWon: parseFloat(ethers.formatEther(stats.totalWon)),
          winRate: parseFloat(winRate.toFixed(2)),
          netProfit: parseFloat(netProfit.toFixed(6)),
          lastPlayTime: stats.lastPlayTime > 0 
            ? new Date(Number(stats.lastPlayTime) * 1000).toISOString()
            : null
        };
      })
    );
    
    // Calculate rankings for each metric
    const rankings = {
      totalGames: comparisons.sort((a, b) => b.totalGames - a.totalGames).map(p => p.address),
      totalWins: comparisons.sort((a, b) => b.totalWins - a.totalWins).map(p => p.address),
      totalWon: comparisons.sort((a, b) => b.totalWon - a.totalWon).map(p => p.address),
      winRate: comparisons.sort((a, b) => b.winRate - a.winRate).map(p => p.address),
      netProfit: comparisons.sort((a, b) => b.netProfit - a.netProfit).map(p => p.address)
    };
    
    const response = {
      players: comparisons,
      rankings,
      metadata: {
        totalPlayers: addressList.length,
        comparedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
    
    // Cache for 2 minutes
    statsCache.set(cacheKey, response, 120);
    res.json(response);
    
  } catch (error) {
    logger.error({ error: error.message, query: req.query }, 'Failed to compare players');
    res.status(500).json({
      error: 'Failed to compare player statistics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/stats/summary
 * Get summary statistics for dashboard
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const cacheKey = 'stats-summary';
    const cached = statsCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const contract = getContract();
    const analyticsService = new AnalyticsService();
    
    const [
      totalGames,
      jackpotPool,
      lastJackpotAmount,
      dailyStats,
      topPlayer
    ] = await Promise.all([
      contract.totalGamesPlayed(),
      contract.jackpotPool(),
      contract.lastJackpotAmount(),
      analyticsService.getDailyStats(),
      contract.getLeaderboard().then(async (addresses: string[]) => {
        if (addresses.length === 0) return null;
        const stats = await contract.playerStats(addresses[0]);
        return {
          address: addresses[0],
          totalWon: ethers.formatEther(stats.totalWon)
        };
      })
    ]);
    
    const summary = {
      totals: {
        games: totalGames.toString(),
        jackpotPool: ethers.formatEther(jackpotPool),
        lastJackpotPayout: lastJackpotAmount > 0 ? ethers.formatEther(lastJackpotAmount) : '0'
      },
      daily: dailyStats,
      highlights: {
        topPlayer: topPlayer,
        averageGameValue: dailyStats.totalGames > 0 
          ? (parseFloat(dailyStats.totalVolume) / dailyStats.totalGames).toFixed(6)
          : '0'
      },
      timestamp: new Date().toISOString()
    };
    
    // Cache for 30 seconds
    statsCache.set(cacheKey, summary, 30);
    res.json(summary);
    
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get stats summary');
    res.status(500).json({
      error: 'Failed to retrieve statistics summary',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;