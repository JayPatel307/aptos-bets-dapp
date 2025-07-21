# 🪨📄✂️ Rock Paper Scissors DApp

A decentralized rock paper scissors game built on the Aptos blockchain featuring provably fair gameplay using a commit-reveal scheme.

## 🌟 Features

- **Provably Fair Gameplay**: Uses cryptographic commit-reveal scheme to ensure neither player can cheat
- **Smart Contract Security**: Built with Aptos Move for secure and transparent game logic
- **Modern UI**: Clean, responsive interface built with React and Tailwind CSS
- **Wallet Integration**: Seamless connection with Aptos-compatible wallets
- **Real-time Updates**: Live game state updates and notifications

## 🎮 How to Play

1. **Connect Wallet**: Connect your Aptos-compatible wallet (Petra, Martian, etc.)
2. **Create or Join Game**: Either create a new game or join an existing one using a Game ID
3. **Commit Move**: Choose your move (Rock, Paper, or Scissors) and commit it (hidden from opponent)
4. **Reveal Move**: Once both players have committed, reveal your move to determine the winner
5. **See Results**: View the final results and both players' moves

## 🛠 Technical Architecture

### Smart Contract (`contract/`)

The Move smart contract implements a secure rock paper scissors game with the following key features:

- **Game Creation**: Players can create new game instances
- **Commit-Reveal Pattern**: Prevents cheating by hiding moves until both players commit
- **Fair Winner Determination**: Automatic winner calculation based on classic rules
- **Event Emission**: All game actions emit events for frontend tracking

#### Game Flow:
1. `WAITING` → Player creates game, waiting for second player
2. `COMMIT` → Both players commit hashed moves
3. `REVEAL` → Players reveal actual moves with nonce for verification
4. `FINISHED` → Winner determined and game completed

### Frontend (`frontend/`)

React-based frontend with TypeScript, featuring:

- **Wallet Adapter Integration**: Seamless wallet connectivity
- **Aptos TS SDK**: Direct blockchain interaction
- **Responsive Design**: Mobile-friendly interface
- **Real-time State Management**: Live game state updates

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Aptos CLI (for contract deployment)
- An Aptos-compatible wallet

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd rock-paper-scissors-dapp
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```bash
   # The Aptos network to use (testnet, mainnet, devnet)
   VITE_APP_NETWORK=testnet
   
   # The address of the deployed contract (update after deployment)
   VITE_MODULE_ADDRESS=0x123
   
   # Optional: API key for better rate limits
   VITE_APTOS_API_KEY=your_api_key_here
   ```

### Smart Contract Deployment

1. **Navigate to contract directory**:
   ```bash
   cd contract
   ```

2. **Initialize Aptos profile** (if not done already):
   ```bash
   aptos init --network testnet
   ```

3. **Compile the contract**:
   ```bash
   aptos move compile --dev
   ```

4. **Run tests**:
   ```bash
   aptos move test --dev
   ```

5. **Deploy the contract**:
   ```bash
   aptos move deploy-object --address-name rock_paper_scissors --assume-yes
   ```

6. **Update environment variables**:
   Copy the deployed contract address and update `VITE_MODULE_ADDRESS` in your `.env` file.

### Running the Frontend

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Open your browser**:
   Navigate to `http://localhost:5173`

3. **Connect your wallet**:
   Click "Connect Wallet" and approve the connection

## 📁 Project Structure

```
rock-paper-scissors-dapp/
├── contract/                  # Move smart contract
│   ├── sources/
│   │   └── rock_paper_scissors.move
│   ├── tests/
│   │   └── game_tests.move
│   ├── Move.toml
│   └── .gitignore
├── frontend/                  # React frontend
│   ├── components/
│   │   ├── Header.tsx
│   │   └── RockPaperScissorsGame.tsx
│   ├── lib/
│   ├── utils/
│   ├── App.tsx
│   ├── main.tsx
│   └── constants.ts
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

## 🎯 Game Rules

Classic rock paper scissors rules apply:

- **Rock** 🪨 beats **Scissors** ✂️
- **Scissors** ✂️ beats **Paper** 📄  
- **Paper** 📄 beats **Rock** 🪨
- Same moves result in a **Draw** 🤝

## 🔒 Security Features

### Commit-Reveal Scheme
- Players first commit a hash of their move + random nonce
- Moves are only revealed after both players have committed
- Prevents cheating and ensures fair gameplay

### Smart Contract Security
- All game logic is immutable and transparent
- Events provide complete audit trail
- No central authority can manipulate results

## 🧪 Testing

### Smart Contract Tests
```bash
cd contract
aptos move test --dev
```

### Frontend (Future Enhancement)
```bash
npm run test
```

## 🛠 Development

### Smart Contract Development
- All contract code is in `contract/sources/`
- Tests are in `contract/tests/`
- Follow Move best practices and coding standards

### Frontend Development
- React components in `frontend/components/`
- Tailwind CSS for styling
- TypeScript for type safety
- Aptos TS SDK for blockchain interaction

## 📋 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run linting
- `npm run fmt` - Format code

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the Apache 2.0 License - see the LICENSE file for details.

## 🔗 Useful Links

- [Aptos Documentation](https://aptos.dev)
- [Move Language](https://move-language.github.io/move/)
- [Aptos TS SDK](https://aptos.dev/en/build/sdks/ts-sdk)
- [Petra Wallet](https://petra.app)

## ⚠️ Disclaimer

This is a demonstration project for educational purposes. While the smart contract implements security best practices, please conduct thorough testing before using in production or with real value.

## 🐛 Known Issues

- Game ID management is manual (could be improved with event parsing)
- No automatic game discovery (players must share Game IDs)
- Limited to testnet for development

## 🗺 Roadmap

- [ ] Automatic game ID extraction from events
- [ ] Game lobby for discovering active games
- [ ] Tournament mode with multiple rounds
- [ ] Betting system with entry fees
- [ ] Mobile app development
- [ ] Mainnet deployment

---

**Happy Gaming!** 🎮 Enjoy playing provably fair rock paper scissors on the blockchain!
