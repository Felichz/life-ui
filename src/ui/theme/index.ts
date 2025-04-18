import { createTheme } from "@mui/material/styles";
import type { TypographyVariantsOptions } from "@mui/material/styles";

// Definición de la paleta de colores
const palette = {
  primary: {
    main: "#3f51b5", // Azul indigo
    light: "#757de8",
    dark: "#002984",
    contrastText: "#fff",
  },
  secondary: {
    main: "#f50057", // Rosa
    light: "#ff5983",
    dark: "#bb002f",
    contrastText: "#fff",
  },
  background: {
    default: "#f5f5f5",
    paper: "#fff",
  },
  text: {
    primary: "rgba(0, 0, 0, 0.87)",
    secondary: "rgba(0, 0, 0, 0.6)",
    disabled: "rgba(0, 0, 0, 0.38)",
  },
};

// Definición de breakpoints
const breakpoints = {
  values: {
    xs: 0,
    sm: 600,
    md: 960,
    lg: 1280,
    xl: 1920,
  },
};

// Configuración de tipografía
const typography: TypographyVariantsOptions = {
  fontFamily: ["Roboto", "Arial", "sans-serif"].join(","),
  h1: {
    fontSize: "2.5rem",
    fontWeight: 500,
  },
  h2: {
    fontSize: "2rem",
    fontWeight: 500,
  },
  h3: {
    fontSize: "1.75rem",
    fontWeight: 500,
  },
  h4: {
    fontSize: "1.5rem",
    fontWeight: 500,
  },
  h5: {
    fontSize: "1.25rem",
    fontWeight: 500,
  },
  h6: {
    fontSize: "1rem",
    fontWeight: 500,
  },
  button: {
    textTransform: "none" as const,
  },
};

// Creación del tema
const theme = createTheme({
  palette,
  breakpoints,
  typography,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 12,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
        },
      },
    },
  },
});

export default theme;
