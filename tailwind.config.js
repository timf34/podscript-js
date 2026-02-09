/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "Times", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        speaker: {
          1: "#6B7BA8",
          2: "#C27B5C",
          3: "#7A9E7A",
          4: "#9B7BA8",
          5: "#A89B6B",
          6: "#5C9EC2",
        },
      },
    },
  },
  plugins: [],
};
