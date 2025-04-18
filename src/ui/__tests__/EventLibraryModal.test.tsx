import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EventLibraryModal from "../modals/EventLibraryModal";
import { useSystemCore } from "../hooks/useSystemCore";
import type { EventTemplate } from "../../types";

// Mock del hook useSystemCore
jest.mock("../hooks/useSystemCore", () => ({
  useSystemCore: jest.fn(),
}));

describe("EventLibraryModal", () => {
  // Mocks de funciones del core
  const createEventTemplateMock = jest.fn();
  const updateEventTemplateMock = jest.fn();
  const deleteEventTemplateMock = jest.fn();

  // Datos de prueba
  const mockTemplates: EventTemplate[] = [
    {
      id: "event-1",
      name: "Tomar café",
      createdAt: "2023-01-01T12:00:00Z",
      updatedAt: "2023-01-01T12:00:00Z",
    },
    {
      id: "event-2",
      name: "Reunión de equipo",
      createdAt: "2023-01-01T12:00:00Z",
      updatedAt: "2023-01-01T12:00:00Z",
    },
  ];

  beforeEach(() => {
    // Configurar el mock del hook
    (useSystemCore as jest.Mock).mockReturnValue({
      state: {
        global: {
          eventTemplates: [...mockTemplates],
        },
      },
      createEventTemplate: createEventTemplateMock,
      updateEventTemplate: updateEventTemplateMock,
      deleteEventTemplate: deleteEventTemplateMock,
    });

    // Reiniciar contadores de llamadas a funciones mock
    createEventTemplateMock.mockReset();
    updateEventTemplateMock.mockReset();
    deleteEventTemplateMock.mockReset();

    // Configurar implementaciones de mocks
    createEventTemplateMock.mockImplementation((name) => ({
      id: "new-event",
      name,
      createdAt: "2023-01-01T12:00:00Z",
      updatedAt: "2023-01-01T12:00:00Z",
    }));

    updateEventTemplateMock.mockImplementation((id, data) => ({
      id,
      name: data.name,
      createdAt: "2023-01-01T12:00:00Z",
      updatedAt: "2023-01-01T12:00:00Z",
    }));
  });

  it("renderiza correctamente la lista de plantillas de eventos", () => {
    render(<EventLibraryModal open={true} onClose={() => {}} />);

    // Verificar que se muestran las plantillas
    expect(screen.getByText("Tomar café")).toBeInTheDocument();
    expect(screen.getByText("Reunión de equipo")).toBeInTheDocument();
  });

  it("permite editar una plantilla existente", async () => {
    render(<EventLibraryModal open={true} onClose={() => {}} />);

    // Hacer clic en editar el primer evento
    const editButtons = screen.getAllByLabelText("editar");
    fireEvent.click(editButtons[0]);

    // Verificar que el formulario de edición está activo
    expect(screen.getByText("Editar evento")).toBeInTheDocument();

    // Hacer clic en actualizar sin cambiar el nombre
    const updateButton = screen.getByText("Actualizar");
    fireEvent.click(updateButton);

    // Verificar que se llamó a la función correcta con el ID correcto
    await waitFor(() => {
      expect(updateEventTemplateMock).toHaveBeenCalledWith("event-1", { name: "Tomar café" });
    });
  });

  it("muestra confirmación al eliminar una plantilla", async () => {
    render(<EventLibraryModal open={true} onClose={() => {}} />);

    // Hacer clic en eliminar el primer evento
    const deleteButtons = screen.getAllByLabelText("eliminar");
    fireEvent.click(deleteButtons[0]);

    // Verificar que aparece el diálogo de confirmación
    expect(screen.getByText(/¿Estás seguro de que deseas eliminar el evento/)).toBeInTheDocument();

    // Confirmar eliminación
    const confirmButton = screen.getByText("Eliminar");
    fireEvent.click(confirmButton);

    // Verificar que se llamó a la función correcta
    await waitFor(() => {
      expect(deleteEventTemplateMock).toHaveBeenCalledWith("event-1");
    });
  });

  it("filtra plantillas correctamente al buscar", () => {
    render(<EventLibraryModal open={true} onClose={() => {}} />);

    // Escribir en el campo de búsqueda
    const searchInput = screen.getByPlaceholderText("Buscar eventos...");
    fireEvent.change(searchInput, { target: { value: "café" } });

    // Verificar que solo se muestra la plantilla correspondiente
    expect(screen.getByText("Tomar café")).toBeInTheDocument();
    expect(screen.queryByText("Reunión de equipo")).not.toBeInTheDocument();
  });

  it("muestra mensaje cuando no hay eventos", () => {
    // Configurar mock sin plantillas
    (useSystemCore as jest.Mock).mockReturnValue({
      state: {
        global: {
          eventTemplates: [],
        },
      },
      createEventTemplate: createEventTemplateMock,
      updateEventTemplate: updateEventTemplateMock,
      deleteEventTemplate: deleteEventTemplateMock,
    });

    render(<EventLibraryModal open={true} onClose={() => {}} />);

    // Verificar mensaje
    expect(screen.getByText("No hay eventos definidos")).toBeInTheDocument();
  });

  it("llama a onClose al hacer clic en el botón cerrar", () => {
    const onCloseMock = jest.fn();
    render(<EventLibraryModal open={true} onClose={onCloseMock} />);

    // Hacer clic en el botón de cerrar
    const closeButton = screen.getByText("Cerrar");
    fireEvent.click(closeButton);

    // Verificar que se llamó a onClose
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("cierra el modal al editar una plantilla exitosamente", async () => {
    const onCloseMock = jest.fn();
    render(<EventLibraryModal open={true} onClose={onCloseMock} />);

    // Hacer clic en editar el primer evento
    const editButtons = screen.getAllByLabelText("editar");
    fireEvent.click(editButtons[0]);

    // Hacer clic en actualizar sin cambiar el nombre
    const updateButton = screen.getByText("Actualizar");
    fireEvent.click(updateButton);

    // Verificar que se ha llamado a onClose después de actualizar
    await waitFor(() => {
      expect(updateEventTemplateMock).toHaveBeenCalledWith("event-1", { name: "Tomar café" });
      expect(onCloseMock).toHaveBeenCalled();
    });
  });
});
