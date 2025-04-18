import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Timeline from "../Timeline";
import type { TimelineData } from "../../../../types";

// Mock de datos para pruebas
const mockActivities: TimelineData["activities"] = [
  {
    id: "act-1",
    title: "Actividad 1",
    startTime: "2023-05-01T09:00:00.000Z", // 09:00
    endTime: "2023-05-01T10:30:00.000Z", // 10:30
    durationMinutes: 90,
    type: "clear-objective",
    state: "completed",
    estimatedDuration: 60,
    isWithinEstimation: false,
  },
  {
    id: "act-2",
    title: "Actividad 2",
    startTime: "2023-05-01T11:00:00.000Z", // 11:00
    endTime: "2023-05-01T12:00:00.000Z", // 12:00
    durationMinutes: 60,
    type: "flexible-duration",
    state: "completed",
    isWithinEstimation: true,
  },
  {
    id: "act-3",
    title: "Actividad 3",
    startTime: "2023-05-01T14:00:00.000Z", // 14:00
    endTime: "2023-05-01T14:30:00.000Z", // 14:30
    durationMinutes: 30,
    type: "timeboxing",
    state: "interrupted",
    estimatedDuration: 45,
    isWithinEstimation: false,
  },
];

const mockEvents: TimelineData["events"] = [
  {
    id: "evt-1",
    name: "Evento 1",
    timestamp: "2023-05-01T13:00:00.000Z",
    position: 780, // 13:00
  },
  {
    id: "evt-2",
    name: "Evento 2",
    timestamp: "2023-05-01T15:30:00.000Z",
    position: 930, // 15:30
  },
];

const mockInterruptions: TimelineData["interruptions"] = [
  {
    id: "int-1",
    activityId: "act-3",
    timestamp: "2023-05-01T14:30:00.000Z",
    position: 870, // 14:30
    isAvoidable: true,
    cause: "Distracción por notificaciones",
  },
];

// Para probar un edge case: actividades con misma posición
const mockOverlappingEvents: TimelineData["events"] = [
  {
    id: "evt-same-1",
    name: "Evento Mismo Tiempo 1",
    timestamp: "2023-05-01T13:00:00.000Z",
    position: 780, // 13:00
  },
  {
    id: "evt-same-2",
    name: "Evento Mismo Tiempo 2",
    timestamp: "2023-05-01T13:00:00.000Z",
    position: 780, // 13:00
  },
];

