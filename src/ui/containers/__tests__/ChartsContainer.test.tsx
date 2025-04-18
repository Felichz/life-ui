/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import ChartsContainer from "../ChartsContainer";
import type { TimeDistributionData, SubjectiveVariablesData } from "../../../types";
import * as SystemProviderModule from "../../context/SystemProvider";

// Mock para DistributionPie
jest.mock("../../components/Charts/DistributionPie", () => ({
  __esModule: true,
  default: ({ categories }: { categories: TimeDistributionData["categories"] }) => (
    <div data-testid="distribution-pie" data-categories={JSON.stringify(categories)} />
  ),
}));

// Mock para SubjectiveChart
jest.mock("../../components/Charts/SubjectiveChart", () => ({
  __esModule: true,
  default: ({
    data,
    hiddenVariables,
    onToggle,
  }: {
    data: SubjectiveVariablesData;
    hiddenVariables: string[];
    onToggle: (id: string) => void;
  }) => (
    <div
      data-testid="subjective-chart"
      data-variables={data.variables.length}
      data-hidden={JSON.stringify(hiddenVariables)}
      onClick={() => onToggle("var-1")}
    />
  ),
}));

// Mock para SkeletonLoader
jest.mock("../../components/Common/SkeletonLoader", () => ({
  __esModule: true,
  default: ({ type }: { type: string }) => <div data-testid={`skeleton-${type}`} />,
}));

// Mockear useState para control manual en el test de SkeletonLoader
jest.mock("react", () => {
  const originalReact = jest.requireActual("react");
  return {
    ...originalReact,
    useState: jest.fn(),
  };
});

