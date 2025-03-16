import { systemApi } from "@core/SystemAPI";

import type { Board, ChallengeActivity, NeutralActivity, HobbyActivity } from "../types";

// Helpers para la creación de boards y actividades
const baseBoard: Board = {
  id: "base-board",
  title: "Base Board",
  parentBoardId: undefined,
  childrenBoards: [],
  activities: [],
  constraintList: [],
  activityProps: {},
  isExpanded: false,
};

describe("Herencia de constraints y activity props en el System API", () => {
  // Antes de cada prueba, forzamos el modo test y limpiamos la data
  beforeEach(async () => {
    // Activar modo de prueba para permitir `clearAllData`
    await systemApi.updateSystemParams({
      isTestMode: true,
      passiveTempoConsumptionRate: 1,
      timeMultiplier: 1,
    });

    await systemApi.clearAllData();
    await systemApi.startDay({
      dayTempoBalance: 0,
      date: 1717027200000,
      dayStartMinute: 0,
    });
  });

  const baseChallenge: Partial<ChallengeActivity> = {
    id: "base-challenge",
    type: "challenge",
    title: "Base Challenge",
    isRepetitive: false,
    minutesActive: 0,
    totalTempoReward: 100,
    constraintList: [],
    inheritedProps: {},
  };

  // 1. Herencia básica de constraints y propiedades desde board root
  test("Actividades heredan constraints y propiedades del board root", async () => {
    // Definir board raíz con un constraint y propiedades para challenge
    const rootBoard: Board = {
      ...baseBoard,
      id: "root-board",
      constraintList: [
        {
          id: "rootConstraint",
          type: "expiration",
          dayMinuteExpiration: 120,
          penalty: 10,
        },
      ],
      activityProps: {
        challenge: { isRepetitive: true },
      },
    };

    // Board hijo sin modificaciones adicionales
    const childBoard: Board = {
      ...baseBoard,
      id: "child-board",
      parentBoardId: "root-board",
      childrenBoards: [],
      activities: [],
      constraintList: [],
      activityProps: {},
    };

    // Crear actividad challenge en el board hijo
    const challengeActivity: ChallengeActivity = {
      ...baseChallenge,
      id: "challenge-1",
      parentBoardId: "child-board",
      constraintList: [],
      inheritedProps: {},
    } as ChallengeActivity;

    // Ejecutar creación en el sistema
    await systemApi.createBoard(rootBoard);
    await systemApi.createBoard(childBoard);
    await systemApi.createActivity(challengeActivity);

    const updatedActivity = (await systemApi.getActivity("challenge-1")) as ChallengeActivity;

    // Verificar que la actividad haya heredado el constraint de rootBoard
    expect(updatedActivity.constraintList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentConstraintId: "rootConstraint",
          dayMinuteExpiration: 120,
          penalty: 10,
        }),
      ])
    );
    // Verificar que se hayan heredado las propiedades (activityProps)
    expect(updatedActivity.inheritedProps).toEqual(
      expect.objectContaining({
        isRepetitive: true,
      })
    );
  });

  // 2. Sobreescritura de constraints en board hijo
  test("Los boards hijos pueden sobreescribir constraints heredados", async () => {
    // Board padre con un constraint base
    const parentBoard: Board = {
      ...baseBoard,
      id: "parent-board",
      constraintList: [
        {
          id: "parentConstraint",
          type: "expiration",
          dayMinuteExpiration: 60,
          penalty: 5,
        },
      ],
      activityProps: {},
    };

    // Board hijo que define su propio constraint (override)
    const childBoard: Board = {
      ...baseBoard,
      id: "child-board",
      parentBoardId: "parent-board",
      childrenBoards: [],
      activities: [],
      constraintList: [
        {
          id: "childConstraint",
          type: "expiration",
          dayMinuteExpiration: 90,
          penalty: "50%", // Sobreescritura de tipo de penalización
        },
      ],
      activityProps: {},
    };

    // Actividad challenge en el board hijo
    const challengeActivity: ChallengeActivity = {
      ...baseChallenge,
      id: "challenge-2",
      parentBoardId: "child-board",
      constraintList: [],
      inheritedProps: {},
    } as ChallengeActivity;

    await systemApi.createBoard(parentBoard);
    await systemApi.createBoard(childBoard);
    await systemApi.createActivity(challengeActivity);

    const updatedActivity = (await systemApi.getActivity("challenge-2")) as ChallengeActivity;

    // La actividad debe reflejar el constraint del board hijo
    expect(updatedActivity.constraintList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentConstraintId: "childConstraint",
          dayMinuteExpiration: 90,
          penalty: "50%",
        }),
      ])
    );
  });

  // 3. Herencia múltiple en jerarquía compleja (grandparent -> parent -> child)
  test("Herencia a través de múltiples niveles de boards", async () => {
    // Board abuelo con constraint y props para challenge
    const grandparentBoard: Board = {
      ...baseBoard,
      id: "grandparent-board",
      constraintList: [
        {
          id: "grandparentConstraint",
          type: "expiration",
          dayMinuteExpiration: 150,
          penalty: 15,
        },
      ],
      activityProps: {
        challenge: { isRepetitive: false },
      },
    };

    // Board padre que hereda del abuelo y define sus propios valores
    const parentBoard: Board = {
      ...baseBoard,
      id: "parent-board",
      parentBoardId: "grandparent-board",
      childrenBoards: [],
      activities: [],
      constraintList: [
        {
          id: "parentConstraint",
          type: "expiration",
          dayMinuteExpiration: 100,
          penalty: 10,
        },
      ],
      activityProps: {
        challenge: { isRepetitive: true },
      },
    };

    // Board hijo que hereda de parent (y en cascada del abuelo)
    const childBoard: Board = {
      ...baseBoard,
      id: "child-board",
      parentBoardId: "parent-board",
      childrenBoards: [],
      activities: [],
      constraintList: [
        {
          id: "childConstraint",
          type: "expiration",
          dayMinuteExpiration: 80,
          penalty: 5,
        },
      ],
      activityProps: {},
    };

    // Actividad challenge en el board hijo
    const challengeActivity: ChallengeActivity = {
      ...baseChallenge,
      id: "challenge-3",
      parentBoardId: "child-board",
      constraintList: [],
      inheritedProps: {},
    } as ChallengeActivity;

    await systemApi.createBoard(grandparentBoard);
    await systemApi.createBoard(parentBoard);
    await systemApi.createBoard(childBoard);
    await systemApi.createActivity(challengeActivity);

    const updatedActivity = (await systemApi.getActivity("challenge-3")) as ChallengeActivity;

    // Esperamos heredar constraints de todos los niveles:
    expect(updatedActivity.constraintList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentConstraintId: "grandparentConstraint",
          dayMinuteExpiration: 150,
          penalty: 15,
        }),
        expect.objectContaining({
          parentConstraintId: "parentConstraint",
          dayMinuteExpiration: 100,
          penalty: 10,
        }),
        expect.objectContaining({
          parentConstraintId: "childConstraint",
          dayMinuteExpiration: 80,
          penalty: 5,
        }),
      ])
    );

    // Se espera que las propiedades heredadas provengan del nivel más cercano con datos (en este caso, del board padre)
    expect(updatedActivity.inheritedProps).toEqual(
      expect.objectContaining({
        isRepetitive: true,
      })
    );
  });

  // 4. Sincronización después de actualizaciones en board padre
  test("Actualizar board padre propaga cambios a actividades hijas", async () => {
    const parentBoard: Board = {
      ...baseBoard,
      id: "parent-board",
      constraintList: [
        {
          id: "parentConstraint",
          type: "expiration",
          dayMinuteExpiration: 60,
          penalty: 5,
        },
      ],
      activityProps: { challenge: { isRepetitive: false } },
    };

    const childBoard: Board = {
      ...baseBoard,
      id: "child-board",
      parentBoardId: "parent-board",
      childrenBoards: [],
      activities: [],
      constraintList: [],
      activityProps: {},
    };

    const challengeActivity: ChallengeActivity = {
      ...baseChallenge,
      id: "challenge-4",
      parentBoardId: "child-board",
      constraintList: [],
      inheritedProps: {},
    } as ChallengeActivity;

    await systemApi.createBoard(parentBoard);
    await systemApi.createBoard(childBoard);
    await systemApi.createActivity(challengeActivity);

    // Verificar estado inicial de la actividad
    let updatedActivity = (await systemApi.getActivity("challenge-4")) as ChallengeActivity;
    expect(updatedActivity.constraintList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentConstraintId: "parentConstraint",
          dayMinuteExpiration: 60,
          penalty: 5,
        }),
      ])
    );
    expect(updatedActivity.inheritedProps).toEqual(
      expect.objectContaining({ isRepetitive: false })
    );

    // Actualizamos el board padre para modificar constraint y props
    const updatedParentBoard: Board = {
      ...parentBoard,
      constraintList: [
        {
          id: "parentConstraint",
          type: "expiration",
          dayMinuteExpiration: 120,
          penalty: 10,
        },
      ],
      activityProps: { challenge: { isRepetitive: true } },
    };

    await systemApi.updateBoard(updatedParentBoard);

    // Verificamos que la actividad se ha actualizado
    updatedActivity = (await systemApi.getActivity("challenge-4")) as ChallengeActivity;
    expect(updatedActivity.constraintList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentConstraintId: "parentConstraint",
          dayMinuteExpiration: 120,
          penalty: 10,
        }),
      ])
    );
    expect(updatedActivity.inheritedProps).toEqual(expect.objectContaining({ isRepetitive: true }));
  });

  // 5. Eliminación de constraints heredados
  test("Eliminar constraint en board padre elimina instancias en actividades", async () => {
    const parentBoard: Board = {
      ...baseBoard,
      id: "parent-board",
      constraintList: [
        {
          id: "parentConstraint",
          type: "expiration",
          dayMinuteExpiration: 60,
          penalty: 5,
        },
      ],
      activityProps: {},
    };

    const childBoard: Board = {
      ...baseBoard,
      id: "child-board",
      parentBoardId: "parent-board",
      childrenBoards: [],
      activities: [],
      constraintList: [],
      activityProps: {},
    };

    const challengeActivity: ChallengeActivity = {
      ...baseChallenge,
      id: "challenge-5",
      parentBoardId: "child-board",
      constraintList: [],
      inheritedProps: {},
    } as ChallengeActivity;

    await systemApi.createBoard(parentBoard);
    await systemApi.createBoard(childBoard);
    await systemApi.createActivity(challengeActivity);

    // Verificar que la actividad dé inicio tiene el constraint heredado
    let updatedActivity = (await systemApi.getActivity("challenge-5")) as ChallengeActivity;
    expect(updatedActivity.constraintList).toEqual(
      expect.arrayContaining([expect.objectContaining({ parentConstraintId: "parentConstraint" })])
    );

    // Simular la eliminación del constraint en el board padre
    const updatedParentBoard: Board = {
      ...parentBoard,
      constraintList: [], // Eliminar constraints del board padre
    };

    await systemApi.updateBoard(updatedParentBoard);

    // Verificar que la actividad ya no contiene el constraint eliminado
    updatedActivity = (await systemApi.getActivity("challenge-5")) as ChallengeActivity;
    expect(
      updatedActivity.constraintList.find((c) => c.parentConstraintId === "parentConstraint")
    ).toBeUndefined();
  });

  // 6. Eliminación de actividades
  test("Eliminar actividad actualiza correctamente el board padre", async () => {
    const parentBoard: Board = {
      ...baseBoard,
      id: "parent-board",
      constraintList: [],
      activityProps: {},
    };

    const challengeActivity: ChallengeActivity = {
      ...baseChallenge,
      id: "challenge-to-delete",
      parentBoardId: "parent-board",
      constraintList: [],
      inheritedProps: {},
    } as ChallengeActivity;

    // Crear board y actividad
    await systemApi.createBoard(parentBoard);
    await systemApi.createActivity(challengeActivity);

    // Verificar estado inicial
    let board = await systemApi.getBoard("parent-board");
    expect(board?.activities).toContain("challenge-to-delete");
    let activity = await systemApi.getActivity("challenge-to-delete");
    expect(activity).toBeDefined();

    // Eliminar la actividad
    await systemApi.removeActivity(challengeActivity);

    // Verificar que la actividad ya no existe
    activity = await systemApi.getActivity("challenge-to-delete");
    expect(activity).toBeUndefined();

    // Verificar que el board padre ya no tiene la referencia
    board = await systemApi.getBoard("parent-board");
    expect(board?.activities).not.toContain("challenge-to-delete");
  });

  // Tests para los nuevos métodos getInheritedPropsForBoard y getInheritedConstraintsForBoard

  // 7. Test para getInheritedPropsForBoard con board sin padres
  test("getInheritedPropsForBoard retorna las propiedades de un board sin padres", async () => {
    // Board sin padres con propiedades específicas
    const rootBoard: Board = {
      ...baseBoard,
      id: "solo-board",
      activityProps: {
        challenge: { isRepetitive: true },
        neutral: { allowedTime: 60 },
        discount: { tempoConsumptionRate: 0.5 },
      },
      constraintList: [],
    };

    await systemApi.createBoard(rootBoard);

    // Obtener propiedades heredadas (que son solo las propias)
    const inheritedProps = await systemApi.getInheritedPropsForBoard("solo-board");

    // Verificar que se devuelven exactamente las mismas propiedades
    expect(inheritedProps).toEqual({
      challenge: { isRepetitive: true },
      neutral: { allowedTime: 60 },
      discount: { tempoConsumptionRate: 0.5 },
    });
  });

  // 8. Test para getInheritedPropsForBoard con jerarquía simple
  test("getInheritedPropsForBoard combina propiedades de un board y su padre", async () => {
    // Board padre con propiedades para challenge
    const parentBoard: Board = {
      ...baseBoard,
      id: "parent-board-props",
      activityProps: {
        challenge: { isRepetitive: true },
        neutral: { allowedTime: 60 },
      },
      constraintList: [],
    };

    // Board hijo con propiedades para discount
    const childBoard: Board = {
      ...baseBoard,
      id: "child-board-props",
      parentBoardId: "parent-board-props",
      activityProps: {
        discount: { tempoConsumptionRate: 0.5 },
      },
      constraintList: [],
    };

    await systemApi.createBoard(parentBoard);
    await systemApi.createBoard(childBoard);

    // Obtener propiedades heredadas para el board hijo
    const inheritedProps = await systemApi.getInheritedPropsForBoard("child-board-props");

    // Verificar combinación de propiedades de ambos boards
    expect(inheritedProps).toEqual({
      challenge: { isRepetitive: true },
      neutral: { allowedTime: 60 },
      discount: { tempoConsumptionRate: 0.5 },
    });
  });

  // 9. Test para getInheritedPropsForBoard con jerarquía compleja y sobrescritura
  test("getInheritedPropsForBoard maneja correctamente la sobrescritura en jerarquía compleja", async () => {
    // Board abuelo con propiedades iniciales
    const grandparentBoard: Board = {
      ...baseBoard,
      id: "grandparent-board-props",
      activityProps: {
        challenge: { isRepetitive: false },
        neutral: { allowedTime: 30 },
        discount: { tempoConsumptionRate: 0.7 },
      },
      constraintList: [],
    };

    // Board padre que sobrescribe algunas propiedades
    const parentBoard: Board = {
      ...baseBoard,
      id: "parent-board-props",
      parentBoardId: "grandparent-board-props",
      activityProps: {
        challenge: { isRepetitive: true },
        neutral: { allowedTime: 60 },
      },
      constraintList: [],
    };

    // Board hijo que sobrescribe otras propiedades
    const childBoard: Board = {
      ...baseBoard,
      id: "child-board-props",
      parentBoardId: "parent-board-props",
      activityProps: {
        discount: { tempoConsumptionRate: 0.5 },
      },
      constraintList: [],
    };

    await systemApi.createBoard(grandparentBoard);
    await systemApi.createBoard(parentBoard);
    await systemApi.createBoard(childBoard);

    // Obtener propiedades heredadas para el board hijo
    const inheritedProps = await systemApi.getInheritedPropsForBoard("child-board-props");

    // Verificar combinación con sobrescritura correcta
    expect(inheritedProps).toEqual({
      challenge: { isRepetitive: true }, // Del padre (sobrescribe al abuelo)
      neutral: { allowedTime: 60 }, // Del padre (sobrescribe al abuelo)
      discount: { tempoConsumptionRate: 0.5 }, // Del hijo (sobrescribe al abuelo)
    });
  });

  // 10. Test para getInheritedConstraintsForBoard con board sin padres
  test("getInheritedConstraintsForBoard retorna los constraints de un board sin padres", async () => {
    // Board sin padres con constraints específicos
    const rootBoard: Board = {
      ...baseBoard,
      id: "solo-board-constraints",
      constraintList: [
        {
          id: "rootConstraint1",
          type: "expiration",
          dayMinuteExpiration: 120,
          penalty: 10,
        },
        {
          id: "rootConstraint2",
          type: "expiration",
          dayMinuteExpiration: 180,
          penalty: 20,
        },
      ],
      activityProps: {},
    };

    await systemApi.createBoard(rootBoard);

    // Obtener constraints heredados (que son solo los propios)
    const inheritedConstraints =
      await systemApi.getInheritedConstraintsForBoard("solo-board-constraints");

    // Verificar que se devuelven exactamente los mismos constraints
    expect(inheritedConstraints).toHaveLength(2);
    expect(inheritedConstraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "rootConstraint1",
          dayMinuteExpiration: 120,
          penalty: 10,
        }),
        expect.objectContaining({
          id: "rootConstraint2",
          dayMinuteExpiration: 180,
          penalty: 20,
        }),
      ])
    );
  });

  // 11. Test para getInheritedConstraintsForBoard con jerarquía simple
  test("getInheritedConstraintsForBoard combina constraints de un board y su padre", async () => {
    // Board padre con un constraint
    const parentBoard: Board = {
      ...baseBoard,
      id: "parent-board-constraints",
      constraintList: [
        {
          id: "parentConstraint",
          type: "expiration",
          dayMinuteExpiration: 60,
          penalty: 5,
        },
      ],
      activityProps: {},
    };

    // Board hijo con otro constraint
    const childBoard: Board = {
      ...baseBoard,
      id: "child-board-constraints",
      parentBoardId: "parent-board-constraints",
      constraintList: [
        {
          id: "childConstraint",
          type: "expiration",
          dayMinuteExpiration: 90,
          penalty: "50%",
        },
      ],
      activityProps: {},
    };

    await systemApi.createBoard(parentBoard);
    await systemApi.createBoard(childBoard);

    // Obtener constraints heredados para el board hijo
    const inheritedConstraints =
      await systemApi.getInheritedConstraintsForBoard("child-board-constraints");

    // Verificar combinación de constraints de ambos boards
    expect(inheritedConstraints).toHaveLength(2);
    expect(inheritedConstraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "childConstraint",
          dayMinuteExpiration: 90,
          penalty: "50%",
        }),
        expect.objectContaining({
          id: "parentConstraint",
          dayMinuteExpiration: 60,
          penalty: 5,
        }),
      ])
    );
  });

  // 12. Test para getInheritedConstraintsForBoard con jerarquía compleja
  test("getInheritedConstraintsForBoard combina constraints en jerarquía compleja", async () => {
    // Board abuelo con un constraint
    const grandparentBoard: Board = {
      ...baseBoard,
      id: "grandparent-board-constraints",
      constraintList: [
        {
          id: "grandparentConstraint",
          type: "expiration",
          dayMinuteExpiration: 150,
          penalty: 15,
        },
      ],
      activityProps: {},
    };

    // Board padre con otro constraint
    const parentBoard: Board = {
      ...baseBoard,
      id: "parent-board-constraints",
      parentBoardId: "grandparent-board-constraints",
      constraintList: [
        {
          id: "parentConstraint",
          type: "expiration",
          dayMinuteExpiration: 100,
          penalty: 10,
        },
      ],
      activityProps: {},
    };

    // Board hijo con otro constraint más
    const childBoard: Board = {
      ...baseBoard,
      id: "child-board-constraints",
      parentBoardId: "parent-board-constraints",
      constraintList: [
        {
          id: "childConstraint",
          type: "expiration",
          dayMinuteExpiration: 80,
          penalty: 5,
        },
      ],
      activityProps: {},
    };

    await systemApi.createBoard(grandparentBoard);
    await systemApi.createBoard(parentBoard);
    await systemApi.createBoard(childBoard);

    // Obtener constraints heredados para el board hijo
    const inheritedConstraints =
      await systemApi.getInheritedConstraintsForBoard("child-board-constraints");

    // Verificar combinación de constraints de todos los boards
    expect(inheritedConstraints).toHaveLength(3);
    expect(inheritedConstraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "childConstraint",
          dayMinuteExpiration: 80,
          penalty: 5,
        }),
        expect.objectContaining({
          id: "parentConstraint",
          dayMinuteExpiration: 100,
          penalty: 10,
        }),
        expect.objectContaining({
          id: "grandparentConstraint",
          dayMinuteExpiration: 150,
          penalty: 15,
        }),
      ])
    );
  });

  // 13. Test para caso borde - board no existente
  test("getInheritedPropsForBoard y getInheritedConstraintsForBoard manejan correctamente boards inexistentes", async () => {
    // Intentar obtener propiedades de un board que no existe
    const inheritedProps = await systemApi.getInheritedPropsForBoard("non-existent-board");
    expect(inheritedProps).toEqual({}); // Debe retornar un objeto vacío

    // Intentar obtener constraints de un board que no existe
    const inheritedConstraints =
      await systemApi.getInheritedConstraintsForBoard("non-existent-board");
    expect(inheritedConstraints).toEqual([]); // Debe retornar un array vacío
  });
});

