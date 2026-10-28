/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        rounded: [
          "Nunito",
          "ui-rounded",
          "Hiragino Maru Gothic ProN",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
