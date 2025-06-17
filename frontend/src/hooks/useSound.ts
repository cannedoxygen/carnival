import { useCallback } from 'react';

export function useSound() {
  const playSound = useCallback((soundName: string, options?: { loop?: boolean; volume?: number }) => {
    // No-op for now - sounds disabled for deployment
  }, []);

  return { playSound };
}