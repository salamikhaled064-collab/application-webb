import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        paper: v("paper"),
        surface: v("surface"),
        sunken: v("sunken"),
        ink: v("ink"),
        muted: v("muted"),
        line: v("line"),
        brand: v("brand"),
        "brand-soft": v("brand-soft"),
        "on-brand": v("on-brand"),
        accent: v("accent"),
        ok: v("ok"),
        "ok-soft": v("ok-soft"),
        bad: v("bad"),
        "bad-soft": v("bad-soft"),
        warn: v("warn"),
        "warn-soft": v("warn-soft"),
      },
      fontFamily: {
        display: ["'Bricolage Grotesque Variable'", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["'Instrument Sans Variable'", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        lift: "0 1px 2px rgb(var(--shadow) / 0.06), 0 8px 24px -12px rgb(var(--shadow) / 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
