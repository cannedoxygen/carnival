import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useSound } from '../../hooks/useSound';

interface DoorSelectionProps {
  onDoorSelect: (doorNumber: number) => void;
  isSelecting: boolean;
  selectedKey?: 'BRONZE' | 'SILVER' | 'GOLD';
}

const doors = [
  {
    id: 1,
    character: 'Homer',
    color: 'bg-yellow-400',
    image: '/assets/characters/homer-door.png',
    hoverSound: 'doh.mp3',
    description: 'Homer\'s Donut Door'
  },
  {
    id: 2,
    character: 'Bart',
    color: 'bg-orange-400',
    image: '/assets/characters/bart-door.png',
    hoverSound: 'cowabunga.mp3',
    description: 'Bart\'s Skateboard Door'
  },
  {
    id: 3,
    character: 'Marge',
    color: 'bg-blue-400',
    image: '/assets/characters/marge-door.png',
    hoverSound: 'hmm.mp3',
    description: 'Marge\'s Blue Door'
  }
];

export const DoorSelection: React.FC<DoorSelectionProps> = ({ 
  onDoorSelect, 
  isSelecting,
  selectedKey 
}) => {
  const [hoveredDoor, setHoveredDoor] = useState<number | null>(null);
  const [selectedDoor, setSelectedDoor] = useState<number | null>(null);
  const { playSound } = useSound();

  const handleDoorClick = (doorId: number) => {
    if (!isSelecting || selectedDoor !== null) return;
    
    setSelectedDoor(doorId);
    playSound('door-select.mp3');
    
    // Animate before calling the callback
    setTimeout(() => {
      onDoorSelect(doorId);
    }, 500);
  };

  const handleDoorHover = (doorId: number) => {
    if (!isSelecting || selectedDoor !== null) return;
    setHoveredDoor(doorId);
    const door = doors.find(d => d.id === doorId);
    if (door) {
      playSound(door.hoverSound);
    }
  };

  const getKeyGlow = () => {
    switch (selectedKey) {
      case 'BRONZE':
        return 'shadow-bronze';
      case 'SILVER':
        return 'shadow-silver';
      case 'GOLD':
        return 'shadow-gold';
      default:
        return '';
    }
  };

  return (
    <div className="relative w-full max-w-6xl mx-auto p-8">
      {/* Title and Instructions */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h2 className="text-4xl font-bold text-yellow-400 mb-4 font-simpsons">
          Choose Your Door!
        </h2>
        <p className="text-white text-lg">
          {isSelecting ? 
            `Use your ${selectedKey} key to unlock a door!` : 
            'Purchase a key to start playing!'
          }
        </p>
      </motion.div>

      {/* Door Container */}
      <div className="grid grid-cols-3 gap-8">
        {doors.map((door, index) => (
          <motion.div
            key={door.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.2 }}
            className="relative"
          >
            <motion.div
              className={`
                relative w-full h-96 rounded-t-3xl cursor-pointer
                ${door.color} ${isSelecting ? 'hover:brightness-110' : 'opacity-50'}
                ${selectedDoor === door.id ? 'ring-4 ring-white' : ''}
                ${hoveredDoor === door.id && isSelecting ? getKeyGlow() : ''}
                transition-all duration-300
              `}
              whileHover={isSelecting ? { scale: 1.05 } : {}}
              whileTap={isSelecting ? { scale: 0.95 } : {}}
              onClick={() => handleDoorClick(door.id)}
              onMouseEnter={() => handleDoorHover(door.id)}
              onMouseLeave={() => setHoveredDoor(null)}
            >
              {/* Door Frame */}
              <div className="absolute inset-0 border-8 border-brown-600 rounded-t-3xl">
                {/* Door Number */}
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center border-4 border-brown-800">
                    <span className="text-2xl font-bold text-brown-800">{door.id}</span>
                  </div>
                </div>

                {/* Door Handle */}
                <div className="absolute right-6 top-1/2 transform -translate-y-1/2">
                  <motion.div
                    animate={selectedDoor === door.id ? { rotate: 45 } : { rotate: 0 }}
                    className="w-8 h-16 bg-yellow-600 rounded-full border-2 border-yellow-800"
                  />
                </div>

                {/* Character Silhouette or Image */}
                <AnimatePresence>
                  {hoveredDoor === door.id && isSelecting && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <div className="text-6xl opacity-20">?</div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Door Opening Animation */}
                <AnimatePresence>
                  {selectedDoor === door.id && (
                    <motion.div
                      initial={{ scaleX: 1 }}
                      animate={{ scaleX: 0 }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                      className="absolute inset-0 bg-black origin-right rounded-t-3xl"
                    />
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Door Label */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.2 + 0.3 }}
              className="mt-4 text-center"
            >
              <h3 className="text-xl font-bold text-white">{door.description}</h3>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Floating Key Animation */}
      {isSelecting && selectedKey && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-0 right-0 pointer-events-none"
        >
          <motion.div
            animate={{ 
              y: [0, -10, 0],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className={`
              w-16 h-16 rounded-full flex items-center justify-center
              ${selectedKey === 'BRONZE' ? 'bg-bronze-500' : ''}
              ${selectedKey === 'SILVER' ? 'bg-silver-500' : ''}
              ${selectedKey === 'GOLD' ? 'bg-gold-500' : ''}
            `}
          >
            =Ý
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};