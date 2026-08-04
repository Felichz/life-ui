import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  InputAdornment,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
} from "@mui/material";
import type { ActivityTemplate, UUID, DynamicSettings } from "../../types";
import { useSystemCore } from "../hooks/useSystemCore";

interface ActivityInstanceModalProps {
  open: boolean;
  onClose: () => void;
  templateId: UUID | null;
  blockId: UUID | null;
  instanceId?: UUID;
  isEditMode?: boolean;
  onConfirm: (templateId: UUID, blockId: UUID, dynamicSettings: DynamicSettings) => void;
}

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

  const currentActivityInstances = useMemo(() => {
    return state?.currentDay?.activityInstances || [];
  }, [state?.currentDay?.activityInstances]);

  const activityTemplates = useMemo(() => {
    return getActivityTemplates?.() || [];
  }, [getActivityTemplates]);

  const initializeDynamicSettings = (tpl: ActivityTemplate) => {
    let s: DynamicSettings = {};
    if (tpl.type === "clear-objective" && tpl.clearObjectiveSettings) {
      s = {
        clearObjectiveSettings: {
          estimatedDurationMinutes: tpl.clearObjectiveSettings.estimatedDurationMinutes,
        },
      };
    } else if (tpl.type === "flexible-duration" && tpl.flexibleDurationSettings) {
      s = {
        flexibleDurationSettings: {
          minimumDurationMinutes: tpl.flexibleDurationSettings.minimumDurationMinutes,
          maximumDurationMinutes: tpl.flexibleDurationSettings.maximumDurationMinutes,
        },
      };
    } else if (tpl.type === "timeboxing" && tpl.timeboxingSettings) {
      s = {
        timeboxingSettings: {
          type: tpl.timeboxingSettings.type,
          minimumDurationMinutes: tpl.timeboxingSettings.minimumDurationMinutes,
          maximumDurationMinutes: tpl.timeboxingSettings.maximumDurationMinutes,
        },
      };
    }
    return s;
  };

  const validateSettings = (settings: DynamicSettings) => {
    const newErrors: Record<string, string> = {};

    if (settings.clearObjectiveSettings) {
      const { estimatedDurationMinutes } = settings.clearObjectiveSettings;
      if (!estimatedDurationMinutes || estimatedDurationMinutes <= 0) {
        newErrors.estimatedDuration = "Indica una duración estimada";
      }
    }

    if (settings.flexibleDurationSettings) {
      const { minimumDurationMinutes, maximumDurationMinutes } = settings.flexibleDurationSettings;
      if (!minimumDurationMinutes || minimumDurationMinutes <= 0) {
        newErrors.minimumDuration = "Indica el mínimo";
      }
      if (!maximumDurationMinutes || maximumDurationMinutes <= 0) {
        newErrors.maximumDuration = "Indica el máximo";
      }
      if (
        minimumDurationMinutes &&
        maximumDurationMinutes &&
        minimumDurationMinutes > maximumDurationMinutes
      ) {
        newErrors.durationRange = "El mínimo no puede ser mayor al máximo";
      }
    }

    if (settings.timeboxingSettings) {
      const { type, minimumDurationMinutes, maximumDurationMinutes } = settings.timeboxingSettings;
      if (
        (type === "minimum-time" || type === "both") &&
        (!minimumDurationMinutes || minimumDurationMinutes <= 0)
      ) {
        newErrors.tbMinimumDuration = "Indica el mínimo";
      }
      if (
        (type === "maximum-time" || type === "both") &&
        (!maximumDurationMinutes || maximumDurationMinutes <= 0)
      ) {
        newErrors.tbMaximumDuration = "Indica el máximo";
      }
      if (
        type === "both" &&
        minimumDurationMinutes &&
        maximumDurationMinutes &&
        minimumDurationMinutes > maximumDurationMinutes
      ) {
        newErrors.tbDurationRange = "El mínimo no puede ser mayor al máximo";
      }
    }

    return { errors: newErrors, isValid: Object.keys(newErrors).length === 0 };
  };

  useEffect(() => {
    if (!open || !templateId) return;

    const foundTemplate = activityTemplates.find((t) => t.id === templateId);
    if (!foundTemplate) return;

    setTemplate(foundTemplate);

    let initialSettings: DynamicSettings;
    if (isEditMode && instanceId) {
      const instance = currentActivityInstances.find((a) => a.id === instanceId);
      if (instance) {
        initialSettings = {
          clearObjectiveSettings: instance.clearObjectiveSettings,
          flexibleDurationSettings: instance.flexibleDurationSettings,
          timeboxingSettings: instance.timeboxingSettings,
        };
      } else {
        initialSettings = initializeDynamicSettings(foundTemplate);
      }
    } else {
      initialSettings = initializeDynamicSettings(foundTemplate);
    }

    setDynamicSettings(initialSettings);
    const validation = validateSettings(initialSettings);
    setErrors(validation.errors);
    setIsValid(validation.isValid);
  }, [open, templateId, instanceId, isEditMode, activityTemplates, currentActivityInstances]);

  const handleConfirm = () => {
    if (templateId && blockId && isValid) {
      onConfirm(templateId, blockId, dynamicSettings);
    }
  };

  const handleClearObjectiveChange = (estimatedDurationMinutes: number) => {
    const newSettings = {
      ...dynamicSettings,
      clearObjectiveSettings: { estimatedDurationMinutes },
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

  const handleTimeboxingTypeChange = (type: "minimum-time" | "maximum-time" | "both") => {
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

  const renderClearObjectiveField = () => {
    const value = dynamicSettings.clearObjectiveSettings?.estimatedDurationMinutes || 0;
    return (
      <TextField
        fullWidth
        label="Duración estimada"
        type="number"
        value={value || ""}
        onChange={(e) => handleClearObjectiveChange(Number(e.target.value))}
        InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment> }}
        error={!!errors.estimatedDuration}
        helperText={errors.estimatedDuration || "Compararemos cuánto tardaste realmente"}
        margin="normal"
        data-testid="estimated-duration-input"
      />
    );
  };

  const renderFlexibleDurationFields = () => {
    const min = dynamicSettings.flexibleDurationSettings?.minimumDurationMinutes || 0;
    const max = dynamicSettings.flexibleDurationSettings?.maximumDurationMinutes || 0;
    return (
      <>
        <TextField
          fullWidth
          label="Duración mínima"
          type="number"
          value={min || ""}
          onChange={(e) =>
            handleFlexibleDurationChange("minimumDurationMinutes", Number(e.target.value))
          }
          InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment> }}
          error={!!errors.minimumDuration || !!errors.durationRange}
          helperText={errors.minimumDuration || errors.durationRange}
          margin="normal"
          data-testid="min-duration-input"
        />
        <TextField
          fullWidth
          label="Duración máxima"
          type="number"
          value={max || ""}
          onChange={(e) =>
            handleFlexibleDurationChange("maximumDurationMinutes", Number(e.target.value))
          }
          InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment> }}
          error={!!errors.maximumDuration || !!errors.durationRange}
          helperText={errors.maximumDuration}
          margin="normal"
          data-testid="max-duration-input"
        />
      </>
    );
  };

  const renderTimeboxingFields = () => {
    const tb = dynamicSettings.timeboxingSettings;
    if (!tb) return null;
    const tbType = tb.type;

    return (
      <Stack spacing={2} sx={{ mt: 1 }}>
        <Box>
          <Typography variant="body2" sx={{ mb: 1 }}>
            ¿Qué tipo de compromiso quieres hoy?
          </Typography>
          <ToggleButtonGroup
            value={tbType}
            exclusive
            onChange={(_, v) => v && handleTimeboxingTypeChange(v)}
            color="primary"
            sx={{ flexWrap: "wrap" }}
            data-testid="timeboxing-question-group"
          >
            <ToggleButton value="minimum-time" sx={{ textTransform: "none" }}>
              Al menos X min
            </ToggleButton>
            <ToggleButton value="maximum-time" sx={{ textTransform: "none" }}>
              No más de X min
            </ToggleButton>
            <ToggleButton value="both" sx={{ textTransform: "none" }}>
              Entre X e Y min
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {(tbType === "minimum-time" || tbType === "both") && (
          <TextField
            fullWidth
            label={tbType === "both" ? "Mínimo (min)" : "¿Cuántos minutos como mínimo?"}
            type="number"
            data-testid="tb-min-duration-input"
            InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment> }}
            value={tb.minimumDurationMinutes || ""}
            onChange={(e) =>
              handleTimeboxingDurationChange("minimumDurationMinutes", Number(e.target.value))
            }
            error={!!errors.tbMinimumDuration || !!errors.tbDurationRange}
            helperText={errors.tbMinimumDuration || errors.tbDurationRange}
          />
        )}

        {(tbType === "maximum-time" || tbType === "both") && (
          <TextField
            fullWidth
            label={tbType === "both" ? "Máximo (min)" : "¿Cuántos minutos como máximo?"}
            type="number"
            data-testid="tb-max-duration-input"
            InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment> }}
            value={tb.maximumDurationMinutes || ""}
            onChange={(e) =>
              handleTimeboxingDurationChange("maximumDurationMinutes", Number(e.target.value))
            }
            error={!!errors.tbMaximumDuration || !!errors.tbDurationRange}
            helperText={errors.tbMaximumDuration}
          />
        )}
      </Stack>
    );
  };

  const renderDynamicFields = () => {
    if (!template) return null;

    if (template.type === "clear-objective") return renderClearObjectiveField();
    if (template.type === "flexible-duration") return renderFlexibleDurationFields();
    if (template.type === "timeboxing") return renderTimeboxingFields();
    return null;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      data-testid="activity-instance-modal"
    >
      <DialogTitle>{isEditMode ? "Editar actividad" : "Añadir a tu día"}</DialogTitle>
      <DialogContent>
        {template ? (
          <>
            <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: "#f4f6fb" }}>
              <Typography variant="overline" color="text.secondary">
                De tu biblioteca
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {template.title}
              </Typography>
              {template.description && (
                <Typography variant="body2" color="text.secondary">
                  {template.description}
                </Typography>
              )}
            </Paper>
            {renderDynamicFields()}
          </>
        ) : (
          <Typography>Cargando datos de la actividad...</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" data-testid="cancel-button">
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          color="primary"
          variant="contained"
          disabled={!template || !isValid}
          data-testid="confirm-button"
        >
          {isEditMode ? "Guardar cambios" : "Confirmar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ActivityInstanceModal;
