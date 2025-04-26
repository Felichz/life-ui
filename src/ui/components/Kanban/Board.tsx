import React from "react";
import { Box, Typography } from "@mui/material";
import KanbanColumn from "./Column";
import type { TimeBlock, ActivityInstance, UUID } from "../../../types";
import type { DropResult } from "@hello-pangea/dnd";

// Define the augmented activity type
export interface ActivityInstanceWithTitle extends ActivityInstance {
  templateTitle: string;
}

// Update the interface to use the augmented type
export interface TimeBlockWithActivities {
  block: TimeBlock;
  activities: ActivityInstanceWithTitle[]; // Use the augmented type here
}

interface KanbanBoardProps {
  columns: TimeBlockWithActivities[];
  onDragEnd?: (result: DropResult) => void;
  onEditActivity?: (activity: ActivityInstance) => void; // Keep original type for callbacks if needed
  onActivateActivity?: (activityId: UUID) => void;
  onCompleteActivity?: (activityId: UUID) => void;
  onInterruptActivity?: (activityId: UUID) => void;
  isDayActive: boolean;
  isTimeBlockAvailable: (blockId: UUID) => boolean;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  columns,
  onDragEnd,
  onEditActivity,
  onActivateActivity,
  onCompleteActivity,
  onInterruptActivity,
  isDayActive,
  isTimeBlockAvailable,
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        overflowX: "auto",
        p: 1,
        minHeight: "70vh",
      }}
      data-testid="kanban-board"
    >
      {columns.length > 0 ? (
        columns.map((column) => (
          <Box key={column.block.id} sx={{ minWidth: 280, mx: 1 }}>
            <KanbanColumn
              block={column.block}
              activities={column.activities}
              onEditActivity={onEditActivity}
              onActivateActivity={onActivateActivity}
              onCompleteActivity={onCompleteActivity}
              onInterruptActivity={onInterruptActivity}
              isDayActive={isDayActive}
              isTimeBlockAvailable={isTimeBlockAvailable}
            />
          </Box>
        ))
      ) : (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Typography variant="h6" color="text.secondary">
            No hay bloques de tiempo definidos.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default KanbanBoard;
