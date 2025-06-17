# 🚀 Deployment Guide

## Vercel Deployment Instructions

### Option 1: Deploy Frontend Only (Recommended for Quick Start)

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Click "New Project"**
3. **Import from GitHub**: `https://github.com/cannedoxygen/carnival.git`
4. **Configure Project**:
   - Framework Preset: **Next.js**
   - Root Directory: **frontend**
   - Build Command: `npm run build`
   - Output Directory: `.next`

5. **Environment Variables** (Add these in Vercel dashboard):
   ```
   NEXT_PUBLIC_CHAIN_ID=1
   NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
   NEXT_PUBLIC_BACKEND_URL=https://your-backend-url.com
   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id
   ```

6. **Deploy**: Click "Deploy" and Vercel will build and deploy your frontend!

### Option 2: Full Stack Deployment

For the complete application with backend:

1. **Deploy Frontend** (follow Option 1 above)
2. **Deploy Backend separately**:
   - Create new Vercel project for backend
   - Root Directory: **backend**
   - Build Command: `npm run build`

3. **Database Setup**:
   - Set up Redis instance (Upstash, Redis Cloud)
   - Configure PostgreSQL (PlanetScale, Supabase)

## Environment Variables Setup

### Frontend (.env.local):
```bash
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_BACKEND_URL=https://carnival-backend.vercel.app
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
```

### Backend (.env):
```bash
NODE_ENV=production
PORT=3001
RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your_key
CONTRACT_ADDRESS=0x...
REDIS_URL=redis://...
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret_key
```

## Quick Deploy Links

### Deploy Frontend to Vercel:
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/cannedoxygen/carnival&project-name=simpsons-carnival&root-directory=frontend)

### Deploy Backend to Vercel:
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/cannedoxygen/carnival&project-name=simpsons-carnival-backend&root-directory=backend)

## Post-Deployment Setup

1. **Deploy Smart Contracts**:
   ```bash
   cd contracts
   npm install
   npm run deploy:mainnet
   ```

2. **Update Contract Address**: Update `NEXT_PUBLIC_CONTRACT_ADDRESS` in Vercel

3. **Test the Application**: Visit your Vercel URL and test the game!

## Troubleshooting

- **Build Errors**: Check that all dependencies are in package.json
- **Environment Variables**: Ensure all required vars are set in Vercel dashboard
- **Web3 Issues**: Verify contract address and RPC URL are correct
- **CORS Issues**: Add your domain to backend CORS configuration

## Production Checklist

- [ ] Smart contracts deployed and verified
- [ ] Frontend deployed to Vercel
- [ ] Backend deployed (optional for MVP)
- [ ] Environment variables configured
- [ ] Domain configured (optional)
- [ ] Analytics setup (optional)
- [ ] Monitoring setup (optional)