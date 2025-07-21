# 🚀 Vercel Deployment Guide

## Prerequisites
- Vercel account (sign up at vercel.com)
- Git repository (GitHub, GitLab, or Bitbucket)

## 🔧 Setup Steps

### 1. Install Vercel CLI (Optional)
```bash
npm install -g vercel
```

### 2. Deploy Options

#### Option A: Deploy via Vercel CLI
```bash
# From your project root directory
npm run deploy
# OR
vercel
```

#### Option B: Deploy via Vercel Dashboard
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your Git repository
4. Configure settings (see below)
5. Click "Deploy"

### 3. Vercel Configuration

**Build Settings:**
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

**Environment Variables (Optional):**
- `VITE_APTOS_API_KEY`: Your Aptos API key (optional, for better rate limits)

## 📁 Project Structure
```
rock-paper-scissors-dapp/
├── dist/                 # Build output (auto-generated)
├── frontend/             # React components
├── contract/             # Move smart contracts  
├── vercel.json           # Vercel configuration
├── vite.config.ts        # Vite configuration
└── package.json          # Dependencies & scripts
```

## 🔄 Automatic Deployments
Once connected to Git, Vercel will automatically:
- Deploy on every push to main branch
- Create preview deployments for pull requests
- Update your production URL

## 🌐 Custom Domain (Optional)
1. Go to your project dashboard on Vercel
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Configure DNS settings as shown

## ✅ What's Included
- ✅ SPA routing configured
- ✅ Asset optimization
- ✅ TypeScript compilation
- ✅ Tailwind CSS processing
- ✅ Production-ready build

## 🎮 Live Features
Your deployed dApp will include:
- 🪨📄✂️ Rock Paper Scissors gameplay
- 💰 APT betting system
- 🔗 Aptos testnet integration
- 🎯 Short game IDs (ABC123)
- 🚫 Game cancellation
- 🌐 Public/private games

## 🔗 Access Your dApp
After deployment, your dApp will be available at:
`https://your-project-name.vercel.app`

## 🐛 Troubleshooting
- **Build fails**: Check TypeScript errors in build logs
- **Wallet issues**: Ensure users are on Aptos Testnet
- **Contract errors**: Verify contract addresses in constants
- **Network issues**: Check Aptos RPC endpoints

---
🎉 **Your Rock Paper Scissors dApp is ready for the world!** 