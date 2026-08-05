/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import TempoBanner from "../TempoBanner";
import { useSystemCore } from "../../hooks/useSystemCore";

jest.mock("../../hooks/useSystemCore", () => ({
  useSystemCore: jest.fn(),
}));

const mockUseSystemCore = useSystemCore as jest.Mock;

describe("TempoBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renderiza null cuando no hay día activo", () => {
    mockUseSystemCore.mockReturnValue({
      getCurrentDay: () => null,
      getTempoSummary: jest.fn(),
      state: { global: { completedActivityRecords: [] }, currentDay: null },
    });
    const { container } = render(<TempoBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("muestra 0/1000 tempos por default (sin records)", () => {
    mockUseSystemCore.mockReturnValue({
      getCurrentDay: () => ({ id: "d1" }),
      getTempoSummary: () => ({
        totalTempos: 0,
        target: 1000,
        targetProgress: 0,
        progressBarValue: 0,
        displayPercent: 0,
        completedActivities: 0,
        averageSatisfaction: 0,
      }),
      state: { global: { completedActivityRecords: [] }, currentDay: { day: { id: "d1" } } },
    });
    render(<TempoBanner />);
    expect(screen.getByTestId("tempo-total")).toHaveTextContent("0");
    expect(screen.getByTestId("tempo-percent")).toHaveTextContent("0%");
    expect(screen.getByTestId("tempo-progress")).toBeInTheDocument();
  });

  it("muestra el total correctamente con actividades completadas", () => {
    mockUseSystemCore.mockReturnValue({
      getCurrentDay: () => ({ id: "d1" }),
      getTempoSummary: () => ({
        totalTempos: 350,
        target: 1000,
        targetProgress: 0.35,
        progressBarValue: 35,
        displayPercent: 35,
        completedActivities: 5,
        averageSatisfaction: 7.5,
        lastReward: { recordId: "r1", activityTitle: "Leer", tempos: 80 },
      }),
      state: { global: { completedActivityRecords: [] }, currentDay: { day: { id: "d1" } } },
    });
    render(<TempoBanner />);
    expect(screen.getByTestId("tempo-total")).toHaveTextContent("350");
    expect(screen.getByTestId("tempo-percent")).toHaveTextContent("35%");
    expect(screen.getByTestId("last-reward")).toHaveTextContent(/Leer.*\+80 tempos/);
  });

  it("muestra >100% cuando se supera el target (sin capear)", () => {
    mockUseSystemCore.mockReturnValue({
      getCurrentDay: () => ({ id: "d1" }),
      getTempoSummary: () => ({
        totalTempos: 1847,
        target: 1000,
        targetProgress: 1.847,
        progressBarValue: 100, // capeado para la barra
        displayPercent: 185, // honesto
        completedActivities: 12,
        averageSatisfaction: 8.2,
      }),
      state: { global: { completedActivityRecords: [] }, currentDay: { day: { id: "d1" } } },
    });
    render(<TempoBanner />);
    // El número grande es honesto
    expect(screen.getByTestId("tempo-total")).toHaveTextContent("1847");
    // El porcentaje muestra 185%
    expect(screen.getByTestId("tempo-percent")).toHaveTextContent("185%");
    // La barra está al 100% (capeada, no se rompe visualmente)
    const bar = screen.getByTestId("tempo-progress");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });

  it("respeta target custom del usuario", () => {
    mockUseSystemCore.mockReturnValue({
      getCurrentDay: () => ({ id: "d1" }),
      getTempoSummary: () => ({
        totalTempos: 500,
        target: 500, // usuario configuró su target
        targetProgress: 1.0,
        progressBarValue: 100,
        displayPercent: 100,
        completedActivities: 3,
        averageSatisfaction: 9,
      }),
      state: { global: { completedActivityRecords: [] }, currentDay: { day: { id: "d1" } } },
    });
    render(<TempoBanner />);
    expect(screen.getByTestId("tempo-total")).toHaveTextContent("500");
    expect(screen.getByText(/500 tempos/)).toBeInTheDocument();
    expect(screen.getByTestId("tempo-percent")).toHaveTextContent("100%");
  });

  it("no muestra lastReward si no hay", () => {
    mockUseSystemCore.mockReturnValue({
      getCurrentDay: () => ({ id: "d1" }),
      getTempoSummary: () => ({
        totalTempos: 0,
        target: 1000,
        targetProgress: 0,
        progressBarValue: 0,
        displayPercent: 0,
        completedActivities: 0,
        averageSatisfaction: 0,
        // lastReward undefined
      }),
      state: { global: { completedActivityRecords: [] }, currentDay: { day: { id: "d1" } } },
    });
    render(<TempoBanner />);
    expect(screen.queryByTestId("last-reward")).not.toBeInTheDocument();
  });
});
