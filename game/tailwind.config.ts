import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  theme: {
    extend: {},
  },
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  plugins: [],
} satisfies Config;

export default config;
