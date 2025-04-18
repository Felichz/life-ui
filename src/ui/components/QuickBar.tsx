import { Box, CircularProgress } from "@mui/material";
import IconButtonWithTooltip from "./Common/IconButtonWithTooltip";
import type { ActivityTemplate, UUID } from "../../types";
import type { ReactElement } from "react";

interface QuickBarProps {
  systemActivities: ActivityTemplate[];
  activeActivityId?: UUID;
  onSelect: (activityId: UUID) => void;
  isLoading?: boolean;
  loadingActivityId?: UUID;
}

// Mapeo simple de iconos por nombre de actividad (puedes personalizarlo)
const activityIcons: Record<string, ReactElement> = {
  "Piloto automático": (
    <span role="img" aria-label="Piloto automático">
      🛩️
    </span>
  ),
  Meditación: (
    <span role="img" aria-label="Meditación">
      🧘‍♂️
    </span>
  ),
  "Descanso consciente": (
    <span role="img" aria-label="Descanso consciente">
      😌
    </span>
  ),
};

const QuickBar = ({
  systemActivities,
  activeActivityId,
  onSelect,
  isLoading = false,
  loadingActivityId,
}: QuickBarProps) => {
  if (!systemActivities.length) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        bgcolor: "background.paper",
        borderRadius: 2,
        p: 1.5,
        boxShadow: 1,
        width: "100%",
        overflowX: "auto",
      }}
      aria-label="Barra de acceso rápido a actividades del sistema"
    >
      {systemActivities.map((activity) => {
        const isActive = activity.id === activeActivityId;
        const isLoading = loadingActivityId === activity.id;

        return (
          <IconButtonWithTooltip
            key={activity.id}
            title={activity.title}
            icon={
              isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                activityIcons[activity.title] || <span>⚡</span>
              )
            }
            color={isActive ? "primary" : "default"}
            onClick={() => onSelect(activity.id)}
            aria-pressed={isActive}
            disabled={isActive || isLoading}
          />
        );
      })}
    </Box>
  );
};

export default QuickBar;
