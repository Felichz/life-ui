import type {
  PersistedState,
  SystemAPIType,
  Board,
  Activity,
  InvestedTimeRecord,
  UsefulMetrics,
  SystemParams,
} from "./types";

const STORAGE_KEY = "system_state";

const defaultState: PersistedState = {
  lifecycleState: "dayNotStarted",
  boards: {},
  activities: {},
  totalTempoBalance: 0,
  investedTimeHistory: [],
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
 * Interactúa con el local storage para obtener y guardar el estado del sistema
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

  private setState(state: PersistedState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  getPersistedState(): PersistedState {
    return this.getState();
  }

  getLifecycleState(): "dayStarted" | "dayInProgress" | "dayNotStarted" {
    return this.getState().lifecycleState;
  }

  setLifecycleState({ state }: { state: "dayStarted" | "dayInProgress" | "dayNotStarted" }): void {
    const currentState = this.getState();
    this.setState({ ...currentState, lifecycleState: state });
  }

  getDayStartMinute(): number | undefined {
    return this.getState().dayStartMinute;
  }

  setDayStartMinute({ minute }: { minute: number }): void {
    const currentState = this.getState();
    this.setState({ ...currentState, dayStartMinute: minute });
  }

  getBoard({ boardId }: { boardId: string }): Board | undefined {
    const state = this.getState();
    return state.boards[boardId];
  }

  getBoards(): Board[] {
    const state = this.getState();
    return Object.values(state.boards);
  }

  createBoard(board: Board): void {
    const state = this.getState();
    this.setState({
      ...state,
      boards: { ...state.boards, [board.id]: board },
    });
  }

  updateBoard({ boardId, board }: { boardId: string; board: Partial<Board> }): void {
    const state = this.getState();
    const existingBoard = state.boards[boardId];
    if (!existingBoard) return;

    this.setState({
      ...state,
      boards: {
        ...state.boards,
        [boardId]: { ...existingBoard, ...board },
      },
    });
  }

  removeBoard({ boardId }: { boardId: string }): void {
    const state = this.getState();
    const { [boardId]: _, ...remainingBoards } = state.boards;
    this.setState({ ...state, boards: remainingBoards });
  }

  getActivity({ activityId }: { activityId: string }): Activity | undefined {
    const state = this.getState();
    return state.activities[activityId];
  }

  getActivities(): Activity[] {
    const state = this.getState();
    return Object.values(state.activities);
  }

  createActivity(activity: Activity): void {
    const state = this.getState();
    this.setState({
      ...state,
      activities: { ...state.activities, [activity.id]: activity },
    });
  }

  updateActivity({
    activityId,
    activity,
  }: {
    activityId: string;
    activity: Partial<Activity>;
  }): void {
    const state = this.getState();
    const existingActivity = state.activities[activityId];
    if (!existingActivity) return;

    this.setState({
      ...state,
      activities: {
        ...state.activities,
        [activityId]: { ...existingActivity, ...activity },
      },
    });
  }

  removeActivity({ activityId }: { activityId: string }): void {
    const state = this.getState();
    const { [activityId]: _, ...remainingActivities } = state.activities;
    this.setState({ ...state, activities: remainingActivities });
  }

  getSelectedActivity(): Activity | undefined {
    return this.getState().selectedActivity;
  }

  setSelectedActivity({ activity }: { activity: Activity | undefined }): void {
    const state = this.getState();
    this.setState({ ...state, selectedActivity: activity });
  }

  getTotalTempoBalance(): number {
    return this.getState().totalTempoBalance;
  }

  updateTotalTempoBalance({
    amount,
    investedTimeRecord,
  }: {
    amount: number;
    investedTimeRecord: InvestedTimeRecord;
  }): void {
    const state = this.getState();

    this.setState({
      ...state,
      totalTempoBalance: amount,
      investedTimeHistory: [...state.investedTimeHistory, investedTimeRecord],
    });
  }

  getInvestedTimeHistory(): InvestedTimeRecord[] {
    return this.getState().investedTimeHistory;
  }

  getInvestedTimeHistoryByDay({ day }: { day: Date }): InvestedTimeRecord[] {
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
    this.setState({ ...state, usefulMetrics: metrics });
  }

  getSystemParams(): SystemParams {
    return this.getState().systemParams;
  }

  updateSystemParams(params: SystemParams): void {
    const state = this.getState();
    this.setState({ ...state, systemParams: params });
  }
}

export const systemAPI = new SystemAPI();
