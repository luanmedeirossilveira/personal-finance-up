import type { Config } from "tailwindcss";

// Cores mapeadas para os tokens CSS de globals.css (dark/light).
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

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
        bg: token("bg"),
        surface: {
          DEFAULT: token("surface"),
          raised: token("surface-raised"),
        },
        line: token("border"),
        fg: {
          DEFAULT: token("text"),
          soft: token("text-soft"),
          muted: token("text-muted"),
        },
        accent: {
          DEFAULT: token("accent"),
          strong: token("accent-strong"),
          bg: token("accent-bg"),
        },
        positive: token("accent"),
        warning: token("warning"),
        negative: token("negative"),
      },
    },
  },
  plugins: [],
};

export default config;
