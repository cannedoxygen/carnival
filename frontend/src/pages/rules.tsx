import React from 'react';
import Navigation from '../components/ui/Navigation';

export default function Rules() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-400 to-orange-500">
      <Navigation />
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-xl p-8 shadow-lg">
          <h1 className="text-4xl font-bold mb-6 text-center">Game Rules</h1>
          <div className="space-y-6">
            <section>
              <h2 className="text-2xl font-bold mb-4">How to Play</h2>
              <ol className="list-decimal list-inside space-y-2">
                <li>Connect your wallet or use demo mode</li>
                <li>Choose a key: Bronze, Silver, or Gold</li>
                <li>Select one of three doors</li>
                <li>Wait for the random reveal!</li>
              </ol>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}