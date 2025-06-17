import React from 'react';
import Navigation from '../components/ui/Navigation';

export default function History() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-400 to-orange-500">
      <Navigation />
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-xl p-8 shadow-lg">
          <h1 className="text-4xl font-bold mb-6 text-center">Game History</h1>
          <div className="text-center text-gray-600">
            <p>Connect your wallet to view your game history!</p>
          </div>
        </div>
      </div>
    </div>
  );
}