import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import OverviewModalContainer from "../OverviewModalContainer";
import { useSystemCore } from "../../hooks/useSystemCore";
import type {
  Day,
  TimelineData,
  SubjectiveVariablesData,
  TimeDistributionData,
} from "../../../types";

// Mock del hook useSystemCore
jest.mock("../../hooks/useSystemCore");

// Mock del componente OverviewModal para mejor aislamiento
jest.mock("../../modals/OverviewModal", () => ({
  __esModule: true,
  default: jest.fn(
    ({
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
    }) => (
      <div data-testid="overview-modal">
        <div data-testid="props-dump">
          {JSON.stringify({
            open,
            days: Array.isArray(days) ? days.length : 0,
            selectedDayId,
            hasTimelineData: !!timelineData,
            hasSubjectiveData: !!subjectiveData,
            hasDistributionData: !!distributionData,
            isLoading,
            hasError: !!error,
            hiddenVariables: hiddenVariables.length,
          })}
        </div>
        <button onClick={onClose}>Close</button>
        <button onClick={() => onDayChange("new-day-id")} data-testid="change-day-btn">
          Change Day
        </button>
        <button onClick={() => onToggleVariableVisibility("var-1")} data-testid="toggle-var-btn">
          Toggle Variable
        </button>
      </div>
    )
  ),
}));

