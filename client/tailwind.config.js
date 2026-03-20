/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono:    ['"Share Tech Mono"', '"Courier New"', 'monospace'],
        display: ['"Orbitron"', '"Share Tech Mono"', 'monospace'],
      },
      colors: {
        reactor: {
          bg:      '#080c14',
          surface: '#0d1320',
          s2:      '#121a2b',
          s3:      '#1a2438',
          border:  '#1e3050',
          b2:      '#2a4060',
        },
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.45' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.15' },
        },
      },
      animation: {
        'pulse-slow': 'pulseGlow 2s ease-in-out infinite',
        'pulse-fast': 'pulseGlow 0.8s ease-in-out infinite',
        'blink':      'blink 1s ease-in-out infinite',
        'blink-fast': 'blink 0.5s ease-in-out infinite',
      },
      boxShadow: {
        'glow-green':  '0 0 10px rgba(52,211,153,.55), 0 0 30px rgba(52,211,153,.2)',
        'glow-red':    '0 0 10px rgba(251,113,133,.55), 0 0 30px rgba(251,113,133,.2)',
        'glow-yellow': '0 0 10px rgba(251,191,36,.55),  0 0 30px rgba(251,191,36,.2)',
        'glow-blue':   '0 0 10px rgba(56,189,248,.55),  0 0 30px rgba(56,189,248,.2)',
        'glow-teal':   '0 0 10px rgba(45,212,191,.55),  0 0 30px rgba(45,212,191,.2)',
      },
    },
  },
  plugins: [],
};
