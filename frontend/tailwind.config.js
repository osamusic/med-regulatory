/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // 'media'か'class'を選択可能、'class'はJavaScriptで切り替え可能
  theme: {
    extend: {},
  },
  plugins: [],
}