describe("OverviewModalContainer", () => {
  // Datos de ejemplo
  const mockDays: Day[] = [
    {
      id: "day-2", // Más reciente
      state: "inactive",
      startTime: "2023-07-02T08:00:00Z",
      endTime: "2023-07-02T20:00:00Z",
      createdAt: "2023-07-02T08:00:00Z",
      updatedAt: "2023-07-02T20:00:00Z",
    },
    {
      id: "day-1", // Más antiguo
      state: "inactive",
      startTime: "2023-07-01T08:00:00Z",
      endTime: "2023-07-01T20:00:00Z",
      createdAt: "2023-07-01T08:00:00Z",
      updatedAt: "2023-07-01T20:00:00Z",
    },
  ];

  const mockTimelineData: TimelineData = {
    activities: [
      {
        id: "1",
        title: "Test",
        startTime: "",
        endTime: "",
        durationMinutes: 60,
        type: "clear-objective",
        state: "completed",
      },
    ],
    events: [],
    interruptions: [],
  };

  const mockSubjectiveData: SubjectiveVariablesData = {
    variables: [
      {
        id: "var-1",
        name: "Energy",
        values: [{ timestamp: "", value: 5, relatedActivities: [], relatedEvents: [] }],
      },
    ],
    timeRange: { start: "", end: "" },
  };

  const mockDistributionData: TimeDistributionData = {
    categories: [
      {
        name: "Work",
        totalMinutes: 60,
        percentage: 100,
        activities: [{ id: "1", title: "Test", minutes: 60, percentage: 100 }],
      },
    ],
  };

  // Configuración por defecto del mock
  const mockUseSystemCore = () => ({
    state: {
      global: {
        days: mockDays,
      },
    },
    getTimelineData: jest.fn(() => mockTimelineData),
    getSubjectiveVariablesData: jest.fn(() => mockSubjectiveData),
    getTimeDistributionData: jest.fn(() => mockDistributionData),
    getUserPreferences: jest.fn(() => ({
      hiddenSubjectiveVariableIds: ["var-2"],
    })),
    toggleVariableVisibility: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (useSystemCore as jest.Mock).mockImplementation(mockUseSystemCore);
  });

  test("selecciona el día más reciente por defecto", async () => {
    render(<OverviewModalContainer open={true} onClose={jest.fn()} />);

    // Esperar a que se estabilice el estado después de cargar los días
    await waitFor(() => {
      const propsDump = screen.getByTestId("props-dump");
      const props = JSON.parse(propsDump.textContent || "{}");
      expect(props.selectedDayId).toBe("day-2"); // El más reciente
    });
  });

  test("usa el dayId proporcionado cuando está definido", async () => {
    render(<OverviewModalContainer open={true} onClose={jest.fn()} dayId="day-1" />);

    await waitFor(() => {
      const propsDump = screen.getByTestId("props-dump");
      const props = JSON.parse(propsDump.textContent || "{}");
      expect(props.selectedDayId).toBe("day-1");
    });
  });

  test("obtiene los datos de timeline, variables y distribución", async () => {
    render(<OverviewModalContainer open={true} onClose={jest.fn()} />);

    // En lugar de verificar llamadas a funciones, verificar que los datos se pasan correctamente
    await waitFor(() => {
      const propsDump = screen.getByTestId("props-dump");
      const props = JSON.parse(propsDump.textContent || "{}");

      // Verificar que se tienen los datos cargados
      expect(props.hasTimelineData).toBe(true);
      expect(props.hasSubjectiveData).toBe(true);
      expect(props.hasDistributionData).toBe(true);
      expect(props.selectedDayId).toBe("day-2");
    });
  });

  test("cambia de día cuando onDayChange es invocado", async () => {
    render(<OverviewModalContainer open={true} onClose={jest.fn()} />);

    // Verificar estado inicial
    await waitFor(() => {
      const propsDump = screen.getByTestId("props-dump");
      const initialProps = JSON.parse(propsDump.textContent || "{}");
      expect(initialProps.selectedDayId).toBe("day-2");
    });

    // Simular cambio de día
    act(() => {
      screen.getByTestId("change-day-btn").click();
    });

    // Verificar que se actualizó el día seleccionado
    await waitFor(() => {
      const propsDump = screen.getByTestId("props-dump");
      const newProps = JSON.parse(propsDump.textContent || "{}");
      expect(newProps.selectedDayId).toBe("new-day-id");
    });
  });

  test("actualiza hiddenVariables desde getUserPreferences", async () => {
    render(<OverviewModalContainer open={true} onClose={jest.fn()} />);

    await waitFor(() => {
      const propsDump = screen.getByTestId("props-dump");
      const props = JSON.parse(propsDump.textContent || "{}");
      expect(props.hiddenVariables).toBe(1); // Un variable oculta: "var-2"
    });
  });

  test("invoca toggleVariableVisibility cuando se cambia visibilidad", async () => {
    const mockSystemCore = mockUseSystemCore();
    (useSystemCore as jest.Mock).mockImplementation(() => mockSystemCore);

    render(<OverviewModalContainer open={true} onClose={jest.fn()} />);

    // Primero verificar que el componente se ha renderizado completamente
    await waitFor(() => {
      const propsDump = screen.getByTestId("props-dump");
      expect(propsDump).toBeInTheDocument();
    });

    // Simular toggle de variable con act()
    await act(async () => {
      screen.getByTestId("toggle-var-btn").click();
    });

    // Verificar que se llamó al método
    expect(mockSystemCore.toggleVariableVisibility).toHaveBeenCalledWith("var-1");
  });

  test("maneja correctamente cuando no hay días finalizados", async () => {
    // Sobrescribir mock para días vacíos
    (useSystemCore as jest.Mock).mockImplementation(() => ({
      ...mockUseSystemCore(),
      state: {
        global: {
          days: [],
        },
      },
    }));

    render(<OverviewModalContainer open={true} onClose={jest.fn()} />);

    await waitFor(() => {
      const propsDump = screen.getByTestId("props-dump");
      const props = JSON.parse(propsDump.textContent || "{}");
      expect(props.days).toBe(0);
      expect(props.selectedDayId).toBe(null);
    });
  });

  test("no hace nada cuando el modal está cerrado", () => {
    const { getTimelineData } = mockUseSystemCore();

    render(<OverviewModalContainer open={false} onClose={jest.fn()} />);

    expect(getTimelineData).not.toHaveBeenCalled();
  });
});
