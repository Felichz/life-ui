import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  FormHelperText,
  Grid,
  Paper,
  Tooltip,
  Alert,
  useTheme,
  DialogContentText,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import type { TimeBlock, UUID } from "../../types";
import { useSystemCore } from "../hooks/useSystemCore";

interface TimeBlockModalProps {
  open: boolean;
  onClose: () => void;
}

// Formato de tiempo para validación
const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;

/**
 * Modal para gestionar bloques de tiempo (crear, editar, eliminar)
 */
const TimeBlockModal: React.FC<TimeBlockModalProps> = ({ open, onClose }) => {
  const { getTimeBlocks, createTimeBlock, updateTimeBlock, deleteTimeBlock, state } =
    useSystemCore();

  const theme = useTheme();

  // Estados del formulario
  const [editMode, setEditMode] = useState<boolean>(false);
  const [currentBlockId, setCurrentBlockId] = useState<UUID | null>(null);
  const [name, setName] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formValid, setFormValid] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [moveActivitiesToTodo, setMoveActivitiesToTodo] = useState<boolean>(true);
  const [blockToDelete, setBlockToDelete] = useState<TimeBlock | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>("");

  // Memorizar bloques de tiempo
  const timeBlocks = useMemo(() => {
    return getTimeBlocks();
  }, [state.global.timeBlocks]); // Solo depende de los timeBlocks en el estado

  // Verificar si un bloque tiene actividades asignadas
  const hasActivities = useCallback(
    (blockId: UUID): boolean => {
      if (!state.currentDay) return false;
      return state.currentDay.activityInstances.some((activity) => activity.blockId === blockId);
    },
    [state.currentDay?.activityInstances]
  );

  // Convertir horas a minutos (HH:MM -> minutos del día)
  const timeToMinutes = (timeString: string): number => {
    if (!TIME_REGEX.test(timeString)) return 0;

    const [hours, minutes] = timeString.split(":").map(Number);
    return hours * 60 + minutes;
  };

  // Convertir minutos a horas (minutos del día -> HH:MM)
  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  // Resetear formulario
  const resetForm = useCallback(() => {
    setEditMode(false);
    setCurrentBlockId(null);
    setName("");
    setStartTime("");
    setEndTime("");
    setErrors({});
    setFormValid(false);
    setSuccessMessage("");
  }, []);

  // Validar formulario
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};

    // Validar nombre
    if (!name.trim()) {
      newErrors.name = "El nombre es obligatorio";
    }

    // Validar hora de inicio
    if (!startTime) {
      newErrors.startTime = "La hora de inicio es obligatoria";
    } else if (!TIME_REGEX.test(startTime)) {
      newErrors.startTime = "Formato inválido. Use HH:MM (ej. 09:30)";
    }

    // Validar hora de fin
    if (!endTime) {
      newErrors.endTime = "La hora de fin es obligatoria";
    } else if (!TIME_REGEX.test(endTime)) {
      newErrors.endTime = "Formato inválido. Use HH:MM (ej. 18:00)";
    }

    // Validar que inicio sea antes que fin
    if (
      TIME_REGEX.test(startTime) &&
      TIME_REGEX.test(endTime) &&
      timeToMinutes(startTime) >= timeToMinutes(endTime)
    ) {
      newErrors.endTime = "La hora de fin debe ser posterior a la hora de inicio";
    }

    // Validar solapamiento con otros bloques
    if (
      TIME_REGEX.test(startTime) &&
      TIME_REGEX.test(endTime) &&
      timeToMinutes(startTime) < timeToMinutes(endTime)
    ) {
      const startMinute = timeToMinutes(startTime);
      const endMinute = timeToMinutes(endTime);

      const hasOverlap = timeBlocks.some((block) => {
        // Ignorar el bloque actual en caso de edición
        if (editMode && block.id === currentBlockId) return false;
        // Ignorar bloque "Por Hacer"
        if (block.isDefault) return false;

        // Detectar solapamiento
        return !(endMinute <= block.startMinute || startMinute >= block.endMinute);
      });

      if (hasOverlap) {
        newErrors.overlap = "El nuevo bloque se solapa con bloques existentes";
      }
    }

    setErrors(newErrors);
    setFormValid(Object.keys(newErrors).length === 0);
  }, [name, startTime, endTime, editMode, currentBlockId, timeBlocks]);

  // Cargar datos para edición
  const handleEdit = useCallback((block: TimeBlock) => {
    setCurrentBlockId(block.id);
    setName(block.name);
    setStartTime(minutesToTime(block.startMinute));
    setEndTime(minutesToTime(block.endMinute));
    setEditMode(true);
  }, []);

  // Iniciar proceso de eliminación
  const handleDelete = useCallback(
    (block: TimeBlock) => {
      if (block.isDefault) {
        return; // No permitir eliminar bloque "Por Hacer"
      }

      setBlockToDelete(block);

      // Si tiene actividades, mostrar confirmación
      if (hasActivities(block.id)) {
        setShowDeleteConfirm(true);
        setMoveActivitiesToTodo(true);
      } else {
        // Si no tiene actividades, eliminar directamente
        try {
          deleteTimeBlock(block.id, true);
          setSuccessMessage(`Bloque "${block.name}" eliminado correctamente`);
        } catch (error) {
          setErrors({ general: (error as Error).message });
        }
      }
    },
    [hasActivities, deleteTimeBlock]
  );

  // Confirmar eliminación
  const confirmDelete = useCallback(() => {
    if (!blockToDelete) return;

    try {
      deleteTimeBlock(blockToDelete.id, moveActivitiesToTodo);
      setSuccessMessage(`Bloque "${blockToDelete.name}" eliminado correctamente`);
    } catch (error) {
      setErrors({ general: (error as Error).message });
    } finally {
      setShowDeleteConfirm(false);
      setBlockToDelete(null);
    }
  }, [blockToDelete, moveActivitiesToTodo, deleteTimeBlock]);

  // Cancelar eliminación
  const cancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setBlockToDelete(null);
  }, []);

  // Guardar bloque (crear o actualizar)
  const handleSave = useCallback(() => {
    if (!formValid) return;

    const startMinute = timeToMinutes(startTime);
    const endMinute = timeToMinutes(endTime);

    try {
      if (editMode && currentBlockId) {
        // Actualizar
        updateTimeBlock(currentBlockId, {
          name,
          startMinute,
          endMinute,
        });
        setSuccessMessage(`Bloque "${name}" actualizado correctamente`);
      } else {
        // Crear
        createTimeBlock(name, startMinute, endMinute);
        setSuccessMessage(`Bloque "${name}" creado correctamente`);
      }

      resetForm();
    } catch (error) {
      setErrors({ general: (error as Error).message });
    }
  }, [
    formValid,
    startTime,
    endTime,
    editMode,
    currentBlockId,
    name,
    updateTimeBlock,
    createTimeBlock,
    resetForm,
  ]);

  // Ejecutar la validación cuando cambien los datos relevantes
  useEffect(() => {
    if (open) validateForm();
  }, [name, startTime, endTime, open, validateForm]);

  // Resetear formulario al abrir modal
  useEffect(() => {
    if (open) resetForm();
  }, [open, resetForm]);

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" data-testid="time-block-modal">
        <DialogTitle>Gestión de Bloques de Tiempo</DialogTitle>
        <DialogContent>
          {successMessage && (
            <Alert role="alert" severity="success" sx={{ mb: 2 }}>
              {successMessage}
            </Alert>
          )}

          {errors.general && (
            <Alert role="alert" severity="error" sx={{ mb: 2 }}>
              {errors.general}
            </Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2 }}>
            {/* Listado de bloques */}
            <Box sx={{ flex: 1, width: { xs: "100%", md: "50%" } }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  height: "100%",
                  maxHeight: 400,
                  overflow: "auto",
                }}
                data-testid="time-blocks-list-container"
              >
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Bloques de tiempo existentes</Typography>
                  <Button
                    startIcon={<AddIcon />}
                    variant="contained"
                    size="small"
                    onClick={resetForm}
                    disabled={editMode}
                    data-testid="new-time-block-button"
                  >
                    Nuevo
                  </Button>
                </Box>

                <Divider sx={{ mb: 2 }} />

                <List role="list" data-testid="time-blocks-list">
                  {timeBlocks.length === 0 ? (
                    <Typography color="text.secondary" align="center">
                      No hay bloques de tiempo definidos
                    </Typography>
                  ) : (
                    timeBlocks.map((block) => (
                      <ListItem
                        key={block.id}
                        secondaryAction={
                          block.isDefault ? (
                            <Typography variant="caption" color="text.secondary">
                              Predeterminado
                            </Typography>
                          ) : (
                            <Box>
                              <Tooltip title="Editar">
                                <IconButton
                                  edge="end"
                                  aria-label="editar"
                                  onClick={() => handleEdit(block)}
                                  data-testid={`edit-block-${block.id}`}
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Eliminar">
                                <IconButton
                                  edge="end"
                                  aria-label="eliminar"
                                  onClick={() => handleDelete(block)}
                                  data-testid={`delete-block-${block.id}`}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )
                        }
                        sx={{
                          borderLeft: block.isDefault
                            ? `4px solid ${theme.palette.primary.main}`
                            : "none",
                          pl: block.isDefault ? 2 : 0,
                          mb: 1,
                        }}
                        data-testid={`time-block-${block.id}`}
                        role="listitem"
                      >
                        <ListItemText
                          primary={block.name}
                          secondary={
                            block.isDefault
                              ? "Disponible siempre"
                              : `${minutesToTime(block.startMinute)} - ${minutesToTime(block.endMinute)}`
                          }
                        />
                      </ListItem>
                    ))
                  )}
                </List>
              </Paper>
            </Box>

            {/* Formulario */}
            <Box sx={{ flex: 1, width: { xs: "100%", md: "50%" } }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  height: "100%",
                  maxHeight: 400,
                  overflow: "auto",
                }}
                data-testid="time-block-form"
              >
                <Typography variant="h6" mb={2}>
                  {editMode ? "Editar bloque" : "Nuevo bloque de tiempo"}
                </Typography>

                <TextField
                  fullWidth
                  label="Nombre del bloque"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={!!errors.name}
                  helperText={errors.name}
                  margin="normal"
                  data-testid="block-name-input"
                />

                <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      fullWidth
                      label="Hora de inicio"
                      placeholder="HH:MM"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      error={!!errors.startTime}
                      helperText={errors.startTime}
                      margin="normal"
                      data-testid="start-time-input"
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      fullWidth
                      label="Hora de fin"
                      placeholder="HH:MM"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      error={!!errors.endTime || !!errors.overlap}
                      helperText={errors.endTime || errors.overlap}
                      margin="normal"
                      data-testid="end-time-input"
                    />
                  </Box>
                </Box>

                <Box display="flex" justifyContent="flex-end" mt={3}>
                  {editMode && (
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={resetForm}
                      sx={{ mr: 1 }}
                      data-testid="cancel-edit-button"
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={!formValid}
                    data-testid="save-block-button"
                  >
                    {editMode ? "Actualizar" : "Crear"}
                  </Button>
                </Box>
              </Paper>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} data-testid="close-modal-button">
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de confirmación para eliminar */}
      <Dialog
        open={showDeleteConfirm}
        onClose={cancelDelete}
        data-testid="delete-confirmation-modal"
      >
        <DialogTitle>¿Eliminar bloque de tiempo?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            El bloque "{blockToDelete?.name}" tiene actividades asignadas. ¿Qué desea hacer con
            estas actividades?
          </DialogContentText>
          <Box mt={2}>
            <Alert severity="info">
              <Typography variant="body2">
                <strong>Mover a "Por Hacer":</strong> Las actividades se moverán al bloque
                predeterminado.
              </Typography>
              <Typography variant="body2" mt={1}>
                <strong>Eliminar actividades:</strong> Las actividades se eliminarán
                permanentemente.
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete} data-testid="cancel-delete-button">
            Cancelar
          </Button>
          <Button
            onClick={() => {
              setMoveActivitiesToTodo(false);
              confirmDelete();
            }}
            color="error"
            data-testid="delete-activities-button"
          >
            Eliminar actividades
          </Button>
          <Button
            onClick={() => {
              setMoveActivitiesToTodo(true);
              confirmDelete();
            }}
            variant="contained"
            data-testid="move-activities-button"
          >
            Mover a "Por Hacer"
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TimeBlockModal;
