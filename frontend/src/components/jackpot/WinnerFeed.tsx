import React from 'react';

export default function WinnerFeed() {
  return (
    <div className="mt-8 bg-white rounded-lg p-4 shadow-lg">
      <h3 className="text-lg font-bold mb-4">🏆 Recent Winners</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>0x1234...5678</span>
          <span className="text-green-600">Won 2.5 ETH</span>
        </div>
        <div className="flex justify-between">
          <span>0xabcd...efgh</span>
          <span className="text-green-600">Won 1.8 ETH</span>
        </div>
      </div>
    </div>
  );
}