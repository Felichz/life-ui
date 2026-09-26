/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        sidebar: token("sidebar"),
        panel: token("panel"),
        subtle: token("subtle"),
        hover: token("hover"),
        line: token("line"),
        "line-strong": token("line-strong"),
        ink: token("ink"),
        "ink-2": token("ink-2"),
        "ink-3": token("ink-3"),
        accent: token("accent"),
        "accent-hover": token("accent-hover"),
        "accent-ink": token("accent-ink"),
        "accent-fill": token("accent-fill"),
        "accent-fill-hover": token("accent-fill-hover"),
        tempo: token("tempo"),
        "tempo-ink": token("tempo-ink"),
        live: token("live"),
        danger: token("danger"),
        "danger-fill": token("danger-fill"),
        success: token("success"),
        objective: token("objective"),
        flexible: token("flexible"),
        timebox: token("timebox"),
        event: token("event"),
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "14px", letterSpacing: "0.01em" }],
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["13px", { lineHeight: "18px" }],
        base: ["14px", { lineHeight: "20px" }],
        md: ["15px", { lineHeight: "22px" }],
        lg: ["17px", { lineHeight: "24px", letterSpacing: "-0.01em" }],
        xl: ["20px", { lineHeight: "28px", letterSpacing: "-0.015em" }],
        "2xl": ["24px", { lineHeight: "30px", letterSpacing: "-0.02em" }],
        "3xl": ["30px", { lineHeight: "36px", letterSpacing: "-0.025em" }],
        "4xl": ["40px", { lineHeight: "44px", letterSpacing: "-0.03em" }],
        clock: ["56px", { lineHeight: "56px", letterSpacing: "-0.035em" }],
      },
      borderRadius: {
        sm: "5px",
        DEFAULT: "7px",
        md: "8px",
        lg: "10px",
        xl: "14px",
      },
      boxShadow: {
        xs: "0 1px 1px rgb(var(--shadow) / 0.04)",
        sm: "0 1px 2px rgb(var(--shadow) / 0.06), 0 1px 1px rgb(var(--shadow) / 0.04)",
        pop: "0 1px 2px rgb(var(--shadow) / 0.08), 0 8px 24px -6px rgb(var(--shadow) / 0.18)",
        dialog: "0 2px 6px rgb(var(--shadow) / 0.08), 0 24px 64px -12px rgb(var(--shadow) / 0.32)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "dialog-in": {
          from: { opacity: "0", transform: "translate(-50%, -48%) scale(0.97)" },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
        "sheet-in": {
          from: { opacity: "0.6", transform: "translateX(24px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "sheet-up": {
          from: { opacity: "0.6", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          from: { opacity: "0", transform: "scale(0.97) translateY(-2px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        ring: {
          "0%": { transform: "scale(1)", opacity: "0.55" },
          "100%": { transform: "scale(2.6)", opacity: "0" },
        },
        "tempo-bump": {
          "0%": { transform: "scale(1)" },
          "35%": { transform: "scale(1.12)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "dialog-in": "dialog-in 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "sheet-in": "sheet-in 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        "sheet-up": "sheet-up 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        "pop-in": "pop-in 140ms cubic-bezier(0.16, 1, 0.3, 1)",
        "toast-in": "toast-in 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        ring: "ring 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite",
        "tempo-bump": "tempo-bump 520ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [
    ({ addVariant }) => {
      // Pantallas táctiles: objetivos de toque más grandes
      addVariant("coarse", "@media (pointer: coarse)");
      addVariant("hover-hover", "@media (hover: hover)");
    },
  ],
};
