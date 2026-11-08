import type { TimeBlock, UUID, DayMinutes, StateUpdater } from "../types";
import { UtilityService } from "./utilityService";
import type { SystemCore } from "./index";
import { CoreError } from "./errors";

/**
 * Time block manager for the LifeUI system
 * Responsible for creating, updating and managing time blocks,
 * which represent time slots for organizing activities
 */
export class TimeBlockManager {
  private systemCore: SystemCore;

  /**
   * TimeBlockManager constructor
   * @param systemCore System core instance
   */
  constructor(systemCore: SystemCore) {
    this.systemCore = systemCore;
    this.ensureDefaultBlockExists();
  }

  /**
   * Creates a new time block
   * @param name Block name
   * @param startMinute Start minute (0-1439)
   * @param endMinute End minute (0-1439)
   * @returns The created time block
   * @throws Error if the parameters are invalid or the block overlaps other blocks
   */
  public createTimeBlock(name: string, startMinute: DayMinutes, endMinute: DayMinutes): TimeBlock {
    if (!name || name.trim() === "") {
      throw new CoreError("block-name-empty");
    }

    if (startMinute < 0 || startMinute > 1439 || endMinute < 0 || endMinute > 1439) {
      throw new CoreError("minutes-out-of-range");
    }

    if (startMinute >= endMinute) {
      throw new CoreError("block-start-after-end");
    }

    // Check for overlap with other blocks
    const allBlocks = this.getTimeBlocks();
    const existingBlocks = allBlocks.filter((block) => !block.isDefault);

    // Detect overlap with any existing block
    const hasOverlap = existingBlocks.some((block) => {
      return !(endMinute <= block.startMinute || startMinute >= block.endMinute);
    });

    if (hasOverlap) {
      throw new CoreError("block-overlap");
    }

    // Determine the order of the new block
    const existingOrder = allBlocks.map((block) => block.order);
    const nextOrder = existingOrder.length > 0 ? Math.max(...existingOrder) + 1 : 1;

    const now = UtilityService.getCurrentISODateTime();
    const newBlock: TimeBlock = {
      id: UtilityService.generateUUID(),
      name,
      startMinute,
      endMinute,
      isDefault: false,
      order: nextOrder,
      createdAt: now,
      updatedAt: now,
    };

    // Update state
    this.systemCore.updateState(this.createAddTimeBlockUpdater(newBlock));

    // Important: the tests need the created object to be returned
    return newBlock;
  }

  /**
   * Updates an existing time block
   * @param id ID of the block to update
   * @param data Data to update
   * @returns The updated block
   * @throws Error if the block does not exist or the update causes an overlap
   */
  public updateTimeBlock(id: UUID, data: Partial<TimeBlock>): TimeBlock {
    const block = this.getTimeBlock(id);
    if (!block) {
      throw new CoreError("block-not-found", `id ${id}`);
    }

    // Do not allow changing isDefault on the default block
    if (block.isDefault && data.isDefault === false) {
      throw new CoreError("default-block-protected");
    }

    // Validate time range changes
    const startMinute = data.startMinute !== undefined ? data.startMinute : block.startMinute;
    const endMinute = data.endMinute !== undefined ? data.endMinute : block.endMinute;

    if (startMinute < 0 || startMinute > 1439 || endMinute < 0 || endMinute > 1439) {
      throw new CoreError("minutes-out-of-range");
    }

    if (startMinute >= endMinute) {
      throw new CoreError("block-start-after-end");
    }

    // If it is not the default block, check for overlap
    if (!block.isDefault) {
      const otherBlocks = this.getTimeBlocks().filter((b) => b.id !== id && !b.isDefault);
      const hasOverlap = otherBlocks.some((b) => {
        // Use the same improved overlap logic
        return !(endMinute <= b.startMinute || startMinute >= b.endMinute);
      });

      if (hasOverlap) {
        throw new CoreError("block-overlap");
      }
    }

    // Build the updated block
    const updatedBlock: TimeBlock = {
      ...block,
      ...data,
      updatedAt: UtilityService.getCurrentISODateTime(),
    };

    // Update state
    this.systemCore.updateState(this.createUpdateTimeBlockUpdater(id, updatedBlock));

    // Return the updated block
    return updatedBlock;
  }

