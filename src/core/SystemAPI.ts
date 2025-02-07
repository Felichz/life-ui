import merge from "lodash.merge";
import { v4 as uuidv4 } from "uuid";

import type {
  Activity,
  ActivityId,
  Board,
  BoardChallengeConstraint,
  BoardId,
  ChallengeActivity,
  ChallengeConstraint,
  CreateActivityInput,
  CreateBoardInput,
  DayState,
  ExpirationChallengeConstraint,
  HobbyActivity,
  InheritableActivityProps,
  InvestedTimeHistory,
  InvestedTimeRecord,
  NeutralActivity,
  PersistedState,
  SystemAPIType,
  SystemParams,
  TempoModificationRecord,
  UsefulMetrics,
} from "./types";

import { formatLog, formatMultiLog } from "@/lib/utils/logger";

const STORAGE_KEY = "system_state";

const defaultState: PersistedState = {
  lifecycleState: "dayNotStarted",
  currentDay: undefined,
  boards: {},
  activities: {},
  totalTempoBalance: 0,
  investedTimeHistory: [],
  tempoModificationHistory: [],
  usefulMetrics: {
    totalGeneratedTemposEver: 0,
    totalMinutesInvested: {
      intrinsicProductivity: 0,
      challenges: 0,
      hobbies: 0,
      rest: 0,
      other: 0,
    },
  },
  systemParams: {
    passiveTempoConsumptionRate: 1,
    isTestMode: false,
    timeMultiplier: 1,
  },
  lastUpdateTimestamp: Date.now(),
  selectedActivity: undefined,
};

class StorageWrapper {
  private memoryStorage: Map<string, string>;
  private hasStorageAccess: boolean;

  constructor() {
    this.memoryStorage = new Map();
    this.hasStorageAccess = false;
  }

  private async requestAccess(): Promise<boolean> {
    try {
      // Prueba más completa de localStorage
      const testKey = "__storage_test__";
      localStorage.setItem(testKey, testKey);
      const result = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      this.hasStorageAccess = result === testKey;
      return this.hasStorageAccess;
    } catch (error) {
      console.warn("Storage access denied, falling back to memory storage:", error);
      this.hasStorageAccess = false;
      return false;
    }
  }

  async getItem(key: string): Promise<string | null> {
    await this.requestAccess();

    if (this.hasStorageAccess) {
      return localStorage.getItem(key);
    }

    return this.memoryStorage.get(key) || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.requestAccess();

    if (this.hasStorageAccess) {
      localStorage.setItem(key, value);
    } else {
      this.memoryStorage.set(key, value);
    }
  }
}

/**
 *  Interactúa con el local storage para obtener y guardar el estado del sistema
 */
class SystemAPI implements SystemAPIType {
  private storage: StorageWrapper;

  constructor() {
    this.storage = new StorageWrapper();
  }

  private async getState(): Promise<PersistedState> {
    const persistedState = await this.storage.getItem(STORAGE_KEY);

    if (!persistedState) {
      return defaultState;
    }

    return JSON.parse(persistedState);
  }

