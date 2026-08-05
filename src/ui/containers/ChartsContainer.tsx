import React, { useState, useEffect, useCallback } from "react";
import { Box, Typography, Snackbar, Alert, Button } from "@mui/material";
import { useSystemCore } from "../hooks/useSystemCore";
import DistributionPie from "../components/Charts/DistributionPie";
import SkeletonLoader from "../components/Common/SkeletonLoader";
import type { TimeDistributionData } from "../../types";

interface ChartsContainerProps {
  dayId?: string;
}

/**
 * Distribución de tiempo del día. Solo muestra el DistributionPie
 * (subjective variables e interruption causes fueron removidas en
 * schema v2 — ver docs/ADR-001-sistema-de-tempos.md).
 */
const ChartsContainer: React.FC<ChartsContainerProps> = ({ dayId }) => {
  const [data, setData] = useState<TimeDistributionData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [showError, setShowError] = useState<boolean>(false);

  const { getTimeDistributionData, getCurrentDay } = useSystemCore();

  const loadDistributionData = useCallback(() => {
    try {
      setIsLoading(true);
      setError(null);

      const targetDayId = dayId || getCurrentDay()?.id;

      if (!targetDayId) {
        setData(null);
        setIsLoading(false);
        return;
      }

      const timeDistributionData = getTimeDistributionData(targetDayId);
      setData(timeDistributionData);
    } catch (err) {
      console.error("Error al cargar datos de distribución:", err);
      setError(err instanceof Error ? err : new Error("Error desconocido"));
      setShowError(true);
    } finally {
      setIsLoading(false);
    }
  }, [getTimeDistributionData, getCurrentDay, dayId]);

  useEffect(() => {
    loadDistributionData();
  }, [loadDistributionData]);

  const handleCloseError = () => {
    setShowError(false);
  };

  const handleRetry = () => {
    setShowError(false);
    loadDistributionData();
  };

  if (isLoading) {
    return (
      <Box sx={{ width: "100%", mt: 4 }} data-testid="charts-container">
        <Typography variant="h5" gutterBottom>
          Distribución del tiempo
        </Typography>
        <SkeletonLoader type="chart" count={1} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ width: "100%", mt: 4 }} data-testid="charts-container">
        <Typography variant="h5" gutterBottom>
          Distribución del tiempo
        </Typography>
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleRetry}
            data-testid="retry-button-distribution"
          >
            Reintentar carga de datos
          </Button>
        </Box>
        <Snackbar open={showError} autoHideDuration={6000} onClose={handleCloseError}>
          <Alert onClose={handleCloseError} severity="error">
            Error al cargar datos de distribución
          </Alert>
        </Snackbar>
      </Box>
    );
  }

  if (!data || !data.categories || data.categories.length === 0) {
    return (
      <Box sx={{ width: "100%", mt: 4 }} data-testid="charts-container">
        <Typography variant="h5" gutterBottom>
          Distribución del tiempo
        </Typography>
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <Typography
            variant="body1"
            color="text.secondary"
            data-testid="no-data-message-distribution"
          >
            No hay datos de distribución disponibles
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", mt: 4 }} data-testid="charts-container">
      <Typography variant="h5" gutterBottom>
        Distribución del tiempo
      </Typography>
      <Box data-testid="distribution-section">
        <DistributionPie categories={data.categories} />
      </Box>
    </Box>
  );
};

export default ChartsContainer;
