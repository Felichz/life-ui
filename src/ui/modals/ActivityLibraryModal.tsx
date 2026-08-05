import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Divider,
  Grid,
  Alert,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import TimerRoundedIcon from "@mui/icons-material/TimerRounded";
import HorizontalRuleRoundedIcon from "@mui/icons-material/HorizontalRuleRounded";
import HeightRoundedIcon from "@mui/icons-material/HeightRounded";
import SyncAltRoundedIcon from "@mui/icons-material/SyncAltRounded";
import type { ActivityTemplate, UUID, TimeboxingType } from "../../types";
import { useSystemCore } from "../hooks/useSystemCore";
import { Draggable, Droppable } from "@hello-pangea/dnd";

type DurationQuestion = "estimate" | "range" | "commitment";
type TimeboxingQuestion = "minimum-time" | "maximum-time" | "both";

interface ActivityLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onOpenCreate: () => void;
  onOpenEdit: (template: ActivityTemplate) => void;
  onConfirmDelete: (templateId: UUID) => void;
  onDelete: () => void;
  onCancelDelete: () => void;
  onSave: (data: Omit<ActivityTemplate, "id" | "createdAt" | "updatedAt">) => void;
  onOpenInstanceModal: (templateId: UUID, blockId: UUID) => void;
  editingTemplate: ActivityTemplate | null;
  confirmDeleteId: UUID | null;
}

