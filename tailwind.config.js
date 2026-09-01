/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bat: {
          bg: '#0a0a0a',
          surface: '#141414',
          elevated: '#1c1c1c',
          border: '#2a2a2a',
          stripe: '#1a1a1a',
          orange: '#ff6b00',
          orangeHot: '#ff8500',
          orangeDim: '#cc5500',
          text: '#f5f5f5',
          muted: '#888888',
          danger: '#ef4444',
          success: '#22c55e',
        },
      },
      backgroundImage: {
        'stripe-diag': 'repeating-linear-gradient(-45deg, #0a0a0a, #0a0a0a 8px, #141414 8px, #141414 16px)',
      },
    },
  },
  plugins: [],
}
