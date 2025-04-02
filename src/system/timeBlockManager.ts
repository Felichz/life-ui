import type { TimeBlock, UUID, DayMinutes, StateUpdater } from "../types";
import { UtilityService } from "./utilityService";
import type { SystemCore } from "./index";

/**
 * Gestor de bloques de tiempo del sistema Qualia Control
 * Responsable de la creación, actualización y gestión de bloques de tiempo
 * que representan franjas horarias para organizar actividades
 */
export class TimeBlockManager {
  private systemCore: SystemCore;

  /**
   * Constructor de TimeBlockManager
   * @param systemCore Instancia del núcleo del sistema
   */
  constructor(systemCore: SystemCore) {
    this.systemCore = systemCore;
    this.ensureDefaultBlockExists();
  }

  /**
   * Crea un nuevo bloque de tiempo
   * @param name Nombre del bloque
   * @param startMinute Minuto de inicio (0-1439)
   * @param endMinute Minuto de fin (0-1439)
   * @returns Bloque de tiempo creado
   * @throws Error si los parámetros son inválidos o si hay solapamiento con otros bloques
   */
  public createTimeBlock(name: string, startMinute: DayMinutes, endMinute: DayMinutes): TimeBlock {
    if (!name || name.trim() === "") {
      throw new Error("El nombre del bloque no puede estar vacío");
    }

    if (startMinute < 0 || startMinute > 1439 || endMinute < 0 || endMinute > 1439) {
      throw new Error("Los minutos deben estar entre 0 y 1439");
    }

    if (startMinute >= endMinute) {
      throw new Error("La hora de inicio debe ser anterior a la hora de fin");
    }

    // Verificar solapamiento con otros bloques
    const allBlocks = this.getTimeBlocks();
    const existingBlocks = allBlocks.filter((block) => !block.isDefault);

    // Detección de solapamiento con cualquier bloque existente
    const hasOverlap = existingBlocks.some((block) => {
      return !(endMinute <= block.startMinute || startMinute >= block.endMinute);
    });

    if (hasOverlap) {
      throw new Error("El nuevo bloque se solapa con bloques existentes");
    }

    // Determinar el orden del nuevo bloque
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

    // Actualizar estado
    this.systemCore.updateState(this.createAddTimeBlockUpdater(newBlock));

    // Importante: para los tests, necesitamos devolver el objeto creado
    return newBlock;
  }

  /**
   * Actualiza un bloque de tiempo existente
   * @param id Identificador del bloque a actualizar
   * @param data Datos a actualizar
   * @returns Bloque actualizado
   * @throws Error si el bloque no existe o si la actualización causa solapamiento
   */
  public updateTimeBlock(id: UUID, data: Partial<TimeBlock>): TimeBlock {
    const block = this.getTimeBlock(id);
    if (!block) {
      throw new Error(`No se encontró el bloque con ID: ${id}`);
    }

    // No permitir cambiar isDefault para el bloque por defecto
    if (block.isDefault && data.isDefault === false) {
      throw new Error("No se puede convertir el bloque por defecto en un bloque regular");
    }

    // Validar cambios en rango de tiempo
    const startMinute = data.startMinute !== undefined ? data.startMinute : block.startMinute;
    const endMinute = data.endMinute !== undefined ? data.endMinute : block.endMinute;

    if (startMinute < 0 || startMinute > 1439 || endMinute < 0 || endMinute > 1439) {
      throw new Error("Los minutos deben estar entre 0 y 1439");
    }

    if (startMinute >= endMinute) {
      throw new Error("La hora de inicio debe ser anterior a la hora de fin");
    }

    // Si no es el bloque por defecto, verificar solapamiento
    if (!block.isDefault) {
      const otherBlocks = this.getTimeBlocks().filter((b) => b.id !== id && !b.isDefault);
      const hasOverlap = otherBlocks.some((b) => {
        // Usar la misma lógica de solapamiento mejorada
        return !(endMinute <= b.startMinute || startMinute >= b.endMinute);
      });

      if (hasOverlap) {
        throw new Error("La actualización causa solapamiento con otros bloques");
      }
    }

    // Crear el bloque actualizado
    const updatedBlock: TimeBlock = {
      ...block,
      ...data,
      updatedAt: UtilityService.getCurrentISODateTime(),
    };

    // Actualizar estado
    this.systemCore.updateState(this.createUpdateTimeBlockUpdater(id, updatedBlock));

    // Devolver el bloque actualizado
    return updatedBlock;
  }

