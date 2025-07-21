import { useState, useEffect } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { MODULE_ADDRESS, REGISTRY_OWNER } from "@/constants";

// Game constants
const MOVES = {
  ROCK: 0,
  PAPER: 1,
  SCISSORS: 2,
} as const;

const MOVE_NAMES = ["Rock", "Paper", "Scissors"];
const MOVE_EMOJIS = ["🪨", "📄", "✂️"];

const PHASES = {
  WAITING: 0,
  COMMIT: 1,
  REVEAL: 2,
  FINISHED: 3,
} as const;

const RESULTS = {
  PENDING: 0,
  PLAYER1_WINS: 1,
  PLAYER2_WINS: 2,
  DRAW: 3,
} as const;

const GAME_TYPES = {
  PUBLIC: 0,
  PRIVATE: 1,
} as const;

// 1 APT = 100,000,000 Octas
const APT_TO_OCTAS = 100000000;

interface GameInfo {
  creator: string;
  player1: string | null;
  player2: string | null;
  phase: number;
  result: number;
  winner: string | null;
  betAmount: number; // in Octas
  prizeWithdrawn: boolean;
}

interface GameMoves {
  player1Move: number | null;
  player2Move: number | null;
}

export function RockPaperScissorsGame() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [gameId, setGameId] = useState<string>("");
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const [gameMoves, setGameMoves] = useState<GameMoves | null>(null);
  const [selectedMove, setSelectedMove] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<"create" | "join" | "browse" | "mygames" | "play">("create");
  const [myActiveGames, setMyActiveGames] = useState<string[]>([]);
  const [createdGameId, setCreatedGameId] = useState<string>("");
  const [lastTransactionHash, setLastTransactionHash] = useState<string>("");
  const [gameType, setGameType] = useState<number>(GAME_TYPES.PRIVATE);
  const [betAmount, setBetAmount] = useState<number>(0.1); // in APT
  const [publicGames, setPublicGames] = useState<string[]>([]);
  const [userBalance, setUserBalance] = useState<number>(0);

  const [committedMove, setCommittedMove] = useState<number | null>(null);
  const [committedNonce, setCommittedNonce] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  // Copy to clipboard function
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setError("🎉 Game ID copied to clipboard!");
      setTimeout(() => setError(""), 3000);
    } catch (error) {
      console.error("Failed to copy:", error);
      setError("Failed to copy Game ID");
    }
  };



  // Convert APT to Octas
  const aptToOctas = (apt: number): number => {
    return Math.floor(apt * APT_TO_OCTAS);
  };

  // Convert Octas to APT
  const octasToApt = (octas: number): number => {
    return octas / APT_TO_OCTAS;
  };

  // Format APT amount for display
  const formatApt = (octas: number): string => {
    return `${octasToApt(octas).toFixed(4)} APT`;
  };

  // Fetch user balance
  const fetchUserBalance = async () => {
    if (!account) return;
    try {
      const balance = await aptos.getAccountAPTAmount({
        accountAddress: account.address,
      });
      setUserBalance(octasToApt(balance));
    } catch (error) {
      console.error("Error fetching balance:", error);
      setError("Failed to fetch balance. Please check your network connection.");
    }
  };

  // Registry is initialized by the deployer at startup

  // Create game function
  const createGame = async () => {
    if (!account) return;
    
    setLoading(true);
    setError("");
    
    try {
      const betOctas = aptToOctas(betAmount);
      
      // Check balance
      if (userBalance < betAmount) {
        setError(`Insufficient balance. You have ${userBalance.toFixed(4)} APT but need ${betAmount} APT`);
        setLoading(false);
        return;
      }
      
      // Registry is already initialized by the deployer
      
      console.log("Creating game with bet:", betAmount, "APT (", betOctas, "Octas)");
      
      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: `${MODULE_ADDRESS}::game::create_game`,
          typeArguments: [],
          functionArguments: [gameType, betOctas.toString(), REGISTRY_OWNER],
        },
      });
      
      console.log("Game created successfully:", response);
      setLastTransactionHash(response.hash);
      
      // Wait for transaction and get the game ID from events
      const txnResult = await aptos.waitForTransaction({ transactionHash: response.hash });
      console.log("Transaction result:", txnResult);
      
      // Extract game ID from events
      const events = (txnResult as any).events;
      if (events && events.length > 0) {
        const gameCreatedEvent = events.find((event: any) => 
          event.type.includes("GameCreated")
        );
        if (gameCreatedEvent && gameCreatedEvent.data && gameCreatedEvent.data.game_id) {
          const extractedGameId = gameCreatedEvent.data.game_id;
          setCreatedGameId(extractedGameId);
          setGameId(extractedGameId);
          
          const gameTypeText = gameType === GAME_TYPES.PUBLIC ? "Public" : "Private";
          setError(`🎉 ${gameTypeText} game created! Game ID: ${extractedGameId} | Bet: ${betAmount} APT`);
          console.log("Game ID extracted:", extractedGameId);
          
          // Refresh balance
          await fetchUserBalance();
          
          // Load game info and switch to play tab to show game status
          setTimeout(async () => {
            await fetchGameInfo(extractedGameId, true);
          }, 1000);
        }
      }
      
    } catch (error) {
      console.error("Detailed error:", error);
      setError(`Failed to create game: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // Load public games
  const loadPublicGames = async () => {
    try {
      const response = await aptos.view({
        payload: {
          function: `${MODULE_ADDRESS}::game::get_public_games`,
          typeArguments: [],
          functionArguments: [REGISTRY_OWNER],
        },
      });
      
      setPublicGames(response[0] as string[]);
    } catch (error) {
      console.error("Error loading public games:", error);
      setPublicGames([]);
    }
  };

  // Load user's active games (games they're participating in that aren't finished)
  const loadMyActiveGames = async () => {
    if (!account) {
      setMyActiveGames([]);
      return;
    }

    try {
      // Get all public games first
      const publicResponse = await aptos.view({
        payload: {
          function: `${MODULE_ADDRESS}::game::get_public_games`,
          typeArguments: [],
          functionArguments: [REGISTRY_OWNER],
        },
      });
      
      const allPublicGames = publicResponse[0] as string[];
      const userActiveGames: string[] = [];

      // Add the currently created game if it exists
      if (createdGameId) {
        const gameDetails = await getGameDetails(createdGameId);
        if (gameDetails && gameDetails.phase !== PHASES.FINISHED) {
          userActiveGames.push(createdGameId);
        }
      }

      // Check all public games to see if user is participating
      for (const gameId of allPublicGames) {
        if (gameId === createdGameId) continue; // Already added above
        
        const gameDetails = await getGameDetails(gameId);
        if (gameDetails && gameDetails.phase !== PHASES.FINISHED) {
          const isParticipant = 
            gameDetails.player1 === account.address || 
            gameDetails.player2 === account.address;
          
          if (isParticipant && !userActiveGames.includes(gameId)) {
            userActiveGames.push(gameId);
          }
        }
      }

      setMyActiveGames(userActiveGames);
    } catch (error) {
      console.error("Error loading user's active games:", error);
      setMyActiveGames([]);
    }
  };

  // Get game info for a specific game ID
  const getGameDetails = async (gameId: string) => {
    try {
      const response = await aptos.view({
        payload: {
          function: `${MODULE_ADDRESS}::game::get_game_info`,
          typeArguments: [],
          functionArguments: [gameId, REGISTRY_OWNER],
        },
      });
      
      const [creator, player1, player2, phase, result, winner, betAmount, prizeWithdrawn] = response;
      
      return {
        creator: creator as string,
        player1: (player1 as any)?.vec?.length > 0 ? (player1 as any).vec[0] : null,
        player2: (player2 as any)?.vec?.length > 0 ? (player2 as any).vec[0] : null,
        phase: phase as number,
        result: result as number,
        winner: (winner as any)?.vec?.length > 0 ? (winner as any).vec[0] : null,
        betAmount: betAmount as number,
        prizeWithdrawn: prizeWithdrawn as boolean,
      };
    } catch (error) {
      console.error("Error fetching game details:", error);
      return null;
    }
  };

  // Join an existing game
  const joinGame = async (targetGameId?: string) => {
    if (!account) return;
    const idToJoin = targetGameId || gameId;
    if (!idToJoin) return;
    
    setLoading(true);
    setError("");
    
    try {
      // Get game details first to check bet amount
      const gameDetails = await getGameDetails(idToJoin);
      if (!gameDetails) {
        setError("Game not found");
        return;
      }
      
      const requiredApt = octasToApt(gameDetails.betAmount);
      if (userBalance < requiredApt) {
        setError(`Insufficient balance. You have ${userBalance.toFixed(4)} APT but need ${requiredApt.toFixed(4)} APT`);
        setLoading(false);
        return;
      }
      
      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: `${MODULE_ADDRESS}::game::join_game`,
          typeArguments: [],
          functionArguments: [idToJoin, REGISTRY_OWNER],
        },
      });
      
      console.log("Joined game:", response);
      
      // Refresh balance
      await fetchUserBalance();
      
      // Refresh active games list since user joined a new game
      await loadMyActiveGames();
      
      // Clear move states when joining a new game
      setCommittedMove(null);
      setCommittedNonce("");
      setSelectedMove(null);
      setGameMoves(null);
      
      if (!targetGameId) {
        await fetchGameInfo(idToJoin);
      } else {
        setGameId(idToJoin);
        setTimeout(async () => {
          await fetchGameInfo(idToJoin);
        }, 1000);
      }
    } catch (error) {
      setError(`Failed to join game: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Generate correct BCS-encoded data (matching the reveal function)
  const generateBCSEncodedData = (move: number, nonceBytes: Uint8Array): Uint8Array => {
    // BCS encoding of u8 is just the single byte
    // The reveal function does: std::bcs::to_bytes(&player_move) + nonce
    const moveBytes = new Uint8Array([move]);
    const combined = new Uint8Array(1 + nonceBytes.length);
    combined.set(moveBytes, 0);
    combined.set(nonceBytes, 1);
    
    console.log("BCS encoding - Move byte:", move);
    console.log("BCS encoding - Combined data:", Array.from(combined));
    
    return combined;
  };

  // Commit a move
  const commitMove = async () => {
    if (!account || !gameId || selectedMove === null) return;
    
    setLoading(true);
    setError("");
    
    try {
      // Generate random nonce (32 bytes)
      const nonceArray = new Uint8Array(32);
      crypto.getRandomValues(nonceArray);
      
      console.log("🔨 COMMIT DEBUG:");
      console.log("Move:", selectedMove);
      console.log("Nonce:", Array.from(nonceArray));
      
      // Use the (incorrect) view function for now to generate hash for commit
      // We'll fix the reveal part separately
      const hashResponse = await aptos.view({
        payload: {
          function: `${MODULE_ADDRESS}::game::create_move_hash`,
          typeArguments: [],
          functionArguments: [selectedMove, Array.from(nonceArray)],
        },
      });
      
      const moveHash = hashResponse[0] as number[];
      console.log("Hash from view function:", moveHash);
      
      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: `${MODULE_ADDRESS}::game::commit_move`,
          typeArguments: [],
          functionArguments: [gameId, moveHash, REGISTRY_OWNER],
        },
      });
      
      console.log("Move committed:", response);
      setCommittedMove(selectedMove);
      // Store the actual nonce bytes
      setCommittedNonce(JSON.stringify(Array.from(nonceArray)));
      setSelectedMove(null);
      
      await fetchGameInfo(undefined, false);
    } catch (error) {
      setError(`Failed to commit move: ${error}`);
    } finally {
      setLoading(false);
    }
  };





  // Withdraw prize
  const withdrawPrize = async () => {
    if (!account || !gameId || !gameInfo) return;
    
    setLoading(true);
    setError("");
    
    try {
      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: `${MODULE_ADDRESS}::game::withdraw_prize`,
          typeArguments: [],
          functionArguments: [gameId, REGISTRY_OWNER],
        },
      });
      
      console.log("Prize withdrawn:", response);
      
      // Refresh balance and game info
      await fetchUserBalance();
      await fetchGameInfo(undefined, false);
      
      if (gameInfo.result === RESULTS.DRAW) {
        setError(`🎉 Refund of ${formatApt(gameInfo.betAmount)} received!`);
      } else {
        setError(`🎉 Prize of ${formatApt(gameInfo.betAmount * 2)} withdrawn!`);
      }
    } catch (error) {
      setError(`Failed to withdraw prize: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch game information
  const fetchGameInfo = async (targetGameId?: string, switchTab: boolean = true) => {
    const idToFetch = targetGameId || gameId;
    if (!idToFetch) return;
    
    try {
      const gameDetails = await getGameDetails(idToFetch);
      if (gameDetails) {
        setGameInfo(gameDetails);
        
        // Reset move states when switching to a different game
        if (targetGameId && targetGameId !== gameId) {
          setCommittedMove(null);
          setCommittedNonce("");
          setSelectedMove(null);
          setGameMoves(null);
        }
        
        if (switchTab) {
          setActiveTab("play");
        }
        if (targetGameId) setGameId(targetGameId);
      } else {
        setError("Game not found");
      }
    } catch (error) {
      console.error("Error fetching game info:", error);
      setError("Failed to fetch game information");
    }
  };

  // Cancel game function
  const cancelGame = async (gameId: string) => {
    if (!account) return;

    try {
      setLoading(true);
      setError("");

      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: `${MODULE_ADDRESS}::game::cancel_game`,
          typeArguments: [],
          functionArguments: [gameId, REGISTRY_OWNER],
        },
      });

      console.log("Game cancelled:", response);

      // Refresh balance
      await fetchUserBalance();
      await loadPublicGames();

      // Clear the created game ID if it was cancelled
      if (createdGameId === gameId) {
        setCreatedGameId("");
      }

      setError(`🎉 Game cancelled! Your bet has been refunded.`);
    } catch (error) {
      console.error("Error cancelling game:", error);
      setError("Failed to cancel game. Make sure you're the creator and no one has joined yet.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch game moves (only visible after game is finished)
  const fetchGameMoves = async () => {
    if (!gameId) return;
    
    try {
      const response = await aptos.view({
        payload: {
          function: `${MODULE_ADDRESS}::game::get_game_moves`,
          typeArguments: [],
          functionArguments: [gameId, REGISTRY_OWNER],
        },
      });
      
      const [player1Move, player2Move] = response;
      setGameMoves({
        player1Move: player1Move as number | null,
        player2Move: player2Move as number | null,
      });
    } catch (error) {
      console.error("Error fetching game moves:", error);
    }
  };



  // Auto-refresh game state (NO AUTO-REVEAL)
  useEffect(() => {
    if (gameInfo && gameInfo.phase < PHASES.FINISHED) {
      fetchGameInfo(undefined, false);
      // REMOVED: handleGameProgression(); // Disabled auto-reveals to stop popup spam
      const interval = setInterval(async () => {
        await fetchGameInfo(undefined, false);
        // REMOVED: await handleGameProgression(); // Disabled auto-reveals
      }, 3000);
      return () => clearInterval(interval);
    } else if (gameInfo && gameInfo.phase === PHASES.FINISHED) {
      // Fetch moves when game finishes
      fetchGameMoves();
    }
  }, [gameId, gameInfo?.phase]);

  // Load public games when browsing
  useEffect(() => {
    if (activeTab === "browse") {
      loadPublicGames();
      const interval = setInterval(loadPublicGames, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Load user's active games when viewing My Games tab
  useEffect(() => {
    if (activeTab === "mygames" && account) {
      loadMyActiveGames();
      const interval = setInterval(loadMyActiveGames, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, account, createdGameId]);

  // Fetch user balance and active games on mount and when account changes
  useEffect(() => {
    if (account) {
      fetchUserBalance();
      loadMyActiveGames();
    }
  }, [account]);

  // Check if current user is a player in the game
  const isPlayer = gameInfo && account && (
    gameInfo.player1 === account.address || 
    gameInfo.player2 === account.address
  );

  const getResultText = () => {
    if (!gameInfo || gameInfo.result === RESULTS.PENDING) return "";
    
    if (gameInfo.result === RESULTS.DRAW) return "It's a draw! 🤝 Both players get refunded.";
    
    if (gameInfo.winner === account?.address) return "You win! 🎉";
    if (isPlayer) return "You lose! 😢";
    
    if (gameInfo.result === RESULTS.PLAYER1_WINS) return "Player 1 wins!";
    return "Player 2 wins!";
  };

  const getGameTypeDisplay = (type: number) => {
    return type === GAME_TYPES.PUBLIC ? "🌐 Public" : "🔒 Private";
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          🪨📄✂️ Rock Paper Scissors Betting
        </h1>
        
        {/* User Balance Display */}
        {account && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-center relative group">
            <div className="text-lg font-semibold text-blue-800">
              💰 Your Balance: {userBalance.toFixed(4)} APT
            </div>
            <div className="text-sm text-blue-600 mt-1">
              🌐 Network: TESTNET | 👤 {account.address.slice(0, 8)}...{account.address.slice(-6)}
            </div>
            <button
              onClick={fetchUserBalance}
              className="text-sm text-blue-600 hover:text-blue-800 mt-2 px-3 py-1 border border-blue-300 rounded hover:bg-blue-100"
            >
              🔄 Refresh Balance
            </button>
            
            {/* Hover Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
              <div className="text-center">
                <div>🔍 Debug Info:</div>
                <div>Account: {account.address}</div>
                <div>Network: TESTNET</div>
                <div>Balance: {(userBalance * 100000000).toFixed(0)} Octas</div>
                <div className="mt-1 text-yellow-300">
                  ⚠️ Balance off? Switch wallet to Testnet
                </div>
              </div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
        )}
        
        {error && (
          <div className={`border px-4 py-3 rounded mb-4 ${
            error.includes('🎉') 
              ? 'bg-green-100 border-green-400 text-green-700' 
              : 'bg-red-100 border-red-400 text-red-700'
          }`}>
            {error}
          </div>
        )}

        {/* Created Game ID Display */}
        {createdGameId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">🎮 Your Game is Ready!</h3>
            <div className="flex items-center justify-between bg-white rounded p-3 border">
              <div>
                <p className="text-sm text-gray-600">Short Game ID:</p>
                <p className="font-mono text-2xl font-bold text-blue-600">{createdGameId}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {getGameTypeDisplay(gameType)} • Bet: {betAmount} APT
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(createdGameId)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
                >
                  📋 Copy
                </button>
                <button
                  onClick={() => cancelGame(createdGameId)}
                  disabled={loading}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
            <p className="text-sm text-blue-600 mt-2">
              {gameType === GAME_TYPES.PUBLIC ? 
                "This is a public game - others can find it in the browser!" : 
                "This is a private game - share this ID with your opponent!"
              }
            </p>
            {lastTransactionHash && (
              <p className="text-xs text-gray-500 mt-1">
                <a 
                  href={`https://explorer.aptoslabs.com/txn/${lastTransactionHash}?network=testnet`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  View on Explorer ↗
                </a>
              </p>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab("create")}
              className={`px-6 py-3 font-semibold ${
                activeTab === "create"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Create Game
            </button>
            <button
              onClick={() => setActiveTab("mygames")}
              className={`px-6 py-3 font-semibold relative ${
                activeTab === "mygames"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              My Games
              {myActiveGames.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
                  {myActiveGames.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("browse")}
              className={`px-6 py-3 font-semibold ${
                activeTab === "browse"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Browse Public Games
            </button>
            <button
              onClick={() => setActiveTab("join")}
              className={`px-6 py-3 font-semibold ${
                activeTab === "join"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Join Private Game
            </button>
            {gameInfo && (
              <button
                onClick={() => setActiveTab("play")}
                className={`px-6 py-3 font-semibold ${
                  activeTab === "play"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Game Status
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "create" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-4">Create New Betting Game</h2>
              <p className="text-gray-600 mb-6">Start a new Rock Paper Scissors game with APT wagering</p>
              
              {/* Bet Amount Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Bet Amount (APT)</label>
                <div className="flex justify-center space-x-2 mb-4">
                  {[0.1, 0.5, 1.0, 2.0, 5.0].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setBetAmount(amount)}
                      className={`px-4 py-2 rounded border ${
                        betAmount === amount
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {amount} APT
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max={userBalance}
                  value={betAmount}
                  onChange={(e) => setBetAmount(parseFloat(e.target.value) || 0.1)}
                  className="w-32 border border-gray-300 px-3 py-2 rounded text-center"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Winner takes {(betAmount * 2).toFixed(1)} APT total
                </p>
              </div>
              
              {/* Game Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Game Type</label>
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => setGameType(GAME_TYPES.PRIVATE)}
                    className={`px-6 py-3 rounded-lg border-2 ${
                      gameType === GAME_TYPES.PRIVATE
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    🔒 Private Game
                    <p className="text-xs mt-1">Share ID with specific player</p>
                  </button>
                  <button
                    onClick={() => setGameType(GAME_TYPES.PUBLIC)}
                    className={`px-6 py-3 rounded-lg border-2 ${
                      gameType === GAME_TYPES.PUBLIC
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    🌐 Public Game
                    <p className="text-xs mt-1">Anyone can find and join</p>
                  </button>
                </div>
              </div>
              
              <button
                onClick={createGame}
                disabled={loading || betAmount > userBalance}
                className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold disabled:opacity-50 text-lg"
              >
                {loading ? "Creating..." : `🚀 Create Game (${betAmount} APT)`}
              </button>
              
              {betAmount > userBalance && (
                <p className="text-red-500 text-sm mt-2">
                  Insufficient balance. You need {betAmount} APT but have {userBalance.toFixed(4)} APT
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "mygames" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-4">🎮 My Active Games</h2>
              <p className="text-gray-600 mb-6">All games you're currently participating in</p>
              
              <div className="max-w-4xl mx-auto">
                {myActiveGames.length === 0 ? (
                  <div className="text-gray-500 py-8">
                    <p className="text-lg">🎯 No active games</p>
                    <p className="text-sm mt-2">Create or join a game to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myActiveGames.map((myGameId, index) => (
                      <MyGameCard 
                        key={index} 
                        gameId={myGameId} 
                        onPlay={() => {
                          setGameId(myGameId);
                          fetchGameInfo(myGameId, true);
                        }}
                        onCancel={() => cancelGame(myGameId)}
                        onRemove={() => {
                          // Remove from active games list
                          setMyActiveGames(prev => prev.filter(id => id !== myGameId));
                          // If it was the current game, clear it
                          if (myGameId === gameId) {
                            setGameId("");
                            setGameInfo(null);
                            setGameMoves(null);
                            setSelectedMove(null);
                            setCommittedMove(null);
                            setCommittedNonce("");
                            setActiveTab("create");
                          }
                        }}
                        loading={loading}
                        getGameDetails={getGameDetails}
                        currentUserAddress={account?.address}
                        isCurrentGame={myGameId === gameId}
                      />
                    ))}
                  </div>
                )}
                
                <button
                  onClick={loadMyActiveGames}
                  disabled={loading}
                  className="mt-4 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold disabled:opacity-50"
                >
                  🔄 Refresh My Games
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "browse" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-4">Browse Public Betting Games</h2>
              <p className="text-gray-600 mb-6">Join any public game and compete for APT prizes</p>
              
              <div className="max-w-2xl mx-auto">
                {publicGames.length === 0 ? (
                  <div className="text-gray-500 py-8">
                    <p className="text-lg">🔍 No public games available</p>
                    <p className="text-sm mt-2">Create a public game to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {publicGames.map((publicGameId, index) => (
                      <PublicGameCard 
                        key={index} 
                        gameId={publicGameId} 
                        onJoin={() => joinGame(publicGameId)}
                        onCancel={() => cancelGame(publicGameId)}
                        loading={loading}
                        getGameDetails={getGameDetails}
                        currentUserAddress={account?.address}
                      />
                    ))}
                  </div>
                )}
                
                <button
                  onClick={loadPublicGames}
                  disabled={loading}
                  className="mt-4 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold disabled:opacity-50"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "join" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-4">Join Private Game</h2>
              <p className="text-gray-600 mb-6">Enter a short Game ID to join a private betting game</p>
              
              <div className="max-w-md mx-auto space-y-4">
                <input
                  type="text"
                  placeholder="Enter Game ID (e.g., ABC123)"
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value.toUpperCase())}
                  className="w-full border border-gray-300 px-4 py-3 rounded-lg text-center font-mono text-lg"
                  maxLength={6}
                />
                <button
                  onClick={gameId ? () => fetchGameInfo() : undefined}
                  disabled={!gameId || loading}
                  className="w-full bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
                >
                  {loading ? "Loading..." : "🎯 Load Game"}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "play" && gameInfo && (
          <div className="space-y-6">
            {/* Game Status */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-4">🎮 Game Status</h3>
              
              {/* Current Status Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="text-lg font-semibold text-blue-800 mb-2">
                  {gameInfo.phase === PHASES.WAITING && isPlayer && "⏳ Waiting for opponent to join"}
                  {gameInfo.phase === PHASES.WAITING && !isPlayer && "👀 Watching game - waiting for player 2"}
                  {gameInfo.phase === PHASES.COMMIT && isPlayer && "🎯 Your turn: Choose your move!"}
                  {gameInfo.phase === PHASES.COMMIT && !isPlayer && "⏳ Players are choosing their moves..."}
                  {gameInfo.phase === PHASES.REVEAL && "🔍 Revealing moves..."}
                  {gameInfo.phase === PHASES.FINISHED && "🏁 Game finished!"}
                </div>
                <div className="text-sm text-blue-600">
                  {gameInfo.phase === PHASES.WAITING && isPlayer && gameInfo.player2 === null && "Share the Game ID or wait for someone to join from public games"}
                  {gameInfo.phase === PHASES.WAITING && !isPlayer && gameInfo.player2 === null && "This game is waiting for a second player to join"}
                  {gameInfo.phase === PHASES.COMMIT && isPlayer && "Select Rock, Paper, or Scissors below"}
                  {gameInfo.phase === PHASES.COMMIT && !isPlayer && "Both players are privately choosing their moves"}
                  {gameInfo.phase === PHASES.REVEAL && "Moves will be revealed automatically once both players have committed"}
                  {gameInfo.phase === PHASES.FINISHED && isPlayer && "Check the result below and claim your prize if you won!"}
                  {gameInfo.phase === PHASES.FINISHED && !isPlayer && "Game completed - check the moves and result below"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Game ID:</strong> <span className="font-mono text-blue-600">{gameId}</span></div>
                <div><strong>Bet Amount:</strong> <span className="text-green-600 font-semibold">{formatApt(gameInfo.betAmount)}</span></div>
                <div><strong>Phase:</strong> {Object.keys(PHASES)[gameInfo.phase]}</div>
                <div><strong>Prize Pool:</strong> <span className="text-purple-600 font-semibold">{formatApt(gameInfo.betAmount * 2)}</span></div>
                <div><strong>Player 1:</strong> {gameInfo.player1 ? `${gameInfo.player1.slice(0, 8)}...` : 'None'}</div>
                <div><strong>Player 2:</strong> {gameInfo.player2 ? `${gameInfo.player2.slice(0, 8)}...` : 'Waiting...'}</div>
              </div>
              
              {gameInfo.phase === PHASES.FINISHED && (
                <div className="mt-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{getResultText()}</div>
                  {gameMoves && (
                    <div className="mt-4 flex justify-center space-x-8">
                      <div className="text-center">
                        <div className="text-4xl">{MOVE_EMOJIS[gameMoves.player1Move!]}</div>
                        <div className="text-sm">Player 1: {MOVE_NAMES[gameMoves.player1Move!]}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-4xl">{MOVE_EMOJIS[gameMoves.player2Move!]}</div>
                        <div className="text-sm">Player 2: {MOVE_NAMES[gameMoves.player2Move!]}</div>
                      </div>
                    </div>
                  )}
                  
                  {/* Prize Withdrawal */}
                  {isPlayer && !gameInfo.prizeWithdrawn && (
                    <div className="mt-6">
                      <button
                        onClick={withdrawPrize}
                        disabled={loading}
                        className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
                      >
                        {loading ? "Withdrawing..." : 
                         gameInfo.result === RESULTS.DRAW ? 
                         `💰 Claim Refund (${formatApt(gameInfo.betAmount)})` : 
                         gameInfo.winner === account?.address ?
                         `🏆 Claim Prize (${formatApt(gameInfo.betAmount * 2)})` :
                         "Game Finished"
                        }
                      </button>
                    </div>
                  )}
                  
                  {gameInfo.prizeWithdrawn && (
                    <div className="mt-4 text-green-600 font-semibold">
                      ✅ Prize has been withdrawn
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Game Actions */}
            {gameInfo.phase === PHASES.WAITING && !isPlayer && (
              <div className="text-center">
                <div className="mb-4">
                  <p className="text-lg font-semibold">Join this game for {formatApt(gameInfo.betAmount)}</p>
                  <p className="text-sm text-gray-600">Winner takes {formatApt(gameInfo.betAmount * 2)} total</p>
                </div>
                <button
                  onClick={() => joinGame()}
                  disabled={loading}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
                >
                  {loading ? "Joining..." : `Join Game (${formatApt(gameInfo.betAmount)})`}
                </button>
              </div>
            )}

            {gameInfo.phase === PHASES.COMMIT && isPlayer && (
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-4">Choose Your Move</h3>
                <div className="flex justify-center space-x-4 mb-6">
                  {Object.entries(MOVES).map(([name, value]) => (
                    <button
                      key={value}
                      onClick={() => setSelectedMove(value)}
                      className={`p-6 rounded-lg border-2 ${
                        selectedMove === value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="text-4xl mb-2">{MOVE_EMOJIS[value]}</div>
                      <div className="text-lg font-semibold">{name}</div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={commitMove}
                  disabled={selectedMove === null || loading}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
                >
                  {loading ? "Committing..." : "Commit Move"}
                </button>
                
                {/* Show committed status if user has committed */}
                {committedMove !== null && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-lg text-green-600 mb-2">✅ Move committed!</div>
                    <div className="text-sm text-green-700">
                      Your move: {MOVE_EMOJIS[committedMove]} {MOVE_NAMES[committedMove]}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Waiting for other player...</div>
                  </div>
                )}
              </div>
            )}

            {gameInfo.phase === PHASES.REVEAL && isPlayer && (
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-4">🔓 Reveal Your Move</h3>
                {committedMove !== null && (
                  <div className="mb-4">
                    <div className="text-4xl mb-2">{MOVE_EMOJIS[committedMove]}</div>
                    <div className="text-lg">Your move: {MOVE_NAMES[committedMove]}</div>
                  </div>
                )}
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="text-lg text-blue-600 mb-2">
                    🎯 Ready to reveal your move!
                  </div>
                  <div className="text-sm text-gray-600">
                    Click the button below to reveal your move and see who wins.
                  </div>
                </div>
                
                {/* Simple reveal button - no auto-reveal */}
                {committedMove !== null && (
                  <button
                    onClick={async () => {
                      try {
                        setLoading(true);
                        setError("");
                        
                        console.log("🔍 REVEAL DEBUG - Starting reveal process...");
                        const nonceBytes = JSON.parse(committedNonce);
                        console.log("Move:", committedMove);
                        console.log("Nonce bytes:", nonceBytes);
                        console.log("Nonce length:", nonceBytes.length);
                        
                        // Test hash generation first
                        console.log("Testing hash generation...");
                        const testHashResponse = await aptos.view({
                          payload: {
                            function: `${MODULE_ADDRESS}::game::create_move_hash`,
                            typeArguments: [],
                            functionArguments: [committedMove, nonceBytes],
                          },
                        });
                        console.log("Generated hash:", testHashResponse[0]);
                        
                        // Now try to reveal
                        console.log("Submitting reveal transaction...");
                        const response = await signAndSubmitTransaction({
                          sender: account.address,
                          data: {
                            function: `${MODULE_ADDRESS}::game::reveal_move`,
                            typeArguments: [],
                            functionArguments: [gameId, committedMove, nonceBytes, REGISTRY_OWNER],
                          },
                        });
                        
                        console.log("✅ Reveal transaction submitted:", response);
                        setError("🎉 Move revealed successfully!");
                        
                        // Wait a bit then refresh
                        setTimeout(async () => {
                          await fetchGameInfo(undefined, false);
                          await fetchGameMoves();
                        }, 2000);
                        
                      } catch (error) {
                        console.error("❌ Reveal failed:", error);
                        setError(`Reveal failed: ${error}`);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading || !committedMove}
                    className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 mb-4"
                  >
                    {loading ? "Revealing..." : "🔓 Reveal Move"}
                  </button>
                )}
                
                {!committedMove && (
                  <div className="text-red-500 text-sm">
                    ❌ No committed move found. Please refresh and try again.
                  </div>
                )}
                
                <div className="mt-4 space-y-3">
                  {/* Debug hash generation */}
                  <div className="bg-gray-50 border rounded-lg p-4">
                    <div className="text-sm font-semibold mb-2">🔧 Debug Hash Generation:</div>
                    <button
                      onClick={async () => {
                        if (!committedMove || !committedNonce) {
                          console.log("No committed move/nonce to test");
                          return;
                        }
                        
                        try {
                          const nonceBytes = JSON.parse(committedNonce);
                          console.log("\n=== COMPREHENSIVE HASH DEBUG ===");
                          console.log("Move:", committedMove);
                          console.log("Move type:", typeof committedMove);
                          console.log("Nonce bytes:", nonceBytes);
                          console.log("Nonce length:", nonceBytes.length);
                          console.log("Nonce type:", typeof nonceBytes[0]);
                          
                          // Test 1: Use contract's hash function (WRONG - uses vector::singleton)
                          console.log("\n--- Test 1: Contract view function (WRONG) ---");
                          const contractHash = await aptos.view({
                            payload: {
                              function: `${MODULE_ADDRESS}::game::create_move_hash`,
                              typeArguments: [],
                              functionArguments: [committedMove, nonceBytes],
                            },
                          });
                          console.log("View function hash:", contractHash[0]);
                          
                          // Test 2: Manual BCS encoding (CORRECT - matches reveal function)
                          console.log("\n--- Test 2: Manual BCS encoding (CORRECT) ---");
                          const bcsData = generateBCSEncodedData(committedMove, new Uint8Array(nonceBytes));
                          console.log("BCS encoded data:", Array.from(bcsData));
                          console.log("Data length:", bcsData.length);
                          console.log("First byte (move):", bcsData[0]);
                          console.log("Remaining bytes (nonce):", Array.from(bcsData.slice(1)));
                          
                          // Test 3: The actual difference
                          console.log("\n--- Test 3: Why they're different ---");
                          console.log("View function uses: vector::singleton(move) + nonce");
                          console.log("Reveal function uses: bcs::to_bytes(move) + nonce");
                          console.log("For u8, bcs::to_bytes just returns the single byte");
                          console.log("So the issue is the VIEW FUNCTION IS WRONG!");
                          
                          console.log("=== END DEBUG ===\n");
                          setError("🔍 Check browser console (F12) for debug output");
                          
                        } catch (error) {
                          console.error("Debug failed:", error);
                          setError("Debug failed - check console");
                        }
                      }}
                      disabled={!committedMove}
                      className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                    >
                      🔍 Debug Hash
                    </button>
                  </div>
                  
                  <button
                    onClick={() => {
                      setGameId("");
                      setGameInfo(null);
                      setGameMoves(null);
                      setSelectedMove(null);
                      setCommittedMove(null);
                      setCommittedNonce("");
                      setError("🚫 Left game. You can create a new game.");
                      setActiveTab("create");
                    }}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
                  >
                    🚫 Leave Game
                  </button>
                </div>
              </div>
            )}

            {gameInfo.phase === PHASES.FINISHED && (
              <div className="text-center">
                <button
                  onClick={() => {
                    setGameId("");
                    setGameInfo(null);
                    setGameMoves(null);
                    setSelectedMove(null);
                    setCommittedMove(null);
                    setCommittedNonce("");
                    setError("");
                    setCreatedGameId("");
                    setActiveTab("create");
                  }}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  Start New Game
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Component for displaying user's active game cards
function MyGameCard({ 
  gameId, 
  onPlay, 
  onCancel,
  onRemove,
  loading, 
  getGameDetails,
  currentUserAddress,
  isCurrentGame
}: { 
  gameId: string; 
  onPlay: () => void; 
  onCancel: () => void;
  onRemove?: () => void;
  loading: boolean;
  getGameDetails: (id: string) => Promise<any>;
  currentUserAddress?: string;
  isCurrentGame: boolean;
}) {
  const [gameDetails, setGameDetails] = useState<any>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      const details = await getGameDetails(gameId);
      setGameDetails(details);
    };
    fetchDetails();
  }, [gameId]);

  const formatApt = (octas: number): string => {
    return `${(octas / 100000000).toFixed(4)} APT`;
  };

  const getStatusIcon = () => {
    if (!gameDetails) return "⏳";
    
    switch(gameDetails.phase) {
      case 0: return "⏳"; // WAITING
      case 1: return "🎯"; // COMMIT
      case 2: return "🔍"; // REVEAL
      case 3: return "🏁"; // FINISHED
      default: return "🎮";
    }
  };

  const getStatusText = () => {
    if (!gameDetails || !currentUserAddress) return "Loading...";
    
    const isPlayer1 = gameDetails.player1 === currentUserAddress;
    
    switch(gameDetails.phase) {
      case 0: // WAITING
        if (isPlayer1) return "Waiting for opponent to join";
        return "Waiting for players";
      case 1: // COMMIT
        return "Players choosing moves";
      case 2: // REVEAL
        return "⚠️ Revealing moves (may be stuck)";
      case 3: // FINISHED
        return "Game finished";
      default:
        return "Unknown status";
    }
  };

  const getActionText = () => {
    if (!gameDetails || !currentUserAddress) return "Loading...";
    
    const isPlayer1 = gameDetails.player1 === currentUserAddress;
    const isParticipant = isPlayer1 || gameDetails.player2 === currentUserAddress;
    
    switch(gameDetails.phase) {
      case 0: // WAITING
        return gameDetails.player2 === null ? "Waiting for players" : "Ready to start";
      case 1: // COMMIT
        // Only show "Your turn" if user is a participant and we don't know if they've committed
        // For simplicity, we'll show "Playing..." since we can't easily check commitment status here
        return isParticipant ? "Playing..." : "In progress";
      case 2: // REVEAL
        return "Revealing moves...";
      case 3: // FINISHED
        return "View results";
      default:
        return "Play";
    }
  };

  if (!gameDetails) {
    return (
      <div className="flex items-center justify-center bg-gray-50 rounded-lg p-4 border">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const canCancel = gameDetails.creator === currentUserAddress && gameDetails.phase === 0 && !gameDetails.player2;

  return (
    <div className={`rounded-lg p-4 border-2 ${
      isCurrentGame 
        ? 'border-blue-500 bg-blue-50' 
        : 'border-gray-200 bg-gray-50'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="text-3xl">{getStatusIcon()}</div>
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <p className="font-mono text-xl font-bold text-blue-600">{gameId}</p>
              {isCurrentGame && (
                <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  Current Game
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">{getStatusText()}</p>
            <p className="text-sm text-gray-500">
              Bet: {formatApt(gameDetails.betAmount)} • Prize: {formatApt(gameDetails.betAmount * 2)} • 
              Players: {gameDetails.player2 !== null ? ' 2/2' : ' 1/2'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              You are: {gameDetails.player1 === currentUserAddress ? 'Player 1' : 'Player 2'} • 
              Role: {gameDetails.creator === currentUserAddress ? ' Creator' : ' Joined'}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col space-y-2">
          <button
            onClick={onPlay}
            disabled={loading}
            className={`px-4 py-2 rounded font-semibold disabled:opacity-50 ${
              isCurrentGame 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {loading ? "Loading..." : 
             isCurrentGame ? "🎮 Playing" : 
             `▶️ ${getActionText()}`}
          </button>
          
          {canCancel && (
            <button
              onClick={onCancel}
              disabled={loading}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-1 rounded text-sm font-semibold disabled:opacity-50"
            >
              {loading ? "..." : "❌ Cancel"}
            </button>
          )}
          
          {/* Show abandon option for stuck reveal games */}
          {gameDetails.phase === 2 && !isCurrentGame && onRemove && (
            <button
              onClick={onRemove}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-1 rounded text-sm font-semibold"
            >
              🗑️ Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Component for displaying public game cards
function PublicGameCard({ 
  gameId, 
  onJoin, 
  onCancel,
  loading, 
  getGameDetails,
  currentUserAddress
}: { 
  gameId: string; 
  onJoin: () => void; 
  onCancel: () => void;
  loading: boolean;
  getGameDetails: (id: string) => Promise<any>;
  currentUserAddress?: string;
}) {
  const [gameDetails, setGameDetails] = useState<any>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      const details = await getGameDetails(gameId);
      setGameDetails(details);
    };
    fetchDetails();
  }, [gameId]);

  const formatApt = (octas: number): string => {
    return `${(octas / 100000000).toFixed(4)} APT`;
  };

  if (!gameDetails) {
    return (
      <div className="flex items-center justify-center bg-gray-50 rounded-lg p-4 border">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border">
      <div className="flex items-center space-x-4">
        <div className="text-2xl">🎮</div>
        <div>
          <p className="font-mono text-lg font-bold text-blue-600">{gameId}</p>
          <p className="text-sm text-gray-500">
            Bet: {formatApt(gameDetails.betAmount)} • Prize: {formatApt(gameDetails.betAmount * 2)}
          </p>
          <p className="text-xs text-gray-400">
            Players: {gameDetails.player2 !== null ? '2/2' : '1/2'}
          </p>
        </div>
      </div>
      {currentUserAddress && gameDetails.creator === currentUserAddress && !gameDetails.player2 ? (
        <button
          onClick={onCancel}
          disabled={loading}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold disabled:opacity-50"
        >
          {loading ? "Cancelling..." : "❌ Cancel"}
        </button>
      ) : (
        <button
          onClick={onJoin}
          disabled={loading || gameDetails.player2 !== null}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-semibold disabled:opacity-50"
        >
          {loading ? "Joining..." : 
           gameDetails.player2 !== null ? "Full" : 
           `Join (${formatApt(gameDetails.betAmount)})`}
        </button>
      )}
    </div>
  );
} 