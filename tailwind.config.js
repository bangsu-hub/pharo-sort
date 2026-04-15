/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'Noto Sans KR', 'sans-serif'],
      },
      keyframes: {
        confetti: {
          '0%':   { transform: 'translateY(-10px) rotate(0deg)',   opacity: '1' },
          '100%': { transform: 'translateY(400px) rotate(720deg)', opacity: '0' },
        },
      },
      animation: {
        confetti: 'confetti 1.6s ease-in forwards',
      },
    },
  },
  plugins: [],
}
