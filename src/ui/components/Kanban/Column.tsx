import React from "react";
import { Paper, Typography, Box, Stack, Chip } from "@mui/material";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import type { TimeBlock, ActivityInstance, UUID } from "../../../types";
import KanbanCard from "./Card";
import { Droppable } from "@hello-pangea/dnd";
import type { ActivityInstanceWithTitle } from "./Board";

interface KanbanColumnProps {
  block: TimeBlock;
  activities: ActivityInstanceWithTitle[];
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

  const droppableId = block.id;
  return (
    <Paper
      sx={{
        width: "100%",
        height: "100%",
        mb: 1,
        backgroundColor: "#fbfcfe",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
      elevation={0}
      variant="outlined"
    >
      <Box
        p={2}
        sx={{
          bgcolor: block.isDefault ? "#eef2ff" : "#f1f6f5",
          borderBottom: "1px solid rgba(99,115,145,0.12)",
          borderRadius: "16px 16px 0 0",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 1,
          }}
        >
          <Box>{renderColumnHeader()}</Box>
          <Chip
            size="small"
            label={activities.length}
            sx={{ bgcolor: "rgba(255,255,255,0.8)", minWidth: 28 }}
          />
        </Box>
        {!block.isDefault && (
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1, color: "text.secondary" }}
          >
            <ScheduleRoundedIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption">Planificado</Typography>
          </Box>
        )}
      </Box>

      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <Stack
            ref={provided.innerRef}
            {...provided.droppableProps}
            spacing={1}
            data-testid={`kanban-column-${block.name.toLowerCase().replace(/ /g, "-")}`}
            sx={{
              flex: 1,
              overflowY: "auto",
              p: 1.25,
              minHeight: 140,
              backgroundColor: snapshot.isDraggingOver ? "rgba(49,86,216,0.07)" : "#fbfcfe",
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
                  templateTitle={activity.templateTitle}
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
