import { useWallet } from "@aptos-labs/wallet-adapter-react";

export function Header() {
  const { connect, disconnect, connected, account } = useWallet();

  return (
    <div className="flex items-center justify-between px-4 py-2 max-w-screen-xl mx-auto w-full flex-wrap">
      <h1 className="text-2xl font-bold text-gray-800">🪨📄✂️ Rock Paper Scissors</h1>

      <div className="flex gap-2 items-center flex-wrap">
        {connected ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {account?.address.slice(0, 8)}...
            </span>
            <button
              onClick={disconnect}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => connect("Petra" as any)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </div>
  );
}
