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
  ChallengeActivity,
  NeutralActivity,
  HobbyActivity,
  BoardChallengeConstraint,
  ChallengeConstraint,
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

  // Cada vez que se modifica un board (al actualizar con la funcion `updateBoard`), se deben sincronizar los constraint de todos los desafios de este board, o cuando se crea una nueva actividad dentro de un board se deben actualizar todos los constraint desde el board root, y esta es la funcion encargada de hacer eso, esta funcion recibe un board y se encarga de actualizar todos los constraint haciendo un proceso recursivo hacia dentro, osea incluyendo sub boards
  // En cuanto a la implementacion, esta funcion debe hacer un analisis recursivo adentrandose en cada sub board (cada iteracion procesa un unico board), debemos asegurarnos de ir guardando los constraint del board actual y pasarlos a la siguiente iteracion recursiva, porque necesitamos esta informacion para saber que constraints debemos enviar hacia cada desafio, ya que esto funciona como herencia
  // Osea, en cada iteracion recursiva, tendremos a mano todos los constraints del board actual (`board.activityProps.challenge.constraintList`) y todos los constraint de los board padres que fueron enviados desde iteraciones anteriores, podemos ir guardando esto dentro de una variable llamada `allInheritedConstraints`
  // Luego en cada una de estas iteraciones, debemos filtrar todas las actividades de tipo challenge del board actual, y para cada uno de estos desaifos, debemos actualizar su `constraintList` de la siguiente manera:
  //   1. Para cada constraint del desafio, se debe verificar si el `parentConstraintId` existe como `id` en algun constraint de `allInheritedConstraints`
  //   2. En caso de que exista, se debe reemplazar el constraint del desafio por el constraint original de `allInheritedConstraints`, actualmente las constraint heredables osea las constraint de un board tienen las propiedades `id`, `type`, y `penalty`, en el caso del constraint del desafio, este puede tener propiedades especificas de la instancia como `failCount` o `status`, asi que lo que tenemos que hacer en esta funcion es actualizar solo unas propiedades especificas que son `type` y `penalty` ya que estas son las que se heredan
  //   3. En caso de que un constraint tenga un `parentConstraintId` que no exista como `id` dentro de `allInheritedConstraints`, se debe eliminar el constraint del challenge, ya que esto significaria que el constraint original fue eliminado del board original
  // Luego debemos iterar sobre `allInheritedConstraints` y revisar si el `id` de alguno de estos constraint no existe dentro de los constraint del challenge como `parentConstraintId`, en caso de que aun no exista debemos crear el constraint desde 0 en el desafio, asi que debemos crearle una nueva `id` propia, debemos crearle el `parentConstraintId` basado en el `id` del constraint original de `allInheritedConstraints`, debemos definir `failCount` en 0, y `status` en
  async _syncBoardInheritableChallengeConstraints(board: Board): Promise<void> {
    const state = await this.getState();

    const processBoard = async (
      currentBoard: Board,
      allInheritedConstraints: BoardChallengeConstraint[] = []
    ) => {
      // Combinar constraints heredados con los del board actual
      const currentBoardConstraints = currentBoard.constraintList;
      const combinedConstraints = [...allInheritedConstraints, ...currentBoardConstraints];

      // Obtener los challenges del board actual
      const childChallenges = currentBoard.activities
        .map((id) => state.activities[id])
        .filter((activity) => activity.type === "challenge");

      // Actualizar los constraints de cada challenge
      for (const challenge of childChallenges) {
        const updatedConstraints: ChallengeConstraint[] = [];

        for (const constraint of challenge.constraintList) {
          if (constraint.parentConstraintId) {
            // Buscar el constraint heredado correspondiente
            const inheritedConstraint = allInheritedConstraints.find(
              (ic) => ic.id === constraint.parentConstraintId
            );

            if (inheritedConstraint) {
              // Actualizar type, penalty, y dayMinuteExpiration (basicamente todas las propeidades heredables menos el id)
              updatedConstraints.push({
                ...constraint,
                ...inheritedConstraint,
                id: constraint.id,
              });
            }
            // Si no existe, no se agrega (se elimina)
          } else {
            // Mantener constraints sin parent
            updatedConstraints.push(constraint);
          }
        }

        // Agregar constraints heredados que no estén presentes
        for (const inheritedConstraint of allInheritedConstraints) {
          const exists = updatedConstraints.some(
            (uc) => uc.parentConstraintId === inheritedConstraint.id
          );

          if (!exists) {
            updatedConstraints.push({
              ...inheritedConstraint,
              id: crypto.randomUUID(),
              parentConstraintId: inheritedConstraint.id,
              failCount: 0,
              status: "active",
            });
          }
        }

        // Actualizar el challenge con los nuevos constraints
        challenge.constraintList = updatedConstraints;

        await this.updateActivity(challenge);
      }

      // Procesar recursivamente solo los hijos directos
      if (currentBoard.childrenBoards) {
        for (const childBoardId of currentBoard.childrenBoards) {
          const childBoard = state.boards[childBoardId];
          if (childBoard) {
            await processBoard(childBoard, combinedConstraints);
          }
        }
      }
    };

    await processBoard(board);
  }

  // Function recursiva que busca el board padre de un board y luego busca el padre de este board, y asi sucesivamente hasta que no haya mas boards padres, basicamente retorna el board root de la actividad. Si el board no tiene padre, retorna el mismo board
  async _getRootBoard(board: Board): Promise<Board> {
    if (!board.parentBoardId) return board;

    const parentBoard = await this.getBoard(board.parentBoardId);

    if (!parentBoard) return board;

    if (!parentBoard.parentBoardId) return parentBoard;

    return this._getRootBoard(parentBoard);
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

    await this._syncBoardInheritableChallengeConstraints(board);
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

    if (!parentBoardId) return;

    // Si se proporciona un parentBoardId, actualizar el tablero correspondiente
    const parentBoard = newState.boards[parentBoardId];

    newState.boards[parentBoardId] = {
      ...parentBoard,
      activities: [...(parentBoard.activities || []), activity.id],
    };

    await this.saveState(newState);

    // Sincronizar nuevamente los constraints desde el board root ya que la actividad puede heredar constraints desde el board root
    const rootBoard = await this._getRootBoard(parentBoard);

    await this._syncBoardInheritableChallengeConstraints(rootBoard);
  }

  async updateActivity(activityUpdates: Partial<Activity> & { id: ActivityId }): Promise<void> {
    console.log("systemApi updateActivity", activityUpdates);
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
