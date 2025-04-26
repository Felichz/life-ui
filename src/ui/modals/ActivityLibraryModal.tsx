import React, { useState, useEffect } from "react";
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
  Chip,
  IconButton,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Grid,
  Alert,
  Stack,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import type { ActivityTemplate, ActivityType, TimeboxingType, UUID } from "../../types";
import { useSystemCore } from "../hooks/useSystemCore";
import { Draggable, Droppable } from "@hello-pangea/dnd";

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

/**
 * Modal para mostrar y gestionar la biblioteca de actividades
 */
const ActivityLibraryModal: React.FC<ActivityLibraryModalProps> = ({
  open,
  onClose,
  onOpenCreate,
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

  // Formulario
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("clear-objective");
  const [estimatedDuration, setEstimatedDuration] = useState<number>(30);
  const [minDuration, setMinDuration] = useState<number>(15);
  const [maxDuration, setMaxDuration] = useState<number>(45);
  const [timeboxingType, setTimeboxingType] = useState<TimeboxingType>("minimum-time");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Cargar actividades al abrir
  useEffect(() => {
    let isMounted = true;

    if (open) {
      const templates = getActivityTemplates();
      if (isMounted) {
        setActivities(templates);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [open]);

  // Cargar datos del template cuando estamos en modo edición
  useEffect(() => {
    if (editingTemplate) {
      setTitle(editingTemplate.title);
      setDescription(editingTemplate.description);
      setActivityType(editingTemplate.type);

      if (editingTemplate.type === "clear-objective" && editingTemplate.clearObjectiveSettings) {
        setEstimatedDuration(editingTemplate.clearObjectiveSettings.estimatedDurationMinutes);
      } else if (
        editingTemplate.type === "flexible-duration" &&
        editingTemplate.flexibleDurationSettings
      ) {
        setMinDuration(editingTemplate.flexibleDurationSettings.minimumDurationMinutes);
        setMaxDuration(editingTemplate.flexibleDurationSettings.maximumDurationMinutes);
      } else if (editingTemplate.type === "timeboxing" && editingTemplate.timeboxingSettings) {
        setTimeboxingType(editingTemplate.timeboxingSettings.type);
        if (editingTemplate.timeboxingSettings.minimumDurationMinutes) {
          setMinDuration(editingTemplate.timeboxingSettings.minimumDurationMinutes);
        }
        if (editingTemplate.timeboxingSettings.maximumDurationMinutes) {
          setMaxDuration(editingTemplate.timeboxingSettings.maximumDurationMinutes);
        }
      }
      setIsFormOpen(true);
    }
  }, [editingTemplate]);

  // Actualizar la lista de actividades después de eliminar una actividad
  useEffect(() => {
    if (open && confirmDeleteId === null && showDeleteConfirm === false) {
      const templates = getActivityTemplates();
      setActivities(templates);
    }
  }, [open, confirmDeleteId, showDeleteConfirm, getActivityTemplates]);

  // Reset del formulario
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setActivityType("clear-objective");
    setEstimatedDuration(30);
    setMinDuration(15);
    setMaxDuration(45);
    setTimeboxingType("minimum-time");
    setErrors({});
  };

  // Manejar la apertura del formulario de creación
  const handleOpenCreateForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  // Validar el formulario
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "El título es obligatorio";
    }

    if (!description.trim()) {
      newErrors.description = "La descripción es obligatoria";
    }

    if (activityType === "clear-objective") {
      if (!estimatedDuration || estimatedDuration <= 0) {
        newErrors.estimatedDuration = "La duración estimada debe ser mayor a 0";
      }
    } else if (activityType === "flexible-duration") {
      if (!minDuration || minDuration <= 0) {
        newErrors.minDuration = "La duración mínima debe ser mayor a 0";
      }
      if (!maxDuration || maxDuration <= 0) {
        newErrors.maxDuration = "La duración máxima debe ser mayor a 0";
      }
      if (minDuration && maxDuration && minDuration >= maxDuration) {
        newErrors.durationRange = "La duración mínima debe ser menor que la máxima";
      }
    } else if (activityType === "timeboxing") {
      if (timeboxingType === "minimum-time" || timeboxingType === "both") {
        if (!minDuration || minDuration <= 0) {
          newErrors.tbMinDuration = "La duración mínima debe ser mayor a 0";
        }
      }
      if (timeboxingType === "maximum-time" || timeboxingType === "both") {
        if (!maxDuration || maxDuration <= 0) {
          newErrors.tbMaxDuration = "La duración máxima debe ser mayor a 0";
        }
      }
      if (timeboxingType === "both" && minDuration && maxDuration && minDuration >= maxDuration) {
        newErrors.tbDurationRange = "La duración mínima debe ser menor que la máxima";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar el guardado del formulario
  const handleSaveForm = () => {
    if (!validateForm()) return;

    const templateData: Omit<ActivityTemplate, "id" | "createdAt" | "updatedAt"> = {
      title,
      description,
      type: activityType,
      isSystemActivity: false,
    };

    // Agregar configuraciones específicas según el tipo
    if (activityType === "clear-objective") {
      templateData.clearObjectiveSettings = {
        estimatedDurationMinutes: estimatedDuration,
      };
    } else if (activityType === "flexible-duration") {
      templateData.flexibleDurationSettings = {
        minimumDurationMinutes: minDuration,
        maximumDurationMinutes: maxDuration,
      };
    } else if (activityType === "timeboxing") {
      templateData.timeboxingSettings = {
        type: timeboxingType,
      };

      if (timeboxingType === "minimum-time" || timeboxingType === "both") {
        templateData.timeboxingSettings!.minimumDurationMinutes = minDuration;
      }
      if (timeboxingType === "maximum-time" || timeboxingType === "both") {
        templateData.timeboxingSettings!.maximumDurationMinutes = maxDuration;
      }
    }

    onSave(templateData);
    setIsFormOpen(false);
    resetForm();

    // Actualizar la lista de actividades después de guardar
    const updatedTemplates = getActivityTemplates();
    setActivities(updatedTemplates);
  };

  // Manejar clic en la tarjeta
  const handleCardClick = (template: ActivityTemplate) => {
    const blocks = getTimeBlocks();
    // Buscar el bloque "Por Hacer" (default)
    const defaultBlock = blocks.find((block) => block.isDefault);
    if (defaultBlock) {
      onOpenInstanceModal(template.id, defaultBlock.id);
    }
  };

  // Cuando se confirma la eliminación
  const handleConfirmDelete = (template: ActivityTemplate) => {
    setTemplateToDelete(template);
    setShowDeleteConfirm(true);
    onConfirmDelete(template.id);
  };

  // Función para manejar la eliminación y actualizar la lista
  const handleDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);

    // Actualizar la lista de actividades después de eliminar
    const updatedTemplates = getActivityTemplates();
    setActivities(updatedTemplates);
  };

  // Función para cancelar la eliminación
  const handleCancelDelete = () => {
    onCancelDelete();
    setShowDeleteConfirm(false);
  };

  // Filtrar actividades según término de búsqueda
  const filteredActivities = activities.filter(
    (activity) =>
      activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Renderizar chip según el tipo de actividad
  const renderActivityTypeChip = (type: string) => {
    switch (type) {
      case "clear-objective":
        return <Chip size="small" label="Objetivo claro" color="primary" variant="outlined" />;
      case "flexible-duration":
        return <Chip size="small" label="Duración flexible" color="secondary" variant="outlined" />;
      case "timeboxing":
        return <Chip size="small" label="Timeboxing" color="info" variant="outlined" />;
      default:
        return null;
    }
  };

  // Renderizar duración según el tipo de actividad
  const renderDuration = (activity: ActivityTemplate) => {
    if (activity.type === "clear-objective" && activity.clearObjectiveSettings) {
      return `~${activity.clearObjectiveSettings.estimatedDurationMinutes} min`;
    } else if (activity.type === "flexible-duration" && activity.flexibleDurationSettings) {
      return `${activity.flexibleDurationSettings.minimumDurationMinutes}-${activity.flexibleDurationSettings.maximumDurationMinutes} min`;
    } else if (activity.type === "timeboxing" && activity.timeboxingSettings) {
      if (
        activity.timeboxingSettings.type === "minimum-time" &&
        activity.timeboxingSettings.minimumDurationMinutes
      ) {
        return `≥ ${activity.timeboxingSettings.minimumDurationMinutes} min`;
      } else if (
        activity.timeboxingSettings.type === "maximum-time" &&
        activity.timeboxingSettings.maximumDurationMinutes
      ) {
        return `≤ ${activity.timeboxingSettings.maximumDurationMinutes} min`;
      } else if (
        activity.timeboxingSettings.type === "both" &&
        activity.timeboxingSettings.minimumDurationMinutes &&
        activity.timeboxingSettings.maximumDurationMinutes
      ) {
        return `${activity.timeboxingSettings.minimumDurationMinutes}-${activity.timeboxingSettings.maximumDurationMinutes} min`;
      }
    }
    return "Duración no definida";
  };

  // Renderizar formulario para crear/editar plantilla
  const renderForm = () => (
    <Dialog
      open={isFormOpen}
      onClose={() => {
        setIsFormOpen(false);
        resetForm();
      }}
      fullWidth
      maxWidth="sm"
      data-testid="activity-form-modal"
    >
      <DialogTitle>{editingTemplate ? "Editar Actividad" : "Nueva Actividad"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <TextField
            fullWidth
            label="Título"
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
            label="Descripción"
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={!!errors.description}
            helperText={errors.description}
            required
            data-testid="activity-description-input"
          />

          <FormControl fullWidth error={!!errors.activityType}>
            <InputLabel id="activity-type-label">Tipo de Actividad</InputLabel>
            <Select
              labelId="activity-type-label"
              value={activityType}
              label="Tipo de Actividad"
              onChange={(e) => setActivityType(e.target.value as ActivityType)}
              data-testid="activity-type-select"
            >
              <MenuItem value="clear-objective">Con objetivo claro</MenuItem>
              <MenuItem value="flexible-duration">Duración flexible</MenuItem>
              <MenuItem value="timeboxing">Timeboxing</MenuItem>
            </Select>
            {errors.activityType && <FormHelperText>{errors.activityType}</FormHelperText>}
          </FormControl>

          {/* Campos específicos según tipo */}
          {activityType === "clear-objective" && (
            <TextField
              fullWidth
              type="number"
              label="Tiempo Estimado (minutos)"
              value={estimatedDuration}
              onChange={(e) => setEstimatedDuration(Number(e.target.value))}
              InputProps={{
                inputProps: { min: 1 },
              }}
              error={!!errors.estimatedDuration}
              helperText={errors.estimatedDuration}
              required
              data-testid="estimated-duration-input"
            />
          )}

          {activityType === "flexible-duration" && (
            <>
              <Grid container spacing={2}>
                <Grid xs={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Tiempo Mínimo (min)"
                    value={minDuration}
                    onChange={(e) => setMinDuration(Number(e.target.value))}
                    InputProps={{ inputProps: { min: 1 } }}
                    error={!!errors.minDuration || !!errors.durationRange}
                    helperText={errors.minDuration || errors.durationRange}
                    required
                    data-testid="min-duration-input"
                  />
                </Grid>
                <Grid xs={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Tiempo Máximo (min)"
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
            </>
          )}

          {activityType === "timeboxing" && (
            <>
              <FormControl fullWidth error={!!errors.timeboxingType}>
                <InputLabel id="timeboxing-type-label">Tipo de Timeboxing</InputLabel>
                <Select
                  labelId="timeboxing-type-label"
                  value={timeboxingType}
                  label="Tipo de Timeboxing"
                  onChange={(e) => setTimeboxingType(e.target.value as TimeboxingType)}
                  data-testid="timeboxing-type-select"
                >
                  <MenuItem value="minimum-time">Tiempo Mínimo</MenuItem>
                  <MenuItem value="maximum-time">Tiempo Máximo</MenuItem>
                  <MenuItem value="both">Ambos</MenuItem>
                </Select>
                {errors.timeboxingType && <FormHelperText>{errors.timeboxingType}</FormHelperText>}
              </FormControl>

              <Grid container spacing={2}>
                {(timeboxingType === "minimum-time" || timeboxingType === "both") && (
                  <Grid xs={timeboxingType === "both" ? 6 : 12}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Tiempo Mínimo (min)"
                      value={minDuration}
                      onChange={(e) => setMinDuration(Number(e.target.value))}
                      InputProps={{ inputProps: { min: 1 } }}
                      error={!!errors.tbMinDuration || !!errors.tbDurationRange}
                      helperText={errors.tbMinDuration || errors.tbDurationRange}
                      required
                      data-testid="min-duration-input"
                    />
                  </Grid>
                )}
                {(timeboxingType === "maximum-time" || timeboxingType === "both") && (
                  <Grid xs={timeboxingType === "both" ? 6 : 12}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Tiempo Máximo (min)"
                      value={maxDuration}
                      onChange={(e) => setMaxDuration(Number(e.target.value))}
                      InputProps={{ inputProps: { min: 1 } }}
                      error={!!errors.tbMaxDuration || !!errors.tbDurationRange}
                      helperText={errors.tbMaxDuration}
                      required
                      data-testid="max-duration-input"
                    />
                  </Grid>
                )}
              </Grid>
            </>
          )}
        </Stack>
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

  // Renderizar confirmación de eliminación
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

  // Renderizar bibliotecas de actividades
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
            sx={{
              display: "flex",
              flexWrap: "wrap",
              margin: "-8px",
            }}
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
                        "&:hover": {
                          boxShadow: 2,
                          cursor: "pointer",
                        },
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
                        <Box mb={1}>{renderActivityTypeChip(activity.type)}</Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {renderDuration(activity)}
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

  // Principal
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

export default ActivityLibraryModal;
