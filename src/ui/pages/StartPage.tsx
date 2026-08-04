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
  Chip,
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import TopBar from "../components/Common/TopBar";
import { useSystemCore } from "../context/SystemProvider";

const StartPage = () => {
  const navigate = useNavigate();
  const { startDay, isDayActive, state, getCompletionRate, getTimeDistributionData } =
    useSystemCore();
  const [loading, setLoading] = useState(false);

  const hasPreviousDays = state.global.days.length > 0;
  const lastDay = hasPreviousDays ? state.global.days[state.global.days.length - 1] : null;
  const lastDayStats = lastDay
    ? {
        completionRate: getCompletionRate(),
        timeDistribution: getTimeDistributionData(lastDay.id),
        activitiesCount: state.global.completedActivityRecords.filter((r) => r.dayId === lastDay.id)
          .length,
      }
    : null;

  const handleStartDay = () => {
    setLoading(true);
    try {
      startDay();
      setTimeout(() => navigate("/"), 500);
    } catch (error) {
      console.error("Error al iniciar el día:", error);
      setLoading(false);
    }
  };

  if (isDayActive()) {
    navigate("/");
    return null;
  }

  return (
    <>
      <TopBar isDayActive={false} />
      <Box sx={{ py: { xs: 4, md: 8 } }}>
        <Container maxWidth="lg">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1.2fr 0.8fr" },
              gap: { xs: 4, md: 8 },
              alignItems: "center",
            }}
          >
            <Box>
              <Chip
                icon={<AutoAwesomeRoundedIcon />}
                label="Diseña tu atención, un día a la vez"
                color="primary"
                variant="outlined"
                sx={{ mb: 3 }}
              />
              <Typography variant="h1" sx={{ maxWidth: 640, mb: 2 }}>
                Menos fricción. Más claridad para hacer lo importante.
              </Typography>
              <Typography
                variant="h5"
                color="text.secondary"
                sx={{ fontWeight: 500, lineHeight: 1.55, maxWidth: 590, mb: 4 }}
              >
                Qualia Control convierte un día complejo en una secuencia visible: eliges qué hacer,
                lo ejecutas y aprendes de cómo ocurrió.
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={
                  loading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <PlayArrowRoundedIcon />
                  )
                }
                onClick={handleStartDay}
                disabled={loading}
                sx={{ px: 3, py: 1.3, fontSize: "1rem" }}
                data-testid="start-day-button"
              >
                Comenzar día
              </Button>
              <Stack
                direction="row"
                spacing={2}
                sx={{ mt: 3, color: "text.secondary", flexWrap: "wrap", rowGap: 1 }}
              >
                <Typography variant="body2">01 · Elige tu foco</Typography>
                <Typography variant="body2">02 · Muévelo por tu día</Typography>
                <Typography variant="body2">03 · Revisa lo aprendido</Typography>
              </Stack>
            </Box>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, md: 4 },
                borderRadius: 5,
                bgcolor: "#1d2b4a",
                color: "white",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  width: 220,
                  height: 220,
                  borderRadius: "50%",
                  bgcolor: "rgba(111,140,255,0.28)",
                  right: -90,
                  top: -90,
                }}
              />
              <Typography variant="overline" sx={{ color: "#aebcff", letterSpacing: "0.14em" }}>
                Tu sistema en una mirada
              </Typography>
              <Typography variant="h3" sx={{ mt: 1, mb: 3, color: "white" }}>
                Un lugar para pensar y actuar.
              </Typography>
              <Stack spacing={2}>
                {[
                  [<PlayArrowRoundedIcon />, "Foco actual", "Una sola actividad activa"],
                  [<HistoryRoundedIcon />, "Ritmo del día", "Timeline de lo que ocurrió"],
                  [<InsightsRoundedIcon />, "Aprendizaje", "Datos para ajustar, no juzgarte"],
                ].map(([icon, title, body]) => (
                  <Box
                    key={title as string}
                    sx={{ display: "flex", gap: 1.5, alignItems: "center" }}
                  >
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: 2,
                        bgcolor: "rgba(255,255,255,0.1)",
                        color: "#b9c6ff",
                      }}
                    >
                      {icon}
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
                      <Typography variant="body2" sx={{ color: "#aeb9cf" }}>
                        {body}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Box>

          {hasPreviousDays && lastDay && lastDayStats ? (
            <Paper
              elevation={0}
              sx={{ mt: 8, p: { xs: 2, md: 3 }, borderRadius: 4 }}
              data-testid="previous-day-summary"
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 2,
                  alignItems: "flex-start",
                  mb: 2,
                }}
              >
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Tu último registro
                  </Typography>
                  <Typography variant="h4">Resumen del día anterior</Typography>
                </Box>
                <Button
                  variant="text"
                  startIcon={<HistoryRoundedIcon />}
                  onClick={() => navigate("/overview")}
                  data-testid="view-details-button"
                >
                  Ver análisis
                </Button>
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                  gap: 2,
                }}
              >
                <Card elevation={0}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Tasa de completación
                    </Typography>
                    <Typography
                      variant="h3"
                      color="primary.main"
                      data-testid="completion-rate-value"
                    >
                      {Math.round(lastDayStats.completionRate * 100)}%
                    </Typography>
                  </CardContent>
                </Card>
                <Card elevation={0}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Actividades completadas
                    </Typography>
                    <Typography
                      variant="h3"
                      color="primary.main"
                      data-testid="completed-activities-count"
                    >
                      {lastDayStats.activitiesCount}
                    </Typography>
                  </CardContent>
                </Card>
                <Card elevation={0}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Duración registrada
                    </Typography>
                    <Typography variant="h3" color="primary.main">
                      {lastDay.startTime && lastDay.endTime
                        ? `${Math.round((new Date(lastDay.endTime).getTime() - new Date(lastDay.startTime).getTime()) / (1000 * 60 * 60))}h`
                        : "N/A"}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Paper>
          ) : (
            <Paper
              elevation={0}
              sx={{
                mt: 8,
                p: 3,
                borderRadius: 4,
                border: "1px dashed rgba(49,86,216,0.3)",
                bgcolor: "rgba(49,86,216,0.035)",
              }}
              data-testid="welcome-message"
            >
              <Typography variant="h5" sx={{ mb: 0.5 }}>
                Bienvenido a Qualia Control
              </Typography>
              <Typography color="text.secondary">
                Tu primer día empieza con una sola decisión. Puedes ajustar el plan sobre la marcha;
                no necesitas tenerlo todo resuelto ahora.
              </Typography>
            </Paper>
          )}
        </Container>
      </Box>
    </>
  );
};

export default StartPage;
