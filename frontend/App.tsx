import { useWallet } from "@aptos-labs/wallet-adapter-react";
// Internal Components
import { Header } from "@/components/Header";
import { RockPaperScissorsGame } from "@/components/RockPaperScissorsGame";

function App() {
  const { connected } = useWallet();

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        {connected ? (
          <RockPaperScissorsGame />
        ) : (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
              <h1 className="text-3xl font-bold text-gray-800 mb-4">
                🪨📄✂️ Rock Paper Scissors
              </h1>
              <p className="text-gray-600 mb-6">
                A decentralized rock paper scissors game built on Aptos blockchain with provably fair gameplay.
              </p>
              <p className="text-lg font-semibold text-blue-600">
                Connect your wallet to start playing!
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