describe("Timeline Component", () => {
  test("renderiza correctamente con datos válidos usando queries accesibles", () => {
    render(
      <Timeline activities={mockActivities} events={mockEvents} interruptions={mockInterruptions} />
    );

    // Verificar que el timeline se renderiza por su rol
    expect(screen.getByRole("region", { name: /línea de tiempo/i })).toBeInTheDocument();

    // Verificar las barras de actividad por sus roles y textos accesibles
    const activitiesList = screen.getByRole("list", { name: /actividades y eventos registrados/i });

    // Usar within para buscar dentro del contenedor de actividades
    mockActivities.forEach((activity) => {
      const activityElement = within(activitiesList).getByRole("listitem", {
        name: new RegExp(`Actividad ${activity.title}`, "i"),
      });
      expect(activityElement).toBeInTheDocument();
    });

    // Verificar los eventos - usar getAllByRole porque hay múltiples listas
    const eventsLists = screen.getAllByRole("list", { name: /eventos registrados/i });
    // Usar la segunda lista, que es específica para eventos
    const eventsList = eventsLists[eventsLists.length - 2];
    mockEvents.forEach((event) => {
      const eventElement = within(eventsList).getByRole("listitem", {
        name: new RegExp(`Evento ${event.name}`, "i"),
      });
      expect(eventElement).toBeInTheDocument();
    });

    // Verificar las interrupciones
    const interruptionsLists = screen.getAllByRole("list", { name: /interrupciones registradas/i });
    const interruptionsList = interruptionsLists[interruptionsLists.length - 1];
    mockInterruptions.forEach((interruption) => {
      const interruptionElement = within(interruptionsList).getByRole("listitem", {
        name: /interrupción/i,
      });
      expect(interruptionElement).toBeInTheDocument();
    });
  });

  test("muestra mensaje cuando no hay datos usando roles", () => {
    render(<Timeline activities={[]} events={[]} interruptions={[]} />);

    // Usar getByRole con name para encontrar el mensaje
    expect(screen.getByRole("status")).toHaveTextContent("No hay datos de timeline disponibles");
  });

  test("posiciona correctamente las barras según su tiempo", () => {
    render(<Timeline activities={mockActivities} events={[]} interruptions={[]} />);

    // Comprobar posición y ancho de la primera actividad (9:00-10:30)
    const firstActivityBar = screen.getByTestId("timeline-bar-act-1");

    // Validar los estilos calculados - las pruebas pueden ejecutarse en diferentes zonas horarias
    const barStyle = window.getComputedStyle(firstActivityBar);

    // En lugar de verificar valores exactos, verificamos que la posición esté en un rango razonable
    const leftValue = parseFloat(barStyle.left);
    expect(leftValue).toBeGreaterThanOrEqual(20); // Al menos 20%
    expect(leftValue).toBeLessThanOrEqual(40); // No más de 40%

    // Verificar que la barra tiene un ancho visible (simplemente que no sea 0)
    expect(parseFloat(barStyle.width)).toBeGreaterThan(0);
  });

  test("renderiza barras de estimación para actividades con estimatedDuration", () => {
    render(<Timeline activities={mockActivities} events={[]} interruptions={[]} />);

    // Filtrar actividades con estimación
    const activitiesWithEstimation = mockActivities.filter(
      (activity) => activity.estimatedDuration !== undefined
    );

    // Comprobar que existen las barras de estimación
    activitiesWithEstimation.forEach((activity) => {
      const estimationBar = screen.getByTestId(`timeline-bar-estimation-${activity.id}`);
      expect(estimationBar).toBeInTheDocument();

      // Comprobar que el ancho de la barra de estimación es correcto
      // estimatedDuration/1440*100
      const expectedWidth = `${(activity.estimatedDuration! / 1440) * 100}%`;
      const barStyle = window.getComputedStyle(estimationBar);
      expect(barStyle.width).toBe(expectedWidth);
    });
  });

  test("gestiona eventos solapados en el mismo punto temporal", async () => {
    render(<Timeline activities={[]} events={mockOverlappingEvents} interruptions={[]} />);

    // Obtener los dos eventos con la misma posición
    const event1 = screen.getByTestId("timeline-event-evt-same-1");
    const event2 = screen.getByTestId("timeline-event-evt-same-2");

    // Comprobar que tienen diferentes posiciones verticales (top)
    const event1Style = window.getComputedStyle(event1);
    const event2Style = window.getComputedStyle(event2);

    expect(event1Style.top).not.toBe(event2Style.top);
  });

  // Test para simular interacción y comprobar tooltips (requiere userEvent)
  test("muestra tooltip al hacer hover sobre una barra de actividad", async () => {
    const user = userEvent.setup();

    render(<Timeline activities={mockActivities} events={[]} interruptions={[]} />);

    // Encontrar la barra de actividad por su rol
    const activityBar = screen.getByRole("listitem", {
      name: new RegExp(`Actividad ${mockActivities[0].title}`, "i"),
    });

    // Hacer hover sobre la barra
    await user.hover(activityBar);

    // Esperar a que aparezca el tooltip con información detallada
    // El tooltip se monta fuera del componente principal, así que buscamos en todo el document
    // Nota: Este test puede ser flaky si el tooltip tarda en aparecer
    const tooltipText = await screen.findByText(/Duración: 1h 30m/i);
    expect(tooltipText).toBeInTheDocument();
  });

  // Snapshot test selectivo solo para la estructura principal
  test("snapshot selectivo de la estructura principal", () => {
    const { container } = render(
      <Timeline activities={mockActivities} events={mockEvents} interruptions={mockInterruptions} />
    );

    // Capturar solo la estructura principal, no todo el árbol
    const mainTimelineRegion = container.querySelector('[role="region"]');
    expect(mainTimelineRegion).toMatchSnapshot();
  });
});
