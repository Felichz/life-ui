import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  CircularProgress,
  Paper,
  IconButton,
  Alert,
  Stack,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { useSystemCore } from "../hooks/useSystemCore";
import type {
  SubjectiveVariable,
  UUID,
  ActivityInstance,
  CompletedActivityRecord,
  EventInstance,
} from "../../types";

interface VariableModalProps {
  open: boolean;
  onClose: () => void;
  relatedActivityIds?: UUID[];
  relatedEventIds?: UUID[];
  onConfirm: (
    values: { variableId: UUID; currentValue: number }[],
    relatedActivityIds: UUID[],
    relatedEventIds: UUID[]
  ) => void;
}

/**
 * Modal para actualizar variables subjetivas
 */
const VariableModal: React.FC<VariableModalProps> = ({
  open,
  onClose,
  relatedActivityIds = [],
  relatedEventIds = [],
  onConfirm,
}) => {
  const { createSubjectiveVariable, getLatestValues, canUpdateVariables, state } = useSystemCore();

  // Estado para almacenar las variables subjetivas
  const [variables, setVariables] = useState<SubjectiveVariable[]>([]);
  // Estado para almacenar los valores de las variables
  const [values, setValues] = useState<{ variableId: UUID; currentValue: number }[]>([]);
  // Estado para nuevas variables que el usuario está creando
  const [newVariableName, setNewVariableName] = useState("");
  // Estado para mostrar/ocultar el formulario de nueva variable
  const [isAddingVariable, setIsAddingVariable] = useState(false);
  // Estado para ids de actividades relacionadas seleccionadas
  const [selectedActivityIds, setSelectedActivityIds] = useState<UUID[]>(relatedActivityIds);
  // Estado para ids de eventos relacionados seleccionados
  const [selectedEventIds, setSelectedEventIds] = useState<UUID[]>(relatedEventIds);
  // Estado para manejar el spinner durante la carga o confirmación
  const [isProcessing, setIsProcessing] = useState(false);
  // Estado para mensajes de error
  const [error, setError] = useState<string | null>(null);
  // Estado para indicar si se pueden actualizar variables (restricción temporal)
  const [canUpdate, setCanUpdate] = useState(true);
  // Referencia para evitar inicializaciones repetidas
  const initialized = useRef(false);

  // Memorizar actividades completadas recientes para el select
  const recentCompletedActivities = useMemo(() => {
    const completedRecords = state.global?.completedActivityRecords || [];
    const currentDayId = state.currentDay?.day?.id;

    if (!currentDayId) return [];

    // Filtrar por día actual y ordenar por más reciente
    return completedRecords
      .filter((record: CompletedActivityRecord) => record.dayId === currentDayId)
      .sort(
        (a: CompletedActivityRecord, b: CompletedActivityRecord) =>
          new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
      )
      .slice(0, 5); // Limitar a las 5 más recientes
  }, [state.global?.completedActivityRecords, state.currentDay?.day?.id]);

  // Memorizar eventos recientes para el select
  const recentEvents = useMemo(() => {
    const events = state.global?.eventInstances || [];
    const currentDayId = state.currentDay?.day?.id;

    if (!currentDayId) return [];

    // Filtrar por día actual y ordenar por más reciente
    return events
      .filter((event: EventInstance) => event.dayId === currentDayId)
      .sort(
        (a: EventInstance, b: EventInstance) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 5); // Limitar a los 5 más recientes
  }, [state.global?.eventInstances, state.currentDay?.day?.id]);

  // Función para inicializar el modal
  const initializeModal = useCallback(() => {
    setError(null);
    setIsProcessing(false);

    // Verificar si se pueden actualizar variables (restricción de 5 minutos)
    const isUpdateAllowed = canUpdateVariables();
    setCanUpdate(isUpdateAllowed);

    if (!isUpdateAllowed) {
      setError("Debes esperar al menos 5 minutos entre actualizaciones de variables");
    }

    // Cargar variables existentes
    const existingVariables = state.global?.subjectiveVariables || [];
    setVariables(existingVariables);

    // Cargar últimos valores
    const latestValues = getLatestValues();

    // Inicializar valores con los últimos conocidos
    const initialValues = existingVariables.map((variable: SubjectiveVariable) => ({
      variableId: variable.id,
      currentValue: latestValues[variable.id] || 5, // Valor por defecto en el medio de la escala
    }));

    setValues(initialValues);

    // Inicializar actividades y eventos relacionados
    setSelectedActivityIds(relatedActivityIds);
    setSelectedEventIds(relatedEventIds);

    // Marcar como inicializado
    initialized.current = true;
  }, [
    canUpdateVariables,
    getLatestValues,
    relatedActivityIds,
    relatedEventIds,
    state.global?.subjectiveVariables,
  ]);

  // Inicializar estado al abrir el modal
  useEffect(() => {
    if (!open) {
      initialized.current = false;
      return;
    }

    if (!initialized.current) {
      initializeModal();
    }
  }, [open, initializeModal]);

  // Manejar el cambio de valor de una variable
  const handleVariableChange = useCallback((variableId: UUID, newValue: number) => {
    setValues((prevValues) => {
      // Buscar si ya existe un valor para esta variable
      const existingIndex = prevValues.findIndex((v) => v.variableId === variableId);

      if (existingIndex >= 0) {
        // Actualizar el valor existente
        const newValues = [...prevValues];
        newValues[existingIndex] = { ...newValues[existingIndex], currentValue: newValue };
        return newValues;
      } else {
        // Añadir un nuevo valor
        return [...prevValues, { variableId, currentValue: newValue }];
      }
    });
  }, []);

  // Crear una nueva variable subjetiva
  const handleCreateVariable = useCallback(() => {
    if (!newVariableName.trim()) {
      return;
    }

    try {
      setIsProcessing(true);
      const newVariable = createSubjectiveVariable(newVariableName.trim());

      // Actualizar lista de variables
      setVariables((prev) => [...prev, newVariable]);

      // Añadir valor inicial para la nueva variable
      setValues((prev) => [...prev, { variableId: newVariable.id, currentValue: 5 }]);

      // Limpiar formulario
      setNewVariableName("");
      setIsAddingVariable(false);
    } catch (error) {
      setError(
        `Error al crear variable: ${error instanceof Error ? error.message : "Error desconocido"}`
      );
    } finally {
      setIsProcessing(false);
    }
  }, [newVariableName, createSubjectiveVariable]);

  // Manejar la confirmación de los cambios
  const handleConfirm = useCallback(() => {
    if (!canUpdate) {
      setError("Debes esperar al menos 5 minutos entre actualizaciones de variables");
      return;
    }

    if (variables.length === 0) {
      setError("Debes crear al menos una variable subjetiva");
      return;
    }

    setIsProcessing(true);

    try {
      onConfirm(values, selectedActivityIds, selectedEventIds);
    } catch (error) {
      setError(
        `Error al guardar los cambios: ${error instanceof Error ? error.message : "Error desconocido"}`
      );
      setIsProcessing(false);
    }
  }, [canUpdate, variables.length, values, selectedActivityIds, selectedEventIds, onConfirm]);

  // Nuevo método para omitir la actualización de variables
  const handleSkip = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      data-testid="variable-modal"
      TransitionProps={{ mountOnEnter: true, unmountOnExit: true, timeout: { enter: 0, exit: 0 } }}
      BackdropProps={{ transitionDuration: 0 }}
    >
      <DialogTitle>
        Actualizar Variables Subjetivas
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
          data-testid="close-button"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {variables.length === 0 && !isAddingVariable ? (
          <Paper elevation={0} sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body1" gutterBottom>
              No hay variables subjetivas definidas.
            </Typography>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              color="primary"
              onClick={() => setIsAddingVariable(true)}
              sx={{ mt: 1 }}
            >
              Crear Primera Variable
            </Button>
          </Paper>
        ) : (
          <Stack spacing={3}>
            {/* Variables existentes */}
            {variables.map((variable) => {
              const value = values.find((v) => v.variableId === variable.id)?.currentValue || 5;

              return (
                <Box key={variable.id} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1">{variable.name}</Typography>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box flexGrow={1}>
                      <Slider
                        value={value}
                        onChange={(_, newValue) =>
                          handleVariableChange(variable.id, newValue as number)
                        }
                        min={1}
                        max={10}
                        step={1}
                        marks
                        valueLabelDisplay="auto"
                        disabled={isProcessing || !canUpdate}
                        data-testid={`variable-slider-${variable.id}`}
                      />
                    </Box>
                    <Box>
                      <Typography variant="body1">{value}</Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })}

            {/* Formulario para nueva variable */}
            {isAddingVariable && (
              <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Nueva Variable Subjetiva
                </Typography>
                <Box display="flex" alignItems="center">
                  <TextField
                    fullWidth
                    label="Nombre de la variable"
                    value={newVariableName}
                    onChange={(e) => setNewVariableName(e.target.value)}
                    disabled={isProcessing}
                    autoFocus
                    sx={{ mr: 1 }}
                    data-testid="new-variable-input"
                    error={newVariableName.trim() === ""}
                    helperText={
                      newVariableName.trim() === "" ? "El nombre no puede estar vacío" : ""
                    }
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleCreateVariable}
                    disabled={!newVariableName.trim() || isProcessing}
                  >
                    Añadir
                  </Button>
                </Box>
              </Paper>
            )}

            {/* Botón para añadir nueva variable (solo visible si ya hay variables) */}
            {variables.length > 0 && !isAddingVariable && (
              <Button
                startIcon={<AddIcon />}
                onClick={() => setIsAddingVariable(true)}
                disabled={isProcessing}
                data-testid="add-variable-button"
              >
                Añadir Variable
              </Button>
            )}

            {/* Sección para relacionar con actividades y eventos */}
            <Typography variant="subtitle1" sx={{ mt: 2 }}>
              Relacionado con:
            </Typography>

            {/* Selector de actividades relacionadas */}
            <FormControl fullWidth disabled={isProcessing}>
              <InputLabel id="related-activities-label">Actividades Relacionadas</InputLabel>
              <Select
                labelId="related-activities-label"
                multiple
                value={selectedActivityIds}
                onChange={(e) => setSelectedActivityIds(e.target.value as UUID[])}
                input={<OutlinedInput label="Actividades Relacionadas" />}
                data-testid="related-activities-select"
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((id) => {
                      const activity = recentCompletedActivities.find((a) => a.id === id);
                      return (
                        <Chip key={id} label={activity ? activity.templateTitle : "Actividad"} />
                      );
                    })}
                  </Box>
                )}
              >
                {recentCompletedActivities.map((activity) => (
                  <MenuItem key={activity.id} value={activity.id}>
                    {activity.templateTitle}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Selector de eventos relacionados */}
            <FormControl fullWidth disabled={isProcessing}>
              <InputLabel id="related-events-label">Eventos Relacionados</InputLabel>
              <Select
                labelId="related-events-label"
                multiple
                value={selectedEventIds}
                onChange={(e) => setSelectedEventIds(e.target.value as UUID[])}
                input={<OutlinedInput label="Eventos Relacionados" />}
                data-testid="related-events-select"
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((id) => {
                      const event = recentEvents.find((e) => e.id === id);
                      return <Chip key={id} label={event ? event.templateName : "Evento"} />;
                    })}
                  </Box>
                )}
              >
                {recentEvents.map((event) => (
                  <MenuItem key={event.id} value={event.id}>
                    {event.templateName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={handleSkip}
          color="secondary"
          disabled={isProcessing}
          data-testid="skip-variables-button"
        >
          Omitir actualización
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="primary"
          disabled={isProcessing || !canUpdate}
          data-testid="confirm-variables-button"
        >
          {isProcessing ? <CircularProgress size={24} color="inherit" /> : "Confirmar Valores"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VariableModal;
