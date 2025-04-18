import React, { useState } from "react";
import { Box, Snackbar, Alert } from "@mui/material";
import EventQuickBar from "../components/EventQuickBar";
import VariableModalContainer from "./VariableModalContainer";
import { useSystemCore } from "../hooks/useSystemCore";
import type { UUID, EventTemplate } from "../../types";

/**
 * Contenedor para la barra de acceso rápido a eventos
 */
const EventQuickBarContainer: React.FC = () => {
  // Obtener core y estado desde el contexto
  const context = useSystemCore();
  const { createEventInstance, isDayActive } = context;

  // Estados para la UI
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTemplateId, setLoadingTemplateId] = useState<UUID | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVariableModalOpen, setIsVariableModalOpen] = useState(false);
  const [relatedEventId, setRelatedEventId] = useState<UUID | null>(null);

  // Obtener plantillas de eventos desde el estado global
  const eventTemplates: EventTemplate[] = context.state.global.eventTemplates || [];

  // Handler para registrar un evento
  const handleEventClick = (templateId: UUID) => {
    if (!isDayActive()) {
      setError("No hay un día activo para registrar eventos");
      return;
    }

    setIsLoading(true);
    setLoadingTemplateId(templateId);
    setError(null);

    try {
      // Crear instancia de evento
      const eventInstance = createEventInstance(templateId);

      // Guardar el ID del evento para relacionarlo con las variables
      setRelatedEventId(eventInstance.id);

      // Abrir modal de variables subjetivas
      setIsVariableModalOpen(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setError(`Error al registrar evento: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setLoadingTemplateId(null);
    }
  };

  // Manejar cierre del modal de variables
  const handleVariableModalClose = () => {
    setIsVariableModalOpen(false);
    setRelatedEventId(null);
  };

  // Manejar el cierre de la alerta de error
  const handleErrorClose = () => {
    setError(null);
  };

  // No mostrar si no hay día activo
  if (!isDayActive()) return null;

  return (
    <Box sx={{ width: "100%", mb: 2 }}>
      <EventQuickBar
        eventTemplates={eventTemplates}
        onEventClick={handleEventClick}
        isLoading={isLoading}
        loadingTemplateId={loadingTemplateId || undefined}
      />

      {/* Modal de variables subjetivas */}
      <VariableModalContainer
        open={isVariableModalOpen}
        onClose={handleVariableModalClose}
        relatedEventIds={relatedEventId ? [relatedEventId] : []}
        onSuccess={() => {
          // Cerrar modal después de guardar variables
          setIsVariableModalOpen(false);
          setRelatedEventId(null);
        }}
      />

      {/* Alerta de error */}
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
