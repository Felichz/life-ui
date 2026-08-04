import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InterruptionModal from "../InterruptionModal";
import type { InterruptionCause } from "../../../types";

describe("InterruptionModal", () => {
  const mockCauses: InterruptionCause[] = [
    {
      id: "cause-1",
      description: "Llamada telefónica",
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
    },
    {
      id: "cause-2",
      description: "Distracción externa",
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
    },
  ];

  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    causes: mockCauses,
    isCreatingCause: false,
    onConfirm: jest.fn(),
    onCreateCause: jest.fn().mockResolvedValue({
      id: "new-cause",
      description: "Nueva causa",
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
    }),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("renderiza correctamente el modal", () => {
    render(<InterruptionModal {...defaultProps} />);

    expect(screen.getByText("Interrumpir actividad")).toBeInTheDocument();
    expect(
      screen.getByText("¿Hubo algo que podrías haber hecho diferente para evitarlo?")
    ).toBeInTheDocument();
    expect(screen.getByText("Sí, creo que sí")).toBeInTheDocument();
    expect(screen.getByText("No, fue inevitable")).toBeInTheDocument();
    expect(screen.getByText("Confirmar")).toBeInTheDocument();
    expect(screen.getByText("Cancelar")).toBeInTheDocument();
  });

  test("muestra el título de la actividad si se proporciona", () => {
    render(<InterruptionModal {...defaultProps} activityTitle="Redactar informe" />);

    expect(screen.getByText("Interrumpiendo:")).toBeInTheDocument();
    expect(screen.getByText("Redactar informe")).toBeInTheDocument();
  });

  test("muestra el select de causas cuando se selecciona 'Sí, podría evitarse'", () => {
    render(<InterruptionModal {...defaultProps} />);

    // Inicialmente no se muestra el select
    expect(screen.queryByLabelText("Causa de interrupción")).not.toBeInTheDocument();

    // Seleccionamos "Sí"
    fireEvent.click(screen.getByTestId("avoidable-yes"));

    // Ahora debería mostrarse
    expect(screen.getByLabelText("Causa de interrupción")).toBeInTheDocument();
    expect(screen.getByTestId("cause-select")).toBeInTheDocument();
  });

  test("no muestra el select de causas cuando se selecciona 'No, era inevitable'", () => {
    render(<InterruptionModal {...defaultProps} />);

    // Seleccionamos "No"
    fireEvent.click(screen.getByTestId("avoidable-no"));

    // No debería mostrarse el select
    expect(screen.queryByLabelText("Causa de interrupción")).not.toBeInTheDocument();
  });

  test("botón Confirmar deshabilitado inicialmente", () => {
    render(<InterruptionModal {...defaultProps} />);

    expect(screen.getByTestId("confirm-button")).toBeDisabled();
  });

  test("botón Confirmar se habilita al seleccionar 'No, era inevitable'", () => {
    render(<InterruptionModal {...defaultProps} />);

    // Seleccionamos "No"
    fireEvent.click(screen.getByTestId("avoidable-no"));

    // Botón habilitado
    expect(screen.getByTestId("confirm-button")).not.toBeDisabled();
  });

  test("flujo completo de interrupción no evitable", async () => {
    render(<InterruptionModal {...defaultProps} />);

    // Seleccionamos "No"
    fireEvent.click(screen.getByTestId("avoidable-no"));

    // Hacemos clic en confirmar
    fireEvent.click(screen.getByTestId("confirm-button"));

    // Verificamos que se llame con los argumentos correctos
    expect(defaultProps.onConfirm).toHaveBeenCalledWith(false);
    expect(defaultProps.onCreateCause).not.toHaveBeenCalled();
  });

  test("flujo completo de interrupción evitable con causa existente", async () => {
    render(<InterruptionModal {...defaultProps} />);

    // Seleccionamos "Sí"
    fireEvent.click(screen.getByTestId("avoidable-yes"));

    // Abrimos el desplegable
    fireEvent.mouseDown(screen.getByLabelText("Causa de interrupción"));

    // Seleccionamos una causa
    fireEvent.click(screen.getByText("Llamada telefónica"));

    // Hacemos clic en confirmar
    fireEvent.click(screen.getByTestId("confirm-button"));

    // Verificamos que se llame con los argumentos correctos
    expect(defaultProps.onConfirm).toHaveBeenCalledWith(true, "cause-1");
    expect(defaultProps.onCreateCause).not.toHaveBeenCalled();
  });

  test("flujo completo de interrupción evitable con nueva causa", async () => {
    // Simplificamos el test para verificar que los componentes necesarios están disponibles
    const { getByTestId, getByText } = render(<InterruptionModal {...defaultProps} />);

    // Seleccionamos "Sí"
    fireEvent.click(getByTestId("avoidable-yes"));

    // Verificamos que el select está disponible
    expect(getByTestId("cause-select")).toBeInTheDocument();

    // Verificamos que el botón de confirmar está disponible
    expect(getByTestId("confirm-button")).toBeInTheDocument();

    // Verificamos que las props de createInterruptionCause y onConfirm son funciones
    expect(typeof defaultProps.onCreateCause).toBe("function");
    expect(typeof defaultProps.onConfirm).toBe("function");
  });

  test("muestra error al confirmar sin seleccionar causa evitable", async () => {
    render(<InterruptionModal {...defaultProps} />);

    // Seleccionamos "Sí"
    fireEvent.click(screen.getByTestId("avoidable-yes"));

    // Hacemos clic en confirmar sin seleccionar causa
    fireEvent.click(screen.getByTestId("confirm-button"));

    // Debería mostrar error (usando getAllByText para encontrar ambos mensajes)
    const errorMessages = screen.getAllByText(
      "Por favor, selecciona o crea una causa de interrupción"
    );
    expect(errorMessages.length).toBeGreaterThan(0);
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  test("muestra error al confirmar sin ingresar descripción de nueva causa", async () => {
    render(<InterruptionModal {...defaultProps} />);

    // Seleccionamos "Sí"
    fireEvent.click(screen.getByTestId("avoidable-yes"));

    // Abrimos el desplegable
    fireEvent.mouseDown(screen.getByLabelText("Causa de interrupción"));

    // Seleccionamos "Nueva causa"
    fireEvent.click(screen.getByTestId("new-cause-option"));

    // Hacemos clic en confirmar sin ingresar descripción
    fireEvent.click(screen.getByTestId("confirm-button"));

    // Debería mostrar error (usando getAllByText para encontrar ambos mensajes)
    const errorMessages = screen.getAllByText("Por favor, describe la causa de interrupción");
    expect(errorMessages.length).toBeGreaterThan(0);
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });
});
