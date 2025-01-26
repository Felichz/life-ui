import type {
  PersistedState,
  SystemAPIType,
  Board,
  Activity,
  InvestedTimeRecord,
  UsefulMetrics,
  SystemParams,
  DayState,
  BoardId,
  ActivityId,
  TempoModificationRecord,
  InvestedTimeHistory,
} from "./types";

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

  async createBoard(board: Board): Promise<void> {
    const state = await this.getState();

    // Si tiene padre, actualizar childrenBoards del padre
    if (board.parentBoardId) {
      const parentBoard = state.boards[board.parentBoardId];
      if (parentBoard) {
        await this.updateBoard({
          ...parentBoard,
          childrenBoards: [...(parentBoard.childrenBoards || []), board.id],
        });
      }
    }

    await this.saveState({
      ...state,
      boards: { ...state.boards, [board.id]: board },
    });
  }

  async updateBoard(board: Board): Promise<void> {
    const state = await this.getState();
    const existingBoard = state.boards[board.id];

    if (!existingBoard) return;

    // Si cambió el parentBoardId
    if (existingBoard.parentBoardId !== board.parentBoardId) {
      // Eliminar referencia del padre anterior
      if (existingBoard.parentBoardId) {
        const oldParent = state.boards[existingBoard.parentBoardId];
        if (oldParent) {
          await this.updateBoard({
            ...oldParent,
            childrenBoards: oldParent.childrenBoards?.filter((id) => id !== board.id),
          });
        }
      }

      // Agregar referencia al nuevo padre
      if (board.parentBoardId) {
        const newParent = state.boards[board.parentBoardId];
        if (newParent) {
          await this.updateBoard({
            ...newParent,
            childrenBoards: [...(newParent.childrenBoards || []), board.id],
          });
        }
      }
    }

    await this.saveState({
      ...state,
      boards: {
        ...state.boards,
        [board.id]: board,
      },
    });
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

    // Actualizar el estado con la nueva actividad
    const newState: PersistedState = {
      ...state,
      activities: { ...state.activities, [activity.id]: activity },
    };

    // Si se proporciona un parentBoardId, actualizar el tablero correspondiente
    const parentBoard = parentBoardId ? newState.boards[parentBoardId] : undefined;

    if (parentBoardId && parentBoard) {
      newState.boards[parentBoardId] = {
        ...parentBoard,
        activities: [...(parentBoard.activities || []), activity.id],
      };
    }

    await this.saveState(newState);
  }

  async updateActivity(activity: Activity): Promise<void> {
    const state = await this.getState();

    if (!state.activities[activity.id]) return;

    await this.saveState({
      ...state,
      activities: {
        ...state.activities,
        [activity.id]: activity,
      },
    });
  }

  async removeActivity(activity: Activity): Promise<void> {
    const state = await this.getState();

    // Eliminar la referencia del board padre si existe
    if (activity.parentBoardId) {
      const parentBoard = state.boards[activity.parentBoardId];

      if (parentBoard) {
        await this.updateBoard({
          ...parentBoard,
          activities: parentBoard.activities.filter((id) => id !== activity.id),
        });
      }
    }

    // Eliminar la actividad
    const { [activity.id]: _, ...remainingActivities } = state.activities;
    await this.saveState({ ...state, activities: remainingActivities });
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
  }: {
    investedTimeRecord?: InvestedTimeRecord | undefined;
    tempoModificationRecord: TempoModificationRecord;
  }): Promise<void> {
    const state = await this.getState();

    if (!state.currentDay) return;

    // Actualizar historial de tiempo invertido
    const newInvestedTimeHistory = investedTimeRecord
      ? await this.updateInvestedTimeHistory({ investedTimeRecord })
      : state.investedTimeHistory;

    // Calcular nuevos balances
    const { dayTempoBalance, totalTempoBalance } = await this.calculateNewBalances({
      tempoModification: tempoModificationRecord.tempoModification,
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
      tempoModificationHistory: [...state.tempoModificationHistory, tempoModificationRecord],
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
