import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import ChartsContainer from "../ChartsContainer";
import type { TimeDistributionData } from "../../../types";
import * as SystemProviderModule from "../../context/SystemProvider";

// Mock para DistributionPie
jest.mock("../../components/Charts/DistributionPie", () => ({
  __esModule: true,
  default: ({ categories }: { categories: TimeDistributionData["categories"] }) => (
    <div data-testid="distribution-pie" data-categories={JSON.stringify(categories)} />
  ),
}));

// Mock para SkeletonLoader
jest.mock("../../components/Common/SkeletonLoader", () => ({
  __esModule: true,
  default: ({ type }: { type: string }) => <div data-testid={`skeleton-${type}`} />,
}));

jest.mock("../../context/SystemProvider", () => {
  const actual = jest.requireActual("../../context/SystemProvider");
  return {
    ...actual,
    useSystemCore: jest.fn(),
  };
});

const mockUseSystemCore = (getTimeDistributionData: jest.Mock, getCurrentDay: jest.Mock) => {
  (SystemProviderModule.useSystemCore as jest.Mock).mockReturnValue({
    getTimeDistributionData,
    getCurrentDay,
  });
};

describe("ChartsContainer Component", () => {
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

  let mockGetTimeDistributionData: jest.Mock;
  let mockGetCurrentDay: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTimeDistributionData = jest.fn(() => mockDistributionData);
    mockGetCurrentDay = jest.fn(() => ({ id: "day-1" }));
    mockUseSystemCore(mockGetTimeDistributionData, mockGetCurrentDay);
  });

  it("renderiza DistributionPie con datos válidos", async () => {
    await act(async () => {
      render(<ChartsContainer />);
    });

    await waitFor(() => {
      const pie = screen.getByTestId("distribution-pie");
      const cats = JSON.parse(pie.getAttribute("data-categories") || "[]");
      expect(cats).toHaveLength(1);
      expect(cats[0].name).toBe("Work");
    });
  });

  it("muestra mensaje cuando no hay día activo", async () => {
    mockGetCurrentDay.mockReturnValueOnce(null);

    await act(async () => {
      render(<ChartsContainer />);
    });

    await waitFor(() => {
      expect(
        screen.getByTestId("no-data-message-distribution")
      ).toBeInTheDocument();
    });
  });

  it("muestra mensaje cuando no hay datos de distribución", async () => {
    mockGetTimeDistributionData.mockReturnValueOnce({ categories: [] });

    await act(async () => {
      render(<ChartsContainer />);
    });

    await waitFor(() => {
      expect(
        screen.getByTestId("no-data-message-distribution")
      ).toBeInTheDocument();
    });
  });

  it("permite reintentar tras un error", async () => {
    mockGetTimeDistributionData.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    await act(async () => {
      render(<ChartsContainer />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("retry-button-distribution")).toBeInTheDocument();
    });

    // El segundo intento ya pasa
    fireEvent.click(screen.getByTestId("retry-button-distribution"));

    await waitFor(() => {
      expect(screen.getByTestId("distribution-pie")).toBeInTheDocument();
    });
  });

  it("acepta dayId como prop y lo usa", async () => {
    const testDayId = "day-explicit";
    await act(async () => {
      render(<ChartsContainer dayId={testDayId} />);
    });

    await waitFor(() => {
      expect(mockGetTimeDistributionData).toHaveBeenCalledWith(testDayId);
    });
  });
});
