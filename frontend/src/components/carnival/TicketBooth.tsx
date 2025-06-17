import React from 'react';
import { motion } from 'framer-motion';

interface TicketBoothProps {
  onEnter: () => void;
}

export default function TicketBooth({ onEnter }: TicketBoothProps) {
  return (
    <motion.div
      className="text-center p-8 bg-gradient-to-b from-red-500 to-red-700 rounded-xl text-white"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <h2 className="text-4xl font-bold mb-4">🎪 Welcome to the Carnival!</h2>
      <p className="text-xl mb-6">Step right up and try your luck at Springfield's finest!</p>
      <motion.button
        onClick={onEnter}
        className="bg-yellow-400 text-red-800 font-bold py-4 px-8 rounded-full text-xl hover:bg-yellow-300 transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        🎫 Enter the Game!
      </motion.button>
    </motion.div>
  );
}