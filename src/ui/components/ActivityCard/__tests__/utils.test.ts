import React from "react";

import type { Activity, ChallengeActivity } from "@core/types";

import {
  formatMinuteToTime,
  formatConstraintPenalty,
  getStatusColor,
  getStatusLabel,
  getTypeLabel,
  getUnselectMessage,
  getCompleteMessage,
  getFailedConstraintsWarning,
  getEstimatedEndTime,
  isPropertyInherited,
} from "../utils";

describe("formatMinuteToTime", () => {
  test("formatea 0 minutos correctamente", () => {
    expect(formatMinuteToTime(0)).toBe("00:00");
  });

  test("formatea minutos < 60 correctamente", () => {
    expect(formatMinuteToTime(5)).toBe("00:05");
    expect(formatMinuteToTime(45)).toBe("00:45");
  });

  test("formatea horas correctamente", () => {
    expect(formatMinuteToTime(60)).toBe("01:00");
    expect(formatMinuteToTime(90)).toBe("01:30");
    expect(formatMinuteToTime(125)).toBe("02:05");
  });

  test("maneja valores grandes correctamente", () => {
    expect(formatMinuteToTime(1440)).toBe("24:00"); // 24 horas
  });
});

describe("formatConstraintPenalty", () => {
  test("maneja valores numéricos correctamente", () => {
    expect(formatConstraintPenalty(10)).toBe("-10 tempos");
    expect(formatConstraintPenalty(0)).toBe("-0 tempos");
  });

  test("maneja valores de cadena correctamente", () => {
    expect(formatConstraintPenalty("50%")).toBe("50%");
    expect(formatConstraintPenalty("100%")).toBe("100%");
  });

  test("maneja valores indefinidos correctamente", () => {
    expect(formatConstraintPenalty(undefined)).toBe("Sin penalización");
  });
});

describe("getStatusColor", () => {
  const challengeActivity: ChallengeActivity = {
    id: "1",
    title: "Desafío",
    type: "challenge",
    status: "inProgress",
    minutesActive: 10,
    totalTempoReward: 30,
    constraintList: [],
    inheritedProps: undefined,
    tempoGeneratingMinutes: 0,
    isRepetitive: false,
    createdAt: 0,
  };

  const completedChallengeActivity: ChallengeActivity = {
    ...challengeActivity,
    status: "completed",
  };

  const exceededChallengeActivity: ChallengeActivity = {
    ...challengeActivity,
    minutesActive: 40,
  };

  test("devuelve color correcto para desafío completado", () => {
    expect(getStatusColor("completed", completedChallengeActivity)).toBe("bg-blue-500");
  });

  test("devuelve color correcto para desafío en progreso generando tempo", () => {
    expect(getStatusColor("inProgress", challengeActivity)).toBe("bg-green-500");
  });

  test("devuelve color correcto para desafío en progreso que excedió tiempo", () => {
    expect(getStatusColor("inProgress", exceededChallengeActivity)).toBe("bg-red-500");
  });

  test("devuelve color correcto para actividades no desafío", () => {
    expect(getStatusColor("toDo")).toBe("");
    expect(getStatusColor("inProgress")).toBe("bg-blue-500");
    expect(getStatusColor("completed")).toBe("bg-green-500");
  });
});

describe("getStatusLabel", () => {
  test("devuelve etiquetas correctas para cada estado", () => {
    expect(getStatusLabel("toDo")).toBe("Por hacer");
    expect(getStatusLabel("inProgress")).toBe("En progreso");
    expect(getStatusLabel("completed")).toBe("Completada");
  });

  test("maneja estado desconocido", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getStatusLabel("invalid" as any)).toBe("Desconocido");
  });
});

describe("getTypeLabel", () => {
  test("devuelve etiquetas correctas para cada tipo", () => {
    expect(getTypeLabel("challenge")).toBe("Desafío");
    expect(getTypeLabel("neutral")).toBe("Neutral");
    expect(getTypeLabel("discount")).toBe("Hobby");
  });

  test("maneja tipo desconocido", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getTypeLabel("invalid" as any)).toBe("Desconocido");
  });
});

