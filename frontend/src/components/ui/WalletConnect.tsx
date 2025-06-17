import React from 'react';
import { motion } from 'framer-motion';

export default function WalletConnect() {
  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h3 className="text-xl font-bold text-center">Connect Your Wallet</h3>
      <div className="grid gap-3">
        <button
          onClick={() => alert('MetaMask connection coming soon!')}
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors font-bold"
        >
          Connect MetaMask
        </button>
        <button
          onClick={() => alert('WalletConnect coming soon!')}
          className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors font-bold"
        >
          Connect Wallet
        </button>
      </div>
    </motion.div>
  );
}