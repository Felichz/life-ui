import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSystemCore } from "../hooks/useSystemCore";
import OverviewModal from "../modals/OverviewModal";
import type {
  UUID,
  Day,
  TimelineData,
  SubjectiveVariablesData,
  TimeDistributionData,
} from "../../types";

interface OverviewModalContainerProps {
  open: boolean;
  onClose: () => void;
  dayId?: UUID; // Opcional: si se proporciona, muestra los datos de ese día específico
}

/**
 * Contenedor para el modal de resumen de datos históricos.
 * Si no se proporciona un dayId, busca automáticamente el último día finalizado.
 */
const OverviewModalContainer: React.FC<OverviewModalContainerProps> = ({
  open,
  onClose,
  dayId: initialDayId,
}) => {
  const {
    getTimelineData,
    getSubjectiveVariablesData,
    getTimeDistributionData,
    state,
    getUserPreferences,
    toggleVariableVisibility,
  } = useSystemCore();

  // Estado para manejar los días disponibles y el día seleccionado
  const [days, setDays] = useState<Day[] | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<UUID | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [timelineDataState, setTimelineDataState] = useState<TimelineData | null>(null);
  const [subjectiveDataState, setSubjectiveDataState] = useState<SubjectiveVariablesData | null>(
    null
  );
  const [distributionDataState, setDistributionDataState] = useState<TimeDistributionData | null>(
    null
  );

  // Obtener las variables ocultas de las preferencias del usuario
  const hiddenVariables = useMemo(() => {
    // Obtener preferencias - usar un objeto vacío con array vacío como fallback
    const preferences = getUserPreferences
      ? getUserPreferences()
      : { hiddenSubjectiveVariableIds: [] };
    return preferences.hiddenSubjectiveVariableIds;
  }, [getUserPreferences]);

  // Cargar los días finalizados
  const loadFinishedDays = useCallback(() => {
    try {
      // Obtener todos los días del estado global, filtrar solo los finalizados
      const allDays = state.global.days;
      const finishedDays = allDays.filter((day: Day) => day.state === "inactive" && day.endTime);

      // Ordenar por fecha (más reciente primero)
      const sortedDays = [...finishedDays].sort(
        (a: Day, b: Day) =>
          new Date(b.endTime || b.createdAt).getTime() -
          new Date(a.endTime || a.createdAt).getTime()
      );

      setDays(sortedDays);

      // Si hay un día inicial, seleccionarlo; si no, seleccionar el más reciente
      if (initialDayId) {
        setSelectedDayId(initialDayId);
      } else if (sortedDays.length > 0) {
        setSelectedDayId(sortedDays[0].id);
      } else {
        setSelectedDayId(null);
      }
    } catch (err) {
      console.error("Error al cargar días finalizados:", err);
      setError(err instanceof Error ? err : new Error("Error desconocido"));
    }
  }, [state.global.days, initialDayId]);

  // Cargar datos al abrir el modal o cambiar el día seleccionado
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setError(null);
      loadFinishedDays();
    }
  }, [open, loadFinishedDays]);

  // Manejador para cambiar el día seleccionado
  const handleDayChange = (dayId: UUID) => {
    setSelectedDayId(dayId);
    setIsLoading(true);
    setError(null);
  };

  // Manejador para alternar la visibilidad de una variable
  const handleToggleVariableVisibility = (variableId: UUID) => {
    if (toggleVariableVisibility) {
      toggleVariableVisibility(variableId);
    }
  };

  // Calcular los datos para el día seleccionado
  const timelineData = useMemo(() => {
    if (!selectedDayId) return null;
    try {
      return getTimelineData(selectedDayId);
    } catch (err) {
      console.error("Error al cargar datos de timeline:", err);
      setError(err instanceof Error ? err : new Error("Error desconocido"));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [selectedDayId, getTimelineData]);

  const subjectiveData = useMemo(() => {
    if (!selectedDayId) return null;
    try {
      return getSubjectiveVariablesData(selectedDayId);
    } catch (err) {
      console.error("Error al cargar datos de variables subjetivas:", err);
      setError(err instanceof Error ? err : new Error("Error desconocido"));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [selectedDayId, getSubjectiveVariablesData]);

  const distributionData = useMemo(() => {
    if (!selectedDayId) return null;
    try {
      return getTimeDistributionData(selectedDayId);
    } catch (err) {
      console.error("Error al cargar datos de distribución:", err);
      setError(err instanceof Error ? err : new Error("Error desconocido"));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [selectedDayId, getTimeDistributionData]);

  return (
    <OverviewModal
      open={open}
      onClose={onClose}
      days={days}
      selectedDayId={selectedDayId}
      onDayChange={handleDayChange}
      timelineData={timelineData}
      subjectiveData={subjectiveData}
      distributionData={distributionData}
      isLoading={isLoading}
      error={error}
      hiddenVariables={hiddenVariables}
      onToggleVariableVisibility={handleToggleVariableVisibility}
    />
  );
};

export default OverviewModalContainer;
