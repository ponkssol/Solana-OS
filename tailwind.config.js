/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        solos: {
          green: '#14f195',
          purple: '#9945ff',
          cyan: '#38bdf8',
          navy: '#0b1536',
          indigo: '#1e1b4b',
          obsidian: '#090d16',
          magenta: '#ec4899',
          amber: '#f59e0b',
          rose: '#f43f5e',
        },
        traffic: {
          close: '#FF5F56',
          minimize: '#FFBD2E',
          maximize: '#27C93F',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Inter"',
          '"SF Pro Display"',
          '"Segoe UI"',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"SF Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
      backdropBlur: {
        os: '32px',
        dock: '34px',
      },
    },
  },
  plugins: [],
};
