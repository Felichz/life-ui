import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import VariableModalContainer from "./VariableModalContainer";
import { useSystemCore } from "../hooks/useSystemCore";
import type { UUID } from "../../types";

// Mock del hook useSystemCore
jest.mock("../hooks/useSystemCore");

// Mock del componente VariableModal
jest.mock("../modals/VariableModal", () => ({
  __esModule: true,
  default: (props: {
    open: boolean;
    onClose: () => void;
    relatedActivityIds?: UUID[];
    relatedEventIds?: UUID[];
    onConfirm: (
      values: { variableId: UUID; currentValue: number }[],
      activityIds: UUID[],
      eventIds: UUID[]
    ) => void;
  }) => (
    <div data-testid="variable-modal">
      <button
        onClick={() =>
          props.onConfirm(
            [{ variableId: "var1", currentValue: 7 }],
            props.relatedActivityIds || [],
            props.relatedEventIds || []
          )
        }
      >
        Confirm
      </button>
      <button onClick={props.onClose}>Close</button>
    </div>
  ),
}));

describe("VariableModalContainer", () => {
  // Valores de prueba
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockCreateSnapshot = jest.fn();
  const testActivityIds = ["activity1"] as UUID[];
  const testEventIds = ["event1"] as UUID[];

  beforeEach(() => {
    // Configuración del mock por defecto
    (useSystemCore as jest.Mock).mockReturnValue({
      createSnapshot: mockCreateSnapshot,
    });

    // Limpiar todos los mocks
    jest.clearAllMocks();
  });

  test("Llama a createSnapshot con valores correctos cuando se confirma", () => {
    // Mock para simular un snapshot creado con éxito
    mockCreateSnapshot.mockReturnValue({ id: "snapshot1" });

    render(
      <VariableModalContainer
        open={true}
        onClose={mockOnClose}
        relatedActivityIds={testActivityIds}
        relatedEventIds={testEventIds}
        onSuccess={mockOnSuccess}
      />
    );

    // Simular confirmación del modal
    fireEvent.click(screen.getByText("Confirm"));

    // Verificar que createSnapshot se llamó con los parámetros correctos
    expect(mockCreateSnapshot).toHaveBeenCalledWith(
      [{ variableId: "var1", currentValue: 7 }],
      testActivityIds,
      testEventIds
    );

    // Verificar que se llamó onSuccess y onClose
    expect(mockOnSuccess).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  test("No cierra el modal si createSnapshot falla (cooldown)", () => {
    // Mock para simular el caso en que no se puede crear un snapshot (cooldown)
    mockCreateSnapshot.mockReturnValue(null);

    render(<VariableModalContainer open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    // Simular confirmación del modal
    fireEvent.click(screen.getByText("Confirm"));

    // Verificar que createSnapshot se llamó
    expect(mockCreateSnapshot).toHaveBeenCalled();

    // El modal NO debe cerrarse y NO debe llamarse a onSuccess
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test("Maneja errores durante la creación del snapshot", () => {
    // Espiar console.error para verificar que se registra el error
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    // Mock para simular un error durante la creación
    mockCreateSnapshot.mockImplementation(() => {
      throw new Error("Error de prueba");
    });

    render(<VariableModalContainer open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    // Simular confirmación del modal
    fireEvent.click(screen.getByText("Confirm"));

    // Verificar que createSnapshot se llamó
    expect(mockCreateSnapshot).toHaveBeenCalled();

    // El modal NO debe cerrarse y se debe registrar el error
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error al crear snapshot:", expect.any(Error));

    // Restaurar console.error
    consoleErrorSpy.mockRestore();
  });

  test("Cierra el modal cuando se hace clic en el botón cerrar", () => {
    render(<VariableModalContainer open={true} onClose={mockOnClose} />);

    // Simular cierre del modal
    fireEvent.click(screen.getByText("Close"));

    // Verificar que se llamó onClose
    expect(mockOnClose).toHaveBeenCalled();
  });
});
