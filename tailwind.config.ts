import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "var(--navy-950)",
          900: "var(--navy-900)",
          850: "var(--navy-850)",
          800: "var(--navy-800)",
          700: "var(--navy-700)",
        },
        signal: {
          DEFAULT: "var(--signal)",
          dim: "var(--signal-dim)",
        },
        ice: "var(--ice)",
        muted: "var(--muted)",
        warning: "var(--warning)",
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      boxShadow: {
        panel: "0 20px 60px rgba(0, 0, 0, 0.4)",
        signal: "0 0 0 1px var(--signal-dim), 0 0 28px rgba(166, 232, 107, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
