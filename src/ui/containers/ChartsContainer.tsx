import React, { useState, useEffect, useCallback } from "react";
import { Box, Typography, Snackbar, Alert, Button, Divider } from "@mui/material";
import { useSystemCore } from "../hooks/useSystemCore";
import DistributionPie from "../components/Charts/DistributionPie";
import SubjectiveChart from "../components/Charts/SubjectiveChart";
import SkeletonLoader from "../components/Common/SkeletonLoader";
import type { TimeDistributionData, SubjectiveVariablesData } from "../../types";

interface ChartsContainerProps {
  dayId?: string;
}

const ChartsContainer: React.FC<ChartsContainerProps> = ({ dayId }) => {
  // Estado para los datos de distribución
  const [data, setData] = useState<TimeDistributionData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [showError, setShowError] = useState<boolean>(false);

  // Estado para los datos de variables subjetivas
  const [subjectiveData, setSubjectiveData] = useState<SubjectiveVariablesData | null>(null);
  const [isLoadingSubjective, setIsLoadingSubjective] = useState<boolean>(true);
  const [errorSubjective, setErrorSubjective] = useState<Error | null>(null);
  const [showErrorSubjective, setShowErrorSubjective] = useState<boolean>(false);

  // Obtener métodos desde el contexto del sistema
  const {
    getTimeDistributionData,
    getSubjectiveVariablesData,
    getCurrentDay,
    getUserPreferences,
    toggleVariableVisibility,
  } = useSystemCore();

  // Función para cargar los datos de distribución
  const loadDistributionData = useCallback(() => {
    try {
      setIsLoading(true);
      setError(null);

      // Si no se proporciona dayId, intentar obtener el día actual
      const targetDayId = dayId || getCurrentDay()?.id;

      if (!targetDayId) {
        setData(null);
        setIsLoading(false);
        return;
      }

      // Obtener datos de distribución para el día
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

  // Función para cargar los datos de variables subjetivas
  const loadSubjectiveData = useCallback(() => {
    try {
      setIsLoadingSubjective(true);
      setErrorSubjective(null);

      // Si no se proporciona dayId, intentar obtener el día actual
      const targetDayId = dayId || getCurrentDay()?.id;

      if (!targetDayId) {
        setSubjectiveData(null);
        setIsLoadingSubjective(false);
        return;
      }

      // Obtener datos de variables subjetivas para el día
      const variablesData = getSubjectiveVariablesData(targetDayId);
      setSubjectiveData(variablesData);
    } catch (err) {
      console.error("Error al cargar datos de variables subjetivas:", err);
      setErrorSubjective(err instanceof Error ? err : new Error("Error desconocido"));
      setShowErrorSubjective(true);
    } finally {
      setIsLoadingSubjective(false);
    }
  }, [getSubjectiveVariablesData, getCurrentDay, dayId]);

  // Cargar datos cuando cambie el día
  useEffect(() => {
    loadDistributionData();
    loadSubjectiveData();
  }, [loadDistributionData, loadSubjectiveData]);

  // Cerrar el snackbar de error de distribución
  const handleCloseError = () => {
    setShowError(false);
  };

  // Cerrar el snackbar de error de variables subjetivas
  const handleCloseErrorSubjective = () => {
    setShowErrorSubjective(false);
  };

  // Reintentar carga de datos de distribución
  const handleRetryDistribution = () => {
    setShowError(false);
    loadDistributionData();
  };

  // Reintentar carga de datos de variables subjetivas
  const handleRetrySubjective = () => {
    setShowErrorSubjective(false);
    loadSubjectiveData();
  };

  // Obtener variables ocultas de las preferencias del usuario
  const hiddenVariables = getUserPreferences().hiddenSubjectiveVariableIds;

  // Renderizar la sección de distribución del tiempo
  const renderDistributionSection = () => {
    if (isLoading) {
      return (
        <Box sx={{ width: "100%", mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Distribución del tiempo
          </Typography>
          <SkeletonLoader type="chart" count={1} />
        </Box>
      );
    }

    if (error) {
      return (
        <Box sx={{ width: "100%", mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Distribución del tiempo
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleRetryDistribution}
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
        <Box sx={{ width: "100%", mt: 4 }}>
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
      <Box sx={{ width: "100%", mt: 4 }} data-testid="distribution-section">
        <Typography variant="h5" gutterBottom>
          Distribución del tiempo
        </Typography>
        <DistributionPie categories={data.categories} />
      </Box>
    );
  };

  // Renderizar la sección de variables subjetivas
  const renderSubjectiveSection = () => {
    if (isLoadingSubjective) {
      return (
        <Box sx={{ width: "100%", mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Variables subjetivas
          </Typography>
          <SkeletonLoader type="chart" count={1} />
        </Box>
      );
    }

    if (errorSubjective) {
      return (
        <Box sx={{ width: "100%", mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Variables subjetivas
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleRetrySubjective}
              data-testid="retry-button-subjective"
            >
              Reintentar carga de datos
            </Button>
          </Box>
          <Snackbar
            open={showErrorSubjective}
            autoHideDuration={6000}
            onClose={handleCloseErrorSubjective}
          >
            <Alert onClose={handleCloseErrorSubjective} severity="error">
              Error al cargar datos de variables subjetivas
            </Alert>
          </Snackbar>
        </Box>
      );
    }

    if (!subjectiveData || !subjectiveData.variables || subjectiveData.variables.length === 0) {
      return (
        <Box sx={{ width: "100%", mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Variables subjetivas
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <Typography
              variant="body1"
              color="text.secondary"
              data-testid="no-data-message-subjective"
            >
              No hay datos de variables subjetivas disponibles
            </Typography>
          </Box>
        </Box>
      );
    }

    return (
      <Box sx={{ width: "100%", mt: 4 }} data-testid="subjective-section">
        <Typography variant="h5" gutterBottom>
          Variables subjetivas
        </Typography>
        <SubjectiveChart
          data={subjectiveData}
          hiddenVariables={hiddenVariables}
          onToggle={toggleVariableVisibility}
        />
      </Box>
    );
  };

  // Renderizar ambas secciones de gráficos
  return (
    <Box sx={{ width: "100%" }} data-testid="charts-container">
      {renderDistributionSection()}
      <Divider sx={{ my: 4 }} />
      {renderSubjectiveSection()}
    </Box>
  );
};

export default ChartsContainer;