describe("getUnselectMessage", () => {
  const systemParams = {
    passiveTempoConsumptionRate: 0.5,
    maxTempoCapacity: 100,
    isTestMode: false,
    timeMultiplier: 1,
  };

  const challengeActivity: ChallengeActivity = {
    id: "1",
    title: "Desafío",
    type: "challenge",
    status: "inProgress",
    minutesActive: 10,
    totalTempoReward: 30,
    constraintList: [],
    inheritedProps: undefined,
    tempoGeneratingMinutes: 0,
    isRepetitive: false,
    createdAt: 0,
  };

  const neutralActivity = {
    id: "2",
    title: "Neutral",
    type: "neutral",
    status: "inProgress",
    minutesActive: 10,
    allowedTime: 30,
  } as Activity;

  const hobbyActivity = {
    id: "3",
    title: "Hobby",
    type: "discount",
    status: "inProgress",
    minutesActive: 10,
    allowedTime: 30,
    tempoConsumptionRate: 0.3,
  } as Activity;

  test("devuelve mensaje correcto para desafío", () => {
    const result = getUnselectMessage(challengeActivity, systemParams);
    expect(result).toBe(
      "Al deseleccionar un desafío, podrás retomarlo más tarde desde donde lo dejaste."
    );
  });

  test("devuelve mensaje correcto para actividad neutral", () => {
    const result = getUnselectMessage(neutralActivity, systemParams);
    // Verificamos que el resultado contenga el texto esperado
    const element = React.isValidElement(result) ? result : null;
    expect(element).not.toBeNull();

    // Convertimos el elemento a string para verificar su contenido
    const renderedString = element ? JSON.stringify(element) : "";
    expect(renderedString).toContain("Recibirás una compensación de");
    expect(renderedString).toContain('"children":["+",20," tempos"]');
  });

  test("devuelve mensaje correcto para hobby", () => {
    const result = getUnselectMessage(hobbyActivity, systemParams);
    const element = React.isValidElement(result) ? result : null;
    expect(element).not.toBeNull();

    const renderedString = element ? JSON.stringify(element) : "";
    expect(renderedString).toContain("Recibirás una compensación de");
    // Compensación = 20 minutos * (0.5 - 0.5*0.3) = 20 * 0.35 = 7
    expect(renderedString).toContain('"children":["+","7"," tempos"]');
  });
});

describe("getCompleteMessage", () => {
  const earlyCompletionActivity: ChallengeActivity = {
    id: "1",
    title: "Desafío",
    type: "challenge",
    status: "inProgress",
    minutesActive: 20,
    totalTempoReward: 30,
    constraintList: [],
    inheritedProps: undefined,
    tempoGeneratingMinutes: 0,
    isRepetitive: false,
    createdAt: 0,
  };

  const lateCompletionActivity: ChallengeActivity = {
    ...earlyCompletionActivity,
    minutesActive: 40,
  };

  test("devuelve mensaje correcto para completado temprano", () => {
    const result = getCompleteMessage(earlyCompletionActivity);
    const element = React.isValidElement(result) ? result : null;
    expect(element).not.toBeNull();

    const renderedString = element ? JSON.stringify(element) : "";
    expect(renderedString).toContain(
      "¡Excelente! Has completado el desafío antes del tiempo estimado"
    );
    expect(renderedString).toContain('"children":["+",10," tempos"]');
  });

  test("devuelve mensaje correcto para completado tardío", () => {
    const result = getCompleteMessage(lateCompletionActivity);
    const element = React.isValidElement(result) ? result : null;
    expect(element).not.toBeNull();

    const renderedString = element ? JSON.stringify(element) : "";
    expect(renderedString).toContain("Has excedido el tiempo estimado para este desafío");
    expect(renderedString).toContain("Ya has recibido el total de la recompensa");
  });
});

