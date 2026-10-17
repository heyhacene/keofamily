import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef7ee',
          100: '#fdedd6',
          200: '#fbd7ac',
          300: '#f7ba77',
          400: '#f39440',
          500: '#ee7318',
          600: '#df560f',
          700: '#b9400f',
          800: '#933414',
          900: '#772d14',
        },
      },
    },
  },
  plugins: [],
};
export default config;
