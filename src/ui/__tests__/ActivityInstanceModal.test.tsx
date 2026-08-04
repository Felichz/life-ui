import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ActivityInstanceModal from "../modals/ActivityInstanceModal";
import { useSystemCore } from "../hooks/useSystemCore";
import type { ActivityTemplate, ActivityInstance } from "../../types";

// Mock del hook useSystemCore
jest.mock("../hooks/useSystemCore", () => ({
  useSystemCore: jest.fn(),
}));

describe("ActivityInstanceModal", () => {
  // Datos de prueba
  const mockTemplateId = "template-1";
  const mockBlockId = "block-1";
  const mockInstanceId = "instance-1";
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  const mockTemplates: ActivityTemplate[] = [
    {
      id: "template-1",
      title: "Actividad de prueba clear-objective",
      description: "Descripción de la actividad",
      type: "clear-objective",
      isSystemActivity: false,
      clearObjectiveSettings: {
        estimatedDurationMinutes: 30,
      },
      createdAt: "2023-01-01T12:00:00Z",
      updatedAt: "2023-01-01T12:00:00Z",
    },
    {
      id: "template-2",
      title: "Actividad de prueba flexible-duration",
      description: "Descripción de la actividad flexible",
      type: "flexible-duration",
      isSystemActivity: false,
      flexibleDurationSettings: {
        minimumDurationMinutes: 20,
        maximumDurationMinutes: 40,
      },
      createdAt: "2023-01-01T12:00:00Z",
      updatedAt: "2023-01-01T12:00:00Z",
    },
    {
      id: "template-3",
      title: "Actividad de prueba timeboxing",
      description: "Descripción de la actividad timeboxing",
      type: "timeboxing",
      isSystemActivity: false,
      timeboxingSettings: {
        type: "both",
        minimumDurationMinutes: 15,
        maximumDurationMinutes: 45,
      },
      createdAt: "2023-01-01T12:00:00Z",
      updatedAt: "2023-01-01T12:00:00Z",
    },
  ];

  const mockInstances: ActivityInstance[] = [
    {
      id: "instance-1",
      templateId: "template-1",
      blockId: "block-1",
      order: 0,
      state: "instantiated",
      clearObjectiveSettings: {
        estimatedDurationMinutes: 45, // Diferente al template para verificar que se carga correctamente
      },
      createdAt: "2023-01-01T12:00:00Z",
      updatedAt: "2023-01-01T12:00:00Z",
    },
  ];

  // Estado mock para el hook useSystemCore con valores estables para evitar re-renders
  const mockState = {
    currentDay: {
      activityInstances: mockInstances,
    },
  };

  // Mock de getActivityTemplates que devuelve siempre la misma referencia
  const mockGetActivityTemplates = jest.fn().mockReturnValue(mockTemplates);

  // Configuración común antes de cada test
  beforeEach(() => {
    jest.clearAllMocks();
    (useSystemCore as jest.Mock).mockImplementation(() => ({
      getActivityTemplates: mockGetActivityTemplates,
      state: mockState,
    }));
  });

  // Configuración común después de cada test
  afterEach(() => {
    jest.resetAllMocks();
  });

  test("renderiza correctamente el modal para crear una actividad clear-objective", async () => {
    render(
      <ActivityInstanceModal
        open={true}
        onClose={mockOnClose}
        templateId={mockTemplateId}
        blockId={mockBlockId}
        onConfirm={mockOnConfirm}
      />
    );

    // Verificar que el título y los campos se renderizan correctamente
    await waitFor(() => {
      expect(screen.getByText("Añadir a tu día")).toBeInTheDocument();
    });

    // Esperar explícitamente a que el título de la actividad se renderice
    await waitFor(() => {
      expect(screen.getByText("Actividad de prueba clear-objective")).toBeInTheDocument();
    });

    // Esperar a que los campos de entrada se renderizen usando waitFor en vez de findByLabelText
    let durationField: HTMLInputElement | null = null;

    await waitFor(() => {
      const element = screen.getByLabelText(/Duración estimada/i);
      expect(element).toBeInTheDocument();
      durationField = element as HTMLInputElement;
    });

    // Verificar que el campo de duración estimada tiene el valor por defecto de la plantilla
    expect(durationField).toHaveValue(30);

    // Cambiar valor y confirmar
    if (durationField) {
      fireEvent.change(durationField, { target: { value: 60 } });
      expect(durationField).toHaveValue(60);
    }

    const confirmButton = screen.getByText("Confirmar");
    fireEvent.click(confirmButton);

    // Verificar que onConfirm fue llamado con los parámetros correctos
    expect(mockOnConfirm).toHaveBeenCalledWith(mockTemplateId, mockBlockId, {
      clearObjectiveSettings: {
        estimatedDurationMinutes: 60,
      },
    });
  });

  test("renderiza correctamente el modal para editar una actividad existente", async () => {
    // Asegurarnos de que el mock devuelve lo que esperamos
    mockGetActivityTemplates.mockReturnValue(mockTemplates);

    render(
      <ActivityInstanceModal
        open={true}
        onClose={mockOnClose}
        templateId={mockTemplateId}
        blockId={mockBlockId}
        instanceId={mockInstanceId}
        isEditMode={true}
        onConfirm={mockOnConfirm}
      />
    );

    // Verificar que el título indica que estamos en modo edición
    await waitFor(() => {
      expect(screen.getByText("Editar actividad")).toBeInTheDocument();
    });

    // Esperar explícitamente a que se renderize el contenido de la plantilla
    await waitFor(() => {
      expect(screen.getByText("Actividad de prueba clear-objective")).toBeInTheDocument();
    });

    // Esperar a que los campos se carguen
    let durationField: HTMLInputElement | null = null;

    await waitFor(() => {
      const element = screen.getByLabelText(/Duración estimada/i);
      expect(element).toBeInTheDocument();
      durationField = element as HTMLInputElement;
    });

    // Verificar que el campo tiene el valor de la instancia (45), no de la plantilla (30)
    expect(durationField).toHaveValue(45);

    // Cambiar valor y guardar
    if (durationField) {
      fireEvent.change(durationField, { target: { value: 50 } });
      expect(durationField).toHaveValue(50);
    }

    const saveButton = screen.getByText("Guardar cambios");
    fireEvent.click(saveButton);

    // Verificar que onConfirm fue llamado con los parámetros correctos
    expect(mockOnConfirm).toHaveBeenCalledWith(mockTemplateId, mockBlockId, {
      clearObjectiveSettings: {
        estimatedDurationMinutes: 50,
      },
    });
  });

  test("valida correctamente un formulario con errores", async () => {
    // Asegurarnos de que el mock devuelve lo que esperamos
    mockGetActivityTemplates.mockReturnValue(mockTemplates);

    // Usar la plantilla de flexible-duration para probar la validación
    render(
      <ActivityInstanceModal
        open={true}
        onClose={mockOnClose}
        templateId="template-2"
        blockId={mockBlockId}
        onConfirm={mockOnConfirm}
      />
    );

    // Esperar a que se renderize el contenido de la plantilla
    await waitFor(() => {
      expect(screen.getByText("Actividad de prueba flexible-duration")).toBeInTheDocument();
    });

    // Esperar a que los campos de duración se renderizen
    let minDurationField: HTMLInputElement | null = null;
    let maxDurationField: HTMLInputElement | null = null;

    await waitFor(() => {
      const minElement = screen.getByLabelText(/Duración mínima/i);
      const maxElement = screen.getByLabelText(/Duración máxima/i);

      expect(minElement).toBeInTheDocument();
      expect(maxElement).toBeInTheDocument();

      minDurationField = minElement as HTMLInputElement;
      maxDurationField = maxElement as HTMLInputElement;
    });

    // Verificar que los campos tienen los valores iniciales
    expect(minDurationField).toHaveValue(20);
    expect(maxDurationField).toHaveValue(40);

    // Introducir un error: mínimo mayor que máximo
    if (minDurationField) {
      fireEvent.change(minDurationField, { target: { value: 50 } });
    }

    // Verificar que aparece el mensaje de error
    await waitFor(() => {
      expect(
        screen.getByText("La duración mínima no puede ser mayor a la máxima")
      ).toBeInTheDocument();
    });

    // Verificar que el botón está deshabilitado debido al error
    const confirmButton = screen.getByText("Confirmar");
    expect(confirmButton).toBeDisabled();

    // Arreglar el error
    if (maxDurationField) {
      fireEvent.change(maxDurationField, { target: { value: 60 } });
    }

    // Verificar que el botón ya no está deshabilitado
    await waitFor(() => {
      expect(confirmButton).not.toBeDisabled();
    });

    // Confirmar cambios y verificar los valores enviados
    fireEvent.click(confirmButton);
    expect(mockOnConfirm).toHaveBeenCalledWith("template-2", mockBlockId, {
      flexibleDurationSettings: {
        minimumDurationMinutes: 50,
        maximumDurationMinutes: 60,
      },
    });
  });
});
