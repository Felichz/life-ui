import React from "react";
import { render, screen } from "@testing-library/react";
import OverviewPage from "../OverviewPage";
import { useSystemCore } from "../../hooks/useSystemCore";
import { MemoryRouter } from "react-router-dom";

// Mock del hook useSystemCore
jest.mock("../../hooks/useSystemCore");

// Mock de los componentes que se utilizan
jest.mock("../../components/Common/TopBar", () => {
  return {
    __esModule: true,
    default: jest.fn(({ isDayActive }) => (
      <div data-testid="top-bar" data-is-day-active={isDayActive}>
        TopBar mocked
        {isDayActive && <span>Día activo</span>}
      </div>
    )),
  };
});

jest.mock("../../containers/TimelineContainer", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="timeline-container">Timeline mocked</div>),
}));

jest.mock("../../containers/ChartsContainer", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="charts-container">Charts mocked</div>),
}));

describe("OverviewPage", () => {
  // Configuración del mock para useSystemCore
  const mockUseSystemCore = {
    isDayActive: jest.fn(() => false),
    getCurrentDay: jest.fn(() => null),
    getTempoSummary: jest.fn(() => ({
      totalTempos: 0,
      target: 1000,
      targetProgress: 0,
      progressBarValue: 0,
      displayPercent: 0,
      completedActivities: 0,
      averageSatisfaction: 0,
      lastReward: undefined,
    })),
    getTempoTrends: jest.fn(() => []),
    state: {
      global: {
        days: [],
        activityTemplates: [],
        eventTemplates: [],
        timeBlocks: [],
        userPreferences: {
          dailyTempoTarget: 100,
          updatedAt: "",
        },
        completedActivityRecords: [],
        eventInstances: [],
        schemaVersion: 2,
      },
      currentDay: null,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useSystemCore as jest.Mock).mockImplementation(() => mockUseSystemCore);
  });

  test("renderiza correctamente con TopBar, TimelineContainer y ChartsContainer", () => {
    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>
    );

    // Verificar que se muestra el título
    expect(screen.getByText("Vista de Resumen - Qualia Control")).toBeInTheDocument();

    // Verificar que TopBar recibe isDayActive=false
    const topBar = screen.getByTestId("top-bar");
    expect(topBar).toHaveAttribute("data-is-day-active", "false");
    expect(screen.queryByText("Día activo")).not.toBeInTheDocument();

    // Verificar que se renderizan los contenedores
    expect(screen.getByTestId("timeline-container")).toBeInTheDocument();
    expect(screen.getByTestId("charts-container")).toBeInTheDocument();
  });

  test("pasa isDayActive=true al TopBar cuando hay un día activo", () => {
    // Sobrescribir mock para un día activo
    mockUseSystemCore.isDayActive.mockReturnValue(true);

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>
    );

    // Verificar que TopBar recibe isDayActive=true
    const topBar = screen.getByTestId("top-bar");
    expect(topBar).toHaveAttribute("data-is-day-active", "true");
    expect(screen.getByText("Día activo")).toBeInTheDocument();
  });
});