  /**
   * Elimina un bloque de tiempo
   * @param id Identificador del bloque a eliminar
   * @throws Error si se intenta eliminar el bloque por defecto
   */
  public deleteTimeBlock(id: UUID): void {
    const block = this.getTimeBlock(id);
    if (!block) {
      throw new Error(`No se encontró el bloque con ID: ${id}`);
    }

    if (block.isDefault) {
      throw new Error("No se puede eliminar el bloque por defecto");
    }

    this.systemCore.updateState(this.createDeleteTimeBlockUpdater(id));
  }

  /**
   * Obtiene todos los bloques de tiempo ordenados por su propiedad order
   * @returns Lista de bloques de tiempo
   */
  public getTimeBlocks(): TimeBlock[] {
    const state = this.systemCore.getState();
    const blocks = [...state.global.timeBlocks];
    return blocks.sort((a, b) => a.order - b.order);
  }

  /**
   * Obtiene un bloque de tiempo por su ID
   * @param id Identificador del bloque
   * @returns Bloque de tiempo o undefined si no existe
   */
  public getTimeBlock(id: UUID): TimeBlock | undefined {
    const state = this.systemCore.getState();
    return state.global.timeBlocks.find((block) => block.id === id);
  }

  /**
   * Obtiene el bloque de tiempo actual según la hora del sistema
   * @returns Bloque de tiempo actual o null si no hay ninguno activo
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
   * Obtiene el bloque por defecto ("Por Hacer")
   * @returns Bloque por defecto
   * @throws Error si no existe el bloque por defecto
   */
  public getDefaultBlock(): TimeBlock {
    const blocks = this.getTimeBlocks();
    const defaultBlock = blocks.find((block) => block.isDefault);

    if (!defaultBlock) {
      // Si no existe, crearlo
      return this.createDefaultBlock();
    }

    return defaultBlock;
  }

  /**
   * Verifica si un bloque de tiempo está disponible para activar actividades
   * @param blockId Identificador del bloque
   * @returns true si el bloque está disponible, false en caso contrario
   */
  public isTimeBlockAvailable(blockId: UUID): boolean {
    const block = this.getTimeBlock(blockId);
    if (!block) return false;

    // El bloque por defecto siempre está disponible
    if (block.isDefault) return true;

    // Para bloques regulares, verificar si estamos dentro de su rango horario
    const currentMinutes = UtilityService.getCurrentDayMinutes();
    return currentMinutes >= block.startMinute && currentMinutes < block.endMinute;
  }

  /**
   * Asegura que el bloque por defecto "Por Hacer" exista
   * Crea el bloque si no existe
   */
  public ensureDefaultBlockExists(): void {
    const state = this.systemCore.getState();
    const defaultBlockExists = state.global.timeBlocks.some((block) => block.isDefault);

    if (!defaultBlockExists) {
      this.createDefaultBlock();
    }
  }

  /**
   * Crea el bloque por defecto ("Por Hacer") si no existe
   * @returns Bloque por defecto creado
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
      endMinute: 1439, // Cambiar de 0 a 1439 (todo el día) para que isTimeBlockAvailable funcione correctamente
      isDefault: true,
      order: 0, // Siempre primero
      createdAt: now,
      updatedAt: now,
    };

    this.systemCore.updateState(this.createAddTimeBlockUpdater(defaultBlock));

    // Devolver el bloque creado directamente
    return defaultBlock;
  }

  /**
   * Convierte minutos a formato de hora "HH:MM"
   * @param minutes Minutos desde las 00:00 (0-1439)
   * @returns Cadena en formato "HH:MM"
   */
  public convertMinutesToTimeString(minutes: DayMinutes): string {
    return UtilityService.formatTime(minutes);
  }

  /**
   * Convierte una cadena de hora "HH:MM" a minutos
   * @param timeString Cadena en formato "HH:MM"
   * @returns Minutos desde las 00:00 (0-1439)
   */
  public convertTimeStringToMinutes(timeString: string): DayMinutes {
    return UtilityService.parseTime(timeString);
  }

  /**
   * Crea un actualizador de estado para añadir un bloque de tiempo
   * @param block Bloque a añadir
   * @returns Función actualizadora de estado
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
   * Crea un actualizador de estado para actualizar un bloque de tiempo
   * @param id Identificador del bloque a actualizar
   * @param updatedBlock Bloque actualizado completo
   * @returns Función actualizadora de estado
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
   * Crea un actualizador de estado para eliminar un bloque de tiempo
   * @param id Identificador del bloque a eliminar
   * @returns Función actualizadora de estado
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
