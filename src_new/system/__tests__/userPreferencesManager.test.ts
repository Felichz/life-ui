import { SystemCore } from "../SystemCore";
import { UserPreferencesManager } from "../userPreferencesManager";
import type { AppState, ISystemCore, UUID } from "../../types";

describe("UserPreferencesManager", () => {
  // Mock de SystemCore
  let mockSystemCore: ISystemCore;
  let userPreferencesManager: UserPreferencesManager;
  let mockState: AppState;
  const testVariableId1: UUID = "test-variable-1";
  const testVariableId2: UUID = "test-variable-2";

  beforeEach(() => {
    // Estado inicial de prueba
    mockState = {
      global: {
        days: [],
        activityTemplates: [],
        eventTemplates: [],
        subjectiveVariables: [],
        interruptionCauses: [],
        timeBlocks: [],
        userPreferences: {
          hiddenSubjectiveVariableIds: [testVariableId1],
          updatedAt: "2023-01-01T00:00:00.000Z",
        },
        completedActivityRecords: [],
        eventInstances: [],
        subjectiveVariableSnapshots: [],
      },
      currentDay: null,
    };

    // Mock de SystemCore
    mockSystemCore = {
      getState: jest.fn().mockReturnValue(mockState),
      updateState: jest.fn((updater) => {
        mockState = updater(mockState);
        return mockState;
      }),
    };

    userPreferencesManager = new UserPreferencesManager(mockSystemCore);
  });

  test("getUserPreferences debe devolver las preferencias actuales", () => {
    const preferences = userPreferencesManager.getUserPreferences();
    expect(preferences).toBe(mockState.global.userPreferences);
    expect(preferences.hiddenSubjectiveVariableIds).toContain(testVariableId1);
  });

  test("updateUserPreferences debe actualizar las preferencias correctamente", () => {
    const newPreferences = {
      hiddenSubjectiveVariableIds: [testVariableId2],
    };

    userPreferencesManager.updateUserPreferences(newPreferences);

    expect(mockSystemCore.updateState).toHaveBeenCalled();
    expect(mockState.global.userPreferences.hiddenSubjectiveVariableIds).toEqual([testVariableId2]);
    expect(mockState.global.userPreferences.updatedAt).not.toBe("2023-01-01T00:00:00.000Z");
  });

  test("toggleVariableVisibility debe mostrar una variable oculta", () => {
    userPreferencesManager.toggleVariableVisibility(testVariableId1);

    expect(mockSystemCore.updateState).toHaveBeenCalled();
    expect(mockState.global.userPreferences.hiddenSubjectiveVariableIds).not.toContain(
      testVariableId1
    );
  });

  test("toggleVariableVisibility debe ocultar una variable visible", () => {
    userPreferencesManager.toggleVariableVisibility(testVariableId2);

    expect(mockSystemCore.updateState).toHaveBeenCalled();
    expect(mockState.global.userPreferences.hiddenSubjectiveVariableIds).toContain(testVariableId2);
  });

  test("isVariableVisible debe devolver true para variables visibles", () => {
    expect(userPreferencesManager.isVariableVisible(testVariableId2)).toBe(true);
  });

  test("isVariableVisible debe devolver false para variables ocultas", () => {
    expect(userPreferencesManager.isVariableVisible(testVariableId1)).toBe(false);
  });
});
