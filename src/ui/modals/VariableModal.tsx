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
  Chip,
  CircularProgress,
  Paper,
  IconButton,
  Alert,
  Stack,
  FormControlLabel,
  Checkbox,
  Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useSystemCore } from "../hooks/useSystemCore";
import type { SubjectiveVariable, UUID, CompletedActivityRecord, EventInstance } from "../../types";

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

const STARTER_VARIABLES: { name: string; description: string }[] = [
  { name: "Energía", description: "Cuánta vitalidad sientes ahora mismo" },
  { name: "Concentración", description: "Qué tan enfocado te sientes" },
  { name: "Ánimo", description: "Tu estado emocional general" },
  { name: "Estrés", description: "Qué tan tenso te sientes" },
];

function relTimeLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString();
}

const VariableModal: React.FC<VariableModalProps> = ({
  open,
  onClose,
  relatedActivityIds = [],
  relatedEventIds = [],
  onConfirm,
}) => {
  const { createSubjectiveVariable, getLatestValues, canUpdateVariables, state } = useSystemCore();

  const [variables, setVariables] = useState<SubjectiveVariable[]>([]);
  const [values, setValues] = useState<{ variableId: UUID; currentValue: number }[]>([]);
  const [newVariableName, setNewVariableName] = useState("");
  const [isAddingVariable, setIsAddingVariable] = useState(false);
  const [selectedActivityIds, setSelectedActivityIds] = useState<UUID[]>(relatedActivityIds);
  const [selectedEventIds, setSelectedEventIds] = useState<UUID[]>(relatedEventIds);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canUpdate, setCanUpdate] = useState(true);
  const [showStarterSet, setShowStarterSet] = useState(false);
  const initialized = useRef(false);

  const recentCompletedActivities = useMemo(() => {
    const completedRecords = state.global?.completedActivityRecords || [];
    const currentDayId = state.currentDay?.day?.id;
    if (!currentDayId) return [];
    return completedRecords
      .filter((record: CompletedActivityRecord) => record.dayId === currentDayId)
      .sort(
        (a: CompletedActivityRecord, b: CompletedActivityRecord) =>
          new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
      )
      .slice(0, 5);
  }, [state.global?.completedActivityRecords, state.currentDay?.day?.id]);

  const recentEvents = useMemo(() => {
    const events = state.global?.eventInstances || [];
    const currentDayId = state.currentDay?.day?.id;
    if (!currentDayId) return [];
    return events
      .filter((event: EventInstance) => event.dayId === currentDayId)
      .sort(
        (a: EventInstance, b: EventInstance) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 5);
  }, [state.global?.eventInstances, state.currentDay?.day?.id]);

  const activeActivityInstance = useMemo(() => {
    return state.currentDay?.activityInstances?.find((a) => a.state === "active");
  }, [state.currentDay?.activityInstances]);

  const initializeModal = useCallback(() => {
    setError(null);
    setIsProcessing(false);

    const isUpdateAllowed = canUpdateVariables();
    setCanUpdate(isUpdateAllowed);
    if (!isUpdateAllowed) {
      setError("Debes esperar al menos 5 minutos entre actualizaciones de variables");
    }

    const existingVariables = state.global?.subjectiveVariables || [];
    setVariables(existingVariables);

    const latestValues = getLatestValues();
    const initialValues = existingVariables.map((variable: SubjectiveVariable) => ({
      variableId: variable.id,
      currentValue: latestValues[variable.id] || 5,
    }));
    setValues(initialValues);

    // Preselecciones (#5): actividad activa + últimos 3 eventos
    const preselectedActivityIds = relatedActivityIds.length
      ? relatedActivityIds
      : activeActivityInstance
        ? [activeActivityInstance.id]
        : [];
    const preselectedEventIds = relatedEventIds.length
      ? relatedEventIds
      : recentEvents.slice(0, 3).map((e) => e.id);

    setSelectedActivityIds(preselectedActivityIds);
    setSelectedEventIds(preselectedEventIds);

    setShowStarterSet(existingVariables.length === 0);

    initialized.current = true;
  }, [
    canUpdateVariables,
    getLatestValues,
    relatedActivityIds,
    relatedEventIds,
    state.global?.subjectiveVariables,
    activeActivityInstance,
    recentEvents,
  ]);

  useEffect(() => {
    if (!open) {
      initialized.current = false;
      return;
    }
    if (!initialized.current) {
      initializeModal();
    }
  }, [open, initializeModal]);

  const handleVariableChange = useCallback((variableId: UUID, newValue: number) => {
    setValues((prevValues) => {
      const existingIndex = prevValues.findIndex((v) => v.variableId === variableId);
      if (existingIndex >= 0) {
        const newValues = [...prevValues];
        newValues[existingIndex] = { ...newValues[existingIndex], currentValue: newValue };
        return newValues;
      }
      return [...prevValues, { variableId, currentValue: newValue }];
    });
  }, []);

  const handleCreateVariable = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      try {
        setIsProcessing(true);
        const newVariable = createSubjectiveVariable(trimmed);
        setVariables((prev) => [...prev, newVariable]);
        setValues((prev) => [...prev, { variableId: newVariable.id, currentValue: 5 }]);
      } catch (err) {
        setError(
          `Error al crear variable: ${err instanceof Error ? err.message : "Error desconocido"}`
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [createSubjectiveVariable]
  );

  const handleAddStarterVariable = (name: string) => {
    handleCreateVariable(name);
  };

  const handleAddCustomVariable = () => {
    handleCreateVariable(newVariableName);
    setNewVariableName("");
    setIsAddingVariable(false);
  };

  const handleConfirm = useCallback(() => {
    if (!canUpdate) {
      setError("Debes esperar al menos 5 minutos entre actualizaciones de variables");
      return;
    }
    if (variables.length === 0) {
      setError("Activa al menos una variable para registrar");
      return;
    }
    setIsProcessing(true);
    try {
      onConfirm(values, selectedActivityIds, selectedEventIds);
    } catch (err) {
      setError(
        `Error al guardar los cambios: ${err instanceof Error ? err.message : "Error desconocido"}`
      );
      setIsProcessing(false);
    }
  }, [canUpdate, variables.length, values, selectedActivityIds, selectedEventIds, onConfirm]);

  const handleSkip = useCallback(() => {
    onClose();
  }, [onClose]);

  const toggleActivity = (id: UUID) => {
    setSelectedActivityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleEvent = (id: UUID) => {
    setSelectedEventIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

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
        ¿Cómo te sientes ahora?
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

        {showStarterSet && variables.length === 0 ? (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Empieza con estas variables. Puedes editarlas o añadir más después.
            </Typography>
            <Stack spacing={1.5}>
              {STARTER_VARIABLES.map((sv) => (
                <Paper
                  key={sv.name}
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: "#f4f6fb",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle2">{sv.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {sv.description}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleAddStarterVariable(sv.name)}
                    disabled={isProcessing}
                    data-testid={`add-starter-${sv.name.toLowerCase()}`}
                  >
                    Activar
                  </Button>
                </Paper>
              ))}
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Button
              size="small"
              onClick={() => setIsAddingVariable(true)}
              data-testid="add-custom-variable-early"
            >
              Crear una variable distinta
            </Button>
          </Box>
        ) : (
          <Stack spacing={3}>
            <Box>
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
                      <Box sx={{ minWidth: 32, textAlign: "right" }}>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {value}/10
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {!isAddingVariable ? (
              <Button
                size="small"
                onClick={() => setIsAddingVariable(true)}
                disabled={isProcessing}
                data-testid="add-variable-button"
              >
                Añadir variable
              </Button>
            ) : (
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: "#f4f6fb" }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Nombre de la nueva variable
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Ej: Dolor de espalda"
                    value={newVariableName}
                    onChange={(e) => setNewVariableName(e.target.value)}
                    disabled={isProcessing}
                    autoFocus
                    data-testid="new-variable-input"
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleAddCustomVariable}
                    disabled={!newVariableName.trim() || isProcessing}
                  >
                    Añadir
                  </Button>
                </Box>
              </Paper>
            )}

            <Divider />

            {/* Sección causal (#5): preselecciones visibles con contexto */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                ¿A qué lo atribuyes?
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1.5 }}
              >
                Confirmamos las más probables. Desmarca las que no apliquen.
              </Typography>

              {activeActivityInstance && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="overline" color="text.secondary">
                    Actividad en curso
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    <Chip
                      label={`${getActivityTitle(activeActivityInstance.id, state.currentDay?.activityInstances || [])} (ahora)`}
                      onClick={() => toggleActivity(activeActivityInstance.id)}
                      color={
                        selectedActivityIds.includes(activeActivityInstance.id)
                          ? "primary"
                          : "default"
                      }
                      variant={
                        selectedActivityIds.includes(activeActivityInstance.id)
                          ? "filled"
                          : "outlined"
                      }
                      size="small"
                    />
                  </Box>
                </Box>
              )}

              {recentCompletedActivities.length > 0 && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="overline" color="text.secondary">
                    Actividades recientes
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    {recentCompletedActivities.map((a) => (
                      <FormControlLabel
                        key={a.id}
                        control={
                          <Checkbox
                            size="small"
                            checked={selectedActivityIds.includes(a.id)}
                            onChange={() => toggleActivity(a.id)}
                            data-testid={`related-activity-${a.id}`}
                          />
                        }
                        label={
                          <Typography variant="body2">
                            <strong>{a.templateTitle}</strong>{" "}
                            <Typography component="span" variant="caption" color="text.secondary">
                              · {relTimeLabel(a.endTime)}
                            </Typography>
                          </Typography>
                        }
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {recentEvents.length > 0 && (
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Eventos recientes
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    {recentEvents.map((e) => (
                      <FormControlLabel
                        key={e.id}
                        control={
                          <Checkbox
                            size="small"
                            checked={selectedEventIds.includes(e.id)}
                            onChange={() => toggleEvent(e.id)}
                            data-testid={`related-event-${e.id}`}
                          />
                        }
                        label={
                          <Typography variant="body2">
                            <strong>{e.templateName}</strong>{" "}
                            <Typography component="span" variant="caption" color="text.secondary">
                              · {relTimeLabel(e.timestamp)}
                            </Typography>
                          </Typography>
                        }
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
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
          Omitir
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="primary"
          disabled={isProcessing || !canUpdate || variables.length === 0}
          data-testid="confirm-variables-button"
        >
          {isProcessing ? <CircularProgress size={24} color="inherit" /> : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

function getActivityTitle(instanceId: UUID, instances: { id: UUID; templateId: string }[]): string {
  const inst = instances.find((i) => i.id === instanceId);
  return inst ? `Actividad ${inst.templateId.slice(0, 4)}` : "Actividad actual";
}

export default VariableModal;
