# Simpsons Carnival Backend

A production-ready Node.js backend for the Simpsons Carnival blockchain game, featuring real-time events, comprehensive analytics, and secure wallet authentication.

## Features

- **🔐 Wallet Authentication**: Secure signature-based authentication with JWT tokens
- **🎲 Game Management**: Complete game lifecycle management with blockchain integration
- **📊 Analytics & Stats**: Real-time analytics with Redis-backed data aggregation
- **🎰 Jackpot Monitoring**: Live blockchain event monitoring with Socket.IO broadcasting
- **🔗 Chainlink VRF**: Professional randomness service integration
- **⚡ Real-time Updates**: Socket.IO for live game and jackpot events
- **🛡️ Production Security**: Rate limiting, CORS, helmet, and comprehensive error handling
- **📈 Comprehensive Logging**: Structured logging with pino
- **🗄️ Caching**: Multi-layer caching strategy for optimal performance

## Architecture

```
backend/
├── api/
│   ├── middleware/
│   │   └── auth.ts           # JWT & wallet signature authentication
│   ├── routes/
│   │   ├── game.ts          # Game actions, history, status
│   │   ├── stats.ts         # Analytics, leaderboards, player stats
│   │   └── jackpot.ts       # Jackpot info, history, probability
│   └── server.ts            # Express server with Socket.IO
├── services/
│   ├── analytics.ts         # Redis-backed analytics service
│   └── randomness.ts        # Chainlink VRF integration
└── workers/
    └── jackpotMonitor.ts    # Blockchain event monitoring
```

## Quick Start

### Prerequisites

- Node.js 18+
- Redis server
- Ethereum RPC endpoint
- Deployed SimpsonsCarnival contract

### Installation

```bash
cd backend
npm install
```

### Configuration

Copy the environment template and configure:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Blockchain
RPC_URL=https://your-ethereum-rpc.com
CONTRACT_ADDRESS=0x...

# Authentication
JWT_SECRET=your-secret-key

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# VRF (optional)
VRF_COORDINATOR_ADDRESS=0x...
VRF_SUBSCRIPTION_ID=123
```

### Start Development Server

```bash
npm run dev
```

### Production Deployment

```bash
npm run build
npm start
```

## API Endpoints

### Authentication

- `GET /api/auth/nonce/:address` - Get signing nonce
- `POST /api/auth/login` - Authenticate with wallet signature

### Game Routes

- `GET /api/game/info` - Game information and prices
- `POST /api/game/play` - Prepare game transaction
- `GET /api/game/history/:address?` - Player game history
- `GET /api/game/stats/:address?` - Player statistics
- `GET /api/game/status/:gameId` - Game status
- `POST /api/game/verify-transaction` - Verify game transaction

### Statistics Routes

- `GET /api/stats/global` - Global game statistics
- `GET /api/stats/leaderboard` - Player leaderboard
- `GET /api/stats/player/:address` - Detailed player stats
- `GET /api/stats/analytics/hourly` - Hourly analytics data
- `GET /api/stats/compare` - Compare player statistics
- `GET /api/stats/summary` - Dashboard summary

### Jackpot Routes

- `GET /api/jackpot/current` - Current jackpot information
- `GET /api/jackpot/history` - Jackpot win history
- `GET /api/jackpot/winners` - Recent winners
- `GET /api/jackpot/probability/:address?` - Win probability
- `GET /api/jackpot/leaderboard` - Jackpot winners leaderboard
- `POST /api/jackpot/contribute` - Prepare jackpot contribution
- `GET /api/jackpot/events/live` - Server-sent events for live updates

### Admin Routes

- `POST /api/jackpot/admin/set-trigger-count` - Update jackpot trigger

## Authentication Flow

1. **Get Nonce**: `GET /api/auth/nonce/:address`
2. **Sign Message**: Sign the returned message with wallet
3. **Login**: `POST /api/auth/login` with signature
4. **Use Token**: Include JWT in `Authorization: Bearer <token>` header

## Real-time Events

Connect to Socket.IO for live updates:

```javascript
const socket = io('http://localhost:3001');

// Join game updates
socket.emit('join-game');

// Listen for events
socket.on('gameStarted', (data) => {
  console.log('Game started:', data);
});

socket.on('jackpotWon', (data) => {
  console.log('JACKPOT WON!', data);
});
```

## Services

### Analytics Service

Tracks and aggregates game metrics:

- Player statistics
- Global game metrics
- Hourly/daily analytics
- Jackpot history
- Real-time event processing

### Randomness Service

Integrates with Chainlink VRF:

- Request monitoring
- Fulfillment tracking
- Randomness validation
- Health checking

### Jackpot Monitor

Monitors blockchain events:

- Real-time event listening
- Historical event processing
- Automatic retry with backoff
- Analytics integration

## Caching Strategy

Multi-layer caching for optimal performance:

1. **Redis**: Long-term analytics and statistics
2. **Memory Cache**: Frequently accessed data (30s-5min TTL)
3. **Route-level Caching**: Endpoint-specific cache strategies

## Error Handling

Comprehensive error handling:

- Structured logging with context
- Graceful degradation
- Rate limit protection
- Input validation with Zod
- Database connection retry logic

## Security Features

- **Helmet**: Security headers
- **CORS**: Configurable cross-origin policies
- **Rate Limiting**: Per-IP request limiting
- **Input Validation**: Schema-based validation
- **JWT Tokens**: Secure session management
- **Wallet Signature Verification**: Cryptographic authentication

## Monitoring & Health

- **Health Endpoint**: `/health`
- **Service Status**: Real-time service monitoring
- **Blockchain Sync**: Automatic sync status tracking
- **VRF Health**: Chainlink VRF health monitoring

## Performance

- **Connection Pooling**: Redis connection management
- **Event Batching**: Efficient analytics processing
- **Memory Management**: Automatic cleanup of old data
- **Async Processing**: Non-blocking event handling

## Development

### Scripts

```bash
npm run dev          # Development server with hot reload
npm run build        # TypeScript compilation
npm run start        # Production server
npm run lint         # ESLint checking
npm run test         # Run tests
npm run test:watch   # Watch mode testing
npm run type-check   # TypeScript checking
```

### Adding New Routes

1. Create route file in `/api/routes/`
2. Add authentication middleware if needed
3. Implement validation schemas
4. Add to server.ts
5. Update this documentation

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Deployment

### Environment Setup

1. Configure production environment variables
2. Set up Redis instance
3. Configure RPC endpoint
4. Deploy smart contract
5. Set up monitoring

### Production Checklist

- [ ] Environment variables configured
- [ ] Redis server running
- [ ] Smart contract deployed
- [ ] JWT secret set
- [ ] Rate limits configured
- [ ] CORS origins set
- [ ] Logging configured
- [ ] Health checks enabled
- [ ] Monitoring alerts set up

## Troubleshooting

### Common Issues

**Redis Connection Failed**
```bash
# Check Redis status
redis-cli ping

# Check connection settings
echo $REDIS_HOST $REDIS_PORT
```

**Blockchain Sync Issues**
```bash
# Check RPC endpoint
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' $RPC_URL
```

**Authentication Problems**
- Verify JWT_SECRET is set
- Check wallet signature format
- Ensure nonce is recent (5-minute expiry)

### Logs

All services use structured logging with pino:

```bash
# View logs with pretty printing
npm run dev | pino-pretty

# Production logs
tail -f logs/application.log
```

## API Response Formats

All responses follow consistent format:

```json
{
  "success": true,
  "data": {},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Error responses:

```json
{
  "error": "Error message",
  "details": "Additional details",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit pull request

## License

MIT License - see LICENSE file for details