import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { BrowserRouter } from "react-router-dom";
import theme from "./theme";
import AppRouter from "./AppRouter";
import { SystemProvider } from "./context/SystemProvider";

/**
 * App - Componente principal de la aplicación
 * Configura providers globales: ThemeProvider, SystemProvider y BrowserRouter
 */
const App = () => {
  return (
    <ThemeProvider theme={theme}>
      {/* Reset CSS global */}
      <CssBaseline />
      {/* Proveedor del estado del sistema */}
      <SystemProvider>
        {/* Router para la navegación */}
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </SystemProvider>
    </ThemeProvider>
  );
};

export default App;
