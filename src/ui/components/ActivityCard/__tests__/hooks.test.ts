import { useToast } from "@shadcn/hooks/use-toast";
import { renderHook, act } from "@testing-library/react-hooks";
import { v4 as uuidv4 } from "uuid";

import {
  useActivityActions,
  useActivityEdit,
  useConstraintsManagement,
  useActivityProgress,
} from "../hooks";

import { useSystemEngineContext } from "@/core/SystemEngineContext";
import type {
  Activity,
  ChallengeActivity,
  ExpirationChallengeConstraint,
  HobbyActivity,
  NeutralActivity,
} from "@/core/types";

// Mock de los hooks externos
jest.mock("@/core/SystemEngineContext", () => ({
  useSystemEngineContext: jest.fn(),
}));

jest.mock("@shadcn/hooks/use-toast", () => ({
  useToast: jest.fn(),
}));

jest.mock("uuid", () => ({
  v4: jest.fn(),
}));

describe("useActivityActions", () => {
  // Configuración de mocks
  const mockSelectActivity = jest.fn();
  const mockUnselectCurrentyActivity = jest.fn();
  const mockCompleteChallenge = jest.fn();
  const mockRemoveActivity = jest.fn();
  const mockToast = jest.fn();

  const mockEngine = {
    activity: {
      selectActivity: mockSelectActivity,
      unselectCurrentyActivity: mockUnselectCurrentyActivity,
      completeChallenge: mockCompleteChallenge,
      removeActivity: mockRemoveActivity,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useSystemEngineContext as jest.Mock).mockReturnValue(mockEngine);
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
  });

  const mockActivity: Activity = {
    id: "1",
    title: "Test Activity",
    type: "challenge",
    status: "toDo",
    minutesActive: 0,
    totalTempoReward: 30,
    constraintList: [],
    inheritedProps: undefined,
    tempoGeneratingMinutes: 0,
    isRepetitive: false,
    createdAt: 0,
  };

  test("handleSelect llama a selectActivity con la actividad correcta", async () => {
    const { result } = renderHook(() => useActivityActions(mockActivity));

    await act(async () => {
      await result.current.handleSelect();
    });

    expect(mockSelectActivity).toHaveBeenCalledWith(mockActivity);
  });

  test("handleUnselect llama a unselectCurrentyActivity", async () => {
    mockUnselectCurrentyActivity.mockResolvedValue(undefined);
    const { result } = renderHook(() => useActivityActions(mockActivity));

    let success;
    await act(async () => {
      success = await result.current.handleUnselect();
    });

    expect(mockUnselectCurrentyActivity).toHaveBeenCalled();
    expect(success).toBe(true);
  });

  test("handleUnselect maneja errores correctamente", async () => {
    mockUnselectCurrentyActivity.mockRejectedValue(new Error("Test error"));
    const { result } = renderHook(() => useActivityActions(mockActivity));

    let success;
    await act(async () => {
      success = await result.current.handleUnselect();
    });

    expect(mockUnselectCurrentyActivity).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Error",
      })
    );
    expect(success).toBe(false);
  });

  test("handleCompleteChallenge llama a completeChallenge con la actividad correcta", async () => {
    const { result } = renderHook(() => useActivityActions(mockActivity));

    await act(async () => {
      await result.current.handleCompleteChallenge(mockActivity);
    });

    expect(mockCompleteChallenge).toHaveBeenCalledWith({
      activity: mockActivity,
    });
  });

  test("handleDelete llama a removeActivity con la actividad correcta", async () => {
    const { result } = renderHook(() => useActivityActions(mockActivity));

    await act(async () => {
      await result.current.handleDelete();
    });

    expect(mockRemoveActivity).toHaveBeenCalledWith(mockActivity);
  });

  test("maneja errores en las acciones correctamente", async () => {
    mockSelectActivity.mockRejectedValue(new Error("Test error"));
    const { result } = renderHook(() => useActivityActions(mockActivity));

    await act(async () => {
      await result.current.handleSelect();
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Error",
      })
    );
  });
});

