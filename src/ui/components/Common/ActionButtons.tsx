import React from "react";
import { IconButton, Tooltip } from "@mui/material";
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

/**
 * Componente que muestra los botones de acción principales para las funcionalidades del sistema
 */
const ActionButtons: React.FC<ActionButtonsProps> = ({
  canUpdateVariables,
  onVariableClick,
  onOverviewClick,
  onTimeBlockClick,
  onEventLibraryClick,
  onActivityLibraryClick,
}) => {
  return (
    <>
      <Tooltip
        title={
          canUpdateVariables
            ? "Actualizar variables subjetivas"
            : "Debes esperar 5 minutos entre actualizaciones"
        }
      >
        <span>
          <IconButton
            color="inherit"
            onClick={onVariableClick}
            aria-label="actualizar variables subjetivas"
            sx={{ mr: 1 }}
            disabled={!canUpdateVariables}
          >
            <ShowChartIcon />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Ver resumen histórico">
        <IconButton
          color="inherit"
          onClick={onOverviewClick}
          aria-label="ver resumen histórico"
          sx={{ mr: 1 }}
        >
          <AssessmentIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Gestionar bloques de tiempo">
        <IconButton
          color="inherit"
          onClick={onTimeBlockClick}
          aria-label="gestionar bloques de tiempo"
          sx={{ mr: 1 }}
        >
          <AccessTimeIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Gestionar biblioteca de eventos">
        <IconButton
          color="inherit"
          onClick={onEventLibraryClick}
          aria-label="gestionar biblioteca de eventos"
          sx={{ mr: 1 }}
        >
          <EventNoteIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Biblioteca de actividades">
        <IconButton
          color="inherit"
          onClick={onActivityLibraryClick}
          aria-label="abrir biblioteca de actividades"
          sx={{ mr: 1 }}
        >
          <MenuBookIcon />
        </IconButton>
      </Tooltip>
    </>
  );
};

export default ActionButtons;
