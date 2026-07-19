import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        aqua: '#00C1C1',
        yellowBrand: '#F8F700',
      },
      fontFamily: {
        title: ['Soulking', 'Georgia', 'serif'],
        body: ['Mulish', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
