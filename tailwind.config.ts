import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      colors: {
        brand: {
          50: "#f0f9f4",
          100: "#dcf1e6",
          200: "#bbe3ce",
          300: "#8dcdb0",
          400: "#5ab28d",
          500: "#389671",
          600: "#29785b",
          700: "#22604a",
          800: "#1e4d3c",
          900: "#1a4032",
          950: "#0d231c",
        },
        surface: {
          DEFAULT: "#0f1a16",
          card: "#162019",
          elevated: "#1c2b22",
          border: "#2a3d31",
        },
      },
    },
  },
  plugins: [],
};

export default config;
