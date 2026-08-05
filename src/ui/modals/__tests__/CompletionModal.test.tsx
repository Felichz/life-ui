/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CompletionModal from "../CompletionModal";
import type { CompletionRequest } from "../../../types";

const mockRequest: CompletionRequest = {
  activityTitle: "Leer libro",
  durationMinutes: 30,
  estimatedMinutes: 30,
  canApplyBonus: false,
  requestedAt: "2023-01-01T12:00:00.000Z",
};

const mockRequestBeat: CompletionRequest = {
  ...mockRequest,
  durationMinutes: 20,
  canApplyBonus: true,
};

describe("CompletionModal", () => {
  const defaultProps = {
    open: true,
    request: mockRequest,
    onConfirm: jest.fn(),
    onInterrupt: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("renderizado básico", () => {
    it("muestra el título con el nombre de la actividad", () => {
      render(<CompletionModal {...defaultProps} />);
      expect(screen.getByText(/Terminaste.*Leer libro/)).toBeInTheDocument();
    });

    it("muestra el tiempo real", () => {
      render(<CompletionModal {...defaultProps} />);
      expect(screen.getByText("30 min")).toBeInTheDocument();
    });

    it("muestra el estimado si está presente", () => {
      render(<CompletionModal {...defaultProps} />);
      expect(screen.getByTestId("estimate-info")).toHaveTextContent("Estimado: 30 min");
    });

    it("indica 'batiste el estimado' cuando canApplyBonus=true", () => {
      render(<CompletionModal {...defaultProps} request={mockRequestBeat} />);
      expect(screen.getByTestId("estimate-info")).toHaveTextContent(/batiste el estimado/);
    });

    it("NO muestra estimado si estimatedMinutes es undefined", () => {
      render(
        <CompletionModal
          {...defaultProps}
          request={{ ...mockRequest, estimatedMinutes: undefined }}
        />
      );
      expect(screen.queryByTestId("estimate-info")).not.toBeInTheDocument();
    });
  });

  describe("slider y heurísticas", () => {
    it("auto-10 cuando canApplyBonus=true", () => {
      render(<CompletionModal {...defaultProps} request={mockRequestBeat} />);
      expect(screen.getByTestId("score-label")).toHaveTextContent("10/10");
    });

    it("default a score 5 cuando NO hay bonus", () => {
      render(<CompletionModal {...defaultProps} />);
      expect(screen.getByTestId("score-label")).toHaveTextContent("5/10");
    });

    it("muestra la heurística correcta para cada score", () => {
      const { rerender } = render(<CompletionModal {...defaultProps} />);
      // Score 5: "Cumplí lo mínimo sin extras. Está bien."
      expect(screen.getByTestId("score-label")).toHaveTextContent(/Cumplí lo mínimo sin extras/);

      // Cambiar a score 8
      const slider = screen.getByTestId("satisfaction-slider").querySelector('input[type="range"]');
      if (slider) {
        fireEvent.change(slider, { target: { value: "8" } });
      }
      rerender(<CompletionModal {...defaultProps} />);
      // Después del cambio, el preview debe actualizarse
      expect(screen.getByTestId("preview-total")).toHaveTextContent(/24/); // 8*30/10
    });
  });

  describe("preview de tempos", () => {
    it("calcula preview sin bonus: 30 min × 5 = 15 tempos", () => {
      render(<CompletionModal {...defaultProps} />);
      expect(screen.getByTestId("preview-total")).toHaveTextContent("15");
    });

    it("calcula preview con bonus: 20 min × 10 + 5 = 25 tempos", () => {
      render(<CompletionModal {...defaultProps} request={mockRequestBeat} />);
      expect(screen.getByTestId("preview-total")).toHaveTextContent("25");
    });

    it("score 0 → preview 0", () => {
      render(<CompletionModal {...defaultProps} />);
      const slider = screen.getByTestId("satisfaction-slider").querySelector('input[type="range"]');
      if (slider) {
        fireEvent.change(slider, { target: { value: "0" } });
      }
      expect(screen.getByTestId("preview-total")).toHaveTextContent("0");
    });
  });

  describe("confirmación", () => {
    it("llama onConfirm con el score al pulsar 'Guardar'", () => {
      render(<CompletionModal {...defaultProps} />);
      fireEvent.click(screen.getByTestId("confirm-button"));
      expect(defaultProps.onConfirm).toHaveBeenCalledWith({ satisfactionScore: 5 });
    });

    it("llama onInterrupt al pulsar 'No la terminé'", () => {
      render(<CompletionModal {...defaultProps} />);
      fireEvent.click(screen.getByTestId("interrupt-button"));
      expect(defaultProps.onInterrupt).toHaveBeenCalled();
      expect(defaultProps.onConfirm).not.toHaveBeenCalled();
    });

    it("llama onClose al pulsar fuera del modal (backdrop)", () => {
      render(<CompletionModal {...defaultProps} />);
      const backdrop = document.querySelector(".MuiBackdrop-root");
      if (backdrop) fireEvent.click(backdrop);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe("render condicional", () => {
    it("retorna null cuando request es null", () => {
      const { container } = render(<CompletionModal {...defaultProps} request={null} />);
      expect(container.firstChild).toBeNull();
    });

    it("no renderiza contenido cuando open=false", () => {
      const { container } = render(<CompletionModal {...defaultProps} open={false} />);
      expect(container.querySelector('[data-testid="completion-modal"]')).toBeNull();
    });
  });

  describe("label del botón cambia según el preview", () => {
    it("muestra 'Guardar y recibir N tempos' cuando hay reward", () => {
      render(<CompletionModal {...defaultProps} />);
      // Score 5, 30 min: preview = 15
      expect(screen.getByTestId("confirm-button")).toHaveTextContent("Guardar y recibir 15 tempos");
    });

    it("muestra solo 'Guardar' cuando preview=0", () => {
      render(<CompletionModal {...defaultProps} />);
      const slider = screen.getByTestId("satisfaction-slider").querySelector('input[type="range"]');
      if (slider) {
        fireEvent.change(slider, { target: { value: "0" } });
      }
      // Después de setear a 0, el label debe ser "Guardar"
      const button = screen.getByTestId("confirm-button");
      expect(button.textContent).toMatch(/^Guardar$/);
    });
  });
});
