/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#050505",
        surface: "#111111",
        "surface-2": "#1a1a1a",
        panel: "#0d0d0d",
        line: "#262626",
        paper: "#f4f4f2",
        dim: "#9a9a9a",
        faint: "#6b6b6b",
        brand: "#dd390b",
        "brand-deep": "#d93708",
        "brand-hot": "#ff6b3d",
        "brand-dim": "#3a180d",
        gold: "#dd390b",
        ok: "#35c17f",
        warn: "#f5a524",
        danger: "#e5484d",
      },
      fontSize: {
        micro: ["11px", { lineHeight: "14px" }],
        label: ["12px", { lineHeight: "16px", letterSpacing: "0.02em" }],
        body: ["15px", { lineHeight: "22px" }],
        title: ["17px", { lineHeight: "24px", letterSpacing: "-0.01em" }],
        display: ["32px", { lineHeight: "36px", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        control: "12px",
        card: "18px",
        sheet: "24px",
      },
      fontFamily: {
        sans: [
          '"Segoe UI"',
          "-apple-system",
          "BlinkMacSystemFont",
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
      keyframes: {
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "sheet-up": "sheet-up 180ms cubic-bezier(0.32, 0.72, 0, 1)",
        "fade-in": "fade-in 140ms ease-out",
      },
    },
  },
  plugins: [],
};
