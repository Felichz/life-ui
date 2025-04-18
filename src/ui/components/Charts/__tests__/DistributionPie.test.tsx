import React from "react";
import { render, screen } from "@testing-library/react";
import DistributionPie from "../DistributionPie";
import { TimeDistributionData } from "../../../../types";

// Mock para recharts
jest.mock("recharts", () => {
  const OriginalModule = jest.requireActual("recharts");
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Pie: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="pie-component">{children}</div>
    ),
    Cell: () => <div data-testid="pie-cell" />,
    Tooltip: () => <div />,
    Legend: () => <div />,
  };
});

describe("DistributionPie Component", () => {
  const mockCategories: TimeDistributionData["categories"] = [
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
        {
          id: "2",
          title: "Reuniones",
          minutes: 120,
          percentage: 0.2,
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
        {
          id: "4",
          title: "Almuerzo",
          minutes: 90,
          percentage: 0.15,
        },
      ],
    },
  ];

  it("renderiza correctamente con categorías válidas", () => {
    render(<DistributionPie categories={mockCategories} />);

    expect(screen.getByTestId("distribution-pie")).toBeInTheDocument();
    expect(screen.getByTestId("pie-component")).toBeInTheDocument();

    // Verificar que se rendericen las celdas del pie
    const cells = screen.getAllByTestId("pie-cell");
    expect(cells.length).toBe(mockCategories.length);
  });

  it("muestra un mensaje cuando no hay categorías", () => {
    render(<DistributionPie categories={[]} />);

    expect(screen.getByText("No hay datos de distribución disponibles")).toBeInTheDocument();
    expect(screen.queryByTestId("pie-component")).not.toBeInTheDocument();
  });

  it("respeta la estructura de datos proporcionada", () => {
    const { container } = render(<DistributionPie categories={mockCategories} />);

    // Snapshot para verificar estructura
    expect(container).toMatchSnapshot();
  });
});
