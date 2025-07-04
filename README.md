# <� The Simpsons Carnival - Web3 Gaming Platform

![Carnival Banner](https://via.placeholder.com/800x200/FFD700/000000?text=The+Simpsons+Carnival)

> A thrilling Web3 gaming experience inspired by The Simpsons universe, featuring door-selection gameplay with progressive jackpots and Chainlink VRF for provably fair randomness.

## <� Overview

The Simpsons Carnival is a decentralized gaming platform where players purchase keys to play door-selection games with the chance to win ETH prizes and trigger massive jackpots. Built with modern Web3 technologies, smart contracts, and featuring beautiful Simpsons-themed UI.

### Key Features

- <� **Provably Fair Gaming** - Powered by Chainlink VRF for true randomness
- =� **Progressive Jackpot** - Community-funded jackpot that triggers based on key usage
- <� **Leaderboard System** - Competitive rankings for top players
- <� **Simpsons Theme** - Authentic Springfield carnival experience
- =� **Mobile Responsive** - Play on any device
- = **Secure & Audited** - Production-ready smart contracts

## <� Game Mechanics

### How to Play

1. **Connect Your Wallet** - MetaMask or any Web3 wallet
2. **Purchase a Key** - Choose from Bronze (0.005 ETH), Silver (0.01 ETH), or Gold (0.025 ETH)
3. **Select a Door** - Pick from 3 mysterious doors
4. **Wait for Results** - Chainlink VRF determines your fate
5. **Collect Winnings** - Automatic payouts for winners

### Probability & Payouts

- **Win Probability**: 30% (2x payout)
- **Break-Even Probability**: 35% (1x payout)
- **Loss Probability**: 35% (0x payout)

### Jackpot System

- Triggers every 1,000 keys used (configurable)
- Fed by 5% of all losing bets and 5% of winning payouts
- Winner receives the entire jackpot pool
- Can be seeded by community contributions

## <� Technical Architecture

### Smart Contracts

```
contracts/
   SimpsonsCarnival.sol      # Main game contract
   interfaces/
      IRandomness.sol       # VRF interface
   libraries/
       GameHelpers.sol       # Utility functions
```

### Frontend Stack

- **Next.js 14** - React framework with app router
- **TypeScript** - Type safety throughout
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Smooth animations
- **Wagmi/Viem** - Web3 connectivity
- **RainbowKit** - Wallet connection

### Backend Services

- **Node.js API** - Game statistics and analytics
- **WebSocket** - Real-time jackpot updates
- **PostgreSQL** - Game history and leaderboards

## =� Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/carnival.git
cd carnival

# Install dependencies for all workspaces
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Environment Setup

Create a `.env` file in the root directory:

```env
# Blockchain Configuration
PRIVATE_KEY=your_private_key_here
VRF_SUBSCRIPTION_ID=your_chainlink_vrf_subscription_id

# RPC URLs
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_KEY

# Block Explorer API Keys
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key

# Optional: Gas reporting
COINMARKETCAP_API_KEY=your_cmc_api_key
REPORT_GAS=true

# Frontend Configuration
NEXT_PUBLIC_CONTRACT_ADDRESS=deployed_contract_address
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_INFURA_KEY=your_infura_key
```

### Development

```bash
# Start local blockchain
npm run node

# Deploy contracts to local network
npm run deploy:localhost

# Seed initial jackpot (optional)
npm run seed-jackpot:localhost 1.0

# Start frontend development server
npm run dev

# In another terminal, start the backend API
cd backend && npm run dev
```

Visit `http://localhost:3000` to see the application.

## =� Deployment

### Smart Contract Deployment

```bash
# Deploy to testnet (Sepolia)
npm run deploy:sepolia

# Verify contract on Etherscan
npm run verify:sepolia

# Deploy to mainnet (production)
npm run deploy:mainnet
npm run verify:mainnet
```

### Frontend Deployment (Vercel)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
vercel

# Set environment variables in Vercel dashboard
# Deploy production
vercel --prod
```

### Backend Deployment

The backend can be deployed to any Node.js hosting service:

- **Railway**: Connect GitHub repo for auto-deploy
- **Heroku**: Use the included `Procfile`
- **Digital Ocean**: Deploy via Docker
- **AWS**: Use Elastic Beanstalk or ECS

## >� Testing

### Smart Contract Tests

```bash
# Run all contract tests
npm run test:contracts

# Run with gas reporting
REPORT_GAS=true npm run test:contracts

# Test coverage
npm run coverage:contracts
```

### Integration Tests

```bash
# Run full game flow tests
npm run test:integration

# Test with forked mainnet
FORK_ENABLED=true npm run test:integration
```

### End-to-End Tests

```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests (requires running frontend)
npm run test:e2e

# Run in headed mode
npm run test:e2e:headed
```

## = Security

### Smart Contract Security

-  **Reentrancy Protection** - OpenZeppelin's ReentrancyGuard
-  **Access Control** - Ownable pattern for admin functions
-  **Pausable** - Emergency stop mechanism
-  **Input Validation** - Comprehensive parameter checking
-  **Integer Overflow** - Solidity 0.8+ built-in protection

### Audit Checklist

- [ ] External security audit
- [ ] Bug bounty program
- [ ] Multi-sig wallet for admin functions
- [ ] Timelock for critical parameter changes

## =� Monitoring & Analytics

### Game Statistics

- Total games played
- Win/loss ratios by key type
- Average jackpot size
- Player retention metrics

### Smart Contract Events

All game actions emit events for off-chain tracking:

```solidity
event KeyPurchased(address indexed player, KeyType keyType, uint256 price);
event GameStarted(address indexed player, uint256 indexed gameId, uint256 requestId, uint256 doorSelected);
event GameCompleted(address indexed player, uint256 indexed gameId, GameResult result, uint256 payout);
event JackpotWon(address indexed winner, uint256 amount);
```

## =� Emergency Procedures

### Contract Pause

```bash
# Pause the contract (emergency only)
npm run emergency:pause --network mainnet --reason="Security incident"

# Resume operations
npm run emergency:unpause --network mainnet
```

### Emergency Withdrawal

```bash
# Withdraw all funds (requires contract to be paused)
npm run emergency:withdraw --network mainnet --reason="Contract migration"
```

### Jackpot Management

```bash
# Seed additional jackpot funds
npm run seed-jackpot --network mainnet 5.0

# Adjust jackpot trigger frequency
npm run set-trigger --network mainnet --count=500
```

## > Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow ESLint configuration
- Add tests for new features
- Update documentation

## =� License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## < Acknowledgments

- **The Simpsons** - For the amazing universe and characters
- **Chainlink** - For provably fair randomness
- **OpenZeppelin** - For secure smart contract libraries
- **The Web3 Community** - For building the decentralized future

## = Links

- **Website**: [https://carnival.simpsons.eth](https://carnival.simpsons.eth)
- **Documentation**: [https://docs.carnival.simpsons.eth](https://docs.carnival.simpsons.eth)
- **Discord**: [https://discord.gg/simpsons-carnival](https://discord.gg/simpsons-carnival)
- **Twitter**: [@SimpsonsCarnival](https://twitter.com/SimpsonsCarnival)

## =� Roadmap

### Phase 1 - Launch (Q1 2024)
- [x] Core game mechanics
- [x] Smart contract deployment
- [x] Frontend MVP
- [x] Basic analytics

### Phase 2 - Enhancement (Q2 2024)
- [ ] Mobile app (React Native)
- [ ] Achievement system
- [ ] Social features
- [ ] Advanced analytics

### Phase 3 - Expansion (Q3 2024)
- [ ] Multi-chain deployment
- [ ] NFT integration
- [ ] Tournament mode
- [ ] DAO governance

---

**Built with d by the Carnival team**

*D'oh! Let's make some money!* - Homer Simpson