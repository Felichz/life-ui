import { systemApi } from "@core/SystemAPI";

import type { Board, ChallengeActivity } from "../types";

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
