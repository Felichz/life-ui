import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import TimelineContainer from "../TimelineContainer";
import { useSystemCore } from "../../hooks/useSystemCore";
import type { TimelineData, AppState } from "../../../types";

// Mock de useSystemCore
jest.mock("../../hooks/useSystemCore");

// Mock para los datos de timeline
const mockTimelineData: TimelineData = {
  activities: [
    {
      id: "act-1",
      title: "Actividad Mock",
      startTime: "2023-05-01T09:00:00.000Z",
      endTime: "2023-05-01T10:00:00.000Z",
      durationMinutes: 60,
      type: "clear-objective",
      state: "completed",
    },
  ],
  events: [
    {
      id: "evt-1",
      name: "Evento Mock",
      timestamp: "2023-05-01T12:00:00.000Z",
      position: 720,
    },
  ],
  interruptions: [],
};

// Mock de estado de la aplicación
const mockStateWithDay: AppState = {
  global: {
    // Datos mínimos requeridos para el test
    days: [],
    activityTemplates: [],
    eventTemplates: [],
    subjectiveVariables: [],
    interruptionCauses: [],
    timeBlocks: [],
    completedActivityRecords: [],
    eventInstances: [],
    subjectiveVariableSnapshots: [],
    userPreferences: {
      hiddenSubjectiveVariableIds: [],
      updatedAt: "",
    },
  },
  currentDay: {
    day: {
      id: "day-1",
      state: "active",
      createdAt: "",
      updatedAt: "",
    },
    activityInstances: [],
  },
};

const mockStateWithoutDay: AppState = {
  global: mockStateWithDay.global,
  currentDay: null,
};

describe("TimelineContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renderiza Timeline con datos cuando hay un día activo", async () => {
    // Configurar el mock de useSystemCore
    const getTimelineDataMock = jest.fn().mockReturnValue(mockTimelineData);
    (useSystemCore as jest.Mock).mockReturnValue({
      getTimelineData: getTimelineDataMock,
      state: mockStateWithDay,
    });

    render(<TimelineContainer />);

    // Verificar que se llama a getTimelineData con el ID correcto
    expect(getTimelineDataMock).toHaveBeenCalledWith("day-1");

    // Verificar que el componente Timeline se renderiza usando atributos ARIA
    await waitFor(() => {
      expect(screen.getByRole("region", { name: /línea de tiempo/i })).toBeInTheDocument();
    });

    // Verificar que la actividad mock se renderiza correctamente
    const activitiesList = screen.getByRole("list", { name: /actividades y eventos registrados/i });
    expect(activitiesList).toBeInTheDocument();

    // Verificar que el evento mock se renderiza correctamente - usar getAllByRole
    const eventsLists = screen.getAllByRole("list", { name: /eventos registrados/i });
    // Tomamos el último elemento de la lista para asegurarnos que es el correcto
    const eventsList = eventsLists[eventsLists.length - 1];
    expect(eventsList).toBeInTheDocument();
  });

  test("renderiza SkeletonLoader cuando no hay día activo", () => {
    // Configurar el mock de useSystemCore sin día activo
    const getTimelineDataMock = jest.fn();
    (useSystemCore as jest.Mock).mockReturnValue({
      getTimelineData: getTimelineDataMock,
      state: mockStateWithoutDay,
    });

    render(<TimelineContainer />);

    // No debería llamarse a getTimelineData
    expect(getTimelineDataMock).not.toHaveBeenCalled();

    // Debería mostrar el skeleton loader
    // El componente Timeline no debe estar presente
    expect(screen.queryByRole("region", { name: /línea de tiempo/i })).not.toBeInTheDocument();

    // No tenemos un testid o rol para SkeletonLoader, pero podemos verificar que
    // no existe ningún elemento con los roles que usaría Timeline
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  test("actualiza la vista cuando cambia el estado", async () => {
    // Primero renderizar sin día activo
    const getTimelineDataMock = jest.fn();
    (useSystemCore as jest.Mock).mockReturnValue({
      getTimelineData: getTimelineDataMock,
      state: mockStateWithoutDay,
    });

    const { rerender } = render(<TimelineContainer />);

    // Verificar que inicialmente muestra el skeleton
    expect(screen.queryByRole("region", { name: /línea de tiempo/i })).not.toBeInTheDocument();

    // Actualizar el mock para simular un cambio de estado (día se activa)
    getTimelineDataMock.mockReturnValue(mockTimelineData);
    (useSystemCore as jest.Mock).mockReturnValue({
      getTimelineData: getTimelineDataMock,
      state: mockStateWithDay,
    });

    // Volver a renderizar el componente
    rerender(<TimelineContainer />);

    // Verificar que se llama a getTimelineData
    expect(getTimelineDataMock).toHaveBeenCalledWith("day-1");

    // Verificar que ahora muestra el Timeline
    await waitFor(() => {
      expect(screen.getByRole("region", { name: /línea de tiempo/i })).toBeInTheDocument();
    });
  });
});