const ActivityLibraryModal: React.FC<ActivityLibraryModalProps> = ({
  open,
  onClose,
  onOpenEdit,
  onConfirmDelete,
  onDelete,
  onCancelDelete,
  onSave,
  onOpenInstanceModal,
  editingTemplate,
  confirmDeleteId,
}) => {
  const { getActivityTemplates, getTimeBlocks } = useSystemCore();
  const [activities, setActivities] = useState<ActivityTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<ActivityTemplate | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationQuestion, setDurationQuestion] = useState<DurationQuestion>("estimate");
  const [estimatedDuration, setEstimatedDuration] = useState<number>(30);
  const [minDuration, setMinDuration] = useState<number>(15);
  const [maxDuration, setMaxDuration] = useState<number>(45);
  const [timeboxingQuestion, setTimeboxingQuestion] = useState<TimeboxingQuestion>("minimum-time");
  const [tbMinDuration, setTbMinDuration] = useState<number>(15);
  const [tbMaxDuration, setTbMaxDuration] = useState<number>(45);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const inferredType = useMemo(() => {
    if (durationQuestion === "estimate") return "clear-objective" as const;
    if (durationQuestion === "range") return "flexible-duration" as const;
    return "timeboxing" as const;
  }, [durationQuestion]);

  useEffect(() => {
    let isMounted = true;
    if (open) {
      const templates = getActivityTemplates();
      if (isMounted) setActivities(templates);
    }
    return () => {
      isMounted = false;
    };
  }, [open]);

  useEffect(() => {
    if (editingTemplate) {
      setTitle(editingTemplate.title);
      setDescription(editingTemplate.description);

      if (editingTemplate.type === "clear-objective" && editingTemplate.clearObjectiveSettings) {
        setDurationQuestion("estimate");
        setEstimatedDuration(editingTemplate.clearObjectiveSettings.estimatedDurationMinutes);
      } else if (
        editingTemplate.type === "flexible-duration" &&
        editingTemplate.flexibleDurationSettings
      ) {
        setDurationQuestion("range");
        setMinDuration(editingTemplate.flexibleDurationSettings.minimumDurationMinutes);
        setMaxDuration(editingTemplate.flexibleDurationSettings.maximumDurationMinutes);
      } else if (editingTemplate.type === "timeboxing" && editingTemplate.timeboxingSettings) {
        setDurationQuestion("commitment");
        setTimeboxingQuestion(editingTemplate.timeboxingSettings.type);
        if (editingTemplate.timeboxingSettings.minimumDurationMinutes) {
          setTbMinDuration(editingTemplate.timeboxingSettings.minimumDurationMinutes);
        }
        if (editingTemplate.timeboxingSettings.maximumDurationMinutes) {
          setTbMaxDuration(editingTemplate.timeboxingSettings.maximumDurationMinutes);
        }
      }
      setIsFormOpen(true);
    }
  }, [editingTemplate]);

  useEffect(() => {
    if (open && confirmDeleteId === null && showDeleteConfirm === false) {
      const templates = getActivityTemplates();
      setActivities(templates);
    }
  }, [open, confirmDeleteId, showDeleteConfirm, getActivityTemplates]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDurationQuestion("estimate");
    setEstimatedDuration(30);
    setMinDuration(15);
    setMaxDuration(45);
    setTimeboxingQuestion("minimum-time");
    setTbMinDuration(15);
    setTbMaxDuration(45);
    setErrors({});
  };

  const handleOpenCreateForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = "El título es obligatorio";
    if (!description.trim()) newErrors.description = "La descripción es obligatoria";

    if (durationQuestion === "estimate") {
      if (!estimatedDuration || estimatedDuration <= 0) {
        newErrors.estimatedDuration = "Indica cuánto suele durar";
      }
    } else if (durationQuestion === "range") {
      if (!minDuration || minDuration <= 0) {
        newErrors.minDuration = "Indica una duración mínima";
      }
      if (!maxDuration || maxDuration <= 0) {
        newErrors.maxDuration = "Indica una duración máxima";
      }
      if (minDuration && maxDuration && minDuration >= maxDuration) {
        newErrors.durationRange = "El mínimo debe ser menor que el máximo";
      }
    } else {
      if (timeboxingQuestion === "minimum-time" || timeboxingQuestion === "both") {
        if (!tbMinDuration || tbMinDuration <= 0) {
          newErrors.tbMinDuration = "Indica el compromiso mínimo";
        }
      }
      if (timeboxingQuestion === "maximum-time" || timeboxingQuestion === "both") {
        if (!tbMaxDuration || tbMaxDuration <= 0) {
          newErrors.tbMaxDuration = "Indica el compromiso máximo";
        }
      }
      if (
        timeboxingQuestion === "both" &&
        tbMinDuration &&
        tbMaxDuration &&
        tbMinDuration >= tbMaxDuration
      ) {
        newErrors.tbDurationRange = "El mínimo debe ser menor que el máximo";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveForm = () => {
    if (!validateForm()) return;

    const templateData: Omit<ActivityTemplate, "id" | "createdAt" | "updatedAt"> = {
      title,
      description,
      type: inferredType,
      isSystemActivity: false,
    };

    if (inferredType === "clear-objective") {
      templateData.clearObjectiveSettings = { estimatedDurationMinutes: estimatedDuration };
    } else if (inferredType === "flexible-duration") {
      templateData.flexibleDurationSettings = {
        minimumDurationMinutes: minDuration,
        maximumDurationMinutes: maxDuration,
      };
    } else {
      const tbSettings: {
        type: TimeboxingType;
        minimumDurationMinutes?: number;
        maximumDurationMinutes?: number;
      } = { type: timeboxingQuestion };
      if (timeboxingQuestion === "minimum-time" || timeboxingQuestion === "both") {
        tbSettings.minimumDurationMinutes = tbMinDuration;
      }
      if (timeboxingQuestion === "maximum-time" || timeboxingQuestion === "both") {
        tbSettings.maximumDurationMinutes = tbMaxDuration;
      }
      templateData.timeboxingSettings = tbSettings;
    }

    onSave(templateData);
    setIsFormOpen(false);
    resetForm();
    const updatedTemplates = getActivityTemplates();
    setActivities(updatedTemplates);
  };

  const handleCardClick = (template: ActivityTemplate) => {
    const blocks = getTimeBlocks();
    const defaultBlock = blocks.find((block) => block.isDefault);
    if (defaultBlock) onOpenInstanceModal(template.id, defaultBlock.id);
  };

  const handleConfirmDelete = (template: ActivityTemplate) => {
    setTemplateToDelete(template);
    setShowDeleteConfirm(true);
    onConfirmDelete(template.id);
  };

  const handleDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);
    const updatedTemplates = getActivityTemplates();
    setActivities(updatedTemplates);
  };

  const handleCancelDelete = () => {
    onCancelDelete();
    setShowDeleteConfirm(false);
  };

  const filteredActivities = activities.filter(
    (activity) =>
      activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderPreview = () => {
    if (durationQuestion === "estimate") {
      return (
        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: "#f4f6fb" }}>
          <Typography variant="overline" color="text.secondary">
            Vista previa
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title || "Tu actividad"}
          </Typography>
          <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <TimerRoundedIcon fontSize="small" color="primary" />
            <Typography variant="body2">
              Estimado: <strong>~{estimatedDuration || "?"} min</strong>
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Al finalizar, verás cuánto tardaste realmente vs. lo estimado.
          </Typography>
        </Paper>
      );
    }
    if (durationQuestion === "range") {
      return (
        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: "#f4f6fb" }}>
          <Typography variant="overline" color="text.secondary">
            Vista previa
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title || "Tu actividad"}
          </Typography>
          <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <SyncAltRoundedIcon fontSize="small" color="primary" />
            <Typography variant="body2">
              Duración habitual:{" "}
              <strong>
                {minDuration}-{maxDuration} min
              </strong>
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Solo se registra para análisis. No hay notificaciones.
          </Typography>
        </Paper>
      );
    }
    if (timeboxingQuestion === "minimum-time") {
      return (
        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: "#f4f6fb" }}>
          <Typography variant="overline" color="text.secondary">
            Vista previa
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title || "Tu actividad"}
          </Typography>
          <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <HorizontalRuleRoundedIcon fontSize="small" color="primary" />
            <Typography variant="body2">
              Te avisaré a los <strong>{tbMinDuration} min</strong> como mínimo.
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Útil para vencer la resistencia inicial. Puedes seguir si quieres.
          </Typography>
        </Paper>
      );
    }
    if (timeboxingQuestion === "maximum-time") {
      return (
        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: "#f4f6fb" }}>
          <Typography variant="overline" color="text.secondary">
            Vista previa
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title || "Tu actividad"}
          </Typography>
          <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <HeightRoundedIcon fontSize="small" color="primary" />
            <Typography variant="body2">
              Te avisaré a los <strong>{tbMaxDuration} min</strong> como máximo.
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Útil para limitar tareas que tienden a expandirse.
          </Typography>
        </Paper>
      );
    }
    return (
      <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: "#f4f6fb" }}>
        <Typography variant="overline" color="text.secondary">
          Vista previa
        </Typography>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title || "Tu actividad"}
        </Typography>
        <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
          <SyncAltRoundedIcon fontSize="small" color="primary" />
          <Typography variant="body2">
            Compromiso:{" "}
            <strong>
              {tbMinDuration}-{tbMaxDuration} min
            </strong>
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Aviso al alcanzar el mínimo, alerta al acercarse al máximo.
        </Typography>
      </Paper>
    );
  };

  const renderForm = () => (
    <Dialog
      open={isFormOpen}
      onClose={() => {
        setIsFormOpen(false);
        resetForm();
      }}
      fullWidth
      maxWidth="md"
      data-testid="activity-form-modal"
    >
      <DialogTitle>{editingTemplate ? "Editar Actividad" : "Nueva Actividad"}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="¿Qué actividad es?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={!!errors.title}
                helperText={errors.title}
                required
                autoFocus
                data-testid="activity-title-input"
              />

              <TextField
                fullWidth
                label="Describe brevemente (opcional)"
                multiline
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                error={!!errors.description}
                helperText={errors.description}
                data-testid="activity-description-input"
              />

              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  ¿Cómo quieres registrar su tiempo?
                </Typography>
                <ToggleButtonGroup
                  value={durationQuestion}
                  exclusive
                  onChange={(_, v) => v && setDurationQuestion(v)}
                  color="primary"
                  sx={{ flexWrap: "wrap" }}
                  data-testid="duration-question-group"
                >
                  <ToggleButton value="estimate" sx={{ textTransform: "none" }}>
                    Tengo un estimado
                  </ToggleButton>
                  <ToggleButton value="range" sx={{ textTransform: "none" }}>
                    Dura un rango variable
                  </ToggleButton>
                  <ToggleButton value="commitment" sx={{ textTransform: "none" }}>
                    Quiero un compromiso con límite
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {durationQuestion === "estimate" && (
                <TextField
                  fullWidth
                  type="number"
                  label="¿Cuánto suele durar? (minutos)"
                  value={estimatedDuration}
                  onChange={(e) => setEstimatedDuration(Number(e.target.value))}
                  InputProps={{ inputProps: { min: 1 } }}
                  error={!!errors.estimatedDuration}
                  helperText={errors.estimatedDuration}
                  required
                  data-testid="estimated-duration-input"
                />
              )}

              {durationQuestion === "range" && (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Mínimo (min)"
                      value={minDuration}
                      onChange={(e) => setMinDuration(Number(e.target.value))}
                      InputProps={{ inputProps: { min: 1 } }}
                      error={!!errors.minDuration || !!errors.durationRange}
                      helperText={errors.minDuration || errors.durationRange}
                      required
                      data-testid="min-duration-input"
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Máximo (min)"
                      value={maxDuration}
                      onChange={(e) => setMaxDuration(Number(e.target.value))}
                      InputProps={{ inputProps: { min: 1 } }}
                      error={!!errors.maxDuration || !!errors.durationRange}
                      helperText={errors.maxDuration}
                      required
                      data-testid="max-duration-input"
                    />
                  </Grid>
                </Grid>
              )}

              {durationQuestion === "commitment" && (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      ¿Qué tipo de compromiso?
                    </Typography>
                    <ToggleButtonGroup
                      value={timeboxingQuestion}
                      exclusive
                      onChange={(_, v) => v && setTimeboxingQuestion(v)}
                      color="primary"
                      sx={{ flexWrap: "wrap" }}
                      data-testid="timeboxing-question-group"
                    >
                      <ToggleButton value="minimum-time" sx={{ textTransform: "none" }}>
                        Al menos X minutos
                      </ToggleButton>
                      <ToggleButton value="maximum-time" sx={{ textTransform: "none" }}>
                        No más de X minutos
                      </ToggleButton>
                      <ToggleButton value="both" sx={{ textTransform: "none" }}>
                        Entre X e Y
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Box>

                  {(timeboxingQuestion === "minimum-time" || timeboxingQuestion === "both") && (
                    <TextField
                      fullWidth
                      type="number"
                      label={
                        timeboxingQuestion === "both"
                          ? "Mínimo (min)"
                          : "¿Cuántos minutos como mínimo?"
                      }
                      value={tbMinDuration}
                      onChange={(e) => setTbMinDuration(Number(e.target.value))}
                      InputProps={{ inputProps: { min: 1 } }}
                      error={!!errors.tbMinDuration || !!errors.tbDurationRange}
                      helperText={errors.tbMinDuration || errors.tbDurationRange}
                      required
                      data-testid="tb-min-duration-input"
                    />
                  )}

                  {(timeboxingQuestion === "maximum-time" || timeboxingQuestion === "both") && (
                    <TextField
                      fullWidth
                      type="number"
                      label={
                        timeboxingQuestion === "both"
                          ? "Máximo (min)"
                          : "¿Cuántos minutos como máximo?"
                      }
                      value={tbMaxDuration}
                      onChange={(e) => setTbMaxDuration(Number(e.target.value))}
                      InputProps={{ inputProps: { min: 1 } }}
                      error={!!errors.tbMaxDuration || !!errors.tbDurationRange}
                      helperText={errors.tbMaxDuration}
                      required
                      data-testid="tb-max-duration-input"
                    />
                  )}
                </Stack>
              )}
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            {renderPreview()}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            setIsFormOpen(false);
            resetForm();
          }}
          data-testid="cancel-activity-form-button"
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSaveForm}
          variant="contained"
          color="primary"
          data-testid="save-activity-button"
        >
          {editingTemplate ? "Guardar Cambios" : "Crear Actividad"}
        </Button>
      </DialogActions>
    </Dialog>
  );

  const renderDeleteConfirmation = () => (
    <Box sx={{ p: 2 }}>
      <Alert severity="warning" sx={{ mb: 2 }}>
        ¿Estás seguro de que deseas eliminar la actividad "{templateToDelete?.title}"?
      </Alert>
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button variant="outlined" onClick={handleCancelDelete}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleDelete} color="error">
          Eliminar
        </Button>
      </Box>
    </Box>
  );

  const renderLibrary = () => (
    <>
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Buscar actividades..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Droppable droppableId="library" isDropDisabled>
        {(provided) => (
          <Box
            ref={provided.innerRef}
            {...provided.droppableProps}
            sx={{ display: "flex", flexWrap: "wrap", margin: "-8px" }}
          >
            {filteredActivities.map((activity, index) => (
              <Draggable key={activity.id} draggableId={activity.id} index={index}>
                {(provided, snapshot) => (
                  <Box
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    sx={{
                      width: { xs: "100%", sm: "50%", md: "33.33%" },
                      padding: "8px",
                      boxSizing: "border-box",
                    }}
                    style={provided.draggableProps.style}
                  >
                    <Card
                      variant="outlined"
                      sx={{
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        bgcolor: snapshot.isDragging ? "rgba(0, 0, 0, 0.04)" : "background.paper",
                        transition: "all 0.2s",
                        "&:hover": { boxShadow: 2, cursor: "pointer" },
                      }}
                      onClick={() => handleCardClick(activity)}
                      data-testid={`activity-template-${activity.id}`}
                    >
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1}
                        >
                          <Typography variant="h6" component="h3" noWrap>
                            {activity.title}
                          </Typography>
                          <div {...provided.dragHandleProps}>
                            <DragIndicatorIcon color="action" />
                          </div>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {renderActivityDurationChip(activity)}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {activity.description}
                        </Typography>
                      </CardContent>
                      <CardActions sx={{ justifyContent: "flex-end" }}>
                        <IconButton
                          size="small"
                          aria-label="editar"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenEdit(activity);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label="eliminar"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmDelete(activity);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </CardActions>
                    </Card>
                  </Box>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </Box>
        )}
      </Droppable>

      {filteredActivities.length === 0 && (
        <Box textAlign="center" py={4}>
          <Typography variant="body1" color="text.secondary">
            No se encontraron actividades.
          </Typography>
        </Box>
      )}
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      data-testid="activity-library-modal"
    >
      <DialogTitle>Biblioteca de Actividades</DialogTitle>
      <DialogContent dividers>
        {isFormOpen && renderForm()}
        {showDeleteConfirm && renderDeleteConfirmation()}
        {!isFormOpen && !showDeleteConfirm && renderLibrary()}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} data-testid="close-library-modal-button">
          Cerrar
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenCreateForm}
          data-testid="new-activity-button"
        >
          Nueva Actividad
        </Button>
      </DialogActions>
    </Dialog>
  );
};

function renderActivityDurationChip(activity: ActivityTemplate) {
  if (activity.type === "clear-objective" && activity.clearObjectiveSettings) {
    return `~${activity.clearObjectiveSettings.estimatedDurationMinutes} min`;
  }
  if (activity.type === "flexible-duration" && activity.flexibleDurationSettings) {
    return `${activity.flexibleDurationSettings.minimumDurationMinutes}-${activity.flexibleDurationSettings.maximumDurationMinutes} min`;
  }
  if (activity.type === "timeboxing" && activity.timeboxingSettings) {
    const tb = activity.timeboxingSettings;
    if (tb.type === "minimum-time" && tb.minimumDurationMinutes)
      return `≥ ${tb.minimumDurationMinutes} min`;
    if (tb.type === "maximum-time" && tb.maximumDurationMinutes)
      return `≤ ${tb.maximumDurationMinutes} min`;
    if (tb.type === "both" && tb.minimumDurationMinutes && tb.maximumDurationMinutes)
      return `${tb.minimumDurationMinutes}-${tb.maximumDurationMinutes} min`;
  }
  return "Duración no definida";
}

export default ActivityLibraryModal;
