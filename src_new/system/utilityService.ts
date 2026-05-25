import { v4 as uuidv4 } from "uuid";
import type { UUID, ISODateTimeString, DayMinutes } from "../types";

/**
 * Shared utility services for Qualia Control.
 * Modernized version using updated web APIs.
 */
export class UtilityService {
    /**
     * Generates a unique UUID v4
     */
    public static generateUUID(): UUID {
        // If we're in a modern browser context, crypto.randomUUID is much faster natively
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return uuidv4();
    }

    /**
     * Gets current date/time in ISO 8601 format
     */
    public static getCurrentISODateTime(): ISODateTimeString {
        return new Date().toISOString();
    }

    /**
     * Calculates minutes elapsed since 00:00 today (0-1439)
     */
    public static getCurrentDayMinutes(): DayMinutes {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    }

    /**
     * Formats duration in minutes to human readable (e.g., "1h 30m")
     */
    public static formatDuration(minutes: number): string {
        if (isNaN(minutes) || minutes < 0) {
            throw new Error("Minutes must be a positive number");
        }

        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        if (hours === 0) return `${mins}m`;
        if (mins === 0) return `${hours}h`;
        return `${hours}h ${mins}m`;
    }

    /**
     * Formats DayMinutes to "HH:MM"
     */
    public static formatTime(dayMinutes: DayMinutes): string {
        if (isNaN(dayMinutes) || dayMinutes < 0 || dayMinutes >= 24 * 60) {
            throw new Error("Day minutes must be between 0 and 1439");
        }

        const hoursStr = Math.floor(dayMinutes / 60).toString().padStart(2, "0");
        const minutesStr = (dayMinutes % 60).toString().padStart(2, "0");
        return `${hoursStr}:${minutesStr}`;
    }

    /**
     * Parses "HH:MM" string back to DayMinutes (0-1439)
     */
    public static parseTime(timeString: string): DayMinutes {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (!timeRegex.test(timeString)) {
            throw new Error('Invalid time format. Expected "HH:MM"');
        }

        const [hours, minutes] = timeString.split(":").map(Number);
        return hours * 60 + minutes;
    }

    /**
     * Native deep copy using modern structuredClone.
     * Fallback to JSON for extremely old environments, though structuredClone is standard now.
     */
    public static deepCopy<T>(obj: T): T {
        if (obj === null || typeof obj !== "object") return obj;

        if (obj instanceof Date) {
            return new Date(obj.getTime()) as any;
        }

        if (Array.isArray(obj)) {
            const arrCopy = [];
            for (let i = 0; i < obj.length; i++) {
                arrCopy[i] = UtilityService.deepCopy(obj[i]);
            }
            return arrCopy as any;
        }

        const objCopy: any = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                objCopy[key] = UtilityService.deepCopy((obj as any)[key]);
            }
        }
        return objCopy;
    }
}