  /**
   * Deletes a time block
   * @param id ID of the block to delete
   * @param moveActivitiesToTodo If true, moves the activities to the default block; if false, deletes them
   * @throws Error when trying to delete the default block
   */
  public deleteTimeBlock(id: UUID, moveActivitiesToTodo: boolean = true): void {
    const block = this.getTimeBlock(id);
    if (!block) {
      throw new CoreError("block-not-found", `id ${id}`);
    }

    if (block.isDefault) {
      throw new CoreError("default-block-protected");
    }

    // Move or delete activities assigned to this block
    const state = this.systemCore.getState();
    if (state.currentDay) {
      const activities = state.currentDay.activityInstances.filter((a) => a.blockId === id);
      if (activities.length > 0) {
        if (moveActivitiesToTodo) {
          // Move activities to the default block
          const defaultBlock = this.getDefaultBlock();
          this.systemCore.updateState((prevState) => {
            if (!prevState.currentDay) return prevState;
            return {
              ...prevState,
              currentDay: {
                ...prevState.currentDay,
                activityInstances: prevState.currentDay.activityInstances.map((a) =>
                  a.blockId === id ? { ...a, blockId: defaultBlock.id } : a
                ),
              },
            };
          });
        } else {
          // Delete this block's activities
          this.systemCore.updateState((prevState) => {
            if (!prevState.currentDay) return prevState;
            return {
              ...prevState,
              currentDay: {
                ...prevState.currentDay,
                activityInstances: prevState.currentDay.activityInstances.filter(
                  (a) => a.blockId !== id
                ),
              },
            };
          });
        }
      }
    }

    // Finally, delete the block
    this.systemCore.updateState(this.createDeleteTimeBlockUpdater(id));
  }

  /**
   * Gets all time blocks sorted by their order property
   * @returns List of time blocks
   */
  public getTimeBlocks(): TimeBlock[] {
    const state = this.systemCore.getState();
    const blocks = [...state.global.timeBlocks];
    return blocks.sort((a, b) => a.order - b.order);
  }

  /**
   * Gets a time block by its ID
   * @param id Block ID
   * @returns The time block, or undefined if it does not exist
   */
  public getTimeBlock(id: UUID): TimeBlock | undefined {
    const state = this.systemCore.getState();
    return state.global.timeBlocks.find((block) => block.id === id);
  }

  /**
   * Gets the current time block based on the system time
   * @returns The current time block, or null if none is active
   */
  public getCurrentTimeBlock(): TimeBlock | null {
    const currentMinutes = UtilityService.getCurrentDayMinutes();
    const blocks = this.getTimeBlocks();

    for (const block of blocks) {
      if (
        !block.isDefault &&
        currentMinutes >= block.startMinute &&
        currentMinutes < block.endMinute
      ) {
        return block;
      }
    }

    return null;
  }

  /**
   * Gets the default block ("Por Hacer")
   * @returns The default block
   * @throws Error if the default block does not exist
   */
  public getDefaultBlock(): TimeBlock {
    const blocks = this.getTimeBlocks();
    const defaultBlock = blocks.find((block) => block.isDefault);

    if (!defaultBlock) {
      // If it does not exist, create it
      return this.createDefaultBlock();
    }

    return defaultBlock;
  }

