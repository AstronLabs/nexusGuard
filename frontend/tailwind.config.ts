import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#f8f9ff",
        surface: "#f8f9ff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#eff4ff",
        "surface-container": "#e5eeff",
        "surface-container-high": "#dce9ff",
        "surface-container-highest": "#d3e4fe",
        "surface-dim": "#cbdbf5",
        "surface-variant": "#d3e4fe",
        "on-surface": "#0b1c30",
        "on-surface-variant": "#45464d",
        "on-background": "#0b1c30",
        "outline": "#76777d",
        "outline-variant": "#c6c6cd",
        primary: "#000000",
        "primary-container": "#131b2e",
        "primary-fixed": "#dae2fd",
        "primary-fixed-dim": "#bec6e0",
        "on-primary": "#ffffff",
        "on-primary-container": "#7c839b",
        secondary: "#006a61",
        "secondary-container": "#86f2e4",
        "secondary-fixed": "#89f5e7",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#006f66",
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        "on-tertiary-container": "#98805d"
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem"
      },
      boxShadow: {
        soft: "0px 4px 6px -1px rgba(15, 23, 42, 0.05), 0px 2px 4px -2px rgba(15, 23, 42, 0.05)"
      },
      fontFamily: {
        display: ["Hanken Grotesk", "sans-serif"],
        heading: ["Hanken Grotesk", "sans-serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      fontSize: {
        display: ["48px", { lineHeight: "1.1", letterSpacing: "0", fontWeight: "600" }],
        "headline-lg": ["32px", { lineHeight: "1.2", letterSpacing: "0", fontWeight: "600" }],
        "headline-md": ["20px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "500" }],
        "body-sm": ["14px", { lineHeight: "1.5", letterSpacing: "0" }],
        "label-caps": ["12px", { lineHeight: "1", letterSpacing: "0.05em", fontWeight: "600" }],
        "mono-data": ["13px", { lineHeight: "1", letterSpacing: "0" }]
      },
      maxWidth: {
        "container-max": "1200px"
      },
      spacing: {
        "stack-sm": "8px",
        "stack-md": "16px",
        "stack-lg": "32px",
        gutter: "24px",
        "margin-mobile": "16px",
        "margin-desktop": "40px"
      }
    }
  },
  plugins: [require("@tailwindcss/forms")]
};

export default config;
