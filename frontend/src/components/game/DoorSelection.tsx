import React from 'react';
import { motion } from 'framer-motion';

interface DoorSelectionProps {
  keyType: string;
  onSelect: (doorNumber: number) => void;
  isLoading?: boolean;
}

export default function DoorSelection({ keyType, onSelect, isLoading }: DoorSelectionProps) {
  const doors = [
    { id: 1, name: "Moe's Tavern", emoji: "🍺", color: "bg-amber-600" },
    { id: 2, name: "Kwik-E-Mart", emoji: "🏪", color: "bg-blue-600" },
    { id: 3, name: "Nuclear Plant", emoji: "☢️", color: "bg-green-600" }
  ];

  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold mb-6">Choose Your Door!</h2>
      <p className="mb-8 text-lg">Using {keyType} key - pick a door and see what's behind it!</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {doors.map((door) => (
          <motion.button
            key={door.id}
            onClick={() => !isLoading && onSelect(door.id)}
            disabled={isLoading}
            className={`${door.color} text-white p-8 rounded-xl text-center hover:opacity-80 transition-opacity disabled:opacity-50`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: door.id * 0.1 }}
          >
            <div className="text-6xl mb-4">{door.emoji}</div>
            <h3 className="text-xl font-bold">{door.name}</h3>
            {isLoading && <div className="mt-2">🎲 Rolling...</div>}
          </motion.button>
        ))}
      </div>
    </div>
  );
}