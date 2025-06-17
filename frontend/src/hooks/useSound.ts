import { useState, useCallback, useRef, useEffect } from 'react';

interface SoundOptions {
  volume?: number;
  loop?: boolean;
  preload?: boolean;
}

interface SoundInstance {
  audio: HTMLAudioElement;
  isLoaded: boolean;
  isPlaying: boolean;
}

export const useSound = () => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [globalVolume, setGlobalVolume] = useState(0.5);
  const soundCache = useRef<Map<string, SoundInstance>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Preload commonly used sounds
  useEffect(() => {
    const commonSounds = [
      'click.mp3',
      'key-select.mp3',
      'door-select.mp3',
      'purchase.mp3',
      'success.mp3',
      'error.mp3',
      'connect.mp3',
      'disconnect.mp3',
      'jackpot-win.mp3'
    ];

    const preloadSounds = async () => {
      setIsLoading(true);
      const promises = commonSounds.map(sound => preloadSound(sound));
      await Promise.allSettled(promises);
      setIsLoading(false);
    };

    preloadSounds();
  }, []);

  const preloadSound = useCallback(async (soundPath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (soundCache.current.has(soundPath)) {
        resolve();
        return;
      }

      const audio = new Audio();
      const fullPath = `/assets/sounds/${soundPath}`;
      
      const handleLoad = () => {
        soundCache.current.set(soundPath, {
          audio,
          isLoaded: true,
          isPlaying: false
        });
        audio.removeEventListener('canplaythrough', handleLoad);
        audio.removeEventListener('error', handleError);
        resolve();
      };

      const handleError = () => {
        console.warn(`Failed to preload sound: ${soundPath}`);
        audio.removeEventListener('canplaythrough', handleLoad);
        audio.removeEventListener('error', handleError);
        // Still resolve to not block other sounds
        resolve();
      };

      audio.addEventListener('canplaythrough', handleLoad);
      audio.addEventListener('error', handleError);
      audio.preload = 'auto';
      audio.src = fullPath;
    });
  }, []);

  const playSound = useCallback(async (
    soundPath: string, 
    options: SoundOptions = {}
  ): Promise<void> => {
    if (!isEnabled) return;

    const {
      volume = 1,
      loop = false,
      preload = false
    } = options;

    try {
      let soundInstance = soundCache.current.get(soundPath);

      // If sound not cached and preload requested, load it first
      if (!soundInstance && preload) {
        await preloadSound(soundPath);
        soundInstance = soundCache.current.get(soundPath);
      }

      // If still not cached, create a new instance
      if (!soundInstance) {
        const audio = new Audio(`/assets/sounds/${soundPath}`);
        soundInstance = {
          audio,
          isLoaded: false,
          isPlaying: false
        };
        soundCache.current.set(soundPath, soundInstance);
      }

      const { audio } = soundInstance;

      // Stop current playback if playing
      if (soundInstance.isPlaying) {
        audio.pause();
        audio.currentTime = 0;
      }

      // Configure audio
      audio.volume = Math.min(1, Math.max(0, volume * globalVolume));
      audio.loop = loop;

      // Play the sound
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        soundInstance.isPlaying = true;
        
        playPromise
          .then(() => {
            // Sound started playing successfully
          })
          .catch((error) => {
            console.warn(`Failed to play sound ${soundPath}:`, error);
            soundInstance!.isPlaying = false;
          });

        // Handle end of playback
        const handleEnded = () => {
          soundInstance!.isPlaying = false;
          audio.removeEventListener('ended', handleEnded);
        };
        
        audio.addEventListener('ended', handleEnded);
      }
    } catch (error) {
      console.warn(`Error playing sound ${soundPath}:`, error);
    }
  }, [isEnabled, globalVolume, preloadSound]);

  const stopSound = useCallback((soundPath: string) => {
    const soundInstance = soundCache.current.get(soundPath);
    if (soundInstance && soundInstance.isPlaying) {
      soundInstance.audio.pause();
      soundInstance.audio.currentTime = 0;
      soundInstance.isPlaying = false;
    }
  }, []);

  const stopAllSounds = useCallback(() => {
    soundCache.current.forEach((soundInstance, soundPath) => {
      if (soundInstance.isPlaying) {
        stopSound(soundPath);
      }
    });
  }, [stopSound]);

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.min(1, Math.max(0, volume));
    setGlobalVolume(clampedVolume);
    
    // Update volume for all cached sounds
    soundCache.current.forEach((soundInstance) => {
      soundInstance.audio.volume = clampedVolume;
    });
  }, []);

  const toggleSound = useCallback(() => {
    setIsEnabled(prev => !prev);
    if (!isEnabled) {
      stopAllSounds();
    }
  }, [isEnabled, stopAllSounds]);

  // Simpsons-themed sound effects shortcuts
  const playSimpsonsSound = useCallback((character: string, action: string = 'default') => {
    const soundMap: Record<string, Record<string, string>> = {
      homer: {
        default: 'doh.mp3',
        win: 'woohoo.mp3',
        lose: 'doh.mp3',
        eat: 'mmm-beer.mp3'
      },
      bart: {
        default: 'cowabunga.mp3',
        win: 'eat-my-shorts.mp3',
        lose: 'ay-caramba.mp3'
      },
      marge: {
        default: 'hmm.mp3',
        worried: 'oh-homer.mp3'
      },
      burns: {
        default: 'excellent.mp3',
        win: 'excellent.mp3'
      },
      ralph: {
        default: 'me-fail-english.mp3',
        win: 'im-a-winner.mp3'
      },
      lisa: {
        default: 'saxophone.mp3'
      }
    };

    const soundFile = soundMap[character]?.[action] || soundMap[character]?.default;
    if (soundFile) {
      playSound(soundFile);
    }
  }, [playSound]);

  // Play background music
  const playBackgroundMusic = useCallback((musicFile: string, fadeIn: boolean = true) => {
    playSound(musicFile, { 
      loop: true, 
      volume: fadeIn ? 0.1 : 0.3,
      preload: true 
    });

    if (fadeIn) {
      // Gradually increase volume
      let currentVolume = 0.1;
      const fadeInterval = setInterval(() => {
        currentVolume += 0.05;
        if (currentVolume >= 0.3) {
          currentVolume = 0.3;
          clearInterval(fadeInterval);
        }
        const soundInstance = soundCache.current.get(musicFile);
        if (soundInstance) {
          soundInstance.audio.volume = currentVolume * globalVolume;
        }
      }, 100);
    }
  }, [playSound, globalVolume]);

  return {
    // Core functions
    playSound,
    stopSound,
    stopAllSounds,
    preloadSound,
    
    // Simpsons-specific
    playSimpsonsSound,
    playBackgroundMusic,
    
    // Settings
    isEnabled,
    globalVolume,
    setVolume,
    toggleSound,
    
    // State
    isLoading,
    soundCache: soundCache.current
  };
};