import { createTheme } from "@mui/material/styles";
import type { TypographyVariantsOptions } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: { main: "#3156d8", light: "#6f8cff", dark: "#19338f", contrastText: "#fff" },
    secondary: { main: "#e97857", light: "#ffab8e", dark: "#b94d32", contrastText: "#fff" },
    success: { main: "#218b69" },
    warning: { main: "#c78628" },
    info: { main: "#4778a8" },
    background: { default: "#f5f7fb", paper: "#ffffff" },
    text: { primary: "#1b2538", secondary: "#647089", disabled: "#9aa5b8" },
  },
  breakpoints: { values: { xs: 0, sm: 600, md: 960, lg: 1280, xl: 1920 } },
  typography: {
    fontFamily: ["Inter", "Roboto", "Arial", "sans-serif"].join(","),
    h1: { fontSize: "2.7rem", fontWeight: 750, letterSpacing: "-0.045em" },
    h2: { fontSize: "2rem", fontWeight: 750, letterSpacing: "-0.03em" },
    h3: { fontSize: "1.5rem", fontWeight: 750, letterSpacing: "-0.02em" },
    h4: { fontSize: "1.25rem", fontWeight: 700 },
    h5: { fontSize: "1.05rem", fontWeight: 700 },
    h6: { fontSize: "1rem", fontWeight: 700 },
    button: { textTransform: "none" as const },
  } as TypographyVariantsOptions,
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: "#f5f7fb", color: "#1b2538" },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 700,
          boxShadow: "none",
          minHeight: 40,
          "&:hover": { boxShadow: "none" },
        },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 10 } } },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
        rounded: { borderRadius: 18 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: "0 8px 24px rgba(31, 48, 86, 0.06)",
          border: "1px solid rgba(99, 115, 145, 0.12)",
        },
      },
    },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiChip: { styleOverrides: { root: { fontWeight: 700 } } },
  },
});

export default theme;
