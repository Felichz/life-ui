import { render, screen, fireEvent } from "@testing-library/react";
import QuickBar from "../components/QuickBar";
import type { ActivityTemplate } from "../../types";

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
    type: "timeboxing",
    isSystemActivity: true,
    timeboxingSettings: {
      type: "maximum-time",
      maximumDurationMinutes: 15,
    },
    createdAt: "2023-01-01T08:00:00.000Z",
    updatedAt: "2023-01-01T08:00:00.000Z",
  },
];

describe("QuickBar", () => {
  test("no renderiza nada cuando no hay actividades del sistema", () => {
    const { container } = render(
      <QuickBar systemActivities={[]} activeActivityId={undefined} onSelect={jest.fn()} />
    );

    expect(container.firstChild).toBeNull();
  });

  test("renderiza correctamente todas las actividades del sistema", () => {
    render(
      <QuickBar
        systemActivities={mockSystemActivities}
        activeActivityId={undefined}
        onSelect={jest.fn()}
      />
    );

    // Verificar que cada actividad está presente (por aria-label)
    expect(screen.getByRole("button", { name: "Piloto automático" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Meditación" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descanso consciente" })).toBeInTheDocument();
  });

  test("marca correctamente la actividad activa", () => {
    render(
      <QuickBar
        systemActivities={mockSystemActivities}
        activeActivityId="activity-2" // Meditación
        onSelect={jest.fn()}
      />
    );

    // La actividad activa debe tener aria-pressed=true y estar deshabilitada
    const meditacionButton = screen.getByRole("button", { name: "Meditación" });
    expect(meditacionButton).toHaveAttribute("aria-pressed", "true");
    expect(meditacionButton).toBeDisabled();

    // Las otras actividades no deben estar marcadas como activas
    const pilotoButton = screen.getByRole("button", { name: "Piloto automático" });
    const descansoButton = screen.getByRole("button", { name: "Descanso consciente" });
    expect(pilotoButton).not.toHaveAttribute("aria-pressed", "true");
    expect(descansoButton).not.toHaveAttribute("aria-pressed", "true");
    expect(pilotoButton).not.toBeDisabled();
    expect(descansoButton).not.toBeDisabled();
  });

  test("llama al callback onSelect con el ID correcto al hacer clic", () => {
    const mockOnSelect = jest.fn();
    render(
      <QuickBar
        systemActivities={mockSystemActivities}
        activeActivityId={undefined}
        onSelect={mockOnSelect}
      />
    );

    // Hacer clic en una actividad
    const descansoButton = screen.getByRole("button", { name: "Descanso consciente" });
    fireEvent.click(descansoButton);

    // Verificar que onSelect fue llamado con el ID correcto
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith("activity-3");
  });

  test("no permite hacer clic en la actividad ya activa", () => {
    const mockOnSelect = jest.fn();
    render(
      <QuickBar
        systemActivities={mockSystemActivities}
        activeActivityId="activity-1" // Piloto automático
        onSelect={mockOnSelect}
      />
    );

    // Intentar hacer clic en la actividad activa
    const pilotoButton = screen.getByRole("button", { name: "Piloto automático" });
    fireEvent.click(pilotoButton);

    // Verificar que onSelect no fue llamado
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  test("muestra el indicador de carga en la actividad que se está activando", () => {
    render(
      <QuickBar
        systemActivities={mockSystemActivities}
        activeActivityId={undefined}
        onSelect={jest.fn()}
        isLoading={true}
        loadingActivityId="activity-2" // Meditación
      />
    );

    // Verificar que se muestra el CircularProgress
    const circularProgress = screen.getByRole("progressbar");
    expect(circularProgress).toBeInTheDocument();

    // Verificar que las actividades sin carga están habilitadas
    const pilotoButton = screen.getByRole("button", { name: "Piloto automático" });
    const descansoButton = screen.getByRole("button", { name: "Descanso consciente" });
    expect(pilotoButton).not.toBeDisabled();
    expect(descansoButton).not.toBeDisabled();
  });

  test("deshabilita todos los botones cuando isLoading es true sin loadingActivityId", () => {
    render(
      <QuickBar
        systemActivities={mockSystemActivities}
        activeActivityId={undefined}
        onSelect={jest.fn()}
        isLoading={true}
      />
    );

    // Verificar que los botones no están deshabilitados ya que isLoading solo afecta al botón específico
    const pilotoButton = screen.getByRole("button", { name: "Piloto automático" });
    const meditacionButton = screen.getByRole("button", { name: "Meditación" });
    const descansoButton = screen.getByRole("button", { name: "Descanso consciente" });

    expect(pilotoButton).not.toBeDisabled();
    expect(meditacionButton).not.toBeDisabled();
    expect(descansoButton).not.toBeDisabled();
  });
});