// Nuevos tests para verificar la deselección de actividades
describe("Deselección de actividades", () => {
  // Antes de cada prueba, forzamos el modo test y limpiamos la data
  beforeEach(async () => {
    // Activar modo de prueba para permitir `clearAllData`
    await systemApi.updateSystemParams({
      isTestMode: true,
      passiveTempoConsumptionRate: 1,
      timeMultiplier: 1,
    });

    await systemApi.clearAllData();
    await systemApi.startDay({
      dayTempoBalance: 0,
      date: Date.now(),
      dayStartMinute: 0,
    });
  });

  // Test para verificar que una actividad neutral se marca como completed al deseleccionarla
  test("unselectActivity marca actividad neutral como completed al deseleccionarla", async () => {
    // Crear un board
    const board = {
      ...baseBoard,
      id: "board-test",
      activityProps: {},
    };
    await systemApi.createBoard(board);

    // Crear una actividad neutral
    const neutralActivity: NeutralActivity = {
      id: "neutral-activity",
      parentBoardId: "board-test",
      type: "neutral",
      title: "Actividad Neutral",
      isRepetitive: false,
      minutesActive: 10, // Menos que el tiempo permitido
      status: "inProgress",
      allowedTime: 30,
      createdAt: Date.now(),
      inheritedProps: {},
      completeCount: 0,
    };
    await systemApi.createActivity(neutralActivity);

    // Seleccionar la actividad
    await systemApi.setSelectedActivity(neutralActivity);

    // Verificar que está seleccionada
    const selectedBefore = await systemApi.getSelectedActivity();
    expect(selectedBefore?.id).toBe("neutral-activity");

    // Deseleccionar la actividad
    await systemApi.unselectActivity();

    // Verificar que ya no está seleccionada
    const selectedAfter = await systemApi.getSelectedActivity();
    expect(selectedAfter).toBeUndefined();

    // Verificar que la actividad se marcó como completed
    const activityAfter = await systemApi.getActivity("neutral-activity");
    expect(activityAfter?.status).toBe("completed");
  });

  // Test para verificar que una actividad discount (hobby) se marca como completed al deseleccionarla
  test("unselectActivity marca actividad discount como completed al deseleccionarla", async () => {
    // Crear un board
    const board = {
      ...baseBoard,
      id: "board-test",
      activityProps: {},
    };
    await systemApi.createBoard(board);

    // Crear una actividad discount
    const discountActivity: HobbyActivity = {
      id: "discount-activity",
      parentBoardId: "board-test",
      type: "discount",
      title: "Actividad Discount",
      isRepetitive: false,
      minutesActive: 15, // Menos que el tiempo permitido
      status: "inProgress",
      allowedTime: 60,
      tempoConsumptionRate: 0.5,
      createdAt: Date.now(),
      inheritedProps: {},
      completeCount: 0,
    };
    await systemApi.createActivity(discountActivity);

    // Seleccionar la actividad
    await systemApi.setSelectedActivity(discountActivity);

    // Verificar que está seleccionada
    const selectedBefore = await systemApi.getSelectedActivity();
    expect(selectedBefore?.id).toBe("discount-activity");

    // Deseleccionar la actividad
    await systemApi.unselectActivity();

    // Verificar que ya no está seleccionada
    const selectedAfter = await systemApi.getSelectedActivity();
    expect(selectedAfter).toBeUndefined();

    // Verificar que la actividad se marcó como completed
    const activityAfter = await systemApi.getActivity("discount-activity");
    expect(activityAfter?.status).toBe("completed");
  });

  // Test para verificar que una actividad challenge NO se marca como completed al deseleccionarla
  test("unselectActivity NO marca actividad challenge como completed al deseleccionarla", async () => {
    // Crear un board
    const board = {
      ...baseBoard,
      id: "board-test",
      activityProps: {},
    };
    await systemApi.createBoard(board);

    // Crear una actividad challenge
    const challengeActivity: ChallengeActivity = {
      id: "challenge-activity",
      parentBoardId: "board-test",
      type: "challenge",
      title: "Actividad Challenge",
      isRepetitive: false,
      minutesActive: 20,
      status: "inProgress",
      totalTempoReward: 100,
      tempoGeneratingMinutes: 20,
      constraintList: [],
      createdAt: Date.now(),
      inheritedProps: {},
      completeCount: 0,
    };
    await systemApi.createActivity(challengeActivity);

    // Seleccionar la actividad
    await systemApi.setSelectedActivity(challengeActivity);

    // Verificar que está seleccionada
    const selectedBefore = await systemApi.getSelectedActivity();
    expect(selectedBefore?.id).toBe("challenge-activity");

    // Deseleccionar la actividad
    await systemApi.unselectActivity();

    // Verificar que ya no está seleccionada
    const selectedAfter = await systemApi.getSelectedActivity();
    expect(selectedAfter).toBeUndefined();
  });

  // Test para verificar que el estado de una actividad challenge cambia a "toDo" al deseleccionarla
  test("unselectActivity cambia el estado de una actividad challenge a toDo", async () => {
    // Crear un board
    const board = {
      ...baseBoard,
      id: "board-test-todo",
      activityProps: {},
    };
    await systemApi.createBoard(board);

    // Crear una actividad challenge
    const challengeActivity: ChallengeActivity = {
      id: "challenge-activity-todo",
      parentBoardId: "board-test-todo",
      type: "challenge",
      title: "Actividad Challenge Estado",
      isRepetitive: false,
      minutesActive: 20,
      status: "inProgress",
      totalTempoReward: 100,
      tempoGeneratingMinutes: 20,
      constraintList: [],
      createdAt: Date.now(),
      inheritedProps: {},
      completeCount: 0,
    };
    await systemApi.createActivity(challengeActivity);

    // Seleccionar la actividad
    await systemApi.setSelectedActivity(challengeActivity);

    // Verificar que está seleccionada y con estado "inProgress"
    const selectedBefore = await systemApi.getSelectedActivity();
    expect(selectedBefore?.id).toBe("challenge-activity-todo");
    expect(selectedBefore?.status).toBe("inProgress");

    // Deseleccionar la actividad
    await systemApi.unselectActivity();

    // Verificar que ya no está seleccionada
    const selectedAfter = await systemApi.getSelectedActivity();
    expect(selectedAfter).toBeUndefined();

    // Verificar que el estado de la actividad cambió a "toDo"
    const updatedActivity = await systemApi.getActivity("challenge-activity-todo");
    expect(updatedActivity?.status).toBe("toDo");
  });

  // Test para verificar que al seleccionar una nueva actividad, la anterior neutral se marca como completed
  test("setSelectedActivity marca actividad neutral anterior como completed", async () => {
    // Crear un board
    const board = {
      ...baseBoard,
      id: "board-test",
      activityProps: {},
    };
    await systemApi.createBoard(board);

    // Crear dos actividades
    const neutralActivity: NeutralActivity = {
      id: "neutral-activity",
      parentBoardId: "board-test",
      type: "neutral",
      title: "Actividad Neutral",
      isRepetitive: false,
      minutesActive: 10,
      status: "inProgress",
      allowedTime: 30,
      createdAt: Date.now(),
      inheritedProps: {},
      completeCount: 0,
    };

    const challengeActivity: ChallengeActivity = {
      id: "challenge-activity",
      parentBoardId: "board-test",
      type: "challenge",
      title: "Actividad Challenge",
      isRepetitive: false,
      minutesActive: 0,
      status: "toDo",
      totalTempoReward: 100,
      tempoGeneratingMinutes: 0,
      constraintList: [],
      createdAt: Date.now(),
      inheritedProps: {},
      completeCount: 0,
    };

    await systemApi.createActivity(neutralActivity);
    await systemApi.createActivity(challengeActivity);

    // Seleccionar la actividad neutral
    await systemApi.setSelectedActivity(neutralActivity);

    // Verificar que está seleccionada
    const selectedBefore = await systemApi.getSelectedActivity();
    expect(selectedBefore?.id).toBe("neutral-activity");

    // Ahora seleccionar la segunda actividad
    await systemApi.setSelectedActivity(challengeActivity);

    // Verificar que la nueva actividad está seleccionada
    const selectedAfter = await systemApi.getSelectedActivity();
    expect(selectedAfter?.id).toBe("challenge-activity");

    // Verificar que la actividad neutral se marcó como completed
    const neutralAfter = await systemApi.getActivity("neutral-activity");
    expect(neutralAfter?.status).toBe("completed");
  });

  // Test para verificar que al seleccionar una nueva actividad, la anterior discount se marca como completed
  test("setSelectedActivity marca actividad discount anterior como completed", async () => {
    // Crear un board
    const board = {
      ...baseBoard,
      id: "board-test",
      activityProps: {},
    };
    await systemApi.createBoard(board);

    // Crear dos actividades
    const discountActivity: HobbyActivity = {
      id: "discount-activity",
      parentBoardId: "board-test",
      type: "discount",
      title: "Actividad Discount",
      isRepetitive: false,
      minutesActive: 15,
      status: "inProgress",
      allowedTime: 60,
      tempoConsumptionRate: 0.5,
      createdAt: Date.now(),
      inheritedProps: {},
      completeCount: 0,
    };

    const challengeActivity: ChallengeActivity = {
      id: "challenge-activity",
      parentBoardId: "board-test",
      type: "challenge",
      title: "Actividad Challenge",
      isRepetitive: false,
      minutesActive: 0,
      status: "toDo",
      totalTempoReward: 100,
      tempoGeneratingMinutes: 0,
      constraintList: [],
      createdAt: Date.now(),
      inheritedProps: {},
      completeCount: 0,
    };

    await systemApi.createActivity(discountActivity);
    await systemApi.createActivity(challengeActivity);

    // Seleccionar la actividad discount
    await systemApi.setSelectedActivity(discountActivity);

    // Verificar que está seleccionada
    const selectedBefore = await systemApi.getSelectedActivity();
    expect(selectedBefore?.id).toBe("discount-activity");

    // Ahora seleccionar la segunda actividad
    await systemApi.setSelectedActivity(challengeActivity);

    // Verificar que la nueva actividad está seleccionada
    const selectedAfter = await systemApi.getSelectedActivity();
    expect(selectedAfter?.id).toBe("challenge-activity");

    // Verificar que la actividad discount se marcó como completed
    const discountAfter = await systemApi.getActivity("discount-activity");
    expect(discountAfter?.status).toBe("completed");
  });
});

