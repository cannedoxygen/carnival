import Redis from 'ioredis';
import pino from 'pino';
import { EventEmitter } from 'events';

const logger = pino({ name: 'analytics-service' });

interface GameEvent {
  id: string;
  player: string;
  eventType: 'game_start' | 'game_complete' | 'jackpot_win' | 'jackpot_contribution';
  keyType?: string;
  doorNumber?: number;
  result?: string;
  amount?: string;
  txHash?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface PlayerStats {
  totalGames: number;
  totalVolume: string;
  avgGameValue: string;
  lastActivity: string | null;
  favoriteKeyType: string;
  winRate: number;
  recentActivity?: {
    gamesPerHour: number;
    lastHourGames: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
}

interface GlobalStats {
  totalGames: number;
  totalVolume: string;
  uniquePlayers: number;
  avgGameValue: string;
  topKeyType: string;
  peakHour: number;
}

interface JackpotEvent {
  winner: string;
  amount: string;
  timestamp: string;
  txHash?: string;
  gameId?: string;
}

interface HourlyData {
  hour: string;
  timestamp: string;
  games: number;
  volume: string;
  uniquePlayers: number;
  avgGameValue: string;
}

export class AnalyticsService extends EventEmitter {
  private redis: Redis;
  private isInitialized = false;
  private eventQueue: GameEvent[] = [];
  private processingInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });
  }

  /**
   * Initialize the analytics service
   */
  async initialize(): Promise<void> {
    try {
      await this.redis.connect();
      logger.info('Connected to Redis for analytics');
      
      // Start processing queued events
      this.processingInterval = setInterval(() => {
        this.processEventQueue();
      }, 1000); // Process every second
      
      this.isInitialized = true;
      this.emit('initialized');
      
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to initialize analytics service');
      throw error;
    }
  }

  /**
   * Shutdown the analytics service
   */
  async shutdown(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    // Process remaining events
    await this.processEventQueue();
    
    await this.redis.quit();
    this.isInitialized = false;
    logger.info('Analytics service shut down');
  }

  /**
   * Track a game start event
   */
  async trackGameStart(player: string, keyType: string, doorNumber: number): Promise<void> {
    const event: GameEvent = {
      id: `game_start_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      player: player.toLowerCase(),
      eventType: 'game_start',
      keyType,
      doorNumber,
      timestamp: Date.now(),
      metadata: {
        userAgent: 'backend-api'
      }
    };
    
    this.eventQueue.push(event);
    
    if (!this.isInitialized) {
      logger.warn('Analytics service not initialized, event queued');
      return;
    }
  }

  /**
   * Track a game completion event
   */
  async trackGameComplete(player: string, keyType: string, result: string, amount: string, txHash?: string): Promise<void> {
    const event: GameEvent = {
      id: `game_complete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      player: player.toLowerCase(),
      eventType: 'game_complete',
      keyType,
      result,
      amount,
      txHash,
      timestamp: Date.now()
    };
    
    this.eventQueue.push(event);
  }

  /**
   * Track a jackpot win event
   */
  async trackJackpotWin(winner: string, amount: string, txHash?: string): Promise<void> {
    const event: GameEvent = {
      id: `jackpot_win_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      player: winner.toLowerCase(),
      eventType: 'jackpot_win',
      amount,
      txHash,
      timestamp: Date.now()
    };
    
    this.eventQueue.push(event);
  }

  /**
   * Track a jackpot contribution event
   */
  async trackJackpotContribution(contributor: string, amount: string): Promise<void> {
    const event: GameEvent = {
      id: `jackpot_contribution_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      player: contributor.toLowerCase(),
      eventType: 'jackpot_contribution',
      amount,
      timestamp: Date.now()
    };
    
    this.eventQueue.push(event);
  }

  /**
   * Track a game transaction
   */
  async trackGameTransaction(player: string, txHash: string, gasUsed: string): Promise<void> {
    if (!this.isInitialized) return;
    
    const key = `transaction:${txHash}`;
    await this.redis.hset(key, {
      player: player.toLowerCase(),
      gasUsed,
      timestamp: Date.now()
    });
    
    await this.redis.expire(key, 86400 * 7); // Keep for 7 days
  }

  /**
   * Track admin action
   */
  async trackAdminAction(admin: string, action: string, metadata: Record<string, any>): Promise<void> {
    if (!this.isInitialized) return;
    
    const key = `admin_action:${Date.now()}`;
    await this.redis.hset(key, {
      admin: admin.toLowerCase(),
      action,
      metadata: JSON.stringify(metadata),
      timestamp: Date.now()
    });
  }

  /**
   * Get player statistics
   */
  async getPlayerStats(player: string): Promise<PlayerStats> {
    if (!this.isInitialized) {
      return this.getDefaultPlayerStats();
    }
    
    const playerKey = `player:${player.toLowerCase()}`;
    const stats = await this.redis.hgetall(playerKey);
    
    if (!stats.totalGames) {
      return this.getDefaultPlayerStats();
    }
    
    // Get recent activity
    const recentActivity = await this.getPlayerRecentActivity(player);
    
    return {
      totalGames: parseInt(stats.totalGames || '0'),
      totalVolume: stats.totalVolume || '0',
      avgGameValue: stats.avgGameValue || '0',
      lastActivity: stats.lastActivity || null,
      favoriteKeyType: stats.favoriteKeyType || 'BRONZE',
      winRate: parseFloat(stats.winRate || '0'),
      recentActivity
    };
  }

  /**
   * Get global statistics
   */
  async getGlobalStats(timeframe: string = 'all'): Promise<GlobalStats> {
    if (!this.isInitialized) {
      return this.getDefaultGlobalStats();
    }
    
    let key = 'global:stats';
    if (timeframe !== 'all') {
      key = `global:stats:${timeframe}`;
    }
    
    const stats = await this.redis.hgetall(key);
    
    return {
      totalGames: parseInt(stats.totalGames || '0'),
      totalVolume: stats.totalVolume || '0',
      uniquePlayers: parseInt(stats.uniquePlayers || '0'),
      avgGameValue: stats.avgGameValue || '0',
      topKeyType: stats.topKeyType || 'BRONZE',
      peakHour: parseInt(stats.peakHour || '0')
    };
  }

  /**
   * Get daily statistics
   */
  async getDailyStats(): Promise<any> {
    if (!this.isInitialized) {
      return { totalGames: 0, totalVolume: '0', uniquePlayers: 0 };
    }
    
    const today = new Date().toISOString().split('T')[0];
    const key = `daily:${today}`;
    const stats = await this.redis.hgetall(key);
    
    return {
      totalGames: parseInt(stats.totalGames || '0'),
      totalVolume: stats.totalVolume || '0',
      uniquePlayers: parseInt(stats.uniquePlayers || '0'),
      date: today
    };
  }

  /**
   * Get hourly statistics
   */
  async getHourlyStats(hours: number = 24): Promise<HourlyData[]> {
    if (!this.isInitialized) return [];
    
    const hourlyData: HourlyData[] = [];
    const now = new Date();
    
    for (let i = hours - 1; i >= 0; i--) {
      const hour = new Date(now.getTime() - (i * 60 * 60 * 1000));
      const hourKey = `hourly:${hour.toISOString().substr(0, 13)}`;
      const stats = await this.redis.hgetall(hourKey);
      
      hourlyData.push({
        hour: hour.toISOString().substr(0, 13),
        timestamp: hour.toISOString(),
        games: parseInt(stats.games || '0'),
        volume: stats.volume || '0',
        uniquePlayers: parseInt(stats.uniquePlayers || '0'),
        avgGameValue: stats.avgGameValue || '0'
      });
    }
    
    return hourlyData;
  }

  /**
   * Get recent game rate
   */
  async getRecentGameRate(): Promise<{ gamesPerHour: number; trend: string }> {
    if (!this.isInitialized) {
      return { gamesPerHour: 0, trend: 'stable' };
    }
    
    const now = new Date();
    const lastHour = new Date(now.getTime() - (60 * 60 * 1000));
    const hourKey = `hourly:${lastHour.toISOString().substr(0, 13)}`;
    const stats = await this.redis.hgetall(hourKey);
    
    return {
      gamesPerHour: parseInt(stats.games || '0'),
      trend: 'stable' // Could implement trend calculation
    };
  }

  /**
   * Get average game rate
   */
  async getAverageGameRate(): Promise<number> {
    if (!this.isInitialized) return 0;
    
    const hourlyStats = await this.getHourlyStats(24);
    const totalGames = hourlyStats.reduce((sum, hour) => sum + hour.games, 0);
    
    return totalGames / 24;
  }

  /**
   * Get jackpot history
   */
  async getJackpotHistory(options: {
    limit: number;
    offset: number;
    sortBy: string;
    timeframe: string;
  }): Promise<{
    events: JackpotEvent[];
    total: number;
    totalValue: string;
    averageValue: string;
    largestJackpot: string;
  }> {
    if (!this.isInitialized) {
      return {
        events: [],
        total: 0,
        totalValue: '0',
        averageValue: '0',
        largestJackpot: '0'
      };
    }
    
    // Get jackpot events from sorted set
    const key = 'jackpot:history';
    const events = await this.redis.zrevrange(key, options.offset, options.offset + options.limit - 1, 'WITHSCORES');
    
    const jackpotEvents: JackpotEvent[] = [];
    for (let i = 0; i < events.length; i += 2) {
      try {
        const eventData = JSON.parse(events[i]);
        jackpotEvents.push(eventData);
      } catch (error) {
        logger.warn({ error: error.message }, 'Failed to parse jackpot event');
      }
    }
    
    // Get statistics
    const totalCount = await this.redis.zcard(key);
    const stats = await this.redis.hgetall('jackpot:stats');
    
    return {
      events: jackpotEvents,
      total: totalCount,
      totalValue: stats.totalValue || '0',
      averageValue: stats.averageValue || '0',
      largestJackpot: stats.largestJackpot || '0'
    };
  }

  /**
   * Get recent jackpot winners
   */
  async getRecentJackpotWinners(limit: number): Promise<JackpotEvent[]> {
    if (!this.isInitialized) return [];
    
    const key = 'jackpot:history';
    const events = await this.redis.zrevrange(key, 0, limit - 1);
    
    return events.map(event => {
      try {
        return JSON.parse(event);
      } catch {
        return null;
      }
    }).filter(Boolean);
  }

  /**
   * Get jackpot leaderboard
   */
  async getJackpotLeaderboard(limit: number): Promise<any[]> {
    if (!this.isInitialized) return [];
    
    const key = 'jackpot:leaderboard';
    const winners = await this.redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');
    
    const leaderboard = [];
    for (let i = 0; i < winners.length; i += 2) {
      leaderboard.push({
        address: winners[i],
        totalJackpotWinnings: winners[i + 1],
        rank: Math.floor(i / 2) + 1
      });
    }
    
    return leaderboard;
  }

  /**
   * Process queued events
   */
  private async processEventQueue(): Promise<void> {
    if (!this.isInitialized || this.eventQueue.length === 0) return;
    
    const events = this.eventQueue.splice(0, 10); // Process up to 10 events at once
    
    for (const event of events) {
      try {
        await this.processEvent(event);
      } catch (error) {
        logger.error({ error: error.message, event }, 'Failed to process analytics event');
        // Re-queue failed events
        this.eventQueue.unshift(event);
      }
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: GameEvent): Promise<void> {
    const multi = this.redis.multi();
    const now = new Date(event.timestamp);
    
    // Update player stats
    const playerKey = `player:${event.player}`;
    multi.hincrby(playerKey, 'totalGames', 1);
    multi.hset(playerKey, 'lastActivity', event.timestamp);
    
    if (event.amount) {
      multi.hincrbyfloat(playerKey, 'totalVolume', parseFloat(event.amount));
    }
    
    if (event.keyType) {
      multi.hset(playerKey, 'lastKeyType', event.keyType);
    }
    
    // Update global stats
    multi.hincrby('global:stats', 'totalGames', 1);
    if (event.amount) {
      multi.hincrbyfloat('global:stats', 'totalVolume', parseFloat(event.amount));
    }
    
    // Update hourly stats
    const hourKey = `hourly:${now.toISOString().substr(0, 13)}`;
    multi.hincrby(hourKey, 'games', 1);
    multi.sadd(`hourly:${hourKey}:players`, event.player);
    if (event.amount) {
      multi.hincrbyfloat(hourKey, 'volume', parseFloat(event.amount));
    }
    multi.expire(hourKey, 86400 * 7); // Keep for 7 days
    
    // Update daily stats
    const dailyKey = `daily:${now.toISOString().split('T')[0]}`;
    multi.hincrby(dailyKey, 'totalGames', 1);
    multi.sadd(`daily:${dailyKey}:players`, event.player);
    if (event.amount) {
      multi.hincrbyfloat(dailyKey, 'totalVolume', parseFloat(event.amount));
    }
    multi.expire(dailyKey, 86400 * 30); // Keep for 30 days
    
    // Handle jackpot events
    if (event.eventType === 'jackpot_win') {
      const jackpotEvent: JackpotEvent = {
        winner: event.player,
        amount: event.amount!,
        timestamp: new Date(event.timestamp).toISOString(),
        txHash: event.txHash
      };
      
      multi.zadd('jackpot:history', event.timestamp, JSON.stringify(jackpotEvent));
      multi.zincrby('jackpot:leaderboard', parseFloat(event.amount!), event.player);
      multi.hincrbyfloat('jackpot:stats', 'totalValue', parseFloat(event.amount!));
    }
    
    await multi.exec();
    
    // Emit real-time event
    this.emit('eventProcessed', event);
  }

  /**
   * Get player recent activity
   */
  private async getPlayerRecentActivity(player: string): Promise<any> {
    const now = new Date();
    const lastHour = new Date(now.getTime() - (60 * 60 * 1000));
    const hourKey = `hourly:${lastHour.toISOString().substr(0, 13)}`;
    
    const isActiveLastHour = await this.redis.sismember(`hourly:${hourKey}:players`, player.toLowerCase());
    
    return {
      gamesPerHour: isActiveLastHour ? 1 : 0, // Simplified - could track more precisely
      lastHourGames: isActiveLastHour ? 1 : 0,
      trend: 'stable'
    };
  }

  /**
   * Get default player stats
   */
  private getDefaultPlayerStats(): PlayerStats {
    return {
      totalGames: 0,
      totalVolume: '0',
      avgGameValue: '0',
      lastActivity: null,
      favoriteKeyType: 'BRONZE',
      winRate: 0
    };
  }

  /**
   * Get default global stats
   */
  private getDefaultGlobalStats(): GlobalStats {
    return {
      totalGames: 0,
      totalVolume: '0',
      uniquePlayers: 0,
      avgGameValue: '0',
      topKeyType: 'BRONZE',
      peakHour: 0
    };
  }
}