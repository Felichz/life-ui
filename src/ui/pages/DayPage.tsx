import React, { useState, useRef } from "react";
import { Box, Button, Container, Paper, Typography, Snackbar, Alert } from "@mui/material";
import { useSystemCore } from "../hooks/useSystemCore";
import KanbanContainer from "../containers/KanbanContainer";
import QuickBarContainer from "../containers/QuickBarContainer";
import EventQuickBarContainer from "../containers/EventQuickBarContainer";
import TimelineContainer from "../containers/TimelineContainer";
import ActivityLibraryContainer from "../containers/ActivityLibraryContainer";
import TimeBlockModalContainer from "../containers/TimeBlockModalContainer";
import EventLibraryModalContainer from "../containers/EventLibraryModalContainer";
import VariableModalContainer from "../containers/VariableModalContainer";
import OverviewModalContainer from "../containers/OverviewModalContainer";
import ActivityInstanceModal from "../modals/ActivityInstanceModal";
import { useModal } from "../hooks/useModal";
import { DragDropContext } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import type { UUID, DynamicSettings } from "../../types";
import ConfirmEndDayModal from "../modals/ConfirmEndDayModal";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/Common/TopBar";
import ActionButtons from "../components/Common/ActionButtons";

const DayPage: React.FC = () => {
  const {
    isDayActive,
    createActivityInstance,
    getActiveActivity,
    canUpdateVariables,
    completeActivity,
    endDay,
  } = useSystemCore();
  const {
    isOpen: isInstanceModalOpen,
    open: openInstanceModal,
    close: closeInstanceModal,
  } = useModal(false);
  const {
    isOpen: isLibraryModalOpen,
    open: openLibraryModal,
    close: closeLibraryModal,
  } = useModal(false);
  const {
    isOpen: isTimeBlockModalOpen,
    open: openTimeBlockModal,
    close: closeTimeBlockModal,
  } = useModal(false);
  const {
    isOpen: isEventLibraryModalOpen,
    open: openEventLibraryModal,
    close: closeEventLibraryModal,
  } = useModal(false);
  const {
    isOpen: isVariableModalOpen,
    open: openVariableModal,
    close: closeVariableModal,
  } = useModal(false);
  const {
    isOpen: isOverviewModalOpen,
    open: openOverviewModal,
    close: closeOverviewModal,
  } = useModal(false);
  const { isOpen: isEndDayModalOpen, open: openEndDayModal, close: closeEndDayModal } = useModal();
  const [selectedTemplateId, setSelectedTemplateId] = useState<UUID | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<UUID | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Ref para acceder a los métodos del KanbanContainer desde este nivel
  const kanbanRef = useRef<{ handleDragEnd: (result: DropResult) => void } | null>(null);

  // Obtener la actividad activa actual
  const activeActivity = getActiveActivity();
  // Comprobar si se pueden actualizar variables (restricción de 5 minutos)
  const canUpdate = canUpdateVariables();

  // Navegación
  const navigate = useNavigate();

  // Verificar si hay un día activo
  if (!isDayActive()) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: "center" }}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            No hay un día activo
          </Typography>
          <Typography paragraph>Debes iniciar un día para acceder a esta vista.</Typography>
          <Button variant="contained" href="/">
            Volver al inicio
          </Button>
        </Paper>
      </Container>
    );
  }

  const handleDragEnd = (result: DropResult) => {
    // Delegar el manejo del resultado a KanbanContainer a través del ref
    if (kanbanRef.current) {
      kanbanRef.current.handleDragEnd(result);
    }
  };

  const handleOpenInstanceModal = (templateId: UUID, blockId: UUID) => {
    setSelectedTemplateId(templateId);
    setSelectedBlockId(blockId);
    openInstanceModal();
  };

  const handleConfirmInstanceModal = (
    templateId: UUID,
    blockId: UUID,
    dynamicSettings: DynamicSettings
  ) => {
    createActivityInstance(templateId, blockId, dynamicSettings);
    closeInstanceModal();
  };

  // Handler para abrir modal de finalizar día
  const handleEndDayClick = () => {
    openEndDayModal();
  };

  // Handler para confirmar finalización del día
  const handleEndDayConfirm = () => {
    try {
      // Si hay una actividad activa, completarla primero
      if (activeActivity) {
        completeActivity(activeActivity.id);
      }

      // Finalizar el día
      endDay();

      // Cerrar modal
      closeEndDayModal();

      // Navegar a la página de overview
      navigate("/overview");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      setError(`Error al finalizar el día: ${errorMessage}`);
      closeEndDayModal();
    }
  };

  // Cerrar alerta de error
  const handleErrorClose = () => {
    setError(null);
  };

  return (
    <>
      {/* TopBar con botón de finalizar día y otros botones de acción */}
      <TopBar
        isDayActive={isDayActive()}
        onEndDayClick={handleEndDayClick}
        actionButtons={
          <ActionButtons
            canUpdateVariables={canUpdate}
            onVariableClick={openVariableModal}
            onOverviewClick={openOverviewModal}
            onTimeBlockClick={openTimeBlockModal}
            onEventLibraryClick={openEventLibraryModal}
            onActivityLibraryClick={openLibraryModal}
          />
        }
      />

      <DragDropContext onDragEnd={handleDragEnd}>
        <Box
          sx={{ display: "flex", flexDirection: "column", height: "100vh" }}
          data-testid="day-page"
        >
          {/* Contenido principal */}
          <Box sx={{ display: "flex", flexGrow: 1, overflow: "hidden" }}>
            {/* Contenido principal */}
            <Box
              sx={{
                flexGrow: 1,
                overflow: "auto",
              }}
            >
              <Container maxWidth="xl" sx={{ my: 4 }}>
                {/* QuickBar */}
                <Box mb={4}>
                  <QuickBarContainer />
                </Box>

                {/* EventQuickBar */}
                <Box mb={4}>
                  <EventQuickBarContainer />
                </Box>

                <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, gap: 3 }}>
                  {/* Kanban */}
                  <Box sx={{ flexGrow: 1, width: { xs: "100%", lg: "66.66%" } }}>
                    <Paper sx={{ p: 2, height: "100%" }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h5" component="h2">
                          Actividades del día
                        </Typography>
                        <Box>
                          <Button variant="outlined" onClick={openTimeBlockModal} sx={{ mr: 1 }}>
                            Gestionar bloques
                          </Button>
                          <Button variant="outlined" onClick={openLibraryModal}>
                            Mostrar biblioteca
                          </Button>
                        </Box>
                      </Box>
                      <KanbanContainer ref={kanbanRef} />
                    </Paper>
                  </Box>

                  {/* Timeline */}
                  <Box sx={{ width: { xs: "100%", lg: "33.33%" } }}>
                    <Paper sx={{ p: 2, height: "100%" }}>
                      <Typography variant="h5" component="h2" mb={2}>
                        Línea de tiempo
                      </Typography>
                      <TimelineContainer />
                    </Paper>
                  </Box>
                </Box>
              </Container>
            </Box>
          </Box>

          {/* Modales */}
          <ActivityLibraryContainer
            open={isLibraryModalOpen}
            onClose={closeLibraryModal}
            onCreateInstance={handleOpenInstanceModal}
          />
          <TimeBlockModalContainer open={isTimeBlockModalOpen} onClose={closeTimeBlockModal} />
          <EventLibraryModalContainer
            open={isEventLibraryModalOpen}
            onClose={closeEventLibraryModal}
          />
          <OverviewModalContainer open={isOverviewModalOpen} onClose={closeOverviewModal} />
          <ActivityInstanceModal
            open={isInstanceModalOpen}
            onClose={closeInstanceModal}
            templateId={selectedTemplateId}
            blockId={selectedBlockId}
            onConfirm={handleConfirmInstanceModal}
          />
          <VariableModalContainer
            open={isVariableModalOpen}
            onClose={closeVariableModal}
            relatedActivityIds={activeActivity ? [activeActivity.id] : []}
          />
          <ConfirmEndDayModal
            open={isEndDayModalOpen}
            onClose={closeEndDayModal}
            onConfirm={handleEndDayConfirm}
          />
        </Box>
      </DragDropContext>

      {/* Snackbar de error */}
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
    </>
  );
};

export default DayPage;
