import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface JackpotDisplayProps {
  amount?: number;
  className?: string;
}

export default function JackpotDisplay({ amount, className = '' }: JackpotDisplayProps) {
  const [displayAmount, setDisplayAmount] = useState('0.00');

  useEffect(() => {
    if (amount) {
      setDisplayAmount(amount.toFixed(4));
    }
  }, [amount]);

  return (
    <motion.div
      className={`bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg p-6 text-center shadow-lg ${className}`}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold text-white mb-2">🎰 JACKPOT</h2>
      <motion.div
        className="text-4xl font-bold text-white"
        key={displayAmount}
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {displayAmount} ETH
      </motion.div>
      <p className="text-yellow-100 mt-2">Next winner in progress...</p>
    </motion.div>
  );
}