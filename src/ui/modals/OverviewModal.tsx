import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  useMediaQuery,
  Paper,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  type SelectChangeEvent,
  CircularProgress,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import Timeline from "../components/Timeline/Timeline";
import SubjectiveChart from "../components/Charts/SubjectiveChart";
import DistributionPie from "../components/Charts/DistributionPie";
import SkeletonLoader from "../components/Common/SkeletonLoader";
import type {
  TimelineData,
  SubjectiveVariablesData,
  TimeDistributionData,
  Day,
  UUID,
} from "../../types";

// Componente TabPanel para gestionar las pestañas en vista móvil
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`overview-tabpanel-${index}`}
      aria-labelledby={`overview-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
};

interface OverviewModalProps {
  open: boolean;
  onClose: () => void;
  days: Day[] | null;
  selectedDayId: UUID | null;
  onDayChange: (dayId: UUID) => void;
  timelineData: TimelineData | null;
  subjectiveData: SubjectiveVariablesData | null;
  distributionData: TimeDistributionData | null;
  isLoading: boolean;
  error: Error | null;
  hiddenVariables: UUID[];
  onToggleVariableVisibility: (variableId: UUID) => void;
}

const OverviewModal: React.FC<OverviewModalProps> = ({
  open,
  onClose,
  days,
  selectedDayId,
  onDayChange,
  timelineData,
  subjectiveData,
  distributionData,
  isLoading,
  error,
  hiddenVariables,
  onToggleVariableVisibility,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [activeTab, setActiveTab] = useState(0);

  // Manejador de cambio de pestaña para vista móvil
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Manejador de cambio de día
  const handleDayChange = (event: SelectChangeEvent) => {
    onDayChange(event.target.value);
  };

  const renderDaySelector = () => {
    if (!days || days.length === 0) return null;

    return (
      <FormControl variant="outlined" size="small" sx={{ minWidth: 200, mb: 2 }}>
        <InputLabel id="day-select-label">Día</InputLabel>
        <Select
          labelId="day-select-label"
          id="day-select"
          value={selectedDayId || ""}
          label="Día"
          onChange={handleDayChange}
          data-testid="day-selector"
        >
          {days.map((day) => (
            <MenuItem key={day.id} value={day.id}>
              {new Date(day.createdAt).toLocaleDateString()}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  };

  const renderTimelineSection = () => {
    if (isLoading) {
      return <SkeletonLoader type="timeline" count={1} />;
    }

    if (error) {
      return (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <Typography color="error" data-testid="timeline-error-message">
            Error al cargar datos: {error.message}
          </Typography>
        </Box>
      );
    }

    if (!timelineData || !timelineData.activities || timelineData.activities.length === 0) {
      return (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <Typography color="textSecondary" data-testid="no-timeline-data-message">
            No hay actividades registradas para este día
          </Typography>
        </Box>
      );
    }

    return (
      <Timeline
        activities={timelineData.activities}
        events={timelineData.events}
        interruptions={timelineData.interruptions}
      />
    );
  };

  const renderSubjectiveSection = () => {
    if (isLoading) {
      return <SkeletonLoader type="chart" count={1} />;
    }

    if (error) {
      return (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <Typography color="error" data-testid="subjective-error-message">
            Error al cargar datos: {error.message}
          </Typography>
        </Box>
      );
    }

    if (!subjectiveData || !subjectiveData.variables || subjectiveData.variables.length === 0) {
      return (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <Typography color="textSecondary" data-testid="no-subjective-data-message">
            No hay variables subjetivas registradas para este día
          </Typography>
        </Box>
      );
    }

    return (
      <SubjectiveChart
        data={subjectiveData}
        hiddenVariables={hiddenVariables}
        onToggle={onToggleVariableVisibility}
      />
    );
  };

  const renderDistributionSection = () => {
    if (isLoading) {
      return <SkeletonLoader type="chart" count={1} />;
    }

    if (error) {
      return (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <Typography color="error" data-testid="distribution-error-message">
            Error al cargar datos: {error.message}
          </Typography>
        </Box>
      );
    }

    if (
      !distributionData ||
      !distributionData.categories ||
      distributionData.categories.length === 0
    ) {
      return (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <Typography color="textSecondary" data-testid="no-distribution-data-message">
            No hay datos de distribución de tiempo para este día
          </Typography>
        </Box>
      );
    }

    return <DistributionPie categories={distributionData.categories} />;
  };

  // Si no hay datos ni siquiera para mostrar el selector, pero no estamos cargando
  if (!days || (days.length === 0 && !isLoading)) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        aria-labelledby="overview-dialog-title"
        data-testid="overview-modal"
      >
        <DialogTitle id="overview-dialog-title">
          Resumen Histórico
          <IconButton
            aria-label="cerrar"
            onClick={onClose}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "50vh",
            }}
          >
            <Typography color="textSecondary" variant="h6" data-testid="no-days-data-message">
              No hay días finalizados para mostrar.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Estado de carga global
  if (isLoading && !timelineData && !subjectiveData && !distributionData) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        aria-labelledby="overview-dialog-title"
        data-testid="overview-modal"
      >
        <DialogTitle id="overview-dialog-title">
          Resumen Histórico
          <IconButton
            aria-label="cerrar"
            onClick={onClose}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "50vh",
            }}
          >
            <CircularProgress data-testid="CircularProgress" />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      aria-labelledby="overview-dialog-title"
      data-testid="overview-modal"
    >
      <DialogTitle id="overview-dialog-title">
        Resumen Histórico
        <IconButton
          aria-label="cerrar"
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {renderDaySelector()}

        {isMobile ? (
          // Vista móvil: usar pestañas
          <Box>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              aria-label="secciones de overview"
              variant="fullWidth"
            >
              <Tab
                label="Línea de Tiempo"
                id="overview-tab-0"
                aria-controls="overview-tabpanel-0"
              />
              <Tab
                label="Variables Subjetivas"
                id="overview-tab-1"
                aria-controls="overview-tabpanel-1"
              />
              <Tab label="Distribución" id="overview-tab-2" aria-controls="overview-tabpanel-2" />
            </Tabs>
            <TabPanel value={activeTab} index={0}>
              <Typography variant="h6" gutterBottom>
                Línea de Tiempo
              </Typography>
              {renderTimelineSection()}
            </TabPanel>
            <TabPanel value={activeTab} index={1}>
              <Typography variant="h6" gutterBottom>
                Variables Subjetivas
              </Typography>
              {renderSubjectiveSection()}
            </TabPanel>
            <TabPanel value={activeTab} index={2}>
              <Typography variant="h6" gutterBottom>
                Distribución de Tiempo
              </Typography>
              {renderDistributionSection()}
            </TabPanel>
          </Box>
        ) : (
          // Vista desktop: mostrar todo
          <Box>
            <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Línea de Tiempo
              </Typography>
              {renderTimelineSection()}
            </Paper>

            <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Variables Subjetivas
              </Typography>
              {renderSubjectiveSection()}
            </Paper>

            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Distribución de Tiempo
              </Typography>
              {renderDistributionSection()}
            </Paper>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
};

export default OverviewModal;