describe("getFailedConstraintsWarning", () => {
  const activityWithoutFailedConstraints: ChallengeActivity = {
    id: "1",
    title: "Desafío",
    type: "challenge",
    status: "inProgress",
    minutesActive: 20,
    totalTempoReward: 30,
    constraintList: [
      {
        id: "1",
        type: "expiration",
        dayMinuteExpiration: 1200,
        penalty: 10,
        status: "active",
        failCount: 0,
      },
    ],
    inheritedProps: undefined,
    tempoGeneratingMinutes: 0,
    isRepetitive: false,
    createdAt: 0,
  };

  const activityWithFailedConstraints: ChallengeActivity = {
    ...activityWithoutFailedConstraints,
    constraintList: [
      {
        id: "1",
        type: "expiration",
        dayMinuteExpiration: 1200,
        penalty: 10,
        status: "failed",
        failCount: 1,
      },
    ],
  };

  test("devuelve null cuando no hay constraints fallidos", () => {
    expect(getFailedConstraintsWarning(activityWithoutFailedConstraints)).toBeNull();
  });

  test("devuelve advertencia cuando hay constraints fallidos", () => {
    const result = getFailedConstraintsWarning(activityWithFailedConstraints);
    const element = React.isValidElement(result) ? result : null;
    expect(element).not.toBeNull();

    const renderedString = element ? JSON.stringify(element) : "";
    expect(renderedString).toContain("¡Atención! Hay criterios fallidos");
  });
});

describe("getEstimatedEndTime", () => {
  const challengeActivity: ChallengeActivity = {
    id: "1",
    title: "Desafío",
    type: "challenge",
    status: "inProgress",
    minutesActive: 10,
    totalTempoReward: 30,
    constraintList: [],
    inheritedProps: undefined,
    tempoGeneratingMinutes: 0,
    isRepetitive: false,
    createdAt: 0,
  };

  const completedChallengeActivity: ChallengeActivity = {
    ...challengeActivity,
    minutesActive: 30,
  };

  const neutralActivity = {
    id: "2",
    title: "Neutral",
    type: "neutral",
    status: "inProgress",
    minutesActive: 10,
    allowedTime: 30,
  } as Activity;

  test("devuelve null cuando la actividad no está seleccionada", () => {
    expect(getEstimatedEndTime(challengeActivity, false, Date.now())).toBeNull();
  });

  test("devuelve null cuando la actividad no está en progreso", () => {
    const activity = { ...challengeActivity, status: "toDo" as const };

    expect(getEstimatedEndTime(activity, true, Date.now())).toBeNull();
  });

  test("devuelve null cuando el desafío ya ha completado su tiempo de recompensa", () => {
    expect(getEstimatedEndTime(completedChallengeActivity, true, Date.now())).toBeNull();
  });

  test("calcula correctamente el tiempo estimado para un desafío", () => {
    const now = new Date("2023-01-01T12:00:00").getTime();
    const result = getEstimatedEndTime(challengeActivity, true, now);

    // Esperamos que el tiempo estimado sea 12:20 (12:00 + 20 minutos restantes)
    expect(result).toBe("12:20");
  });

  test("calcula correctamente el tiempo estimado para una actividad neutral", () => {
    const now = new Date("2023-01-01T12:00:00").getTime();
    const result = getEstimatedEndTime(neutralActivity, true, now);

    // Esperamos que el tiempo estimado sea 12:20 (12:00 + 20 minutos restantes)
    expect(result).toBe("12:20");
  });
});

describe("isPropertyInherited", () => {
  const activityWithInheritedProps: Activity = {
    id: "1",
    title: "Actividad",
    type: "discount",
    status: "inProgress",
    minutesActive: 10,
    allowedTime: 30,
    tempoConsumptionRate: 0.5,
    inheritedProps: {
      allowedTime: 30,
    },
    isRepetitive: false,
    createdAt: 0,
  };

  const activityWithoutInheritedProps: Activity = {
    id: "2",
    title: "Actividad",
    type: "discount",
    status: "inProgress",
    minutesActive: 10,
    allowedTime: 30,
    tempoConsumptionRate: 0.5,
    inheritedProps: undefined,
    isRepetitive: false,
    createdAt: 0,
  };

  test("devuelve true cuando la propiedad es heredada", () => {
    expect(
      isPropertyInherited(
        activityWithInheritedProps,
        "allowedTime" as keyof typeof activityWithInheritedProps.inheritedProps
      )
    ).toBe(true);
  });

  test("devuelve false cuando la propiedad no es heredada", () => {
    expect(
      isPropertyInherited(
        activityWithInheritedProps,
        "tempoConsumptionRate" as keyof typeof activityWithInheritedProps.inheritedProps
      )
    ).toBe(false);
  });

  test("devuelve false cuando no hay propiedades heredadas", () => {
    expect(
      isPropertyInherited(
        activityWithoutInheritedProps,
        "allowedTime" as keyof typeof activityWithoutInheritedProps.inheritedProps
      )
    ).toBe(false);
  });
});