  private async saveState(state: PersistedState): Promise<void> {
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  async getPersistedState(): Promise<PersistedState> {
    return this.getState();
  }

  async getLifecycleState(): Promise<PersistedState["lifecycleState"]> {
    const state = await this.getState();
    return state.lifecycleState;
  }

  async startDay(currentDay: DayState): Promise<void> {
    const currentState = await this.getState();
    await this.saveState({ ...currentState, currentDay, lifecycleState: "dayInProgress" });
  }

  async endDay(): Promise<void> {
    const currentState = await this.getState();
    await this.saveState({
      ...currentState,
      currentDay: undefined,
      lifecycleState: "dayNotStarted",
    });
  }

  async getBoard(boardId: BoardId): Promise<Board | undefined> {
    const state = await this.getState();
    return state.boards[boardId];
  }

  async getBoards(): Promise<Board[]> {
    const state = await this.getState();
    return Object.values(state.boards);
  }

  private async _traverseBoardHierarchy<T>({
    board,
    processBoard,
    initialInheritedData,
  }: {
    board: Board;
    processBoard: (currentBoard: Board, inheritedData: T) => Promise<T>;
    initialInheritedData: T;
  }): Promise<void> {
    const iterationCallback = async (currentBoard: Board, inheritedData: T) => {
      // Procesar el board actual y obtener datos para pasar a los hijos
      const updatedInheritedData = await processBoard(currentBoard, inheritedData);

      // Procesar recursivamente los hijos directos
      if (currentBoard.childrenBoards) {
        for (const childBoardId of currentBoard.childrenBoards) {
          const childBoard = await this.getBoard(childBoardId);
          if (childBoard) {
            await iterationCallback(childBoard, updatedInheritedData);
          }
        }
      }
    };

    await iterationCallback(board, initialInheritedData);
  }

  /**
   * Función auxiliar para generar un UUID.
   * Usa uuidv4 para generar IDs únicos.
   */
  private generateUUID(): string {
    return uuidv4();
  }

  /**
   * Sincroniza los constraint de desafíos para el tablero actual.
   *
   * Esta función se encarga de combinar los constraint heredados (provenientes del tablero padre)
   * con los constraint propios definidos en el tablero actual. Luego, se encarga de recorrer las
   * actividades de tipo desafío que pertenecen al tablero y actualizar, modificar o eliminar los
   * constraint según corresponda:
   *
   * - Si un constraint en la actividad tiene un identificador de constraint padre, se busca el constraint
   *   heredado y se actualizan ciertas propiedades (como type, penalty y dayMinuteExpiration).
   * - Si no existe el constraint heredado, ese constraint se elimina de la actividad.
   * - Se añaden a la actividad los constraint heredados que aún no se han aplicado.
   *
   * @param currentBoard - El tablero actual que contiene actividades y constraint propios.
   * @param inheritedConstraints - Lista de constraint heredados a aplicar provenientes del padre.
   * @returns Promise que resuelve con la lista combinada de constraint (heredados y propios) para seguir la sincronización.
   */
  private async _syncChallengeConstraintsCallback({
    currentBoard,
    inheritedConstraints,
  }: {
    currentBoard: Board;
    inheritedConstraints: BoardChallengeConstraint[];
  }): Promise<BoardChallengeConstraint[]> {
    const state = await this.getState();

    formatMultiLog({
      label: "_syncChallengeConstraintsCallback",
      data: { currentBoard, inheritedConstraints },
    });

    // Combinar los constraints heredados con los del board actual
    const currentBoardConstraints = currentBoard.constraintList || [];
    formatLog("currentBoardConstraints", currentBoardConstraints);

    const combinedConstraints = [...currentBoardConstraints];
    formatLog("combinedConstraints", combinedConstraints);

    const childChallenges = currentBoard.activities
      .map((id) => state.activities[id])
      .filter((activity): activity is ChallengeActivity => activity?.type === "challenge");

    formatMultiLog(
      { label: "currentBoard.activities", data: currentBoard.activities },
      { label: "childChallenges", data: childChallenges }
    );

    for (const challenge of childChallenges) {
      const updatedConstraints: ChallengeConstraint[] = [];

      for (const constraint of challenge.constraintList) {
        if (constraint.parentConstraintId) {
          // Buscar el constraint heredado correspondiente
          const inheritedConstraint = inheritedConstraints.find(
            (ic) => ic.id === constraint.parentConstraintId
          );

          if (inheritedConstraint) {
            formatLog("updating inherited constraint because it exists", inheritedConstraint);
            // Actualizar type, penalty, y dayMinuteExpiration (basicamente todas las propiedades heredables menos el id)
            updatedConstraints.push({
              ...constraint,
              ...inheritedConstraint,
              id: constraint.id,
              status: constraint.status,
              failCount: constraint.failCount,
            });
          }
          // Si no existe, no se agrega (se elimina)
        } else {
          // Mantener constraints sin parent
          updatedConstraints.push(constraint);
        }
      }

      // Agregar constraints heredados que no estén presentes
      for (const constraintToApply of combinedConstraints) {
        const exists = updatedConstraints.some(
          (uc) => uc.parentConstraintId === constraintToApply.id
        );

        if (!exists) {
          // Buscar si ya existía este constraint en la actividad
          const existingConstraint = challenge.constraintList.find(
            (c) => c.parentConstraintId === constraintToApply.id
          );

          updatedConstraints.push({
            ...constraintToApply,
            id: existingConstraint?.id || this.generateUUID(),
            parentConstraintId: constraintToApply.id,
            failCount: existingConstraint?.failCount || 0,
            status: existingConstraint?.status || "active",
          });
        }
      }

      // Actualizar el challenge con los nuevos constraint
      challenge.constraintList = updatedConstraints;

      await this.updateActivity(challenge);
    }

    return combinedConstraints;
  }

  /**
   * Sincroniza las propiedades heredables de las actividades para el tablero actual.
   *
   * Esta función combina las propiedades heredadas (provenientes del tablero padre) con las propiedades
   * especificadas en el tablero actual (currentBoard.activityProps). El resultado es un objeto de propiedades
   * heredables combinadas que se utilizan para actualizar las actividades asociadas al tablero:
   *
   * - Se recorre cada actividad (de cualquier tipo) en el tablero.
   * - Cada actividad se actualiza asignándole las propiedades heredadas correspondientes en función de su tipo.
   *
   * @param currentBoard - El tablero actual del cual se extraen las propiedades propias para actividades.
   * @param inheritedProps - Objeto con las propiedades heredadas que provienen del tablero padre.
   * @returns Promise que resuelve con las propiedades heredables combinadas (un objeto InheritableActivityProps)
   *          que pueden ser propagadas a los tableros hijos o utilizadas para la actualización de actividades.
   */
  private async _syncActivityPropsCallback({
    currentBoard,
    inheritedProps,
  }: {
    currentBoard: Board;
    inheritedProps: InheritableActivityProps;
  }): Promise<InheritableActivityProps> {
    const state = await this.getState();

    const combinedProps = {
      challenge: {
        ...inheritedProps.challenge,
        ...currentBoard.activityProps.challenge,
      },
      neutral: {
        ...inheritedProps.neutral,
        ...currentBoard.activityProps.neutral,
      },
      discount: {
        ...inheritedProps.discount,
        ...currentBoard.activityProps.discount,
      },
    };

    const childActivities = currentBoard.activities
      .map((id) => state.activities[id])
      .filter((activity): activity is Activity => activity !== undefined);

    for (const activity of childActivities) {
      const updatedActivity = {
        ...activity,
        inheritedProps: combinedProps[activity.type],
      };

      await this.updateActivity(updatedActivity as Activity);
    }

    return combinedProps;
  }

  /**
   * Sincroniza recursivamente el estado del tablero y sus hijos, actualizando
   * los constraint de desafíos y las propiedades heredables de las actividades.
   *
   * Recorre la jerarquía de tableros iniciando desde el tablero proporcionado. En cada iteración:
   *  - Se actualizan los constraint de desafíos combinando los constraint heredados del padre
   *    con los constraint propios definidos en el tablero actual.
   *  - Se actualizan las propiedades heredables de las actividades combinando las propiedades heredadas
   *    con las propiedades específicas del tablero actual.
   *
   * @param board - Tablero raíz desde el cual se inicia la sincronización (incluye sus tableros hijos).
   * @returns Promise que se resuelve cuando la sincronización de todo el árbol de tableros ha finalizado.
   */
  private async _syncBoardWithChildren(board: Board): Promise<void> {
    formatLog("_syncBoardWithChildren", board);

    await this._traverseBoardHierarchy({
      board,
      processBoard: async (currentBoard, { constraints, activityProps }) => {
        const newConstraints = await this._syncChallengeConstraintsCallback({
          currentBoard,
          inheritedConstraints: constraints,
        });

        const newProps = await this._syncActivityPropsCallback({
          currentBoard,
          inheritedProps: activityProps,
        });

        formatMultiLog(
          { label: "processBoard", data: { currentBoard } },
          { label: "constraints", data: { constraints, newConstraints } },
          { label: "activityProps", data: { activityProps, newProps } }
        );

        return { constraints: newConstraints, activityProps: newProps };
      },
      initialInheritedData: {
        constraints: [] as BoardChallengeConstraint[],
        activityProps: {} as InheritableActivityProps,
      },
    });
  }

  // Function recursiva que busca el board padre de un board y luego busca el padre de este board, y asi sucesivamente hasta que no haya mas boards padres, basicamente retorna el board root de la actividad. Si el board no tiene padre, retorna el mismo board
  async _getRootBoard(board: Board): Promise<Board> {
    if (!board.parentBoardId) return board;

    const parentBoard = await this.getBoard(board.parentBoardId);

    if (!parentBoard) return board;

    if (!parentBoard.parentBoardId) return parentBoard;

    return this._getRootBoard(parentBoard);
  }

  async createBoard(newBoard: Board): Promise<void> {
    // Obtenemos el estado persistido actual
    const state = await this.getPersistedState();

    // Si el board tiene padre, actualizamos el board padre para agregar el id del nuevo board en childrenBoards
    if (newBoard.parentBoardId) {
      const parentBoard = await this.getBoard(newBoard.parentBoardId);
      if (parentBoard) {
        // Calculamos los childrenBoards actualizados, garantizando que se mantengan los cambios anteriores
        const updatedChildrenBoards = Array.isArray(parentBoard.childrenBoards)
          ? [...parentBoard.childrenBoards, newBoard.id]
          : [newBoard.id];
        const updatedParentBoard = { ...parentBoard, childrenBoards: updatedChildrenBoards };

        // Actualizamos el board padre
        await this.updateBoard(updatedParentBoard);

        const freshParentBoard = await this.getBoard(newBoard.parentBoardId);
        state.boards[newBoard.parentBoardId] = freshParentBoard!;
      }
    }

    // Agregamos el nuevo board al estado
    state.boards[newBoard.id] = newBoard;

    // Guardamos el estado actualizado incluyendo la versión fresca del board padre
    await this.saveState(state);
  }

  async updateBoard(boardUpdates: Partial<Board> & { id: BoardId }): Promise<void> {
    const state = await this.getState();
    const existingBoard = state.boards[boardUpdates.id];

    if (!existingBoard) {
      return;
    }

    const updatedBoard = merge({}, existingBoard, boardUpdates);

    if (boardUpdates.constraintList !== undefined) {
      updatedBoard.constraintList = [...boardUpdates.constraintList];
    } else {
      updatedBoard.constraintList = [...existingBoard.constraintList];
    }

    state.boards[boardUpdates.id] = updatedBoard;

    await this.saveState(state);

    // Solo sincronizamos si hay cambios en constraintList o activityProps
    const shouldSync =
      boardUpdates.constraintList !== undefined || boardUpdates.activityProps !== undefined;

    if (shouldSync) {
      await this._syncBoardWithChildren(updatedBoard);
    }
  }

  async removeBoard(board: Board): Promise<void> {
    const state = await this.getState();

    // 1. Actualizar el board padre si existe
    if (board.parentBoardId) {
      const parentBoard = state.boards[board.parentBoardId];
      if (parentBoard) {
        const updatedParentBoard = {
          ...parentBoard,
          childrenBoards: parentBoard.childrenBoards?.filter((id) => id !== board.id) || [],
        };
        state.boards[board.parentBoardId] = updatedParentBoard;
      }
    }

    // 2. Eliminar recursivamente los boards hijos
    if (board.childrenBoards) {
      for (const childId of board.childrenBoards) {
        const childBoard = state.boards[childId];
        if (childBoard) {
          // Eliminar el hijo del estado actual
          delete state.boards[childId];
          // Eliminar las actividades del hijo
          for (const activityId of childBoard.activities) {
            delete state.activities[activityId];
          }
        }
      }
    }

    // 3. Eliminar las actividades asociadas al board actual
    for (const activityId of board.activities) {
      delete state.activities[activityId];
    }

    // 4. Eliminar el board actual
    delete state.boards[board.id];

    // 5. Guardar el estado actualizado
    await this.saveState(state);
  }

  async getActivity(activityId: ActivityId): Promise<Activity | undefined> {
    const state = await this.getState();
    return state.activities[activityId];
  }

  async getActivities(): Promise<Activity[]> {
    const state = await this.getState();
    return Object.values(state.activities);
  }

  async createActivity(activity: Activity): Promise<void> {
    const { parentBoardId } = activity;
    const state = await this.getState();

    formatLog("createActivity", null);

    // Actualizar el estado con la nueva actividad
    const newState: PersistedState = {
      ...state,
      activities: { ...state.activities, [activity.id]: activity },
    };

    if (!parentBoardId) return;

    // Si se proporciona un parentBoardId, actualizar el tablero correspondiente
    const parentBoard = newState.boards[parentBoardId];

    newState.boards[parentBoardId] = {
      ...parentBoard,
      activities: [...(parentBoard.activities || []), activity.id],
    };

    await this.saveState(newState);

    const updatedState = await this.getState();
    const updatedParentBoard = updatedState.boards[parentBoardId];

    const rootBoard = await this._getRootBoard(updatedParentBoard);
    await this._syncBoardWithChildren(rootBoard);
  }

  async updateActivity(activityUpdates: Partial<Activity> & { id: ActivityId }): Promise<void> {
    formatLog("systemApi updateActivity", activityUpdates);
    const state = await this.getState();

    if (!state.activities[activityUpdates.id]) return;

    const currentActivity = state.activities[activityUpdates.id];

    // Aseguramos que el tipo resultante sea una Activity válida
    let updatedActivity: Activity;
    switch (currentActivity.type) {
      case "challenge":
        updatedActivity = { ...currentActivity, ...activityUpdates } as ChallengeActivity;
        break;
      case "neutral":
        updatedActivity = { ...currentActivity, ...activityUpdates } as NeutralActivity;
        break;
      case "discount":
        updatedActivity = { ...currentActivity, ...activityUpdates } as HobbyActivity;
        break;
    }

    await this.saveState({
      ...state,
      activities: {
        ...state.activities,
        [updatedActivity.id]: updatedActivity,
      },
    });
  }

  async removeActivity(activity: Activity): Promise<void> {
    const state = await this.getState();

    formatLog("deleteActivity - Activity a eliminar", activity);

    // Primero eliminamos la actividad del estado
    const { [activity.id]: _, ...remainingActivities } = state.activities;
    const newState = {
      ...state,
      activities: remainingActivities,
    };
    await this.saveState(newState);

    // Luego actualizamos el board padre si existe
    if (activity.parentBoardId) {
      const parentBoard = newState.boards[activity.parentBoardId];
      formatLog("deleteActivity - Board padre antes de actualizar", parentBoard);

      if (parentBoard) {
        const updatedBoard = {
          ...parentBoard,
          activities: parentBoard.activities.filter((id) => id !== activity.id),
        };
        formatLog("deleteActivity - Board padre después de filtrar la actividad", updatedBoard);

        // Actualizamos el board sin llamar a syncBoardWithChildren
        newState.boards[activity.parentBoardId] = updatedBoard;
        await this.saveState(newState);

        // Verificar el estado del board después de la actualización
        const stateAfterUpdate = await this.getState();
        formatLog(
          "deleteActivity - Board padre después de update",
          stateAfterUpdate.boards[activity.parentBoardId]
        );
      }
    }

    // Verificar el estado final
    const finalState = await this.getState();
    formatMultiLog(
      {
        label: "deleteActivity - Estado final - actividad existe",
        data: !!finalState.activities[activity.id],
      },
      {
        label: "deleteActivity - Estado final - board padre",
        data: activity.parentBoardId ? finalState.boards[activity.parentBoardId] : null,
      }
    );
  }

  async getSelectedActivity(): Promise<Activity | undefined> {
    const state = await this.getState();

    if (!state.selectedActivity) return undefined;

    return state.activities[state.selectedActivity];
  }

  async setSelectedActivity(activity: Activity): Promise<void> {
    const state = await this.getState();

    await this.saveState({ ...state, selectedActivity: activity?.id });
  }

  async unselectActivity(): Promise<void> {
    const state = await this.getState();
    await this.saveState({ ...state, selectedActivity: undefined });
  }

  async getTotalTempoBalance(): Promise<PersistedState["totalTempoBalance"]> {
    const state = await this.getState();
    return state.totalTempoBalance;
  }

  private shouldUpdateLastRecord(
    lastRecord: InvestedTimeRecord,
    newRecord: InvestedTimeRecord
  ): boolean {
    const isSameActivity =
      "activityId" in lastRecord &&
      "activityId" in newRecord &&
      lastRecord.activityId === newRecord.activityId;

    const areBothIdle = lastRecord.status === "idle" && newRecord.status === "idle";

    return isSameActivity || areBothIdle;
  }

  private mergeTimeRecords(
    lastRecord: InvestedTimeRecord,
    newRecord: InvestedTimeRecord
  ): InvestedTimeRecord {
    return {
      ...lastRecord,
      minutesInvested: lastRecord.minutesInvested + newRecord.minutesInvested,
      tempoModification: lastRecord.tempoModification + newRecord.tempoModification,
    };
  }

  async updateTempoBalance({
    investedTimeRecord,
    tempoModificationRecord,
  }:
    | {
        investedTimeRecord: InvestedTimeRecord;
        tempoModificationRecord: TempoModificationRecord;
      }
    | {
        investedTimeRecord: InvestedTimeRecord;
        tempoModificationRecord?: undefined;
      }
    | {
        investedTimeRecord?: undefined;
        tempoModificationRecord?: TempoModificationRecord;
      }): Promise<void> {
    const state = await this.getState();

    if (!state.currentDay) return;

    // Actualizar historial de tiempo invertido
    const newInvestedTimeHistory = investedTimeRecord
      ? await this.updateInvestedTimeHistory({ investedTimeRecord })
      : state.investedTimeHistory;

    const tempoModification = (tempoModificationRecord?.tempoModification ||
      investedTimeRecord?.tempoModification) as number;

    // Calcular nuevos balances
    const { dayTempoBalance, totalTempoBalance } = await this.calculateNewBalances({
      tempoModification,
    });

    // Guardar todos los cambios
    await this.saveState({
      ...state,
      lifecycleState: "dayInProgress",
      currentDay: {
        ...state.currentDay,
        dayTempoBalance,
      },
      totalTempoBalance,
      investedTimeHistory: newInvestedTimeHistory,
      tempoModificationHistory: tempoModificationRecord
        ? [...state.tempoModificationHistory, tempoModificationRecord]
        : state.tempoModificationHistory,
    });
  }

  async pushToInvestedTimeHistory(investedTimeRecord: InvestedTimeRecord): Promise<void> {
    const state = await this.getState();
    const newInvestedTimeHistory = await this.updateInvestedTimeHistory({ investedTimeRecord });
    await this.saveState({ ...state, investedTimeHistory: newInvestedTimeHistory });
  }

  private async updateInvestedTimeHistory({
    investedTimeRecord: newRecord,
  }: {
    investedTimeRecord: InvestedTimeRecord;
  }): Promise<InvestedTimeRecord[]> {
    const currentHistory = await this.getInvestedTimeHistory();
    const lastRecord = currentHistory.at(-1);

    if (!lastRecord) {
      return [newRecord];
    }

    if (this.shouldUpdateLastRecord(lastRecord, newRecord)) {
      return [...currentHistory.slice(0, -1), this.mergeTimeRecords(lastRecord, newRecord)];
    }

    return [...currentHistory, newRecord];
  }

  private async calculateNewBalances({ tempoModification }: { tempoModification: number }) {
    const state = await this.getState();
    const currentDay = state.currentDay;

    const prevDayTempoBalance = currentDay?.dayTempoBalance ?? 0;

    return {
      totalTempoBalance: state.totalTempoBalance + tempoModification,
      dayTempoBalance: prevDayTempoBalance + tempoModification,
    };
  }

  async getInvestedTimeHistory(): Promise<InvestedTimeHistory> {
    const state = await this.getState();
    return state.investedTimeHistory;
  }

  async getInvestedTimeHistoryByDay(day: Date): Promise<InvestedTimeHistory> {
    const history = await this.getInvestedTimeHistory();
    return history.filter((record) => {
      const recordDate = new Date(record.timestamp);
      return (
        recordDate.getFullYear() === day.getFullYear() &&
        recordDate.getMonth() === day.getMonth() &&
        recordDate.getDate() === day.getDate()
      );
    });
  }

  async getUsefulMetrics(): Promise<UsefulMetrics> {
    const state = await this.getState();
    return state.usefulMetrics;
  }

  async updateUsefulMetrics({ metrics }: { metrics: UsefulMetrics }): Promise<void> {
    const state = await this.getState();
    await this.saveState({ ...state, usefulMetrics: metrics });
  }

  async getSystemParams(): Promise<SystemParams> {
    const state = await this.getState();
    return state.systemParams;
  }

  async updateSystemParams(params: SystemParams): Promise<void> {
    const state = await this.getState();
    await this.saveState({ ...state, systemParams: params });
  }

  async getCurrentDay(): Promise<DayState | undefined> {
    const state = await this.getState();
    return state.currentDay;
  }

  async updateLastUpdateTimestamp(timestamp: number): Promise<void> {
    const state = await this.getState();
    await this.saveState({ ...state, lastUpdateTimestamp: timestamp });
  }

  async clearAllData(): Promise<void> {
    const state = await this.getState();

    // Validar que el test mode esté activo
    if (!state.systemParams.isTestMode) {
      throw new Error("No se puede borrar la data si el modo de prueba no está activo");
    }

    await this.saveState(defaultState);
  }
}

export const systemApi = new SystemAPI();
