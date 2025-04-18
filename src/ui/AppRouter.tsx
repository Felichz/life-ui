import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useSystemCore } from "./context/SystemProvider";

// Cargamos las páginas con lazy loading para mejor rendimiento inicial
const DayPage = lazy(() => import("./pages/DayPage"));
const OverviewPage = lazy(() => import("./pages/OverviewPage"));
const StartPage = lazy(() => import("./pages/StartPage"));

// Componente de carga mientras se cargan las páginas con lazy loading
const Loading = () => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
    }}
  >
    <CircularProgress size={60} thickness={4} />
    <Typography variant="h6" sx={{ mt: 2 }}>
      Cargando...
    </Typography>
  </Box>
);

/**
 * Componente que redirige según si hay un día activo o no
 */
const HomeRedirect = () => {
  const { isDayActive } = useSystemCore();

  // Si hay un día activo, muestra DayPage, si no, redirige a StartPage
  return isDayActive() ? <Navigate to="/" /> : <Navigate to="/start" />;
};

/**
 * Componente que protege rutas que requieren un día activo
 */
const RequireActiveDay = ({ children }: { children: JSX.Element }) => {
  const { isDayActive } = useSystemCore();

  // Si no hay día activo, redirige a StartPage
  if (!isDayActive()) {
    return <Navigate to="/start" replace />;
  }

  return children;
};

/**
 * AppRouter - Componente principal de enrutamiento
 * Define las rutas de la aplicación y maneja la carga asíncrona de componentes
 */
const AppRouter = () => {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Redirección inteligente según estado del día */}
        <Route
          path="/"
          element={
            <RequireActiveDay>
              <DayPage />
            </RequireActiveDay>
          }
        />

        {/* Ruta de inicio de día */}
        <Route path="/start" element={<StartPage />} />

        {/* Ruta de resumen - Vista histórica */}
        <Route path="/overview" element={<OverviewPage />} />

        {/* Redirección para rutas no encontradas */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;
