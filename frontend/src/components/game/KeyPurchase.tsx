import React from 'react';
import { motion } from 'framer-motion';

interface KeyPurchaseProps {
  onPurchase: (keyType: 'bronze' | 'silver' | 'gold') => void;
}

export default function KeyPurchase({ onPurchase }: KeyPurchaseProps) {
  const keys = [
    { type: 'bronze' as const, price: '0.005 ETH', color: 'bg-orange-600', emoji: '🗝️' },
    { type: 'silver' as const, price: '0.01 ETH', color: 'bg-gray-400', emoji: '🔑' },
    { type: 'gold' as const, price: '0.025 ETH', color: 'bg-yellow-500', emoji: '🗝️' },
  ];

  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold mb-6">Choose Your Key</h2>
      <p className="mb-8 text-lg">Select a key to enter the game!</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {keys.map((key) => (
          <motion.button
            key={key.type}
            onClick={() => onPurchase(key.type)}
            className={`${key.color} text-white p-6 rounded-xl hover:opacity-80 transition-opacity`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: keys.indexOf(key) * 0.1 }}
          >
            <div className="text-4xl mb-4">{key.emoji}</div>
            <h3 className="text-xl font-bold capitalize">{key.type} Key</h3>
            <p className="text-lg">{key.price}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}