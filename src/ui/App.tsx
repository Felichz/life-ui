import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { BrowserRouter } from "react-router-dom";
import theme from "./theme";
import AppRouter from "./AppRouter";
import { SystemProvider } from "./context/SystemProvider";
import { CompletionFlowProvider } from "./context/CompletionFlowContext";

/**
 * App - Componente principal de la aplicación
 * Configura providers globales: ThemeProvider, SystemProvider, CompletionFlowProvider, BrowserRouter
 */
const App = () => {
  return (
    <ThemeProvider theme={theme}>
      {/* Reset CSS global */}
      <CssBaseline />
      {/* Proveedor del estado del sistema */}
      <SystemProvider>
        {/* Proveedor del flujo de cierre de actividades (CompletionModal único compartido) */}
        <CompletionFlowProvider>
          {/* Router para la navegación */}
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </CompletionFlowProvider>
      </SystemProvider>
    </ThemeProvider>
  );
};

export default App;
