import React from "react";
import { Box, Button, IconButton, Tooltip, useMediaQuery, useTheme } from "@mui/material";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EventNoteIcon from "@mui/icons-material/EventNote";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { useNavigate } from "react-router-dom";

interface ActionButtonsProps {
  onTimeBlockClick: () => void;
  onEventLibraryClick: () => void;
  onActivityLibraryClick: () => void;
}

/**
 * Acciones globales del TopBar de DayPage.
 *
 * Schema v2+: el botón "Variables" y la apertura de un modal de
 * "Resumen histórico" fueron removidos. El botón "Resumen" navega
 * directamente a `/overview`, donde la OverviewPage muestra métricas,
 * tendencias y distribución de tiempo.
 */
const ActionButtons: React.FC<ActionButtonsProps> = ({
  onTimeBlockClick,
  onEventLibraryClick,
  onActivityLibraryClick,
}) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const navigate = useNavigate();
  const actions = [
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

  const goToOverview = () => navigate("/overview");

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
                  aria-label={action.title}
                  sx={{ color: "text.secondary", px: 1.1, minWidth: "auto" }}
                >
                  {action.label}
                </Button>
              </span>
            </Tooltip>
          ))}
          <Tooltip title="Ver resumen histórico">
            <Button
              size="small"
              color="inherit"
              startIcon={<AssessmentIcon />}
              onClick={goToOverview}
              aria-label="ver resumen histórico"
              data-testid="open-overview-button"
              sx={{ color: "text.secondary", px: 1.1, minWidth: "auto" }}
            >
              Resumen
            </Button>
          </Tooltip>
        </Box>
      ) : (
        <Box sx={{ display: "flex", gap: 0.25 }}>
          {actions.map((action) => (
            <Tooltip key={action.label} title={action.title}>
              <IconButton
                size="small"
                color="primary"
                onClick={action.onClick}
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
              onClick={goToOverview}
              aria-label="ver resumen histórico"
              data-testid="open-overview-button"
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