// Nuevos tests para verificar la funcionalidad de startDay
describe("Funcionalidad de startDay", () => {
  // Antes de cada prueba, forzamos el modo test y limpiamos la data
  beforeEach(async () => {
    // Activar modo de prueba para permitir `clearAllData`
    await systemApi.updateSystemParams({
      isTestMode: true,
      passiveTempoConsumptionRate: 1,
      timeMultiplier: 1,
    });

    await systemApi.clearAllData();
  });

  // Test para verificar que startDay cambia el estado del sistema correctamente
  test("startDay cambia el estado del sistema a dayInProgress", async () => {
    // Verificar estado inicial
    const initialState = await systemApi.getLifecycleState();
    expect(initialState).toBe("dayNotStarted");

    // Iniciar el día
    await systemApi.startDay({
      dayTempoBalance: 10,
      date: Date.now(),
      dayStartMinute: 480, // 8:00 AM
    });

    // Verificar que el estado cambió
    const newState = await systemApi.getLifecycleState();
    expect(newState).toBe("dayInProgress");

    // Verificar que se guardó la información del día
    const currentDay = await systemApi.getCurrentDay();
    expect(currentDay).toBeDefined();
    expect(currentDay?.dayTempoBalance).toBe(10);
    expect(currentDay?.dayStartMinute).toBe(480);
  });

  // Test para verificar que startDay no restaura actividades si no hay días anteriores
  test("startDay no restaura actividades cuando no hay días anteriores", async () => {
    // Crear un board
    const board = {
      ...baseBoard,
      id: "board-test",
      activityProps: {},
    };
    await systemApi.createBoard(board);

    // Iniciar el día
    await systemApi.startDay({
      dayTempoBalance: 0,
      date: Date.now(),
      dayStartMinute: 0,
    });

    // Verificar que no hay actividades (porque no había días anteriores)
    const activities = await systemApi.getActivities();
    expect(activities.length).toBe(0);
  });

  // Test para verificar que startDay restaura actividades repetitivas del día anterior
  test("startDay restaura actividades repetitivas del día anterior", async () => {
    // Crear un board
    const board = {
      ...baseBoard,
      id: "board-test",
      activityProps: {},
    };
    await systemApi.createBoard(board);

    // Crear una actividad repetitiva
    const repetitiveActivity: ChallengeActivity = {
      id: "repetitive-challenge",
      parentBoardId: "board-test",
      type: "challenge",
      title: "Actividad Repetitiva",
      isRepetitive: true,
      minutesActive: 30,
      status: "completed",
      totalTempoReward: 100,
      tempoGeneratingMinutes: 30,
      constraintList: [
        {
          id: "constraint-1",
          type: "expiration",
          dayMinuteExpiration: 120,
          penalty: 10,
          status: "active",
          failCount: 2,
        },
      ],
      createdAt: Date.now(),
      inheritedProps: {},
      completeCount: 1,
    };

    // Crear una actividad no repetitiva
    const nonRepetitiveActivity: NeutralActivity = {
      id: "non-repetitive-neutral",
      parentBoardId: "board-test",
      type: "neutral",
      title: "Actividad No Repetitiva",
      isRepetitive: false,
      minutesActive: 15,
      status: "completed",
      allowedTime: 30,
      createdAt: Date.now(),
      inheritedProps: {},
      completeCount: 1,
    };

    await systemApi.createActivity(repetitiveActivity);
    await systemApi.createActivity(nonRepetitiveActivity);

    // Iniciar y finalizar un día para crear un registro en dayDatabase
    await systemApi.startDay({
      dayTempoBalance: 0,
      date: Date.now() - 86400000, // Ayer
      dayStartMinute: 0,
    });

    // Finalizar el día con las actividades en su estado final
    await systemApi.endDay({
      dayState: {
        dayTempoBalance: 100,
        date: Date.now() - 86400000,
        dayStartMinute: 0,
      },
      activitiesFinalState: {
        "repetitive-challenge": repetitiveActivity,
        "non-repetitive-neutral": nonRepetitiveActivity,
      },
      usefulMetrics: {
        totalGeneratedTemposEver: 100,
        totalMinutesInvested: {
          intrinsicProductivity: 0,
          challenges: 30,
          hobbies: 0,
          rest: 15,
          other: 0,
        },
      },
      investedTimeHistory: [],
      tempoModificationHistory: [],
    });

    // Verificar que no hay actividades después de finalizar el día
    let activities = await systemApi.getActivities();
    expect(activities.length).toBe(0);

    // Iniciar un nuevo día
    await systemApi.startDay({
      dayTempoBalance: 100,
      date: Date.now(),
      dayStartMinute: 0,
    });

    // Verificar que solo se restauró la actividad repetitiva
    activities = await systemApi.getActivities();
    expect(activities.length).toBe(1);

    // Verificar que la actividad restaurada es la repetitiva
    const restoredActivity = activities[0];
    expect(restoredActivity.id).toBe("repetitive-challenge");
    expect(restoredActivity.isRepetitive).toBe(true);

    // Verificar que se reiniciaron los valores de la actividad
    expect(restoredActivity.status).toBe("toDo");
    expect(restoredActivity.minutesActive).toBe(0);

    // Verificar que se reiniciaron los constraints
    if (restoredActivity.type === "challenge") {
      expect(restoredActivity.tempoGeneratingMinutes).toBe(0);
      expect(restoredActivity.constraintList[0].status).toBe("active");
    }

    // Verificar que la actividad no repetitiva no se restauró
    const nonRepetitiveExists = activities.some((a) => a.id === "non-repetitive-neutral");
    expect(nonRepetitiveExists).toBe(false);
  });

  // Test para verificar que startDay no restaura actividades repetitivas que ya existen
  test("startDay no restaura actividades repetitivas que ya existen en el estado actual", async () => {
    // Crear un board
    const board = {
      ...baseBoard,
      id: "board-test",
      activityProps: {},
    };
    await systemApi.createBoard(board);

    // Crear una actividad repetitiva para el día anterior
    const repetitiveActivity: ChallengeActivity = {
      id: "repetitive-challenge",
      parentBoardId: "board-test",
      type: "challenge",
      title: "Actividad Repetitiva",
      isRepetitive: true,
      minutesActive: 30,
      status: "completed",
      totalTempoReward: 100,
      tempoGeneratingMinutes: 30,
      constraintList: [],
      createdAt: Date.now() - 86400000,
      inheritedProps: {},
      completeCount: 1,
    };

    await systemApi.createActivity(repetitiveActivity);

    // Iniciar y finalizar un día para crear un registro en dayDatabase
    await systemApi.startDay({
      dayTempoBalance: 0,
      date: Date.now() - 86400000, // Ayer
      dayStartMinute: 0,
    });

    // Finalizar el día con la actividad en su estado final
    await systemApi.endDay({
      dayState: {
        dayTempoBalance: 100,
        date: Date.now() - 86400000,
        dayStartMinute: 0,
      },
      activitiesFinalState: {
        "repetitive-challenge": repetitiveActivity,
      },
      usefulMetrics: {
        totalGeneratedTemposEver: 100,
        totalMinutesInvested: {
          intrinsicProductivity: 0,
          challenges: 30,
          hobbies: 0,
          rest: 0,
          other: 0,
        },
      },
      investedTimeHistory: [],
      tempoModificationHistory: [],
    });

    // Crear manualmente la misma actividad repetitiva antes de iniciar el nuevo día
    // (simulando que el usuario la creó manualmente)
    const manuallyCreatedActivity: ChallengeActivity = {
      id: "repetitive-challenge",
      parentBoardId: "board-test",
      type: "challenge",
      title: "Actividad Repetitiva Modificada", // Título diferente
      isRepetitive: true,
      minutesActive: 0,
      status: "toDo",
      totalTempoReward: 150, // Valor diferente
      tempoGeneratingMinutes: 0,
      constraintList: [],
      createdAt: Date.now(),
      inheritedProps: {},
      completeCount: 1,
    };

    await systemApi.createActivity(manuallyCreatedActivity);

    // Verificar que la actividad existe antes de iniciar el día
    let activities = await systemApi.getActivities();
    expect(activities.length).toBe(1);
    expect(activities[0].title).toBe("Actividad Repetitiva Modificada");
    expect((activities[0] as ChallengeActivity).totalTempoReward).toBe(150);

    // Iniciar un nuevo día
    await systemApi.startDay({
      dayTempoBalance: 100,
      date: Date.now(),
      dayStartMinute: 0,
    });

    // Verificar que la actividad manual no fue sobrescrita por la restauración
    activities = await systemApi.getActivities();
    expect(activities.length).toBe(1);
    expect(activities[0].title).toBe("Actividad Repetitiva Modificada");
    expect((activities[0] as ChallengeActivity).totalTempoReward).toBe(150);
  });

  // Test para verificar que startDay restaura múltiples actividades repetitivas
  test("startDay restaura múltiples actividades repetitivas correctamente", async () => {
    // Crear un board
    const board = {
      ...baseBoard,
      id: "board-test",
      activityProps: {},
    };
    await systemApi.createBoard(board);

    // Crear varias actividades repetitivas de diferentes tipos
    const repetitiveChallenge: ChallengeActivity = {
      id: "repetitive-challenge",
      parentBoardId: "board-test",
      type: "challenge",
      title: "Desafío Repetitivo",
      isRepetitive: true,
      minutesActive: 30,
      status: "completed",
      totalTempoReward: 100,
      tempoGeneratingMinutes: 30,
      constraintList: [],
      createdAt: Date.now() - 86400000,
      inheritedProps: {},
      completeCount: 1,
    };

    const repetitiveNeutral: NeutralActivity = {
      id: "repetitive-neutral",
      parentBoardId: "board-test",
      type: "neutral",
      title: "Neutral Repetitiva",
      isRepetitive: true,
      minutesActive: 15,
      status: "completed",
      allowedTime: 30,
      createdAt: Date.now() - 86400000,
      inheritedProps: {},
      completeCount: 1,
    };

    const repetitiveDiscount: HobbyActivity = {
      id: "repetitive-discount",
      parentBoardId: "board-test",
      type: "discount",
      title: "Hobby Repetitivo",
      isRepetitive: true,
      minutesActive: 20,
      status: "completed",
      allowedTime: 60,
      tempoConsumptionRate: 0.5,
      createdAt: Date.now() - 86400000,
      inheritedProps: {},
      completeCount: 1,
    };

    await systemApi.createActivity(repetitiveChallenge);
    await systemApi.createActivity(repetitiveNeutral);
    await systemApi.createActivity(repetitiveDiscount);

    // Iniciar y finalizar un día para crear un registro en dayDatabase
    await systemApi.startDay({
      dayTempoBalance: 0,
      date: Date.now() - 86400000, // Ayer
      dayStartMinute: 0,
    });

    // Finalizar el día con las actividades en su estado final
    await systemApi.endDay({
      dayState: {
        dayTempoBalance: 100,
        date: Date.now() - 86400000,
        dayStartMinute: 0,
      },
      activitiesFinalState: {
        "repetitive-challenge": repetitiveChallenge,
        "repetitive-neutral": repetitiveNeutral,
        "repetitive-discount": repetitiveDiscount,
      },
      usefulMetrics: {
        totalGeneratedTemposEver: 100,
        totalMinutesInvested: {
          intrinsicProductivity: 0,
          challenges: 30,
          hobbies: 20,
          rest: 15,
          other: 0,
        },
      },
      investedTimeHistory: [],
      tempoModificationHistory: [],
    });

    // Verificar que no hay actividades después de finalizar el día
    let activities = await systemApi.getActivities();
    expect(activities.length).toBe(0);

    // Iniciar un nuevo día
    await systemApi.startDay({
      dayTempoBalance: 100,
      date: Date.now(),
      dayStartMinute: 0,
    });

    // Verificar que se restauraron todas las actividades repetitivas
    activities = await systemApi.getActivities();
    expect(activities.length).toBe(3);

    // Verificar que todas las actividades están en estado toDo y con minutesActive = 0
    activities.forEach((activity) => {
      expect(activity.status).toBe("toDo");
      expect(activity.minutesActive).toBe(0);
    });

    // Verificar que cada tipo de actividad se restauró correctamente
    const restoredChallenge = activities.find((a) => a.id === "repetitive-challenge");
    const restoredNeutral = activities.find((a) => a.id === "repetitive-neutral");
    const restoredDiscount = activities.find((a) => a.id === "repetitive-discount");

    expect(restoredChallenge).toBeDefined();
    expect(restoredNeutral).toBeDefined();
    expect(restoredDiscount).toBeDefined();

    // Verificar propiedades específicas por tipo
    if (restoredChallenge?.type === "challenge") {
      expect(restoredChallenge.tempoGeneratingMinutes).toBe(0);
    }
  });

  // Test para verificar que startDay restaura actividades no repetibles incompletas pero no las completadas
  test("startDay restaura actividades no repetibles incompletas pero no las completadas", async () => {
    // Crear un board
    const board = {
      ...baseBoard,
      id: "board-test",
      activityProps: {},
    };
    await systemApi.createBoard(board);

    // Crear una actividad no repetible incompleta (toDo)
    const incompleteActivity: ChallengeActivity = {
      id: "incomplete-challenge",
      parentBoardId: "board-test",
      type: "challenge",
      title: "Desafío Incompleto",
      isRepetitive: false,
      minutesActive: 10,
      status: "toDo", // Estado incompleto
      totalTempoReward: 100,
      tempoGeneratingMinutes: 10,
      constraintList: [],
      createdAt: Date.now() - 86400000,
      inheritedProps: {},
      completeCount: 0,
    };

    // Crear una actividad no repetible en progreso
    const inProgressActivity: NeutralActivity = {
      id: "inprogress-neutral",
      parentBoardId: "board-test",
      type: "neutral",
      title: "Neutral En Progreso",
      isRepetitive: false,
      minutesActive: 15,
      status: "inProgress", // Estado incompleto
      allowedTime: 30,
      createdAt: Date.now() - 86400000,
      inheritedProps: {},
      completeCount: 0,
    };

    // Crear una actividad no repetible completada
    const completedActivity: HobbyActivity = {
      id: "completed-discount",
      parentBoardId: "board-test",
      type: "discount",
      title: "Hobby Completado",
      isRepetitive: false,
      minutesActive: 20,
      status: "completed", // Estado completado
      allowedTime: 60,
      tempoConsumptionRate: 0.5,
      createdAt: Date.now() - 86400000,
      inheritedProps: {},
      completeCount: 1,
    };

    await systemApi.createActivity(incompleteActivity);
    await systemApi.createActivity(inProgressActivity);
    await systemApi.createActivity(completedActivity);

    // Iniciar y finalizar un día para crear un registro en dayDatabase
    await systemApi.startDay({
      dayTempoBalance: 0,
      date: Date.now() - 86400000, // Ayer
      dayStartMinute: 0,
    });

    // Finalizar el día con las actividades en su estado final
    await systemApi.endDay({
      dayState: {
        dayTempoBalance: 100,
        date: Date.now() - 86400000,
        dayStartMinute: 0,
      },
      activitiesFinalState: {
        "incomplete-challenge": incompleteActivity,
        "inprogress-neutral": inProgressActivity,
        "completed-discount": completedActivity,
      },
      usefulMetrics: {
        totalGeneratedTemposEver: 100,
        totalMinutesInvested: {
          intrinsicProductivity: 0,
          challenges: 10,
          hobbies: 20,
          rest: 15,
          other: 0,
        },
      },
      investedTimeHistory: [],
      tempoModificationHistory: [],
    });

    // Verificar que no hay actividades después de finalizar el día
    let activities = await systemApi.getActivities();
    expect(activities.length).toBe(0);

    // Iniciar un nuevo día
    await systemApi.startDay({
      dayTempoBalance: 100,
      date: Date.now(),
      dayStartMinute: 0,
    });

    // Verificar que se restauraron solo las actividades incompletas
    activities = await systemApi.getActivities();
    expect(activities.length).toBe(2); // Solo las dos actividades incompletas

    // Verificar que las actividades incompletas se restauraron
    const restoredIncomplete = activities.find((a) => a.id === "incomplete-challenge");
    const restoredInProgress = activities.find((a) => a.id === "inprogress-neutral");
    const restoredCompleted = activities.find((a) => a.id === "completed-discount");

    expect(restoredIncomplete).toBeDefined();
    expect(restoredInProgress).toBeDefined();
    expect(restoredCompleted).toBeUndefined(); // No debe existir

    // Verificar que se mantuvieron los estados originales
    expect(restoredIncomplete?.status).toBe("toDo");
    expect(restoredInProgress?.status).toBe("toDo"); // Debería reiniciarse a toDo

    // Verificar que se mantuvieron los valores de minutesActive
    expect(restoredIncomplete?.minutesActive).toBe(10);
    expect(restoredInProgress?.minutesActive).toBe(15);

    // Verificar propiedades específicas por tipo
    if (restoredIncomplete?.type === "challenge") {
      expect(restoredIncomplete.tempoGeneratingMinutes).toBe(10);
    }
  });
});
