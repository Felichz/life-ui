import React from "react";
import { Card, CardContent, Typography, Box, Chip, IconButton, Button } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import type { ActivityInstance, UUID } from "../../../types";
import { Draggable } from "@hello-pangea/dnd";
import ActivityTimer from "../Common/ActivityTimer";

interface KanbanCardProps {
  activity: ActivityInstance;
  templateTitle: string;
  index: number;
  onEdit?: (activity: ActivityInstance) => void;
  onActivate?: (activityId: UUID) => void;
  onComplete?: (activityId: UUID) => void;
  onInterrupt?: (activityId: UUID) => void;
  isDayActive: boolean;
  isTimeBlockAvailable: boolean;
}

const KanbanCard: React.FC<KanbanCardProps> = ({
  activity,
  templateTitle,
  index,
  onEdit,
  onActivate,
  onComplete,
  onInterrupt,
  isDayActive,
  isTimeBlockAvailable,
}) => {
  // Renderizar duración según configuraciones
  const renderDuration = () => {
    if (activity.clearObjectiveSettings) {
      return `~${activity.clearObjectiveSettings.estimatedDurationMinutes} min`;
    } else if (activity.flexibleDurationSettings) {
      return `${activity.flexibleDurationSettings.minimumDurationMinutes}-${activity.flexibleDurationSettings.maximumDurationMinutes} min`;
    } else if (activity.timeboxingSettings) {
      if (activity.timeboxingSettings.type === "minimum-time") {
        return `≥ ${activity.timeboxingSettings.minimumDurationMinutes} min`;
      } else if (activity.timeboxingSettings.type === "maximum-time") {
        return `≤ ${activity.timeboxingSettings.maximumDurationMinutes} min`;
      } else {
        return `${activity.timeboxingSettings.minimumDurationMinutes}-${activity.timeboxingSettings.maximumDurationMinutes} min`;
      }
    }
    return "Duración no definida";
  };

  const handleEditClick = (e: React.MouseEvent) => {
    // Detener la propagación para evitar que el draggable se active
    e.stopPropagation();
    if (onEdit) {
      onEdit(activity);
    }
  };

  const handleActivateClick = (e: React.MouseEvent) => {
    // Detener la propagación para evitar que el draggable se active
    e.stopPropagation();
    if (onActivate) {
      onActivate(activity.id);
    }
  };

  const handleCompleteClick = (e: React.MouseEvent) => {
    // Detener la propagación para evitar que el draggable se active
    e.stopPropagation();
    if (onComplete) {
      onComplete(activity.id);
    }
  };

  const handleInterruptClick = (e: React.MouseEvent) => {
    // Detener la propagación para evitar que el draggable se active
    e.stopPropagation();
    if (onInterrupt) {
      onInterrupt(activity.id);
    }
  };

  return (
    <Draggable draggableId={activity.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{
            ...provided.draggableProps.style,
            opacity: snapshot.isDragging ? 0.8 : 1,
          }}
          data-testid={`kanban-card-${activity.id}`}
        >
          <Card
            variant="outlined"
            sx={{
              bgcolor: snapshot.isDragging ? "#eef2ff" : "background.paper",
              transition: "transform 0.2s, box-shadow 0.2s",
              border: activity.state === "active" ? "1px solid rgba(49,86,216,0.4)" : undefined,
              boxShadow:
                activity.state === "active" ? "0 8px 20px rgba(49,86,216,0.12)" : undefined,
              "&:hover": {
                transform: "translateY(-1px)",
                boxShadow: "0 8px 20px rgba(31,48,86,0.1)",
              },
            }}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography
                  variant="h6"
                  component="h3"
                  gutterBottom
                  sx={{ fontSize: "0.98rem" }}
                  noWrap
                >
                  {templateTitle}
                </Typography>
                <IconButton size="small" onClick={handleEditClick} aria-label="editar actividad">
                  <EditIcon fontSize="small" />
                </IconButton>
              </Box>

              {/* Mostrar timer si la actividad está activa */}
              {activity.state === "active" && activity.startTime && (
                <Box mt={1} mb={1}>
                  <ActivityTimer startTime={activity.startTime} />
                </Box>
              )}

              <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                <Chip
                  size="small"
                  label={
                    activity.state === "active"
                      ? "En curso"
                      : activity.state === "instantiated"
                        ? "Preparada"
                        : activity.state
                  }
                  color={activity.state === "active" ? "primary" : "default"}
                  variant="outlined"
                />
                <Box display="flex" alignItems="center">
                  {/* Mostrar botón Completar solo si está activa y hay día activo */}
                  {activity.state === "active" && isDayActive && (
                    <>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        onClick={handleCompleteClick}
                        startIcon={<CheckCircleOutlineIcon />}
                        sx={{ mr: 1 }}
                        data-testid="complete-button"
                      >
                        Completar
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={handleInterruptClick}
                        startIcon={<PauseCircleOutlineIcon />}
                        sx={{ mr: 1 }}
                        data-testid="interrupt-button"
                      >
                        Interrumpir
                      </Button>
                    </>
                  )}
                  {/* Mostrar botón Activar solo si está instantiada, hay día activo y no está ya activa */}
                  {activity.state === "instantiated" && isDayActive && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      onClick={handleActivateClick}
                      disabled={!isTimeBlockAvailable}
                      sx={{ mr: 1 }}
                      data-testid="activate-button"
                    >
                      Activar
                    </Button>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    {renderDuration()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
};

export default KanbanCard;
