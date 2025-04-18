import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ActivityLibraryDrawer from "../components/ActivityLibraryDrawer";
import { useSystemCore } from "../hooks/useSystemCore";
import { DragDropContext } from "@hello-pangea/dnd";

// Mock de useSystemCore
jest.mock("../hooks/useSystemCore", () => ({
  useSystemCore: jest.fn(),
}));

describe("ActivityLibraryDrawer", () => {
  beforeEach(() => {
    // Mock básico para useSystemCore
    (useSystemCore as jest.Mock).mockReturnValue({
      getActivityTemplates: jest.fn().mockReturnValue([
        {
          id: "template-1",
          title: "Actividad 1",
          description: "Descripción de actividad 1",
          type: "clear-objective",
          clearObjectiveSettings: { estimatedDurationMinutes: 30 },
          isSystemActivity: false,
          createdAt: "2023-01-01T12:00:00.000Z",
          updatedAt: "2023-01-01T12:00:00.000Z",
        },
        {
          id: "template-2",
          title: "Actividad 2",
          description: "Descripción de actividad 2",
          type: "flexible-duration",
          flexibleDurationSettings: { minimumDurationMinutes: 15, maximumDurationMinutes: 45 },
          isSystemActivity: false,
          createdAt: "2023-01-01T12:00:00.000Z",
          updatedAt: "2023-01-01T12:00:00.000Z",
        },
      ]),
    });
  });

  test("renderiza correctamente cuando está abierto", () => {
    render(
      <DragDropContext onDragEnd={() => {}}>
        <ActivityLibraryDrawer open={true} onClose={() => {}} />
      </DragDropContext>
    );

    // Verificar que el título se muestra
    expect(screen.getByText("Biblioteca de Actividades")).toBeInTheDocument();

    // Verificar que las actividades se muestran
    expect(screen.getByText("Actividad 1")).toBeInTheDocument();
    expect(screen.getByText("Actividad 2")).toBeInTheDocument();

    // Verificar que los chips de tipo se muestran
    expect(screen.getByText("Objetivo claro")).toBeInTheDocument();
    expect(screen.getByText("Duración flexible")).toBeInTheDocument();
  });

  test("filtra actividades correctamente al buscar", () => {
    render(
      <DragDropContext onDragEnd={() => {}}>
        <ActivityLibraryDrawer open={true} onClose={() => {}} />
      </DragDropContext>
    );

    // Obtener el campo de búsqueda
    const searchInput = screen.getByPlaceholderText("Buscar actividades...");

    // Introducir un término de búsqueda
    fireEvent.change(searchInput, { target: { value: "Actividad 1" } });

    // Verificar que solo se muestra la actividad 1
    expect(screen.getByText("Actividad 1")).toBeInTheDocument();
    expect(screen.queryByText("Actividad 2")).not.toBeInTheDocument();
  });

  test("no carga actividades cuando está cerrado", () => {
    const mockGetActivityTemplates = jest.fn().mockReturnValue([]);
    (useSystemCore as jest.Mock).mockReturnValue({
      getActivityTemplates: mockGetActivityTemplates,
    });

    render(
      <DragDropContext onDragEnd={() => {}}>
        <ActivityLibraryDrawer open={false} onClose={() => {}} />
      </DragDropContext>
    );

    // Verificar que no se llamó a getActivityTemplates
    expect(mockGetActivityTemplates).not.toHaveBeenCalled();
  });
});