describe("useActivityEdit", () => {
  const mockUpdateActivity = jest.fn();
  const mockValidate = jest.fn();
  const mockToast = jest.fn();

  const mockEngine = {
    activity: {
      updateActivity: mockUpdateActivity,
      validate: mockValidate,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useSystemEngineContext as jest.Mock).mockReturnValue(mockEngine);
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
  });

  const challengeActivity: ChallengeActivity = {
    id: "1",
    title: "Test Challenge",
    type: "challenge",
    status: "toDo",
    minutesActive: 0,
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
      {
        id: "2",
        type: "expiration",
        dayMinuteExpiration: 1300,
        penalty: 20,
        status: "active",
        failCount: 0,
        parentConstraintId: "parent1",
      },
    ],
    inheritedProps: undefined,
    tempoGeneratingMinutes: 0,
    isRepetitive: false,
    createdAt: 0,
  };

  const neutralActivity: NeutralActivity = {
    id: "2",
    title: "Test Neutral",
    type: "neutral",
    status: "toDo",
    minutesActive: 0,
    allowedTime: 30,
    inheritedProps: undefined,
    isRepetitive: false,
    createdAt: 0,
  };

  const hobbyActivity: HobbyActivity = {
    id: "3",
    title: "Test Hobby",
    type: "discount",
    status: "toDo",
    minutesActive: 0,
    allowedTime: 30,
    tempoConsumptionRate: 0.5,
    inheritedProps: undefined,
    isRepetitive: false,
    createdAt: 0,
  };

  test("inicializa correctamente los valores para un desafío", () => {
    const { result } = renderHook(() => useActivityEdit(challengeActivity));

    expect(result.current.editedTitle).toBe("Test Challenge");
    expect(result.current.editedTempoReward).toBe(30);
    expect(result.current.inheritedConstraints).toHaveLength(1);
    expect(result.current.editedConstraints).toHaveLength(1);
  });

  test("inicializa correctamente los valores para una actividad neutral", () => {
    const { result } = renderHook(() => useActivityEdit(neutralActivity));

    expect(result.current.editedTitle).toBe("Test Neutral");
    expect(result.current.editedAllowedTime).toBe(30);
  });

  test("inicializa correctamente los valores para un hobby", () => {
    const { result } = renderHook(() => useActivityEdit(hobbyActivity));

    expect(result.current.editedTitle).toBe("Test Hobby");
    expect(result.current.editedAllowedTime).toBe(30);
    expect(result.current.editedConsumptionRate).toBe(0.5);
  });

  test("handleUpdateActivity actualiza correctamente un desafío", async () => {
    mockValidate.mockReturnValue(true);
    mockUpdateActivity.mockResolvedValue(undefined);

    const { result } = renderHook(() => useActivityEdit(challengeActivity));

    await act(async () => {
      const success = await result.current.handleUpdateActivity();
      expect(success).toBe(true);
    });

    expect(mockUpdateActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "1",
        title: "Test Challenge",
        totalTempoReward: 30,
        constraintList: expect.arrayContaining([
          expect.objectContaining({ id: "1" }),
          expect.objectContaining({ id: "2", parentConstraintId: "parent1" }),
        ]),
      })
    );

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Actividad actualizada",
      })
    );
  });

  test("handleUpdateActivity actualiza correctamente una actividad neutral", async () => {
    mockValidate.mockReturnValue(true);
    mockUpdateActivity.mockResolvedValue(undefined);

    const { result } = renderHook(() => useActivityEdit(neutralActivity));

    await act(async () => {
      const success = await result.current.handleUpdateActivity();
      expect(success).toBe(true);
    });

    expect(mockUpdateActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "2",
        title: "Test Neutral",
        allowedTime: 30,
      })
    );
  });

  test("handleUpdateActivity actualiza correctamente un hobby", async () => {
    mockValidate.mockReturnValue(true);
    mockUpdateActivity.mockResolvedValue(undefined);

    const { result } = renderHook(() => useActivityEdit(hobbyActivity));

    await act(async () => {
      const success = await result.current.handleUpdateActivity();
      expect(success).toBe(true);
    });

    expect(mockUpdateActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "3",
        title: "Test Hobby",
        allowedTime: 30,
        tempoConsumptionRate: 0.5,
      })
    );
  });

  test("handleUpdateActivity maneja errores de validación", async () => {
    mockValidate.mockReturnValue(false);

    const { result } = renderHook(() => useActivityEdit(challengeActivity));

    await act(async () => {
      const success = await result.current.handleUpdateActivity();
      expect(success).toBe(false);
    });

    expect(mockUpdateActivity).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Error",
        description: "Los datos de la actividad son inválidos",
      })
    );
  });

  test("handleUpdateActivity maneja errores de actualización", async () => {
    mockValidate.mockReturnValue(true);
    mockUpdateActivity.mockRejectedValue(new Error("Update error"));

    const { result } = renderHook(() => useActivityEdit(challengeActivity));

    await act(async () => {
      const success = await result.current.handleUpdateActivity();
      expect(success).toBe(false);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar la actividad",
      })
    );
  });
});

