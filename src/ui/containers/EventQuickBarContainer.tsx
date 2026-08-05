import React, { useState } from "react";
import { Box, Snackbar, Alert } from "@mui/material";
import EventQuickBar from "../components/EventQuickBar";
import { useSystemCore } from "../hooks/useSystemCore";
import type { UUID, EventTemplate } from "../../types";

/**
 * Contenedor para la barra de acceso rápido a eventos.
 *
 * Schema v2+: ya no abre el VariableModalContainer (subjective variables
 * removidas). Solo registra el evento y muestra errores de runtime.
 */
const EventQuickBarContainer: React.FC = () => {
  const context = useSystemCore();
  const { createEventInstance, isDayActive } = context;

  const [isLoading, setIsLoading] = useState(false);
  const [loadingTemplateId, setLoadingTemplateId] = useState<UUID | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eventTemplates: EventTemplate[] = context.state.global.eventTemplates || [];

  const handleEventClick = (templateId: UUID) => {
    if (!isDayActive()) {
      setError("No hay un día activo para registrar eventos");
      return;
    }

    setIsLoading(true);
    setLoadingTemplateId(templateId);
    setError(null);

    try {
      createEventInstance(templateId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setError(`Error al registrar evento: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setLoadingTemplateId(null);
    }
  };

  const handleErrorClose = () => setError(null);

  if (!isDayActive()) return null;

  return (
    <Box sx={{ width: "100%", mb: 2 }} data-testid="event-quickbar-container">
      <EventQuickBar
        eventTemplates={eventTemplates}
        onEventClick={handleEventClick}
        isLoading={isLoading}
        loadingTemplateId={loadingTemplateId || undefined}
      />
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleErrorClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={handleErrorClose}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EventQuickBarContainer;
