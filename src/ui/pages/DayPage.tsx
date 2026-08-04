import React, { useState, useRef } from "react";
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  Snackbar,
  Alert,
  Chip,
  Stack,
} from "@mui/material";
import PlayCircleFilledRoundedIcon from "@mui/icons-material/PlayCircleFilledRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import ViewKanbanRoundedIcon from "@mui/icons-material/ViewKanbanRounded";
import TipsAndUpdatesRoundedIcon from "@mui/icons-material/TipsAndUpdatesRounded";
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
import TempoBanner from "../components/TempoBanner";
import { useModal } from "../hooks/useModal";
import { DragDropContext } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import type { UUID, DynamicSettings } from "../../types";
import ConfirmEndDayModal from "../modals/ConfirmEndDayModal";
import { useInRouterContext, useNavigate } from "react-router-dom";
import TopBar from "../components/Common/TopBar";
import ActionButtons from "../components/Common/ActionButtons";

const DayPage: React.FC = () => {
  const {
    state,
    isDayActive,
    createActivityInstance,
    getActiveActivity,
    canUpdateVariables,
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
  const kanbanRef = useRef<{ handleDragEnd: (result: DropResult) => void } | null>(null);
  const activeActivity = getActiveActivity();
  const canUpdate = canUpdateVariables();
  const inRouter = useInRouterContext();
  // DayPage is normally rendered inside BrowserRouter. The fallback keeps the
  // guarded empty-state renderable in isolation (e.g. component tests).
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const routerNavigate = inRouter ? useNavigate() : null;
  const navigate = routerNavigate || ((path: string) => window.history.pushState({}, "", path));
  const activeTemplateTitle =
    activeActivity && state?.global.activityTemplates
      ? state.global.activityTemplates.find((template) => template.id === activeActivity.templateId)
          ?.title
      : undefined;

  if (!isDayActive()) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: "center" }}>
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            No hay un día activo
          </Typography>
          <Typography paragraph color="text.secondary">
            Debes iniciar un día para acceder a esta vista.
          </Typography>
          <Button variant="contained" href="/">
            Volver al inicio
          </Button>
        </Paper>
      </Container>
    );
  }

  const handleDragEnd = (result: DropResult) => kanbanRef.current?.handleDragEnd(result);
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
  const handleEndDayConfirm = () => {
    try {
      // Schema v2+: si hay actividad activa, NO auto-completar al cerrar el día.
      // El usuario debe cerrar primero vía CompletionModal desde el Kanban.
      if (activeActivity) {
        setError(
          "Hay una actividad activa. Ciérrala primero desde el kanban antes de finalizar el día."
        );
        closeEndDayModal();
        return;
      }
      endDay();
      closeEndDayModal();
      navigate("/overview");
    } catch (err) {
      setError(
        `Error al finalizar el día: ${err instanceof Error ? err.message : "Error desconocido"}`
      );
      closeEndDayModal();
    }
  };

  return (
    <>
      <TopBar
        isDayActive={isDayActive()}
        onEndDayClick={openEndDayModal}
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
        <Box sx={{ minHeight: "calc(100vh - 72px)" }} data-testid="day-page">
          <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
            <TempoBanner />
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: 2,
                mb: 3,
                flexWrap: "wrap",
              }}
            >
              <Box>
                <Typography
                  variant="overline"
                  color="primary.main"
                  sx={{ letterSpacing: "0.14em", fontWeight: 800 }}
                >
                  MODO DÍA · EN VIVO
                </Typography>
                <Typography variant="h2" sx={{ mt: 0.5 }}>
                  Tu día, a tu ritmo.
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  Elige un foco. El resto puede esperar.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <Chip icon={<ViewKanbanRoundedIcon />} label="Plan visual" variant="outlined" />
                <Chip
                  icon={<TimelineRoundedIcon />}
                  label="Registro automático"
                  variant="outlined"
                />
              </Stack>
            </Box>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, md: 2.5 },
                mb: 3,
                borderRadius: 4,
                bgcolor: activeActivity ? "#1d2b4a" : "#eef2ff",
                color: activeActivity ? "white" : "text.primary",
                border: activeActivity ? "none" : "1px solid rgba(49,86,216,0.12)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 2.5,
                    bgcolor: activeActivity ? "rgba(255,255,255,0.12)" : "rgba(49,86,216,0.1)",
                    color: activeActivity ? "#b9c6ff" : "primary.main",
                  }}
                >
                  <PlayCircleFilledRoundedIcon />
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography
                    variant="overline"
                    sx={{
                      color: activeActivity ? "#aebcff" : "primary.main",
                      letterSpacing: "0.12em",
                    }}
                  >
                    {activeActivity ? "En ejecución" : "Siguiente paso"}
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ color: activeActivity ? "white" : "text.primary" }}
                  >
                    {activeActivity
                      ? activeTemplateTitle || "Actividad activa"
                      : "Activa una actividad para empezar"}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: activeActivity ? "#aeb9cf" : "text.secondary" }}
                  >
                    {activeActivity
                      ? "El tiempo se está registrando. Cuando termines, marca completar o interrumpir."
                      : "Usa la biblioteca, arrastra una tarjeta al bloque correcto o elige un acceso rápido."}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <TipsAndUpdatesRoundedIcon color="primary" />
                <Typography variant="h5">Accesos rápidos</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Las actividades y eventos frecuentes viven aquí para que no tengas que buscar.
              </Typography>
              <Stack spacing={1.5}>
                <QuickBarContainer />
                <EventQuickBarContainer />
              </Stack>
            </Box>

            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 4 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 2,
                }}
              >
                <Box>
                  <Typography variant="h5">Lo que ocurrió</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Actividades completadas, eventos e interrupciones.
                  </Typography>
                </Box>
                <Button
                  variant="text"
                  onClick={openOverviewModal}
                  startIcon={<TimelineRoundedIcon />}
                >
                  Ver detalle
                </Button>
              </Box>
              <Box sx={{ height: { xs: 150, md: 180 }, overflow: "auto" }}>
                <TimelineContainer />
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 4 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 2,
                  mb: 2,
                  flexWrap: "wrap",
                }}
              >
                <Box>
                  <Typography variant="h5">Actividades del día</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Arrastra para ordenar. Activa una tarjeta cuando estés listo.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" size="small" onClick={openTimeBlockModal}>
                    Gestionar bloques
                  </Button>
                  <Button variant="contained" size="small" onClick={openLibraryModal}>
                    Abrir biblioteca
                  </Button>
                </Stack>
              </Box>
              <KanbanContainer ref={kanbanRef} />
            </Paper>
          </Container>

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
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
};

export default DayPage;
