/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Simpsons-inspired color palette
        'simpsons-yellow': '#FFD700',
        'simpsons-blue': '#5DADE2',
        'simpsons-red': '#E74C3C',
        'simpsons-green': '#27AE60',
        'simpsons-orange': '#FF8C00',
        'simpsons-purple': '#8E44AD',
        'simpson-skin': '#FFDB9E',
        'duff-blue': '#1E3A8A',
        'springfield-green': '#16A085',
        
        // Game-specific colors
        'carnival-red': '#DC143C',
        'carnival-gold': '#FFD700',
        'carnival-blue': '#4169E1',
        'jackpot-glow': '#FFA500',
        
        // Key colors
        'bronze': '#CD7F32',
        'silver': '#C0C0C0',
        'gold': '#FFD700',
        
        // UI colors
        'success': '#10B981',
        'warning': '#F59E0B',
        'error': '#EF4444',
        'info': '#3B82F6',
      },
      fontFamily: {
        'simpsons': ['Arial Black', 'sans-serif'],
        'comic': ['Comic Sans MS', 'cursive'],
        'mono': ['Courier New', 'monospace'],
      },
      backgroundImage: {
        'carnival-gradient': 'linear-gradient(45deg, #FFD700, #FF8C00, #DC143C)',
        'jackpot-gradient': 'linear-gradient(90deg, #FFD700, #FFA500, #FF8C00)',
        'win-gradient': 'linear-gradient(45deg, #10B981, #16A085)',
        'lose-gradient': 'linear-gradient(45deg, #EF4444, #DC143C)',
        'door-gradient': 'linear-gradient(180deg, #8B4513, #654321)',
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-fast': 'pulse 1s infinite',
        'spin-slow': 'spin 3s linear infinite',
        'jackpot-glow': 'jackpot-glow 2s ease-in-out infinite alternate',
        'door-shake': 'door-shake 0.5s ease-in-out',
        'coin-flip': 'coin-flip 1s ease-in-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
      },
      keyframes: {
        'jackpot-glow': {
          '0%': { 
            boxShadow: '0 0 5px #FFD700, 0 0 10px #FFD700, 0 0 15px #FFD700',
            transform: 'scale(1)'
          },
          '100%': { 
            boxShadow: '0 0 10px #FFA500, 0 0 20px #FFA500, 0 0 30px #FFA500',
            transform: 'scale(1.05)'
          },
        },
        'door-shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-2px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(2px)' },
        },
        'coin-flip': {
          '0%': { transform: 'rotateY(0deg)' },
          '50%': { transform: 'rotateY(180deg)' },
          '100%': { transform: 'rotateY(360deg)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      boxShadow: {
        'glow': '0 0 20px rgba(255, 215, 0, 0.5)',
        'glow-lg': '0 0 40px rgba(255, 215, 0, 0.7)',
        'door': '0 4px 8px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.1)',
        'key': '0 2px 4px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.1)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      screens: {
        'xs': '475px',
        '3xl': '1600px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    // Custom plugin for game-specific utilities
    function({ addUtilities, addComponents, theme }) {
      const newUtilities = {
        '.text-glow': {
          textShadow: '0 0 10px currentColor',
        },
        '.text-glow-lg': {
          textShadow: '0 0 20px currentColor, 0 0 30px currentColor',
        },
        '.backdrop-carnival': {
          backdropFilter: 'blur(10px) saturate(150%)',
        },
        '.perspective-1000': {
          perspective: '1000px',
        },
        '.transform-3d': {
          transformStyle: 'preserve-3d',
        },
        '.rotate-y-180': {
          transform: 'rotateY(180deg)',
        },
        '.backface-hidden': {
          backfaceVisibility: 'hidden',
        },
      };

      const newComponents = {
        '.btn-carnival': {
          '@apply bg-carnival-gradient text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-glow transition-all duration-300 transform hover:scale-105': {},
        },
        '.btn-key': {
          '@apply relative overflow-hidden rounded-lg shadow-key transition-all duration-300 transform hover:scale-105 active:scale-95': {},
        },
        '.door-card': {
          '@apply bg-door-gradient rounded-2xl shadow-door border-4 border-yellow-600 transition-all duration-300 hover:shadow-glow': {},
        },
        '.jackpot-display': {
          '@apply bg-jackpot-gradient text-transparent bg-clip-text font-bold text-4xl md:text-6xl animate-jackpot-glow': {},
        },
        '.game-card': {
          '@apply bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6': {},
        },
        '.stat-card': {
          '@apply bg-gradient-to-br from-white/80 to-gray-50/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/30 p-4': {},
        },
      };

      addUtilities(newUtilities);
      addComponents(newComponents);
    },
  ],
  darkMode: 'class',
};