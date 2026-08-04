import { Box, Typography, Container, Paper, Chip } from "@mui/material";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import DonutLargeRoundedIcon from "@mui/icons-material/DonutLargeRounded";
import TopBar from "../components/Common/TopBar";
import TimelineContainer from "../containers/TimelineContainer";
import ChartsContainer from "../containers/ChartsContainer";
import { useSystemCore } from "../hooks/useSystemCore";

const OverviewPage = () => {
  const { isDayActive } = useSystemCore();

  return (
    <>
      <TopBar isDayActive={isDayActive()} />
      <Box sx={{ py: { xs: 4, md: 6 } }}>
        <Container maxWidth="lg">
          <Box sx={{ mb: 4 }}>
            <Chip
              icon={<InsightsRoundedIcon />}
              label="Mirar para ajustar"
              color="primary"
              variant="outlined"
              sx={{ mb: 2 }}
            />
            <Typography variant="h2" component="h1">
              Vista de Resumen - Qualia Control
            </Typography>
            <Typography
              variant="h5"
              color="text.secondary"
              sx={{ fontWeight: 500, mt: 1, maxWidth: 700 }}
            >
              Un registro amable de cómo usaste tu tiempo: observa patrones, celebra avances y
              decide qué probar después.
            </Typography>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1.25fr 0.75fr" },
              gap: 2.5,
            }}
          >
            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 4 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <TimelineRoundedIcon color="primary" />
                <Box>
                  <Typography variant="h5">Tu recorrido</Typography>
                  <Typography variant="body2" color="text.secondary">
                    El tiempo real frente a tu intención.
                  </Typography>
                </Box>
              </Box>
              <TimelineContainer />
            </Paper>
            <Paper
              elevation={0}
              sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, bgcolor: "#1d2b4a", color: "white" }}
            >
              <DonutLargeRoundedIcon sx={{ color: "#b9c6ff", mb: 1 }} />
              <Typography variant="h5" sx={{ color: "white", mb: 1 }}>
                Cómo leer esto
              </Typography>
              <Typography variant="body2" sx={{ color: "#aeb9cf", lineHeight: 1.7 }}>
                No es una puntuación. Es contexto para reconocer qué condiciones te ayudan a avanzar
                y cuáles conviene rediseñar.
              </Typography>
            </Paper>
          </Box>

          <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, mt: 2.5, borderRadius: 4 }}>
            <ChartsContainer />
          </Paper>
        </Container>
      </Box>
    </>
  );
};

export default OverviewPage;
