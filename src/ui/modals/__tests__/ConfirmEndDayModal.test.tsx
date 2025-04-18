import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ConfirmEndDayModal from "../ConfirmEndDayModal";

describe("ConfirmEndDayModal", () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("debería renderizar correctamente cuando está abierto", () => {
    render(<ConfirmEndDayModal open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />);

    // Verificar que el título se muestra
    const dialogTitle = screen.getByRole("heading", { name: "Finalizar día" });
    expect(dialogTitle).toBeInTheDocument();

    // Verificar que el mensaje de confirmación se muestra
    expect(screen.getByText(/¿Estás seguro que deseas finalizar el día?/i)).toBeInTheDocument();

    // Verificar que la información sobre la actividad en curso está presente
    expect(
      screen.getByText(/Si hay alguna actividad en curso, se completará automáticamente./i)
    ).toBeInTheDocument();

    // Verificar que los botones están presentes
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finalizar día" })).toBeInTheDocument();
  });

  it("no debería renderizar cuando está cerrado", () => {
    render(<ConfirmEndDayModal open={false} onClose={mockOnClose} onConfirm={mockOnConfirm} />);

    // Verificar que el título no se muestra
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("debería llamar onClose cuando se hace clic en Cancelar", () => {
    render(<ConfirmEndDayModal open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />);

    // Hacer clic en el botón Cancelar
    const cancelButton = screen.getByRole("button", { name: "Cancelar" });
    fireEvent.click(cancelButton);

    // Verificar que se llamó a onClose
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it("debería llamar onConfirm cuando se hace clic en Finalizar día", () => {
    render(<ConfirmEndDayModal open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />);

    // Hacer clic en el botón Finalizar día
    const confirmButton = screen.getByRole("button", { name: "Finalizar día" });
    fireEvent.click(confirmButton);

    // Verificar que se llamó a onConfirm
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("debería tener atributos de accesibilidad adecuados", () => {
    render(<ConfirmEndDayModal open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />);

    // Verificar que el diálogo tiene un labelledby
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby", "end-day-dialog-title");
  });
});
