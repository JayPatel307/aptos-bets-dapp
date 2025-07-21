# 🚀 Deployment Guide

## Smart Contract Deployment

### 1. Setup Aptos CLI

First, ensure you have the Aptos CLI installed:

```bash
# Check if already installed
aptos --version

# If not installed, visit: https://aptos.dev/en/build/cli
```

### 2. Initialize Your Account

Navigate to the contract directory and initialize your account:

```bash
cd contract
aptos init --network testnet
```

This will:
- Create a new account or import an existing one
- Fund your account with test APT (for testnet)
- Save your profile in `.aptos/config.yaml`

### 3. Compile the Contract

```bash
aptos move compile --dev
```

Expected output: `BUILDING rock_paper_scissors` with no errors

### 4. Run Tests (Optional but Recommended)

```bash
aptos move test --dev
```

Expected: All tests pass ✅

### 5. Deploy the Contract

```bash
aptos move deploy-object --address-name rock_paper_scissors --assume-yes
```

**Important:** Save the contract address from the output! It will look something like:
```
Code will be deployed to address: 0xabc123...def456
```

### 6. Update Frontend Configuration

Copy the deployed contract address and update your `.env` file:

```bash
# In the root directory (not in contract/)
cd ..
nano .env
```

Update the `VITE_MODULE_ADDRESS` line:
```env
VITE_MODULE_ADDRESS=0xabc123...def456  # Use your actual deployed address
```

### 7. Restart the Frontend

```bash
npm run dev
```

The frontend should now connect to your deployed contract!

## Testing the Game

### 1. Connect Your Wallet
- Install [Petra Wallet](https://petra.app/) or another Aptos wallet
- Switch to **Testnet** network
- Connect your wallet to the dapp

### 2. Get Test APT
- Your wallet should have test APT from account creation
- If not, use the [testnet faucet](https://aptos.dev/en/network/faucet)

### 3. Create a Game
- Click "Create New Game"
- Approve the transaction in your wallet
- Note the Game ID from the console logs

### 4. Test with Two Players
- Open the dapp in an incognito window
- Connect a different wallet
- Enter the Game ID and join the game
- Play a round!

## Common Issues

### "Module not found" errors
- Make sure you copied the correct contract address
- Verify the contract was deployed successfully
- Check that you're on the same network (testnet)

### "Insufficient funds" errors
- Get more test APT from the faucet
- Make sure your wallet is connected and has APT

### Wallet connection issues
- Try refreshing the page
- Disconnect and reconnect the wallet
- Switch to testnet network in your wallet

### Game ID not working
- The Game ID should be the contract object address
- Check the browser console for the actual Game ID
- Make sure both players are on the same network

## Production Deployment

### Mainnet Deployment

⚠️ **Warning:** Only deploy to mainnet if you're confident in the code and have tested thoroughly on testnet.

1. Change network to mainnet:
```bash
aptos init --network mainnet
```

2. Fund your account with real APT

3. Deploy:
```bash
aptos move deploy-object --address-name rock_paper_scissors --assume-yes
```

4. Update `.env` with mainnet contract address:
```env
VITE_APP_NETWORK=mainnet
VITE_MODULE_ADDRESS=0x...  # Your mainnet contract address
```

### Frontend Deployment

Deploy to Vercel, Netlify, or any static hosting:

```bash
npm run build
```

Upload the `dist/` folder to your hosting provider.

## Support

If you encounter issues:

1. Check the browser console for detailed error messages
2. Verify all addresses and network settings
3. Ensure your wallet has sufficient APT
4. Test each step on testnet first

Happy gaming! 🎮 