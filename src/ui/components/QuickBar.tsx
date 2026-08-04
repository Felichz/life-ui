import { Box, CircularProgress, Button, Typography } from "@mui/material";
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
        gap: 1,
        bgcolor: "background.paper",
        borderRadius: 3,
        p: 1.25,
        border: "1px solid rgba(99,115,145,0.12)",
        width: "100%",
        overflowX: "auto",
      }}
      aria-label="Barra de acceso rápido a actividades del sistema"
      data-testid="quick-bar"
    >
      <Typography
        variant="body2"
        sx={{ color: "text.secondary", fontWeight: 700, whiteSpace: "nowrap", mr: 0.5 }}
      >
        Empezar rápido
      </Typography>
      {systemActivities.map((activity) => {
        const isActive = activity.id === activeActivityId;
        const isLoading = loadingActivityId === activity.id;

        return (
          <Button
            key={activity.id}
            size="small"
            variant={isActive ? "contained" : "outlined"}
            title={activity.title}
            startIcon={
              isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                activityIcons[activity.title] || <span>⚡</span>
              )
            }
            sx={{ minWidth: "fit-content", whiteSpace: "nowrap" }}
            color={isActive ? "primary" : "inherit"}
            onClick={() => onSelect(activity.id)}
            aria-pressed={isActive}
            aria-label={activity.title}
            disabled={isActive || isLoading}
            data-testid={`quick-activity-${activity.id}`}
          >
            {activity.title}
          </Button>
        );
      })}
    </Box>
  );
};

export default QuickBar;
