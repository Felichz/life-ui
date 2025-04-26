import React, { useState, useEffect } from "react";
import {
  Drawer,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Box,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Divider,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import type { ActivityTemplate, UUID } from "../../types";
import { useSystemCore } from "../hooks/useSystemCore";
import { Draggable, Droppable } from "@hello-pangea/dnd";

interface ActivityLibraryDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Panel lateral para mostrar y gestionar la biblioteca de actividades
 */
const ActivityLibraryDrawer: React.FC<ActivityLibraryDrawerProps> = ({ open, onClose }) => {
  const { getActivityTemplates } = useSystemCore();
  const [activities, setActivities] = useState<ActivityTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Cargar actividades al abrir
  useEffect(() => {
    if (open) {
      const templates = getActivityTemplates();
      setActivities(templates);
    }
  }, [open, getActivityTemplates]);

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

  return (
    <Drawer
      open={open}
      onClose={onClose}
      anchor="left"
      variant="persistent"
      sx={{
        width: 280,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: 280,
          boxSizing: "border-box",
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Biblioteca de Actividades
        </Typography>
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

        <Droppable droppableId="library">
          {(provided) => (
            <Box
              ref={provided.innerRef}
              {...provided.droppableProps}
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                maxHeight: "calc(100vh - 200px)",
                overflow: "auto",
              }}
            >
              {filteredActivities.map((activity, index) => (
                <Draggable key={activity.id} draggableId={activity.id} index={index}>
                  {(provided, snapshot) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      sx={{
                        boxSizing: "border-box",
                      }}
                      style={provided.draggableProps.style}
                    >
                      <Card
                        variant="outlined"
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          bgcolor: snapshot.isDragging ? "rgba(0, 0, 0, 0.04)" : "background.paper",
                          transition: "all 0.2s",
                          "&:hover": {
                            boxShadow: 2,
                          },
                        }}
                      >
                        <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            mb={1}
                          >
                            <Typography variant="subtitle1" component="h3" noWrap>
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
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {activity.description}
                          </Typography>
                        </CardContent>
                        <CardActions sx={{ justifyContent: "flex-end", pt: 0 }}>
                          <IconButton size="small" aria-label="editar">
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" aria-label="eliminar">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </CardActions>
                      </Card>
                    </Box>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              {filteredActivities.length === 0 && (
                <Box textAlign="center" py={2}>
                  <Typography variant="body2" color="text.secondary">
                    No se encontraron actividades.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Droppable>
      </Box>
      <Box sx={{ p: 2, borderTop: "1px solid rgba(0, 0, 0, 0.12)" }}>
        <Button variant="contained" color="primary" fullWidth data-testid="new-activity-button">
          Nueva Actividad
        </Button>
      </Box>
    </Drawer>
  );
};

export default ActivityLibraryDrawer;
