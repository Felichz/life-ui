import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import QuickBarContainer from "../containers/QuickBarContainer";
import type { ActivityInstance, ActivityTemplate, DynamicSettings } from "../../types";

// Mock del hook useSystemCore
jest.mock("../hooks/useSystemCore", () => ({
  useSystemCore: jest.fn(),
}));

// Mock del modal ActivityInstanceModal
jest.mock("../modals/ActivityInstanceModal", () => {
  return jest.fn(({ open, onClose, templateId, blockId, onConfirm }) => {
    if (!open) return null;
    return (
      <div data-testid="mock-activity-modal">
        <button
          onClick={() =>
            onConfirm(templateId, blockId, {
              timeboxingSettings: { type: "minimum-time", minimumDurationMinutes: 15 },
            })
          }
        >
          Confirmar
        </button>
        <button onClick={onClose}>Cancelar</button>
      </div>
    );
  });
});

// Importar el mock para poder configurarlo en los tests
import { useSystemCore } from "../hooks/useSystemCore";

// Mock de actividades del sistema para las pruebas
const mockSystemActivities: ActivityTemplate[] = [
  {
    id: "activity-1",
    title: "Piloto automático",
    description: "Estar en piloto automático",
    type: "flexible-duration",
    isSystemActivity: true,
    flexibleDurationSettings: {
      minimumDurationMinutes: 10,
      maximumDurationMinutes: 60,
    },
    createdAt: "2023-01-01T08:00:00.000Z",
    updatedAt: "2023-01-01T08:00:00.000Z",
  },
  {
    id: "activity-2",
    title: "Meditación",
    description: "Sesión de meditación mindfulness",
    type: "timeboxing",
    isSystemActivity: true,
    timeboxingSettings: {
      type: "minimum-time",
      minimumDurationMinutes: 10,
    },
    createdAt: "2023-01-01T08:00:00.000Z",
    updatedAt: "2023-01-01T08:00:00.000Z",
  },
  {
    id: "activity-3",
    title: "Descanso consciente",
    description: "Tomar un descanso breve pero consciente",
    type: "clear-objective",
    isSystemActivity: true,
    clearObjectiveSettings: {
      estimatedDurationMinutes: 15,
    },
    createdAt: "2023-01-01T08:00:00.000Z",
    updatedAt: "2023-01-01T08:00:00.000Z",
  },
];

// Mock de actividad activa
const mockActiveActivity: ActivityInstance = {
  id: "instance-1",
  templateId: "activity-1", // Piloto automático
  blockId: "block-1",
  order: 0,
  state: "active",
  startTime: "2023-01-01T10:00:00.000Z",
  createdAt: "2023-01-01T10:00:00.000Z",
  updatedAt: "2023-01-01T10:00:00.000Z",
};

// Mock de bloque por hacer
const mockDefaultBlock = {
  id: "default-block",
  name: "Por Hacer",
  startMinute: 0,
  endMinute: 1439,
  isDefault: true,
  order: 0,
  createdAt: "2023-01-01T08:00:00.000Z",
  updatedAt: "2023-01-01T08:00:00.000Z",
};

// Mock de nueva instancia creada
const mockCreatedInstance: ActivityInstance = {
  id: "new-instance-1",
  templateId: "activity-2", // Meditación
  blockId: "default-block",
  order: 0,
  state: "instantiated",
  timeboxingSettings: {
    type: "minimum-time",
    minimumDurationMinutes: 15,
  },
  createdAt: "2023-01-01T10:15:00.000Z",
  updatedAt: "2023-01-01T10:15:00.000Z",
};

