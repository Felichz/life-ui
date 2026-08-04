import React from "react";
import { Box, Button, IconButton, Tooltip, useMediaQuery, useTheme } from "@mui/material";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EventNoteIcon from "@mui/icons-material/EventNote";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import AssessmentIcon from "@mui/icons-material/Assessment";

interface ActionButtonsProps {
  canUpdateVariables: boolean;
  onVariableClick: () => void;
  onOverviewClick: () => void;
  onTimeBlockClick: () => void;
  onEventLibraryClick: () => void;
  onActivityLibraryClick: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  canUpdateVariables,
  onVariableClick,
  onOverviewClick,
  onTimeBlockClick,
  onEventLibraryClick,
  onActivityLibraryClick,
}) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const actions = [
    {
      label: "Variables",
      icon: <ShowChartIcon />,
      onClick: onVariableClick,
      disabled: !canUpdateVariables,
      title: canUpdateVariables
        ? "actualizar variables subjetivas"
        : "actualizar variables subjetivas",
    },
    {
      label: "Bloques",
      icon: <AccessTimeIcon />,
      onClick: onTimeBlockClick,
      title: "gestionar bloques de tiempo",
    },
    {
      label: "Eventos",
      icon: <EventNoteIcon />,
      onClick: onEventLibraryClick,
      title: "gestionar biblioteca de eventos",
    },
    {
      label: "Biblioteca",
      icon: <MenuBookIcon />,
      onClick: onActivityLibraryClick,
      title: "abrir biblioteca de actividades",
    },
  ];

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {isDesktop ? (
        <Box sx={{ display: "flex", gap: 0.5 }}>
          {actions.map((action) => (
            <Tooltip key={action.label} title={action.title}>
              <span>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={action.icon}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  aria-label={action.title}
                  sx={{ color: "text.secondary", px: 1.1, minWidth: "auto" }}
                >
                  {action.label}
                </Button>
              </span>
            </Tooltip>
          ))}
        </Box>
      ) : (
        <Box sx={{ display: "flex", gap: 0.25 }}>
          {actions.map((action) => (
            <Tooltip key={action.label} title={action.title}>
              <IconButton
                size="small"
                color="primary"
                onClick={action.onClick}
                disabled={action.disabled}
                aria-label={action.title}
              >
                {action.icon}
              </IconButton>
            </Tooltip>
          ))}
          <Tooltip title="Ver resumen histórico">
            <IconButton
              size="small"
              color="primary"
              onClick={onOverviewClick}
              aria-label="ver resumen histórico"
            >
              <AssessmentIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

export default ActionButtons;