  /**
   * Checks whether a time block is available for activating activities
   * @param blockId Block ID
   * @returns true if the block is available, false otherwise
   */
  public isTimeBlockAvailable(blockId: UUID): boolean {
    const block = this.getTimeBlock(blockId);
    if (!block) return false;

    // The default block is always available
    if (block.isDefault) return true;

    // For regular blocks, check whether we are within their time range
    const currentMinutes = UtilityService.getCurrentDayMinutes();
    return currentMinutes >= block.startMinute && currentMinutes < block.endMinute;
  }

  /**
   * Checks whether a time block exists, ignoring time restrictions
   * This allows placing activities in blocks outside their time range
   * @param blockId Block ID
   * @returns true if the block exists, false otherwise
   */
  public isTimeBlockExisting(blockId: UUID): boolean {
    const block = this.getTimeBlock(blockId);
    return !!block; // Returns true if the block exists, regardless of its time range
  }

  /**
   * Ensures the default "Por Hacer" block exists
   * Creates the block if it does not exist
   */
  public ensureDefaultBlockExists(): void {
    const state = this.systemCore.getState();
    const defaultBlockExists = state.global.timeBlocks.some((block) => block.isDefault);

    if (!defaultBlockExists) {
      this.createDefaultBlock();
    }
  }

  /**
   * Creates the default block ("Por Hacer") if it does not exist
   * @returns The created default block
   */
  public createDefaultBlock(): TimeBlock {
    const blocks = this.getTimeBlocks();
    const existingDefaultBlock = blocks.find((block) => block.isDefault);

    if (existingDefaultBlock) {
      return existingDefaultBlock;
    }

    const now = UtilityService.getCurrentISODateTime();
    const defaultBlock: TimeBlock = {
      id: UtilityService.generateUUID(),
      name: "Por Hacer",
      startMinute: 0,
      endMinute: 1439, // Changed from 0 to 1439 (whole day) so isTimeBlockAvailable works correctly
      isDefault: true,
      order: 0, // Always first
      createdAt: now,
      updatedAt: now,
    };

    this.systemCore.updateState(this.createAddTimeBlockUpdater(defaultBlock));

    // Return the created block directly
    return defaultBlock;
  }

  /**
   * Converts minutes to "HH:MM" time format
   * @param minutes Minutes since 00:00 (0-1439)
   * @returns String in "HH:MM" format
   */
  public convertMinutesToTimeString(minutes: DayMinutes): string {
    return UtilityService.formatTime(minutes);
  }

  /**
   * Converts an "HH:MM" time string to minutes
   * @param timeString String in "HH:MM" format
   * @returns Minutes since 00:00 (0-1439)
   */
  public convertTimeStringToMinutes(timeString: string): DayMinutes {
    return UtilityService.parseTime(timeString);
  }

  /**
   * Creates a state updater that adds a time block
   * @param block Block to add
   * @returns State updater function
   */
  private createAddTimeBlockUpdater(block: TimeBlock): StateUpdater {
    return (state) => {
      return {
        ...state,
        global: {
          ...state.global,
          timeBlocks: [...state.global.timeBlocks, block],
        },
      };
    };
  }

  /**
   * Creates a state updater that updates a time block
   * @param id ID of the block to update
   * @param updatedBlock The full updated block
   * @returns State updater function
   */
  private createUpdateTimeBlockUpdater(id: UUID, updatedBlock: TimeBlock): StateUpdater {
    return (state) => {
      const updatedBlocks = state.global.timeBlocks.map((block) => {
        if (block.id === id) {
          return updatedBlock;
        }
        return block;
      });

      return {
        ...state,
        global: {
          ...state.global,
          timeBlocks: updatedBlocks,
        },
      };
    };
  }

  /**
   * Creates a state updater that deletes a time block
   * @param id ID of the block to delete
   * @returns State updater function
   */
  private createDeleteTimeBlockUpdater(id: UUID): StateUpdater {
    return (state) => {
      return {
        ...state,
        global: {
          ...state.global,
          timeBlocks: state.global.timeBlocks.filter((block) => block.id !== id),
        },
      };
    };
  }
}
