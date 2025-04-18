import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Container,
  Button,
  Paper,
  CircularProgress,
  Card,
  CardContent,
  Stack,
  Grid,
} from "@mui/material";
import TopBar from "../components/Common/TopBar";
import { useSystemCore } from "../context/SystemProvider";

/**
 * StartPage - Página inicial que muestra un resumen del día anterior y permite iniciar un nuevo día
 */
const StartPage = () => {
  const navigate = useNavigate();
  const {
    startDay,
    isDayActive,
    state,
    getTimelineData,
    getTimeDistributionData,
    getCompletionRate,
  } = useSystemCore();

  const [loading, setLoading] = useState(false);

  // Comprueba si hay días previos para mostrar resumen
  const hasPreviousDays = state.global.days.length > 0;

  // Obtiene el último día si existe
  const lastDay = hasPreviousDays ? state.global.days[state.global.days.length - 1] : null;

  // Estadísticas básicas del último día si existe
  const lastDayStats = lastDay
    ? {
        completionRate: getCompletionRate(),
        timeDistribution: getTimeDistributionData(lastDay.id),
        activitiesCount: state.global.completedActivityRecords.filter((r) => r.dayId === lastDay.id)
          .length,
      }
    : null;

  // Función para iniciar un nuevo día
  const handleStartDay = () => {
    setLoading(true);

    try {
      // Inicia el día en el sistema
      startDay();

      // Redirige a la página principal
      setTimeout(() => {
        navigate("/");
      }, 500); // Pequeño delay para mostrar feedback visual
    } catch (error) {
      console.error("Error al iniciar el día:", error);
      setLoading(false);
    }
  };

  // Si ya hay un día activo, redirige automáticamente
  if (isDayActive()) {
    navigate("/");
    return null;
  }

  return (
    <>
      <TopBar isDayActive={isDayActive()} />
      <Container maxWidth="md">
        <Box sx={{ my: 6, textAlign: "center" }}>
          <Typography variant="h3" component="h1" gutterBottom>
            Qualia Control
          </Typography>

          <Typography variant="h5" sx={{ mb: 4, color: "text.secondary" }}>
            Sistema para gestión consciente del tiempo y actividades
          </Typography>

          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleStartDay}
            disabled={loading}
            sx={{
              py: 1.5,
              px: 4,
              fontSize: "1.2rem",
              borderRadius: 2,
              mb: 6,
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} /> : null}
            Comenzar día
          </Button>

          {hasPreviousDays && lastDay && lastDayStats ? (
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h5" gutterBottom>
                Resumen del día anterior
              </Typography>

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, mt: 2 }}>
                <Box sx={{ flex: "1 1 30%", minWidth: "240px" }}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Tasa de completación
                      </Typography>
                      <Typography variant="h4" color="primary">
                        {Math.round(lastDayStats.completionRate * 100)}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>

                <Box sx={{ flex: "1 1 30%", minWidth: "240px" }}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Actividades completadas
                      </Typography>
                      <Typography variant="h4" color="primary">
                        {lastDayStats.activitiesCount}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>

                <Box sx={{ flex: "1 1 30%", minWidth: "240px" }}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Duración
                      </Typography>
                      <Typography variant="h4" color="primary">
                        {lastDay.startTime && lastDay.endTime
                          ? `${Math.round(
                              (new Date(lastDay.endTime).getTime() -
                                new Date(lastDay.startTime).getTime()) /
                                (1000 * 60 * 60)
                            )}h`
                          : "N/A"}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              </Box>

              <Stack direction="row" justifyContent="center" sx={{ mt: 3 }}>
                <Button variant="outlined" color="primary" onClick={() => navigate("/overview")}>
                  Ver detalles completos
                </Button>
              </Stack>
            </Paper>
          ) : hasPreviousDays === false ? (
            <Paper elevation={1} sx={{ p: 3, borderRadius: 3, bgcolor: "background.default" }}>
              <Typography variant="body1">
                Bienvenido a Qualia Control. Este es tu primer día utilizando el sistema. Presiona
                "Comenzar día" para iniciar tu primera sesión.
              </Typography>
            </Paper>
          ) : null}
        </Box>
      </Container>
    </>
  );
};

export default StartPage;
