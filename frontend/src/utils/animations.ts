import { Variants } from 'framer-motion';

// Common animation variants for reuse across components
export const fadeInUp: Variants = {
  initial: { 
    opacity: 0, 
    y: 20 
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut"
    }
  },
  exit: { 
    opacity: 0, 
    y: -20,
    transition: {
      duration: 0.3
    }
  }
};

export const fadeInDown: Variants = {
  initial: { 
    opacity: 0, 
    y: -20 
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut"
    }
  },
  exit: { 
    opacity: 0, 
    y: 20,
    transition: {
      duration: 0.3
    }
  }
};

export const fadeInScale: Variants = {
  initial: { 
    opacity: 0, 
    scale: 0.8 
  },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: {
      duration: 0.4,
      ease: "easeOut"
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.8,
    transition: {
      duration: 0.3
    }
  }
};

export const slideInLeft: Variants = {
  initial: { 
    opacity: 0, 
    x: -50 
  },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut"
    }
  },
  exit: { 
    opacity: 0, 
    x: -50,
    transition: {
      duration: 0.3
    }
  }
};

export const slideInRight: Variants = {
  initial: { 
    opacity: 0, 
    x: 50 
  },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut"
    }
  },
  exit: { 
    opacity: 0, 
    x: 50,
    transition: {
      duration: 0.3
    }
  }
};

// Springfield/Simpsons themed animations
export const springyBounce: Variants = {
  initial: { 
    scale: 0,
    rotate: -180
  },
  animate: { 
    scale: 1,
    rotate: 0,
    transition: {
      type: "spring",
      damping: 8,
      stiffness: 100,
      duration: 0.8
    }
  },
  exit: { 
    scale: 0,
    rotate: 180,
    transition: {
      duration: 0.4
    }
  }
};

export const wobble: Variants = {
  animate: {
    rotate: [0, -5, 5, -5, 5, 0],
    transition: {
      duration: 0.6,
      ease: "easeInOut"
    }
  }
};

export const pulse: Variants = {
  animate: {
    scale: [1, 1.1, 1],
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

export const float: Variants = {
  animate: {
    y: [0, -10, 0],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

export const spin: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

// Door opening animation
export const doorOpen: Variants = {
  initial: { 
    scaleX: 1,
    originX: 1
  },
  animate: { 
    scaleX: 0,
    transition: {
      duration: 0.8,
      ease: "easeInOut"
    }
  }
};

// Key selection animation
export const keyGlow: Variants = {
  animate: {
    boxShadow: [
      "0 0 0px rgba(255, 215, 0, 0)",
      "0 0 20px rgba(255, 215, 0, 0.8)",
      "0 0 0px rgba(255, 215, 0, 0)"
    ],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

// Jackpot celebration animation
export const jackpotCelebration: Variants = {
  animate: {
    scale: [1, 1.1, 1.05, 1.1, 1],
    rotate: [0, -2, 2, -2, 0],
    textShadow: [
      "0 0 0px rgba(255, 215, 0, 0)",
      "0 0 20px rgba(255, 215, 0, 1)",
      "0 0 40px rgba(255, 215, 0, 0.8)",
      "0 0 20px rgba(255, 215, 0, 1)",
      "0 0 0px rgba(255, 215, 0, 0)"
    ],
    transition: {
      duration: 2,
      repeat: 3,
      ease: "easeInOut"
    }
  }
};

// Staggered container animations
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  },
  exit: {
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1
    }
  }
};

export const staggerItem: Variants = {
  initial: { 
    opacity: 0, 
    y: 20 
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut"
    }
  },
  exit: { 
    opacity: 0, 
    y: -20,
    transition: {
      duration: 0.3
    }
  }
};

// Loading spinner
export const loadingSpinner: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

// Button hover effects
export const buttonHover = {
  whileHover: { 
    scale: 1.05,
    transition: { duration: 0.2 }
  },
  whileTap: { 
    scale: 0.95,
    transition: { duration: 0.1 }
  }
};

export const buttonGlow = {
  whileHover: {
    boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)",
    transition: { duration: 0.3 }
  }
};

// Card animations
export const cardHover = {
  whileHover: { 
    y: -10,
    scale: 1.02,
    transition: { 
      duration: 0.3,
      ease: "easeOut"
    }
  }
};

// Text animations
export const typewriter = (text: string, delay: number = 0.05) => ({
  animate: {
    transition: {
      staggerChildren: delay
    }
  }
});

export const typewriterChar: Variants = {
  initial: { opacity: 0 },
  animate: { 
    opacity: 1,
    transition: {
      duration: 0.1
    }
  }
};

// Error shake animation
export const errorShake: Variants = {
  animate: {
    x: [0, -10, 10, -10, 10, 0],
    transition: {
      duration: 0.5,
      ease: "easeInOut"
    }
  }
};

// Success checkmark animation
export const successPop: Variants = {
  initial: { 
    scale: 0,
    rotate: -180
  },
  animate: { 
    scale: [0, 1.2, 1],
    rotate: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut"
    }
  }
};

// Confetti burst animation
export const confettiBurst = (count: number = 20) => {
  return Array.from({ length: count }, (_, i) => ({
    initial: {
      x: 0,
      y: 0,
      opacity: 1,
      scale: 1,
      rotate: 0
    },
    animate: {
      x: (Math.random() - 0.5) * 400,
      y: Math.random() * -200 - 100,
      opacity: 0,
      scale: Math.random() * 0.5 + 0.5,
      rotate: Math.random() * 360,
      transition: {
        duration: 2 + Math.random(),
        ease: "easeOut"
      }
    }
  }));
};

// Helper function to create random floating elements
export const createFloatingElements = (count: number = 10) => {
  return Array.from({ length: count }, (_, i) => ({
    animate: {
      x: [
        Math.random() * window.innerWidth,
        Math.random() * window.innerWidth
      ],
      y: [
        window.innerHeight + 50,
        -50
      ],
      rotate: [0, 360],
      opacity: [0, 1, 0],
      transition: {
        duration: 5 + Math.random() * 5,
        delay: Math.random() * 2,
        repeat: Infinity,
        ease: "linear"
      }
    }
  }));
};