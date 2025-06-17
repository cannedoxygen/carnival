import React from 'react';
import Link from 'next/link';

export default function Navigation() {
  return (
    <nav className="bg-red-600 text-white p-4">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold">
          🎪 Simpsons Carnival
        </Link>
        <div className="flex gap-4">
          <Link href="/" className="hover:text-yellow-300">
            Game
          </Link>
          <Link href="/rules" className="hover:text-yellow-300">
            Rules
          </Link>
          <Link href="/history" className="hover:text-yellow-300">
            History
          </Link>
        </div>
      </div>
    </nav>
  );
}