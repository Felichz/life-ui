import { Box, Typography, Container, Paper } from "@mui/material";
import TopBar from "../components/Common/TopBar";
import TimelineContainer from "../containers/TimelineContainer";
import ChartsContainer from "../containers/ChartsContainer";
import { useSystemCore } from "../hooks/useSystemCore";

const OverviewPage = () => {
  const { isDayActive } = useSystemCore();

  return (
    <>
      <TopBar isDayActive={isDayActive()} />
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Vista de Resumen - Qualia Control
          </Typography>
          <Typography variant="body1" paragraph>
            Esta página mostrará un resumen de datos, con gráficos y estadísticas sobre el
            rendimiento y hábitos.
          </Typography>

          <Paper elevation={2} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
            <TimelineContainer />
          </Paper>

          <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <ChartsContainer />
          </Paper>
        </Box>
      </Container>
    </>
  );
};

export default OverviewPage;
