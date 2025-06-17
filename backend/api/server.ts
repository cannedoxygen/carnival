import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import pino from 'pino';
import gameRoutes from './routes/game';
import statsRoutes from './routes/stats';
import jackpotRoutes from './routes/jackpot';
import authMiddleware, { authenticateWallet, getNonce } from './middleware/auth';
import { JackpotMonitor } from '../workers/jackpotMonitor';
import { AnalyticsService } from '../services/analytics';

dotenv.config();

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty'
  } : undefined
});

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "ws:"]
    }
  }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Auth routes (no middleware required)
app.get('/api/auth/nonce/:address', getNonce);
app.post('/api/auth/login', authenticateWallet);

// API routes
app.use('/api/game', authMiddleware, gameRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/jackpot', jackpotRoutes);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  }, 'API Error');

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');

  socket.on('join-game', (data) => {
    socket.join('game-updates');
    logger.info({ socketId: socket.id, data }, 'Client joined game updates');
  });

  socket.on('join-jackpot', (data) => {
    socket.join('jackpot-updates');
    logger.info({ socketId: socket.id, data }, 'Client joined jackpot updates');
  });

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });
});

// Initialize services
let jackpotMonitor: JackpotMonitor;
let analyticsService: AnalyticsService;

async function initializeServices() {
  try {
    // Initialize blockchain connection
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const contractAddress = process.env.CONTRACT_ADDRESS;
    
    if (!contractAddress) {
      throw new Error('CONTRACT_ADDRESS not set in environment variables');
    }

    // Initialize analytics service
    analyticsService = new AnalyticsService();
    await analyticsService.initialize();

    // Initialize jackpot monitor
    jackpotMonitor = new JackpotMonitor(provider, contractAddress, io);
    await jackpotMonitor.start();

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize services');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  if (jackpotMonitor) {
    await jackpotMonitor.stop();
  }
  
  if (analyticsService) {
    await analyticsService.shutdown();
  }
  
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  if (jackpotMonitor) {
    await jackpotMonitor.stop();
  }
  
  if (analyticsService) {
    await analyticsService.shutdown();
  }
  
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Start server
httpServer.listen(PORT, async () => {
  logger.info({ port: PORT }, 'Server started');
  await initializeServices();
});

export { io, logger };
export default app;