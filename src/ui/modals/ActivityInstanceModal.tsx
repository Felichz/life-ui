import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Box,
  Typography,
  InputAdornment,
} from "@mui/material";
import type {
  ActivityTemplate,
  ActivityType,
  ActivityInstance,
  UUID,
  TimeboxingType,
  DynamicSettings,
} from "../../types";
import { useSystemCore } from "../hooks/useSystemCore";

interface ActivityInstanceModalProps {
  open: boolean;
  onClose: () => void;
  templateId: UUID | null;
  blockId: UUID | null;
  instanceId?: UUID; // ID de la instancia en caso de edición
  isEditMode?: boolean; // Modo edición o creación
  onConfirm: (templateId: UUID, blockId: UUID, dynamicSettings: DynamicSettings) => void;
}

/**
 * Modal para configurar propiedades dinámicas al crear o editar una instancia de actividad
 */
const ActivityInstanceModal: React.FC<ActivityInstanceModalProps> = ({
  open,
  onClose,
  templateId,
  blockId,
  instanceId,
  isEditMode = false,
  onConfirm,
}) => {
  const { getActivityTemplates, state } = useSystemCore();
  const [template, setTemplate] = useState<ActivityTemplate | null>(null);
  const [dynamicSettings, setDynamicSettings] = useState<DynamicSettings>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValid, setIsValid] = useState<boolean>(false);

  // Memorizar las instancias de actividad actuales para evitar referencias cambiantes
  const currentActivityInstances = useMemo(() => {
    return state?.currentDay?.activityInstances || [];
  }, [state?.currentDay?.activityInstances]);

  // Memorizar los templates para evitar renderizaciones innecesarias
  const activityTemplates = useMemo(() => {
    return getActivityTemplates?.() || [];
  }, [getActivityTemplates]);

  // Inicializar configuraciones dinámicas según el tipo de actividad
  const initializeDynamicSettings = (template: ActivityTemplate) => {
    let newSettings: DynamicSettings = {};

    if (template.type === "clear-objective" && template.clearObjectiveSettings) {
      newSettings = {
        clearObjectiveSettings: {
          estimatedDurationMinutes: template.clearObjectiveSettings.estimatedDurationMinutes,
        },
      };
    } else if (template.type === "flexible-duration" && template.flexibleDurationSettings) {
      newSettings = {
        flexibleDurationSettings: {
          minimumDurationMinutes: template.flexibleDurationSettings.minimumDurationMinutes,
          maximumDurationMinutes: template.flexibleDurationSettings.maximumDurationMinutes,
        },
      };
    } else if (template.type === "timeboxing" && template.timeboxingSettings) {
      newSettings = {
        timeboxingSettings: {
          type: template.timeboxingSettings.type,
          minimumDurationMinutes: template.timeboxingSettings.minimumDurationMinutes,
          maximumDurationMinutes: template.timeboxingSettings.maximumDurationMinutes,
        },
      };
    }

    return newSettings;
  };

  // Validar las configuraciones
  const validateSettings = (settings: DynamicSettings) => {
    const newErrors: Record<string, string> = {};

    if (settings.clearObjectiveSettings) {
      const { estimatedDurationMinutes } = settings.clearObjectiveSettings;
      if (!estimatedDurationMinutes || estimatedDurationMinutes <= 0) {
        newErrors.estimatedDuration = "La duración estimada debe ser mayor a 0";
      }
    }

    if (settings.flexibleDurationSettings) {
      const { minimumDurationMinutes, maximumDurationMinutes } = settings.flexibleDurationSettings;
      if (!minimumDurationMinutes || minimumDurationMinutes <= 0) {
        newErrors.minimumDuration = "La duración mínima debe ser mayor a 0";
      }
      if (!maximumDurationMinutes || maximumDurationMinutes <= 0) {
        newErrors.maximumDuration = "La duración máxima debe ser mayor a 0";
      }
      if (
        minimumDurationMinutes &&
        maximumDurationMinutes &&
        minimumDurationMinutes > maximumDurationMinutes
      ) {
        newErrors.durationRange = "La duración mínima no puede ser mayor a la máxima";
      }
    }

    if (settings.timeboxingSettings) {
      const { type, minimumDurationMinutes, maximumDurationMinutes } = settings.timeboxingSettings;

      if (
        (type === "minimum-time" || type === "both") &&
        (!minimumDurationMinutes || minimumDurationMinutes <= 0)
      ) {
        newErrors.tbMinimumDuration = "El tiempo mínimo debe ser mayor a 0";
      }

      if (
        (type === "maximum-time" || type === "both") &&
        (!maximumDurationMinutes || maximumDurationMinutes <= 0)
      ) {
        newErrors.tbMaximumDuration = "El tiempo máximo debe ser mayor a 0";
      }

      if (
        type === "both" &&
        minimumDurationMinutes &&
        maximumDurationMinutes &&
        minimumDurationMinutes > maximumDurationMinutes
      ) {
        newErrors.tbDurationRange = "El tiempo mínimo no puede ser mayor al máximo";
      }
    }

    return { errors: newErrors, isValid: Object.keys(newErrors).length === 0 };
  };

  // Cargar la plantilla y si es edición, también la instancia
  useEffect(() => {
    if (!open || !templateId) return;

    // Obtener la plantilla
    const foundTemplate = activityTemplates.find((t) => t.id === templateId);
    if (!foundTemplate) return;

    setTemplate(foundTemplate);

    // Inicializar settings con valores por defecto
    let initialSettings: DynamicSettings;

    // En modo edición, cargar los valores de la instancia
    if (isEditMode && instanceId) {
      const instance = currentActivityInstances.find((a) => a.id === instanceId);
      if (instance) {
        // Usar los valores de la instancia existente
        initialSettings = {
          clearObjectiveSettings: instance.clearObjectiveSettings,
          flexibleDurationSettings: instance.flexibleDurationSettings,
          timeboxingSettings: instance.timeboxingSettings,
        };
      } else {
        // Si no se encuentra la instancia, inicializar con valores de plantilla
        initialSettings = initializeDynamicSettings(foundTemplate);
      }
    } else {
      // Modo creación, inicializar con la plantilla
      initialSettings = initializeDynamicSettings(foundTemplate);
    }

    setDynamicSettings(initialSettings);
    const validation = validateSettings(initialSettings);
    setErrors(validation.errors);
    setIsValid(validation.isValid);

    // Remover state.currentDay para evitar re-renders infinitos
    // Solo dependemos de la lista memoizada de instancias
  }, [open, templateId, instanceId, isEditMode, activityTemplates, currentActivityInstances]);

  const handleConfirm = () => {
    if (templateId && blockId && isValid) {
      onConfirm(templateId, blockId, dynamicSettings);
    }
  };

  const handleClearObjectiveChange = (estimatedDurationMinutes: number) => {
    const newSettings = {
      ...dynamicSettings,
      clearObjectiveSettings: {
        estimatedDurationMinutes,
      },
    };
    setDynamicSettings(newSettings);
    const validation = validateSettings(newSettings);
    setErrors(validation.errors);
    setIsValid(validation.isValid);
  };

  const handleFlexibleDurationChange = (
    field: "minimumDurationMinutes" | "maximumDurationMinutes",
    value: number
  ) => {
    const newSettings = {
      ...dynamicSettings,
      flexibleDurationSettings: {
        minimumDurationMinutes:
          field === "minimumDurationMinutes"
            ? value
            : (dynamicSettings.flexibleDurationSettings?.minimumDurationMinutes ?? 0),
        maximumDurationMinutes:
          field === "maximumDurationMinutes"
            ? value
            : (dynamicSettings.flexibleDurationSettings?.maximumDurationMinutes ?? 0),
      },
    };
    setDynamicSettings(newSettings);
    const validation = validateSettings(newSettings);
    setErrors(validation.errors);
    setIsValid(validation.isValid);
  };

  const handleTimeboxingTypeChange = (type: TimeboxingType) => {
    const newSettings = {
      ...dynamicSettings,
      timeboxingSettings: {
        type,
        minimumDurationMinutes: dynamicSettings.timeboxingSettings?.minimumDurationMinutes,
        maximumDurationMinutes: dynamicSettings.timeboxingSettings?.maximumDurationMinutes,
      },
    };
    setDynamicSettings(newSettings);
    const validation = validateSettings(newSettings);
    setErrors(validation.errors);
    setIsValid(validation.isValid);
  };

  const handleTimeboxingDurationChange = (
    field: "minimumDurationMinutes" | "maximumDurationMinutes",
    value: number
  ) => {
    const newSettings = {
      ...dynamicSettings,
      timeboxingSettings: {
        type: dynamicSettings.timeboxingSettings?.type || "minimum-time",
        ...dynamicSettings.timeboxingSettings,
        [field]: value,
      },
    };
    setDynamicSettings(newSettings);
    const validation = validateSettings(newSettings);
    setErrors(validation.errors);
    setIsValid(validation.isValid);
  };

  const renderDynamicFields = () => {
    if (!template) return null;

    switch (template.type) {
      case "clear-objective":
        return (
          <Box>
            <TextField
              fullWidth
              label="Duración estimada"
              type="number"
              value={dynamicSettings.clearObjectiveSettings?.estimatedDurationMinutes || ""}
              onChange={(e) => handleClearObjectiveChange(Number(e.target.value))}
              InputProps={{
                endAdornment: <InputAdornment position="end">min</InputAdornment>,
              }}
              error={!!errors.estimatedDuration}
              helperText={errors.estimatedDuration}
              margin="normal"
            />
          </Box>
        );

      case "flexible-duration":
        return (
          <Box>
            <TextField
              fullWidth
              label="Duración mínima"
              type="number"
              value={dynamicSettings.flexibleDurationSettings?.minimumDurationMinutes || ""}
              onChange={(e) =>
                handleFlexibleDurationChange("minimumDurationMinutes", Number(e.target.value))
              }
              InputProps={{
                endAdornment: <InputAdornment position="end">min</InputAdornment>,
              }}
              error={!!errors.minimumDuration || !!errors.durationRange}
              helperText={errors.minimumDuration || errors.durationRange}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Duración máxima"
              type="number"
              value={dynamicSettings.flexibleDurationSettings?.maximumDurationMinutes || ""}
              onChange={(e) =>
                handleFlexibleDurationChange("maximumDurationMinutes", Number(e.target.value))
              }
              InputProps={{
                endAdornment: <InputAdornment position="end">min</InputAdornment>,
              }}
              error={!!errors.maximumDuration || !!errors.durationRange}
              helperText={errors.maximumDuration}
              margin="normal"
            />
          </Box>
        );

      case "timeboxing":
        return (
          <Box>
            <FormControl fullWidth margin="normal">
              <InputLabel>Tipo de timeboxing</InputLabel>
              <Select
                value={dynamicSettings.timeboxingSettings?.type || "minimum-time"}
                onChange={(e) => handleTimeboxingTypeChange(e.target.value as TimeboxingType)}
                label="Tipo de timeboxing"
              >
                <MenuItem value="minimum-time">Tiempo mínimo</MenuItem>
                <MenuItem value="maximum-time">Tiempo máximo</MenuItem>
                <MenuItem value="both">Ambos</MenuItem>
              </Select>
              <FormHelperText>Selecciona el tipo de limitación de tiempo</FormHelperText>
            </FormControl>

            {(dynamicSettings.timeboxingSettings?.type === "minimum-time" ||
              dynamicSettings.timeboxingSettings?.type === "both") && (
              <TextField
                fullWidth
                label="Tiempo mínimo"
                type="number"
                InputProps={{
                  endAdornment: <InputAdornment position="end">min</InputAdornment>,
                }}
                value={dynamicSettings.timeboxingSettings?.minimumDurationMinutes || ""}
                onChange={(e) =>
                  handleTimeboxingDurationChange("minimumDurationMinutes", Number(e.target.value))
                }
                error={!!errors.tbMinimumDuration || !!errors.tbDurationRange}
                helperText={errors.tbMinimumDuration || errors.tbDurationRange}
                margin="normal"
              />
            )}

            {(dynamicSettings.timeboxingSettings?.type === "maximum-time" ||
              dynamicSettings.timeboxingSettings?.type === "both") && (
              <TextField
                fullWidth
                label="Tiempo máximo"
                type="number"
                InputProps={{
                  endAdornment: <InputAdornment position="end">min</InputAdornment>,
                }}
                value={dynamicSettings.timeboxingSettings?.maximumDurationMinutes || ""}
                onChange={(e) =>
                  handleTimeboxingDurationChange("maximumDurationMinutes", Number(e.target.value))
                }
                error={!!errors.tbMaximumDuration || !!errors.tbDurationRange}
                helperText={errors.tbMaximumDuration}
                margin="normal"
              />
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEditMode ? "Editar actividad" : "Configurar actividad"}</DialogTitle>
      <DialogContent>
        {template ? (
          <>
            <Typography variant="h6" gutterBottom>
              {template.title}
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              {template.description}
            </Typography>
            {renderDynamicFields()}
          </>
        ) : (
          <Typography>Cargando datos de la actividad...</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          color="primary"
          variant="contained"
          disabled={!template || !isValid}
        >
          {isEditMode ? "Guardar cambios" : "Confirmar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ActivityInstanceModal;
