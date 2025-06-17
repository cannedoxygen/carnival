import React from 'react';

export default function Leaderboard() {
  return (
    <div className="bg-white rounded-lg p-6 shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">🏆 Leaderboard</h2>
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((rank) => (
          <div key={rank} className="flex justify-between items-center p-3 bg-gray-100 rounded">
            <div className="flex items-center gap-3">
              <span className="font-bold text-lg">#{rank}</span>
              <span>0x{Math.random().toString(16).substr(2, 8)}...</span>
            </div>
            <span className="text-green-600 font-bold">{(Math.random() * 10).toFixed(2)} ETH</span>
          </div>
        ))}
      </div>
    </div>
  );
}