describe("useConstraintsManagement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (uuidv4 as jest.Mock).mockReturnValue("new-uuid");
  });

  const initialConstraints: ExpirationChallengeConstraint[] = [
    {
      id: "1",
      type: "expiration",
      dayMinuteExpiration: 1200,
      penalty: 10,
      status: "active",
      failCount: 0,
    },
  ];

  test("handleAddConstraint agrega un nuevo constraint", () => {
    const setEditedConstraints = jest.fn();
    const { result } = renderHook(() =>
      useConstraintsManagement(initialConstraints, setEditedConstraints)
    );

    act(() => {
      result.current.handleAddConstraint();
    });

    expect(setEditedConstraints).toHaveBeenCalledWith([
      ...initialConstraints,
      {
        id: "new-uuid",
        type: "expiration",
        dayMinuteExpiration: 0,
        penalty: 0,
        status: "active",
        failCount: 0,
      },
    ]);
  });

  test("handleUpdateConstraint actualiza un constraint existente", () => {
    const setEditedConstraints = jest.fn();
    const { result } = renderHook(() =>
      useConstraintsManagement(initialConstraints, setEditedConstraints)
    );

    act(() => {
      result.current.handleUpdateConstraint(0, { dayMinuteExpiration: 1300 });
    });

    expect(setEditedConstraints).toHaveBeenCalledWith([
      {
        ...initialConstraints[0],
        dayMinuteExpiration: 1300,
      },
    ]);
  });

  test("handleRemoveConstraint elimina un constraint", () => {
    const setEditedConstraints = jest.fn();
    const { result } = renderHook(() =>
      useConstraintsManagement(initialConstraints, setEditedConstraints)
    );

    act(() => {
      result.current.handleRemoveConstraint(0);
    });

    expect(setEditedConstraints).toHaveBeenCalledWith([]);
  });

  test("handleUpdateConstraintPenalty actualiza la penalización con valor fijo", () => {
    const setEditedConstraints = jest.fn();
    const { result } = renderHook(() =>
      useConstraintsManagement(initialConstraints, setEditedConstraints)
    );

    act(() => {
      result.current.handleUpdateConstraintPenalty(0, "20", "fixed");
    });

    expect(setEditedConstraints).toHaveBeenCalledWith([
      {
        ...initialConstraints[0],
        penalty: 20,
      },
    ]);
  });

  test("handleUpdateConstraintPenalty actualiza la penalización con porcentaje", () => {
    const setEditedConstraints = jest.fn();
    const { result } = renderHook(() =>
      useConstraintsManagement(initialConstraints, setEditedConstraints)
    );

    act(() => {
      result.current.handleUpdateConstraintPenalty(0, "50%", "percentage");
    });

    expect(setEditedConstraints).toHaveBeenCalledWith([
      {
        ...initialConstraints[0],
        penalty: "50%",
      },
    ]);
  });
});

describe("useActivityProgress", () => {
  const mockCalculateProgress = jest.fn();

  const mockEngine = {
    activity: {
      calculateProgress: mockCalculateProgress,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useSystemEngineContext as jest.Mock).mockReturnValue(mockEngine);
  });

  const challengeActivity: ChallengeActivity = {
    id: "1",
    title: "Test Challenge",
    type: "challenge",
    status: "inProgress",
    minutesActive: 20,
    totalTempoReward: 30,
    constraintList: [],
    exceededMinutes: 0,
    inheritedProps: undefined,
    tempoGeneratingMinutes: 0,
    isRepetitive: false,
    createdAt: 0,
  };

  const exceededChallengeActivity = {
    ...challengeActivity,
    minutesActive: 40,
    exceededMinutes: 10,
  };

  test("calcula correctamente el progreso", () => {
    mockCalculateProgress.mockReturnValue(66.7);

    const { result } = renderHook(() => useActivityProgress(challengeActivity));

    expect(mockCalculateProgress).toHaveBeenCalledWith(challengeActivity);
    expect(result.current.progress).toBe(66.7);
  });

  test("determina correctamente si está generando tempo", () => {
    mockCalculateProgress.mockReturnValue(66.7);

    const { result } = renderHook(() => useActivityProgress(challengeActivity));

    expect(result.current.isGeneratingTempo).toBe(true);
  });

  test("determina correctamente cuando no está generando tempo", () => {
    mockCalculateProgress.mockReturnValue(100);

    const { result } = renderHook(() => useActivityProgress(exceededChallengeActivity));

    expect(result.current.isGeneratingTempo).toBe(false);
  });

  test("devuelve los minutos excedidos correctamente", () => {
    mockCalculateProgress.mockReturnValue(100);

    const { result } = renderHook(() => useActivityProgress(exceededChallengeActivity));

    expect(result.current.exceededMinutes).toBe(10);
  });

  test("devuelve 0 minutos excedidos cuando no hay exceso", () => {
    mockCalculateProgress.mockReturnValue(66.7);

    const { result } = renderHook(() => useActivityProgress(challengeActivity));

    expect(result.current.exceededMinutes).toBe(0);
  });

  test("maneja actividades que no son desafíos", () => {
    const neutralActivity: NeutralActivity = {
      id: "2",
      title: "Test Neutral",
      type: "neutral",
      status: "inProgress",
      minutesActive: 20,
      allowedTime: 30,
      inheritedProps: undefined,
      isRepetitive: false,
      createdAt: 0,
    };

    mockCalculateProgress.mockReturnValue(66.7);

    const { result } = renderHook(() => useActivityProgress(neutralActivity));

    expect(result.current.isGeneratingTempo).toBe(false);
    expect(result.current.exceededMinutes).toBe(0);
  });
});