describe("ChartsContainer Component", () => {
  // Mock data
  const mockTimeDistributionData: TimeDistributionData = {
    categories: [
      {
        name: "Trabajo",
        totalMinutes: 300,
        percentage: 0.5,
        activities: [
          {
            id: "1",
            title: "Desarrollo",
            minutes: 180,
            percentage: 0.3,
          },
        ],
      },
      {
        name: "Descanso",
        totalMinutes: 120,
        percentage: 0.2,
        activities: [
          {
            id: "3",
            title: "Café",
            minutes: 30,
            percentage: 0.05,
          },
        ],
      },
    ],
  };

  const mockSubjectiveVariablesData: SubjectiveVariablesData = {
    variables: [
      {
        id: "var-1",
        name: "Energía",
        values: [
          {
            timestamp: "2023-04-18T09:00:00Z",
            value: 7,
            relatedActivities: ["Ejercicio matutino"],
            relatedEvents: [],
          },
          {
            timestamp: "2023-04-18T12:00:00Z",
            value: 5,
            relatedActivities: ["Reunión de equipo"],
            relatedEvents: ["Almuerzo"],
          },
        ],
      },
      {
        id: "var-2",
        name: "Concentración",
        values: [
          {
            timestamp: "2023-04-18T09:00:00Z",
            value: 6,
            relatedActivities: ["Ejercicio matutino"],
            relatedEvents: [],
          },
          {
            timestamp: "2023-04-18T12:00:00Z",
            value: 4,
            relatedActivities: ["Reunión de equipo"],
            relatedEvents: ["Almuerzo"],
          },
        ],
      },
    ],
    timeRange: {
      start: "2023-04-18T09:00:00Z",
      end: "2023-04-18T17:00:00Z",
    },
  };

  const mockEmptyDistributionData: TimeDistributionData = {
    categories: [],
  };

  const mockEmptySubjectiveData: SubjectiveVariablesData = {
    variables: [],
    timeRange: {
      start: "2023-04-18T09:00:00Z",
      end: "2023-04-18T17:00:00Z",
    },
  };

  // Configurar mocks
  let useSystemCoreMock: jest.SpyInstance;
  let mockGetTimeDistributionData: jest.Mock;
  let mockGetSubjectiveVariablesData: jest.Mock;
  let mockGetCurrentDay: jest.Mock;
  let mockGetUserPreferences: jest.Mock;
  let mockToggleVariableVisibility: jest.Mock;

  beforeEach(() => {
    // Evitar que jest imprima el console.error en las pruebas
    jest.spyOn(console, "error").mockImplementation(() => {});

    mockGetTimeDistributionData = jest.fn(() => mockTimeDistributionData);
    mockGetSubjectiveVariablesData = jest.fn(() => mockSubjectiveVariablesData);
    mockGetCurrentDay = jest.fn(() => ({ id: "day-123" }));
    mockGetUserPreferences = jest.fn(() => ({ hiddenSubjectiveVariableIds: [] }));
    mockToggleVariableVisibility = jest.fn();

    // Usamos any para evitar problemas de tipado en el test ya que solo probamos funcionalidades específicas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSystemCoreMock = jest.spyOn(SystemProviderModule, "useSystemCore").mockReturnValue({
      getTimeDistributionData: mockGetTimeDistributionData,
      getSubjectiveVariablesData: mockGetSubjectiveVariablesData,
      getCurrentDay: mockGetCurrentDay,
      getUserPreferences: mockGetUserPreferences,
      toggleVariableVisibility: mockToggleVariableVisibility,
      state: {},
    } as any);

    // Restablecer el mock de useState para los tests que no lo necesitan
    (React.useState as jest.Mock).mockImplementation(jest.requireActual("react").useState);
  });

  afterEach(() => {
    jest.clearAllMocks();
    (console.error as jest.Mock).mockRestore();
  });

  it("muestra SkeletonLoader durante la carga para ambas secciones", async () => {
    // Mockear useState para controlar manualmente el estado isLoading para ambas secciones

    // Estados para distribución
    (React.useState as jest.Mock).mockImplementationOnce(() => [null, jest.fn()]); // data
    (React.useState as jest.Mock).mockImplementationOnce(() => [true, jest.fn()]); // isLoading
    (React.useState as jest.Mock).mockImplementationOnce(() => [null, jest.fn()]); // error
    (React.useState as jest.Mock).mockImplementationOnce(() => [false, jest.fn()]); // showError

    // Estados para variables subjetivas
    (React.useState as jest.Mock).mockImplementationOnce(() => [null, jest.fn()]); // subjectiveData
    (React.useState as jest.Mock).mockImplementationOnce(() => [true, jest.fn()]); // isLoadingSubjective
    (React.useState as jest.Mock).mockImplementationOnce(() => [null, jest.fn()]); // errorSubjective
    (React.useState as jest.Mock).mockImplementationOnce(() => [false, jest.fn()]); // showErrorSubjective

    await act(async () => {
      render(<ChartsContainer />);
    });

    // Verificar que se muestran ambos SkeletonLoader
    const skeletons = screen.getAllByTestId("skeleton-chart");
    expect(skeletons.length).toBe(2);

    // Verificar títulos de secciones
    expect(screen.getByText("Distribución del tiempo")).toBeInTheDocument();
    expect(screen.getByText("Variables subjetivas")).toBeInTheDocument();
  });

  it("renderiza DistributionPie y SubjectiveChart con datos válidos", async () => {
    await act(async () => {
      render(<ChartsContainer />);
    });

    // Verificar que se muestran ambos componentes
    expect(screen.getByTestId("distribution-pie")).toBeInTheDocument();
    expect(screen.getByTestId("subjective-chart")).toBeInTheDocument();
    expect(screen.getByTestId("charts-container")).toBeInTheDocument();

    // Verificar las secciones
    expect(screen.getByTestId("distribution-section")).toBeInTheDocument();
    expect(screen.getByTestId("subjective-section")).toBeInTheDocument();
  });

  it("muestra mensaje cuando no hay datos de distribución", async () => {
    // Configurar mock para devolver datos vacíos de distribución
    mockGetTimeDistributionData.mockReturnValueOnce(mockEmptyDistributionData);

    await act(async () => {
      render(<ChartsContainer />);
    });

    expect(screen.getByTestId("no-data-message-distribution")).toBeInTheDocument();
    expect(screen.getByText("No hay datos de distribución disponibles")).toBeInTheDocument();

    // Verificar que el gráfico de variables aún se muestra
    expect(screen.getByTestId("subjective-chart")).toBeInTheDocument();
  });

  it("muestra mensaje cuando no hay datos de variables subjetivas", async () => {
    // Configurar mock para devolver datos vacíos de variables subjetivas
    mockGetSubjectiveVariablesData.mockReturnValueOnce(mockEmptySubjectiveData);

    await act(async () => {
      render(<ChartsContainer />);
    });

    expect(screen.getByTestId("no-data-message-subjective")).toBeInTheDocument();
    expect(
      screen.getByText("No hay datos de variables subjetivas disponibles")
    ).toBeInTheDocument();

    // Verificar que el gráfico de distribución aún se muestra
    expect(screen.getByTestId("distribution-pie")).toBeInTheDocument();
  });

  it("maneja errores en carga de datos de distribución y permite reintentar", async () => {
    // Configurar mock para lanzar error en el primer intento
    const mockError = new Error("Error de prueba");
    mockGetTimeDistributionData.mockImplementationOnce(() => {
      throw mockError;
    });

    // Segundo intento exitoso
    mockGetTimeDistributionData.mockImplementationOnce(() => mockTimeDistributionData);

    await act(async () => {
      render(<ChartsContainer />);
    });

    // Verificar presencia del botón de reintentar
    expect(screen.getByTestId("retry-button-distribution")).toBeInTheDocument();

    // Simular clic en el botón de reintentar
    await act(async () => {
      fireEvent.click(screen.getByTestId("retry-button-distribution"));
    });

    // Verificar que se cargan los datos correctamente en el segundo intento
    expect(screen.getByTestId("distribution-pie")).toBeInTheDocument();
  });

  it("maneja errores en carga de datos de variables subjetivas y permite reintentar", async () => {
    // Configurar mock para lanzar error en el primer intento
    const mockError = new Error("Error de prueba");
    mockGetSubjectiveVariablesData.mockImplementationOnce(() => {
      throw mockError;
    });

    // Segundo intento exitoso
    mockGetSubjectiveVariablesData.mockImplementationOnce(() => mockSubjectiveVariablesData);

    await act(async () => {
      render(<ChartsContainer />);
    });

    // Verificar presencia del botón de reintentar
    expect(screen.getByTestId("retry-button-subjective")).toBeInTheDocument();

    // Simular clic en el botón de reintentar
    await act(async () => {
      fireEvent.click(screen.getByTestId("retry-button-subjective"));
    });

    // Verificar que se cargan los datos correctamente en el segundo intento
    expect(screen.getByTestId("subjective-chart")).toBeInTheDocument();
  });

  it("usa dayId cuando se proporciona como prop para ambas secciones", async () => {
    const testDayId = "specific-day-123";

    await act(async () => {
      render(<ChartsContainer dayId={testDayId} />);
    });

    expect(mockGetTimeDistributionData).toHaveBeenCalledWith(testDayId);
    expect(mockGetSubjectiveVariablesData).toHaveBeenCalledWith(testDayId);
  });

  it("llama a toggleVariableVisibility cuando se interactúa con el gráfico de variables", async () => {
    await act(async () => {
      render(<ChartsContainer />);
    });

    const subjectiveChart = screen.getByTestId("subjective-chart");

    // Simular interacción con el gráfico de variables
    fireEvent.click(subjectiveChart);

    // Verificar que se llama a toggleVariableVisibility
    expect(mockToggleVariableVisibility).toHaveBeenCalledWith("var-1");
  });

  it("pasa las variables ocultas desde userPreferences al gráfico", async () => {
    // Modificar el mock para devolver variables ocultas
    const hiddenVars = ["var-1", "var-3"];
    mockGetUserPreferences.mockReturnValue({
      hiddenSubjectiveVariableIds: hiddenVars,
    });

    await act(async () => {
      render(<ChartsContainer />);
    });

    const subjectiveChart = screen.getByTestId("subjective-chart");

    // Verificar que se pasan las variables ocultas al gráfico
    expect(subjectiveChart.getAttribute("data-hidden")).toBe(JSON.stringify(hiddenVars));
  });
});
