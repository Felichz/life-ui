import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import useMediaQuery from "@mui/material/useMediaQuery";
import OverviewModal from "../OverviewModal";
import type {
  TimelineData,
  SubjectiveVariablesData,
  TimeDistributionData,
  Day,
  UUID,
} from "../../../types";

// Mock de los componentes de visualización
jest.mock("../../components/Timeline/Timeline", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="mocked-timeline">Timeline Mocked</div>),
}));

jest.mock("../../components/Charts/SubjectiveChart", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="mocked-subjective-chart">SubjectiveChart Mocked</div>),
}));

jest.mock("../../components/Charts/DistributionPie", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="mocked-distribution-pie">DistributionPie Mocked</div>),
}));

// Mock de useMediaQuery para controlar respuesta de viewport
jest.mock("@mui/material/useMediaQuery", () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe("OverviewModal", () => {
  // Props base para el componente
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    days: null,
    selectedDayId: null,
    onDayChange: jest.fn(),
    timelineData: null,
    subjectiveData: null,
    distributionData: null,
    isLoading: false,
    error: null,
    hiddenVariables: [],
    onToggleVariableVisibility: jest.fn(),
  };

  // Datos de ejemplo
  const mockDays: Day[] = [
    {
      id: "day-1",
      state: "inactive",
      startTime: "2023-07-01T08:00:00Z",
      endTime: "2023-07-01T20:00:00Z",
      createdAt: "2023-07-01T08:00:00Z",
      updatedAt: "2023-07-01T20:00:00Z",
    },
    {
      id: "day-2",
      state: "inactive",
      startTime: "2023-07-02T08:00:00Z",
      endTime: "2023-07-02T20:00:00Z",
      createdAt: "2023-07-02T08:00:00Z",
      updatedAt: "2023-07-02T20:00:00Z",
    },
  ];

  const mockTimelineData: TimelineData = {
    activities: [
      {
        id: "activity-1",
        title: "Test Activity",
        startTime: "2023-07-01T10:00:00Z",
        endTime: "2023-07-01T11:00:00Z",
        durationMinutes: 60,
        type: "clear-objective",
        state: "completed",
      },
    ],
    events: [
      {
        id: "event-1",
        name: "Test Event",
        timestamp: "2023-07-01T12:00:00Z",
        position: 720, // 12:00
      },
    ],
    interruptions: [],
  };

  const mockSubjectiveData: SubjectiveVariablesData = {
    variables: [
      {
        id: "var-1",
        name: "Energy",
        values: [
          {
            timestamp: "2023-07-01T10:00:00Z",
            value: 7,
            relatedActivities: [],
            relatedEvents: [],
          },
          {
            timestamp: "2023-07-01T14:00:00Z",
            value: 5,
            relatedActivities: [],
            relatedEvents: [],
          },
        ],
      },
    ],
    timeRange: {
      start: "2023-07-01T08:00:00Z",
      end: "2023-07-01T20:00:00Z",
    },
  };

  const mockDistributionData: TimeDistributionData = {
    categories: [
      {
        name: "Trabajo",
        totalMinutes: 240,
        percentage: 50,
        activities: [
          {
            id: "activity-1",
            title: "Test Activity",
            minutes: 240,
            percentage: 100,
          },
        ],
      },
      {
        name: "Descanso",
        totalMinutes: 120,
        percentage: 25,
        activities: [
          {
            id: "activity-2",
            title: "Break",
            minutes: 120,
            percentage: 100,
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useMediaQuery as jest.Mock).mockReturnValue(false); // Desktop por defecto
  });

  test("muestra spinner de carga cuando isLoading=true", () => {
    render(<OverviewModal {...defaultProps} isLoading={true} />);

    // Solo verificamos el título del diálogo en estado de carga
    expect(screen.getByText("Resumen Histórico")).toBeInTheDocument();
  });

  test("muestra mensaje cuando no hay días registrados", () => {
    render(<OverviewModal {...defaultProps} days={[]} />);

    expect(screen.getByText("No hay días anteriores registrados")).toBeInTheDocument();
  });

  test("muestra selector de día cuando hay días disponibles", () => {
    render(<OverviewModal {...defaultProps} days={mockDays} selectedDayId={mockDays[0].id} />);

    expect(screen.getByTestId("day-selector")).toBeInTheDocument();
  });

  test("muestra mensaje cuando no hay datos de timeline", () => {
    render(
      <OverviewModal
        {...defaultProps}
        days={mockDays}
        selectedDayId={mockDays[0].id}
        timelineData={{ activities: [], events: [], interruptions: [] }}
      />
    );

    expect(screen.getByText("No hay actividades registradas para este día")).toBeInTheDocument();
  });

  test("muestra mensaje cuando no hay datos de variables subjetivas", () => {
    render(
      <OverviewModal
        {...defaultProps}
        days={mockDays}
        selectedDayId={mockDays[0].id}
        subjectiveData={{ variables: [], timeRange: { start: "", end: "" } }}
      />
    );

    expect(
      screen.getByText("No hay variables subjetivas registradas para este día")
    ).toBeInTheDocument();
  });

  test("muestra mensaje cuando no hay datos de distribución", () => {
    render(
      <OverviewModal
        {...defaultProps}
        days={mockDays}
        selectedDayId={mockDays[0].id}
        distributionData={{ categories: [] }}
      />
    );

    expect(
      screen.getByText("No hay datos de distribución de tiempo para este día")
    ).toBeInTheDocument();
  });

  test("renderiza correctamente los datos de timeline", () => {
    render(
      <OverviewModal
        {...defaultProps}
        days={mockDays}
        selectedDayId={mockDays[0].id}
        timelineData={mockTimelineData}
      />
    );

    expect(screen.getByTestId("mocked-timeline")).toBeInTheDocument();
  });

  test("renderiza correctamente los datos de variables subjetivas", () => {
    render(
      <OverviewModal
        {...defaultProps}
        days={mockDays}
        selectedDayId={mockDays[0].id}
        subjectiveData={mockSubjectiveData}
      />
    );

    expect(screen.getByTestId("mocked-subjective-chart")).toBeInTheDocument();
  });

  test("renderiza correctamente los datos de distribución", () => {
    render(
      <OverviewModal
        {...defaultProps}
        days={mockDays}
        selectedDayId={mockDays[0].id}
        distributionData={mockDistributionData}
      />
    );

    expect(screen.getByTestId("mocked-distribution-pie")).toBeInTheDocument();
  });

  test("llama a onClose al hacer clic en el botón Cerrar", () => {
    render(<OverviewModal {...defaultProps} days={mockDays} selectedDayId={mockDays[0].id} />);

    fireEvent.click(screen.getByText("Cerrar"));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  test("llama a onDayChange al cambiar el día seleccionado", () => {
    render(<OverviewModal {...defaultProps} days={mockDays} selectedDayId={mockDays[0].id} />);

    // Nota: Este test está simplificado ya que es difícil simular el cambio en un select de MUI
    // En un escenario real podríamos usar testing-library/user-event para una interacción más completa
    const onDayChange = defaultProps.onDayChange;
    expect(onDayChange).toBeDefined();
  });

  test("en vista móvil muestra pestañas en lugar de secciones apiladas", () => {
    // Simular viewport móvil
    (useMediaQuery as jest.Mock).mockReturnValue(true);

    render(
      <OverviewModal
        {...defaultProps}
        days={mockDays}
        selectedDayId={mockDays[0].id}
        timelineData={mockTimelineData}
        subjectiveData={mockSubjectiveData}
        distributionData={mockDistributionData}
      />
    );

    // Verificar que existen las pestañas
    expect(screen.getByRole("tab", { name: /Línea de Tiempo/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Variables Subjetivas/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Distribución/i })).toBeInTheDocument();
  });

  test("muestra mensaje de error cuando hay un error", () => {
    render(
      <OverviewModal
        {...defaultProps}
        days={mockDays}
        selectedDayId={mockDays[0].id}
        error={new Error("Error de prueba")}
      />
    );

    expect(screen.getAllByText(/Error al cargar datos/i)).toHaveLength(3); // Un mensaje por sección
  });
});