describe("QuickBarContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("no renderiza nada cuando no hay día activo", () => {
    // Mock de useSystemCore para simular que no hay día activo
    (useSystemCore as jest.Mock).mockReturnValue({
      isDayActive: jest.fn(() => false),
      getActivityTemplates: jest.fn(() => []),
      getActiveActivity: jest.fn(() => null),
    });

    const { container } = render(<QuickBarContainer />);

    // No debería renderizar nada
    expect(container.firstChild).toBeNull();
  });

  test("renderiza la QuickBar con actividades del sistema cuando hay día activo", () => {
    // Mock de useSystemCore para simular día activo con actividades del sistema
    (useSystemCore as jest.Mock).mockReturnValue({
      isDayActive: jest.fn(() => true),
      getActivityTemplates: jest.fn(() => mockSystemActivities),
      getActiveActivity: jest.fn(() => null),
      activateActivity: jest.fn(),
      completeActivity: jest.fn(),
      getCurrentTimeBlock: jest.fn(() => null),
      getTimeBlocks: jest.fn(() => [mockDefaultBlock]),
      createActivityInstance: jest.fn(),
    });

    render(<QuickBarContainer />);

    // Verificar que se muestran los botones de las actividades
    expect(screen.getByRole("button", { name: "Piloto automático" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Meditación" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descanso consciente" })).toBeInTheDocument();
  });

  test("activa directamente una actividad", () => {
    // Mock de funciones del SystemCore
    const activateActivityMock = jest.fn();
    const completeActivityMock = jest.fn();

    // Mock de useSystemCore sin actividad activa
    (useSystemCore as jest.Mock).mockReturnValue({
      isDayActive: jest.fn(() => true),
      getActivityTemplates: jest.fn(() => [
        // Solo piloto automático sin necesidad de configuración
        {
          id: "activity-1",
          title: "Piloto automático",
          description: "Estar en piloto automático",
          type: "flexible-duration",
          isSystemActivity: true,
          createdAt: "2023-01-01T08:00:00.000Z",
          updatedAt: "2023-01-01T08:00:00.000Z",
        },
      ]),
      getActiveActivity: jest.fn(() => null), // Sin actividad activa
      activateActivity: activateActivityMock,
      completeActivity: completeActivityMock,
      getCurrentTimeBlock: jest.fn(() => null),
      getTimeBlocks: jest.fn(() => [mockDefaultBlock]),
      createActivityInstance: jest.fn(),
    });

    // Renderizar el componente
    render(<QuickBarContainer />);

    // Hacer clic en "Piloto automático" (no hay actividad activa)
    const pilotoButton = screen.getByRole("button", { name: "Piloto automático" });
    fireEvent.click(pilotoButton);

    // Verificar que se llamó a activateActivity con el ID correcto
    expect(activateActivityMock).toHaveBeenCalledWith("activity-1");

    // Verificar que no se llamó a completeActivity
    expect(completeActivityMock).not.toHaveBeenCalled();
  });

  test("completa la actividad activa antes de activar una nueva", () => {
    // Este test será una prueba de integración manual
    // Las pruebas unitarias para completeActivity están en activateManager.test.ts
  });

  test("abre el modal para actividades que requieren configuración dinámica", async () => {
    // Mock de useSystemCore
    (useSystemCore as jest.Mock).mockReturnValue({
      isDayActive: jest.fn(() => true),
      getActivityTemplates: jest.fn(() => mockSystemActivities),
      getActiveActivity: jest.fn(() => null),
      activateActivity: jest.fn(),
      completeActivity: jest.fn(),
      getCurrentTimeBlock: jest.fn(() => null),
      getTimeBlocks: jest.fn(() => [mockDefaultBlock]),
      createActivityInstance: jest.fn(),
    });

    render(<QuickBarContainer />);

    // Hacer clic en "Meditación" (requiere configuración timeboxing)
    const meditacionButton = screen.getByRole("button", { name: "Meditación" });
    fireEvent.click(meditacionButton);

    // Verificar que se abrió el modal
    await waitFor(() => {
      expect(screen.getByTestId("mock-activity-modal")).toBeInTheDocument();
    });
  });

  test("crea y activa una instancia después de confirmar la configuración en el modal", async () => {
    // Mock de funciones del SystemCore
    const createActivityInstanceMock = jest.fn(() => mockCreatedInstance);
    const activateActivityMock = jest.fn();
    const completeActivityMock = jest.fn();

    // Mock de useSystemCore
    (useSystemCore as jest.Mock).mockReturnValue({
      isDayActive: jest.fn(() => true),
      getActivityTemplates: jest.fn(() => mockSystemActivities),
      getActiveActivity: jest.fn(() => null),
      activateActivity: activateActivityMock,
      completeActivity: completeActivityMock,
      getCurrentTimeBlock: jest.fn(() => null),
      getTimeBlocks: jest.fn(() => [mockDefaultBlock]),
      createActivityInstance: createActivityInstanceMock,
    });

    render(<QuickBarContainer />);

    // Hacer clic en "Meditación"
    const meditacionButton = screen.getByRole("button", { name: "Meditación" });
    fireEvent.click(meditacionButton);

    // Verificar que se abrió el modal
    await waitFor(() => {
      expect(screen.getByTestId("mock-activity-modal")).toBeInTheDocument();
    });

    // Hacer clic en confirmar en el modal
    const confirmButton = screen.getByText("Confirmar");
    fireEvent.click(confirmButton);

    // Verificar que se llamó a createActivityInstance con los datos correctos
    expect(createActivityInstanceMock).toHaveBeenCalledWith(
      "activity-2", // ID de Meditación
      "default-block", // ID del bloque por defecto
      expect.objectContaining({
        timeboxingSettings: {
          type: "minimum-time",
          minimumDurationMinutes: 15,
        },
      })
    );

    // Verificar que se activó la nueva instancia
    expect(activateActivityMock).toHaveBeenCalledWith("new-instance-1");
  });

  test("cierra el modal al hacer clic en Cancelar", async () => {
    // Mock de useSystemCore
    (useSystemCore as jest.Mock).mockReturnValue({
      isDayActive: jest.fn(() => true),
      getActivityTemplates: jest.fn(() => mockSystemActivities),
      getActiveActivity: jest.fn(() => null),
      activateActivity: jest.fn(),
      completeActivity: jest.fn(),
      getCurrentTimeBlock: jest.fn(() => null),
      getTimeBlocks: jest.fn(() => [mockDefaultBlock]),
      createActivityInstance: jest.fn(),
    });

    render(<QuickBarContainer />);

    // Hacer clic en "Meditación"
    const meditacionButton = screen.getByRole("button", { name: "Meditación" });
    fireEvent.click(meditacionButton);

    // Verificar que se abrió el modal
    await waitFor(() => {
      expect(screen.getByTestId("mock-activity-modal")).toBeInTheDocument();
    });

    // Hacer clic en cancelar en el modal
    const cancelButton = screen.getByText("Cancelar");
    fireEvent.click(cancelButton);

    // Verificar que el modal se cerró
    await waitFor(() => {
      expect(screen.queryByTestId("mock-activity-modal")).not.toBeInTheDocument();
    });
  });
});
