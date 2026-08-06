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

describe("CompletionModal (fórmula MVP v3)", () => {
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
    it("auto-10 cuando canApplyBonus=true (reward por eficiencia)", () => {
      render(<CompletionModal {...defaultProps} request={mockRequestBeat} />);
      expect(screen.getByTestId("score-label")).toHaveTextContent("10/10");
    });

    it("default a score 7 (umbral de recompensa) cuando NO hay bonus", () => {
      render(<CompletionModal {...defaultProps} />);
      expect(screen.getByTestId("score-label")).toHaveTextContent("7/10");
    });

    it("muestra la heurística correcta para el score default", () => {
      render(<CompletionModal {...defaultProps} />);
      // Score 7: "Lo hiciste. Eso es lo que cuenta."
      expect(screen.getByTestId("score-label")).toHaveTextContent(/Lo hiciste/);
    });
  });

  describe("preview de tempos (fórmula MVP v3)", () => {
    it("score 7 + estimado 30 min → 30 tempos (100%)", () => {
      render(<CompletionModal {...defaultProps} />);
      // score default es 7 → 100% × 30 estimado = 30
      expect(screen.getByTestId("preview-total")).toHaveTextContent("30");
    });

    it("score 10 + estimado 30 min → 39 tempos (130%)", () => {
      render(<CompletionModal {...defaultProps} request={mockRequestBeat} />);
      // canApplyBonus=true → auto-10 → 130% × 30 = 39
      expect(screen.getByTestId("preview-total")).toHaveTextContent("39");
    });

    it("score < 7 → preview 0", () => {
      render(<CompletionModal {...defaultProps} />);
      const slider = screen
        .getByTestId("satisfaction-slider")
        .querySelector('input[type="range"]');
      if (slider) {
        fireEvent.change(slider, { target: { value: "5" } });
      }
      // Score 5 → 0 tempos (no recompensa)
      expect(screen.getByTestId("preview-total")).toHaveTextContent("0");
    });

    it("usa el estimado (no la duración real) cuando está presente", () => {
      // duración real baja (acaba de iniciar) pero estimado es 30
      const requestLowDuration: CompletionRequest = {
        ...mockRequest,
        durationMinutes: 2,
        estimatedMinutes: 30,
      };
      render(<CompletionModal {...defaultProps} request={requestLowDuration} />);
      // Score default 7 → 100% × 30 estimado = 30
      expect(screen.getByTestId("preview-total")).toHaveTextContent("30");
    });

    it("sin estimado: usa la duración real", () => {
      const requestNoEstimate: CompletionRequest = {
        ...mockRequest,
        durationMinutes: 25,
        estimatedMinutes: undefined,
      };
      render(<CompletionModal {...defaultProps} request={requestNoEstimate} />);
      // Score 7 → 100% × 25 duración = 25
      expect(screen.getByTestId("preview-total")).toHaveTextContent("25");
    });
  });

  describe("confirmación", () => {
    it("llama onConfirm con el score al pulsar 'Guardar'", () => {
      render(<CompletionModal {...defaultProps} />);
      fireEvent.click(screen.getByTestId("confirm-button"));
      expect(defaultProps.onConfirm).toHaveBeenCalledWith({ satisfactionScore: 7 });
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
    it("muestra 'Guardar y recibir 30 tempos' cuando hay reward (score 7)", () => {
      render(<CompletionModal {...defaultProps} />);
      // Score 7, estimado 30 → 30 tempos
      expect(screen.getByTestId("confirm-button")).toHaveTextContent(
        "Guardar y recibir 30 tempos"
      );
    });

    it("muestra 'Guardar y recibir 39 tempos' cuando hay bonus (score 10)", () => {
      render(<CompletionModal {...defaultProps} request={mockRequestBeat} />);
      // Score 10 (auto), estimado 30 → 39 tempos
      expect(screen.getByTestId("confirm-button")).toHaveTextContent(
        "Guardar y recibir 39 tempos"
      );
    });

    it("muestra solo 'Guardar' cuando preview=0 (score bajo)", () => {
      render(<CompletionModal {...defaultProps} />);
      const slider = screen
        .getByTestId("satisfaction-slider")
        .querySelector('input[type="range"]');
      if (slider) {
        fireEvent.change(slider, { target: { value: "0" } });
      }
      // Después de setear a 0, el label debe ser "Guardar" sin número
      const button = screen.getByTestId("confirm-button");
      expect(button.textContent).toMatch(/^Guardar$/);
    });
  });
});