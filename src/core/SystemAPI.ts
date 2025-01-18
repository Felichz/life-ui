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
      intrinsecProductivity: 0,
      challenges: 0,
      hobbies: 0,
      rest: 0,
      other: 0,
    },
  },
  systemParams: {
    passiveTempoConsumptionRate: 1,
  },
};

/**
 *  Interactúa con el local storage para obtener y guardar el estado del sistema
 */
class SystemAPI implements SystemAPIType {
  private getState(): PersistedState {
    const stateStr = localStorage.getItem(STORAGE_KEY);

    if (!stateStr) {
      return defaultState;
    }

    return JSON.parse(stateStr, (key, value) => {
      // Convertir strings de fecha a objetos Date
      if (key === "timestamp" || key === "value") {
        const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        if (typeof value === "string" && dateRegex.test(value)) {
          return new Date(value);
        }
      }
      return value;
    });
  }

  private saveState(state: PersistedState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  getPersistedState(): PersistedState {
    return this.getState();
  }

  getLifecycleState(): PersistedState["lifecycleState"] {
    return this.getState().lifecycleState;
  }

  startDay(currentDay: DayState) {
    const currentState = this.getState();

    this.saveState({ ...currentState, currentDay, lifecycleState: "dayInProgress" });
  }

  endDay() {
    const currentState = this.getState();

    this.saveState({ ...currentState, currentDay: undefined, lifecycleState: "dayNotStarted" });
  }

  getBoard(boardId: BoardId): Board | undefined {
    const state = this.getState();
    return state.boards[boardId];
  }

  getBoards(): Board[] {
    const state = this.getState();
    return Object.values(state.boards);
  }

  createBoard(board: Board): void {
    const state = this.getState();
    this.saveState({
      ...state,
      boards: { ...state.boards, [board.id]: board },
    });
  }

  updateBoard(board: Board): void {
    const state = this.getState();
    const existingBoard = state.boards[board.id];

    if (!existingBoard) return;

    this.saveState({
      ...state,
      boards: {
        ...state.boards,
        [board.id]: board,
      },
    });
  }

  removeBoard(board: Board): void {
    const state = this.getState();
    const { [board.id]: _, ...remainingBoards } = state.boards;
    this.saveState({ ...state, boards: remainingBoards });
  }

  getActivity(activityId: ActivityId): Activity | undefined {
    const state = this.getState();
    return state.activities[activityId];
  }

  getActivities(): Activity[] {
    const state = this.getState();
    return Object.values(state.activities);
  }

  createActivity(activity: Activity): void {
    const { parentBoardId } = activity;
    const state = this.getState();

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

    this.saveState(newState);
  }

  updateActivity(activity: Activity): void {
    const state = this.getState();

    if (!state.activities[activity.id]) return;

    this.saveState({
      ...state,
      activities: {
        ...state.activities,
        [activity.id]: activity,
      },
    });
  }

  removeActivity(activity: Activity): void {
    const state = this.getState();

    // Eliminar la referencia del board padre si existe
    if (activity.parentBoardId) {
      const parentBoard = state.boards[activity.parentBoardId];

      if (parentBoard) {
        this.updateBoard({
          ...parentBoard,
          activities: parentBoard.activities.filter((id) => id !== activity.id),
        });
      }
    }

    // Eliminar la actividad
    const { [activity.id]: _, ...remainingActivities } = state.activities;
    this.saveState({ ...state, activities: remainingActivities });
  }

  getSelectedActivity(): Activity | undefined {
    return this.getState().selectedActivity;
  }

  setSelectedActivity(activity: Activity | undefined): void {
    const state = this.getState();
    this.saveState({ ...state, selectedActivity: activity });
  }

  getTotalTempoBalance(): number {
    return this.getState().totalTempoBalance;
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

  updateTempoBalance({
    investedTimeRecord,
    tempoModificationRecord,
  }: {
    investedTimeRecord?: InvestedTimeRecord | undefined;
    tempoModificationRecord: TempoModificationRecord;
  }): void {
    const state = this.getState();

    if (!state.currentDay) return;

    // Actualizar historial de tiempo invertido
    const newInvestedTimeHistory = investedTimeRecord
      ? this.updateInvestedTimeHistory({ investedTimeRecord })
      : state.investedTimeHistory;

    // Calcular nuevos balances
    const { dayTempoBalance, totalTempoBalance } = this.calculateNewBalances({
      tempoModification: tempoModificationRecord.tempoModification,
    });

    // Guardar todos los cambios
    this.saveState({
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

  pushToInvestedTimeHistory(investedTimeRecord: InvestedTimeRecord): void {
    const state = this.getState();
    const newInvestedTimeHistory = this.updateInvestedTimeHistory({ investedTimeRecord });
    this.saveState({ ...state, investedTimeHistory: newInvestedTimeHistory });
  }

  private updateInvestedTimeHistory({
    investedTimeRecord: newRecord,
  }: {
    investedTimeRecord: InvestedTimeRecord;
  }): InvestedTimeRecord[] {
    const currentHistory = this.getInvestedTimeHistory();
    const lastRecord = currentHistory.at(-1);

    if (!lastRecord) {
      return [newRecord];
    }

    if (this.shouldUpdateLastRecord(lastRecord, newRecord)) {
      return [...currentHistory.slice(0, -1), this.mergeTimeRecords(lastRecord, newRecord)];
    }

    return [...currentHistory, newRecord];
  }

  private calculateNewBalances({ tempoModification }: { tempoModification: number }) {
    const state = this.getState();
    const currentDay = state.currentDay;

    const prevDayTempoBalance = currentDay?.dayTempoBalance ?? 0;

    return {
      totalTempoBalance: state.totalTempoBalance + tempoModification,
      dayTempoBalance: prevDayTempoBalance + tempoModification,
    };
  }

  getInvestedTimeHistory(): InvestedTimeRecord[] {
    return this.getState().investedTimeHistory;
  }

  getInvestedTimeHistoryByDay(day: Date): InvestedTimeRecord[] {
    const history = this.getInvestedTimeHistory();
    return history.filter((record) => {
      const recordDate = new Date(record.timestamp);
      return (
        recordDate.getFullYear() === day.getFullYear() &&
        recordDate.getMonth() === day.getMonth() &&
        recordDate.getDate() === day.getDate()
      );
    });
  }

  getUsefulMetrics(): UsefulMetrics {
    return this.getState().usefulMetrics;
  }

  updateUsefulMetrics({ metrics }: { metrics: UsefulMetrics }): void {
    const state = this.getState();
    this.saveState({ ...state, usefulMetrics: metrics });
  }

  getSystemParams(): SystemParams {
    return this.getState().systemParams;
  }

  updateSystemParams(params: SystemParams): void {
    const state = this.getState();
    this.saveState({ ...state, systemParams: params });
  }

  getCurrentDay(): DayState | undefined {
    return this.getState().currentDay;
  }
}

export const systemAPI = new SystemAPI();
