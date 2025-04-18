import React from "react";
import { Paper, Typography, Box, Stack } from "@mui/material";
import type { TimeBlock, ActivityInstance, UUID } from "../../../types";
import KanbanCard from "./Card";
import { Droppable } from "@hello-pangea/dnd";

interface KanbanColumnProps {
  block: TimeBlock;
  activities: ActivityInstance[];
  onEditActivity?: (activity: ActivityInstance) => void;
  onActivateActivity?: (activityId: UUID) => void;
  onCompleteActivity?: (activityId: UUID) => void;
  onInterruptActivity?: (activityId: UUID) => void;
  isDayActive: boolean;
  isTimeBlockAvailable: (blockId: UUID) => boolean;
}

const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
};

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  block,
  activities,
  onEditActivity,
  onActivateActivity,
  onCompleteActivity,
  onInterruptActivity,
  isDayActive,
  isTimeBlockAvailable,
}) => {
  const renderColumnHeader = () => {
    if (block.isDefault) {
      return (
        <Typography variant="subtitle1" fontWeight="medium">
          {block.name}
        </Typography>
      );
    }
    return (
      <>
        <Typography variant="subtitle1" fontWeight="medium">
          {block.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatTime(block.startMinute)} - {formatTime(block.endMinute)}
        </Typography>
      </>
    );
  };

  return (
    <Paper
      sx={{
        width: 280,
        height: "100%",
        mx: 1,
        mb: 1,
        backgroundColor: "background.paper",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
      elevation={0}
      variant="outlined"
    >
      <Box p={2} bgcolor="background.default" borderRadius="4px 4px 0 0">
        {renderColumnHeader()}
      </Box>

      <Droppable droppableId={block.id}>
        {(provided, snapshot) => (
          <Stack
            ref={provided.innerRef}
            {...provided.droppableProps}
            spacing={1}
            sx={{
              flex: 1,
              overflowY: "auto",
              p: 1,
              minHeight: 100,
              backgroundColor: snapshot.isDraggingOver ? "action.hover" : "background.paper",
              transition: "background-color 0.2s ease",
            }}
            role="list"
            aria-label={`Columna ${block.name}`}
          >
            {activities.length === 0 ? (
              <Typography
                variant="body2"
                color="text.disabled"
                role="listitem"
                sx={{
                  textAlign: "center",
                  py: 2,
                  fontStyle: "italic",
                }}
              >
                {snapshot.isDraggingOver
                  ? "Suelta aquí para añadir"
                  : "No hay actividades en este bloque."}
              </Typography>
            ) : (
              activities.map((activity, index) => (
                <KanbanCard
                  key={activity.id}
                  activity={activity}
                  index={index}
                  onEdit={onEditActivity}
                  onActivate={onActivateActivity}
                  onComplete={onCompleteActivity}
                  onInterrupt={onInterruptActivity}
                  isDayActive={isDayActive}
                  isTimeBlockAvailable={isTimeBlockAvailable(block.id)}
                />
              ))
            )}
            {provided.placeholder}
          </Stack>
        )}
      </Droppable>
    </Paper>
  );
};

export default KanbanColumn;
