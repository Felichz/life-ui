import React from "react";
import { Box, Typography, Button, CircularProgress, Tooltip } from "@mui/material";
import EventIcon from "@mui/icons-material/Event";
import type { EventTemplate, UUID } from "../../types";

interface EventQuickBarProps {
  eventTemplates: EventTemplate[];
  onEventClick: (templateId: UUID) => void;
  isLoading?: boolean;
  loadingTemplateId?: UUID;
}

/**
 * Barra de acceso rápido a eventos
 */
const EventQuickBar: React.FC<EventQuickBarProps> = ({
  eventTemplates,
  onEventClick,
  isLoading = false,
  loadingTemplateId,
}) => {
  if (eventTemplates.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          bgcolor: "background.paper",
          borderRadius: 3,
          p: 1.5,
          border: "1px dashed rgba(99,115,145,0.22)",
          width: "100%",
        }}
      >
        <Typography variant="body2" color="textSecondary" sx={{ ml: 1 }}>
          No hay eventos definidos. Añade eventos desde la biblioteca de eventos.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 1,
        bgcolor: "background.paper",
        borderRadius: 3,
        p: 1.5,
        border: "1px solid rgba(99,115,145,0.12)",
        width: "100%",
        overflowX: "auto",
      }}
      aria-label="Registro rápido de eventos"
    >
      <Typography
        variant="body2"
        sx={{ mr: 1, color: "text.secondary", fontWeight: 700, whiteSpace: "nowrap" }}
      >
        Registrar ahora
      </Typography>

      {eventTemplates.map((template) => {
        const isLoadingThis = loadingTemplateId === template.id && isLoading;

        return (
          <Tooltip key={template.id} title={`Registrar "${template.name}"`} arrow>
            <Button
              variant="outlined"
              size="small"
              startIcon={
                isLoadingThis ? <CircularProgress size={16} /> : <EventIcon fontSize="small" />
              }
              onClick={() => onEventClick(template.id)}
              disabled={isLoadingThis}
              sx={{ minWidth: "auto" }}
              data-testid={`quick-event-${template.id}`}
            >
              {template.name}
            </Button>
          </Tooltip>
        );
      })}
    </Box>
  );
};

export default EventQuickBar;
