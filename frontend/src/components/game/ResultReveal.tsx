import React from 'react';
import { motion } from 'framer-motion';

interface ResultRevealProps {
  result: 'win' | 'lose' | 'breakeven';
  doorNumber: number;
  onPlayAgain: () => void;
  isRevealing?: boolean;
}

export default function ResultReveal({ result, doorNumber, onPlayAgain, isRevealing }: ResultRevealProps) {
  const resultConfig = {
    win: { emoji: '🎉', message: 'You Won!', color: 'text-green-600' },
    lose: { emoji: '😭', message: 'You Lost!', color: 'text-red-600' },
    breakeven: { emoji: '😐', message: 'Break Even!', color: 'text-yellow-600' },
  };

  const config = resultConfig[result];

  if (isRevealing) {
    return (
      <div className="text-center p-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-6xl mb-4"
        >
          🎲
        </motion.div>
        <h2 className="text-2xl font-bold">Revealing door {doorNumber}...</h2>
      </div>
    );
  }

  return (
    <motion.div
      className="text-center p-8"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="text-8xl mb-4">{config.emoji}</div>
      <h2 className={`text-4xl font-bold mb-4 ${config.color}`}>{config.message}</h2>
      <p className="text-xl mb-8">Behind door {doorNumber}</p>
      
      <motion.button
        onClick={onPlayAgain}
        className="bg-blue-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-600 transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        Play Again! 🎪
      </motion.button>
    </motion.div>
  );
}