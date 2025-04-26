import React, { useState, useEffect } from "react";
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
  ListItemSecondaryAction,
  IconButton,
  Divider,
  CircularProgress,
  Alert,
  Tooltip,
  Paper,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { useSystemCore } from "../hooks/useSystemCore";
import type { EventTemplate, UUID } from "../../types";

interface EventLibraryModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal para gestionar la biblioteca de plantillas de eventos
 */
const EventLibraryModal: React.FC<EventLibraryModalProps> = ({ open, onClose }) => {
  const context = useSystemCore();
  const { createEventTemplate, updateEventTemplate, deleteEventTemplate } = context;

  // Definir getEventTemplates de manera segura
  const getEventTemplates = () => {
    return context.state.global.eventTemplates || [];
  };

  // Estado para almacenar las plantillas de eventos
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  // Estado para el filtro de búsqueda
  const [searchQuery, setSearchQuery] = useState("");
  // Estado para nueva plantilla o edición
  const [editingTemplate, setEditingTemplate] = useState<{
    id?: UUID;
    name: string;
    isEditing: boolean;
  }>({
    name: "",
    isEditing: false,
  });
  // Estado para indicar si se está procesando una operación
  const [isProcessing, setIsProcessing] = useState(false);
  // Estado para mensaje de error
  const [error, setError] = useState<string | null>(null);
  // Estado para confirmación de eliminación
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    templateId?: UUID;
    templateName?: string;
  }>({
    show: false,
  });

  // Cargar plantillas al abrir el modal
  useEffect(() => {
    if (open) {
      setTemplates(getEventTemplates());
      resetForm();
    }
  }, [open]);

  // Filtrar plantillas según la búsqueda
  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Resetear formulario
  const resetForm = () => {
    setEditingTemplate({
      name: "",
      isEditing: false,
    });
    setError(null);
    setDeleteConfirm({ show: false });
    setIsProcessing(false);
  };

  // Manejar cambio en el campo de nombre
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingTemplate((prev) => ({
      ...prev,
      name: e.target.value,
    }));
    // Limpiar error si el usuario comienza a escribir
    if (error && e.target.value.trim()) {
      setError(null);
    }
  };

  // Comenzar edición de una plantilla existente
  const handleStartEdit = (template: EventTemplate) => {
    setEditingTemplate({
      id: template.id,
      name: template.name,
      isEditing: true,
    });
    setError(null);
  };

  // Cancelar edición
  const handleCancelEdit = () => {
    resetForm();
  };

  // Guardar plantilla (crear o actualizar)
  const handleSaveTemplate = async () => {
    const name = editingTemplate.name.trim();

    if (!name) {
      setError("El nombre del evento no puede estar vacío");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      if (editingTemplate.isEditing && editingTemplate.id) {
        // Actualizar plantilla existente
        const updated = updateEventTemplate(editingTemplate.id, { name });
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        // Crear nueva plantilla
        const newTemplate = createEventTemplate(name);
        setTemplates((prev) => [...prev, newTemplate]);
      }
      resetForm();
      // No cerrar el modal automáticamente después de guardar, para permitir crear múltiples eventos
      // onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setError(`Error al guardar: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Mostrar confirmación para eliminar
  const handleConfirmDelete = (template: EventTemplate) => {
    setDeleteConfirm({
      show: true,
      templateId: template.id,
      templateName: template.name,
    });
  };

  // Cancelar eliminación
  const handleCancelDelete = () => {
    setDeleteConfirm({ show: false });
  };

  // Eliminar plantilla
  const handleDeleteTemplate = async () => {
    if (!deleteConfirm.templateId) return;

    setIsProcessing(true);
    setError(null);

    try {
      deleteEventTemplate(deleteConfirm.templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteConfirm.templateId));
      setDeleteConfirm({ show: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setError(`Error al eliminar: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      aria-labelledby="event-library-title"
    >
      <DialogTitle id="event-library-title">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Biblioteca de Eventos</Typography>
          <IconButton edge="end" color="inherit" onClick={onClose} aria-label="cerrar" size="large">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 3 }}>
          {/* Lista de plantillas */}
          <Box sx={{ flex: 1 }}>
            <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
              <Box mb={2}>
                <Typography variant="h6" gutterBottom>
                  Eventos disponibles
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Buscar eventos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                  }}
                />
              </Box>

              {filteredTemplates.length === 0 ? (
                <Box sx={{ p: 2, textAlign: "center" }}>
                  <Typography color="textSecondary">
                    {searchQuery
                      ? "No se encontraron eventos con ese nombre"
                      : "No hay eventos definidos"}
                  </Typography>
                </Box>
              ) : (
                <List dense sx={{ maxHeight: 300, overflow: "auto" }}>
                  {filteredTemplates.map((template) => (
                    <React.Fragment key={template.id}>
                      <ListItem data-testid={`event-template-${template.id}`}>
                        <ListItemText primary={template.name} />
                        <ListItemSecondaryAction>
                          <Tooltip title="Editar">
                            <IconButton
                              edge="end"
                              aria-label="editar"
                              onClick={() => handleStartEdit(template)}
                              size="small"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar">
                            <IconButton
                              edge="end"
                              aria-label="eliminar"
                              onClick={() => handleConfirmDelete(template)}
                              size="small"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                      <Divider component="li" />
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Paper>
          </Box>

          {/* Formulario para crear/editar */}
          <Box sx={{ flex: 1 }}>
            <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
              <Typography variant="h6" gutterBottom>
                {editingTemplate.isEditing ? "Editar evento" : "Nuevo evento"}
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Box component="form" noValidate>
                <TextField
                  fullWidth
                  label="Nombre del evento"
                  variant="outlined"
                  margin="normal"
                  value={editingTemplate.name}
                  onChange={handleNameChange}
                  disabled={isProcessing}
                  required
                  error={!!error}
                  autoFocus
                  id="nombre-evento-input"
                  aria-label="Nombre del evento"
                />

                <Box display="flex" justifyContent="flex-end" mt={2}>
                  <Button onClick={handleCancelEdit} disabled={isProcessing} sx={{ mr: 1 }}>
                    Cancelar
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSaveTemplate}
                    disabled={isProcessing || !editingTemplate.name.trim()}
                    startIcon={isProcessing ? <CircularProgress size={20} /> : null}
                  >
                    {editingTemplate.isEditing ? "Actualizar" : "Crear"}
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Box>
        </Box>

        {/* Modal de confirmación de eliminación */}
        {deleteConfirm.show && (
          <Dialog
            open={true}
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
          >
            <DialogTitle id="delete-dialog-title">Confirmar eliminación</DialogTitle>
            <DialogContent>
              <Typography id="delete-dialog-description">
                ¿Estás seguro de que deseas eliminar el evento "{deleteConfirm.templateName}"? Esta
                acción no se puede deshacer.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCancelDelete} disabled={isProcessing}>
                Cancelar
              </Button>
              <Button
                onClick={handleDeleteTemplate}
                color="error"
                disabled={isProcessing}
                startIcon={isProcessing ? <CircularProgress size={20} /> : null}
              >
                Eliminar
              </Button>
            </DialogActions>
          </Dialog>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          startIcon={<AddIcon />}
          onClick={() => {
            if (editingTemplate.isEditing) {
              resetForm();
            }
            setEditingTemplate({
              name: "",
              isEditing: false,
            });
          }}
          disabled={isProcessing || (!editingTemplate.isEditing && !editingTemplate.name)}
          sx={{ mr: "auto" }}
        >
          Nuevo evento
        </Button>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EventLibraryModal;
