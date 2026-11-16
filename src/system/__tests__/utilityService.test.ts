import { UtilityService } from "../utilityService";

describe("UtilityService", () => {
  // UUID generation test
  describe("generateUUID", () => {
    it("generates a valid UUID", () => {
      const uuid = UtilityService.generateUUID();
      expect(uuid).toBeDefined();
      // Validate the UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it("generates unique UUIDs on consecutive calls", () => {
      const uuid1 = UtilityService.generateUUID();
      const uuid2 = UtilityService.generateUUID();
      expect(uuid1).not.toEqual(uuid2);
    });
  });

  // getCurrentISODateTime test
  describe("getCurrentISODateTime", () => {
    it("returns a date in ISO format", () => {
      const isoDateTime = UtilityService.getCurrentISODateTime();
      expect(isoDateTime).toBeDefined();
      // Validate ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(isoDateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });
  });

  // getCurrentDayMinutes test
  describe("getCurrentDayMinutes", () => {
    it("returns a number between 0 and 1439", () => {
      const dayMinutes = UtilityService.getCurrentDayMinutes();
      expect(dayMinutes).toBeDefined();
      expect(dayMinutes).toBeGreaterThanOrEqual(0);
      expect(dayMinutes).toBeLessThan(24 * 60);
    });

    it("computes the day minutes correctly", () => {
      // Mock the current date for a deterministic test
      const mockDate = new Date(2023, 0, 1, 14, 30); // 14:30
      jest.spyOn(global, "Date").mockImplementation(() => mockDate);

      const dayMinutes = UtilityService.getCurrentDayMinutes();
      expect(dayMinutes).toEqual(14 * 60 + 30); // 870 minutes

      // Restore the original Date
      jest.restoreAllMocks();
    });
  });

  // formatDuration test
  describe("formatDuration", () => {
    it("formats minutes only correctly", () => {
      expect(UtilityService.formatDuration(30)).toEqual("30m");
    });

    it("formats hours only correctly", () => {
      expect(UtilityService.formatDuration(120)).toEqual("2h");
    });

    it("formats hours and minutes correctly", () => {
      expect(UtilityService.formatDuration(90)).toEqual("1h 30m");
    });

    it("throws for negative values", () => {
      expect(() => UtilityService.formatDuration(-10)).toThrow();
    });

    it("throws for NaN values", () => {
      expect(() => UtilityService.formatDuration(NaN)).toThrow();
    });
  });

  // formatTime test
  describe("formatTime", () => {
    it("formats minutes as time correctly", () => {
      expect(UtilityService.formatTime(0)).toEqual("00:00");
      expect(UtilityService.formatTime(60)).toEqual("01:00");
      expect(UtilityService.formatTime(90)).toEqual("01:30");
      expect(UtilityService.formatTime(870)).toEqual("14:30");
      expect(UtilityService.formatTime(1439)).toEqual("23:59");
    });

    it("throws for out-of-range values", () => {
      expect(() => UtilityService.formatTime(-1)).toThrow();
      expect(() => UtilityService.formatTime(1440)).toThrow();
    });

    it("throws for NaN values", () => {
      expect(() => UtilityService.formatTime(NaN)).toThrow();
    });
  });

  // parseTime test
  describe("parseTime", () => {
    it("converts a string to minutes correctly", () => {
      expect(UtilityService.parseTime("00:00")).toEqual(0);
      expect(UtilityService.parseTime("01:00")).toEqual(60);
      expect(UtilityService.parseTime("01:30")).toEqual(90);
      expect(UtilityService.parseTime("14:30")).toEqual(870);
      expect(UtilityService.parseTime("23:59")).toEqual(1439);
    });

    it("accepts formats without leading zeros", () => {
      expect(UtilityService.parseTime("1:30")).toEqual(90);
      expect(UtilityService.parseTime("9:05")).toEqual(545);
    });

    it("throws for invalid formats", () => {
      expect(() => UtilityService.parseTime("24:00")).toThrow();
      expect(() => UtilityService.parseTime("12:60")).toThrow();
      expect(() => UtilityService.parseTime("abc")).toThrow();
      expect(() => UtilityService.parseTime("12-30")).toThrow();
    });
  });

  // deepCopy test
  describe("deepCopy", () => {
    it("makes a deep copy of an object", () => {
      const original = {
        a: 1,
        b: { c: 2, d: [3, 4, 5] },
        e: new Date(),
      };

      const copy = UtilityService.deepCopy(original);

      // Verify it is a copy and not the same object
      expect(copy).toEqual(original);
      expect(copy).not.toBe(original);
      expect(copy.b).not.toBe(original.b);
      expect(copy.b.d).not.toBe(original.b.d);

      // Modifying the original does not affect the copy
      original.a = 10;
      original.b.c = 20;
      original.b.d[0] = 30;

      expect(copy.a).toBe(1);
      expect(copy.b.c).toBe(2);
      expect(copy.b.d[0]).toBe(3);
    });

    it("handles primitive types", () => {
      expect(UtilityService.deepCopy(123)).toBe(123);
      expect(UtilityService.deepCopy("test")).toBe("test");
      expect(UtilityService.deepCopy(true)).toBe(true);
      expect(UtilityService.deepCopy(null)).toBe(null);
      expect(UtilityService.deepCopy(undefined)).toBe(undefined);
    });
  });

  // Schema v2+: calculateBeatEstimate
  describe("calculateBeatEstimate", () => {
    it("does NOT apply a bonus for flexible-duration even with an estimate", () => {
      // Even though flexible-duration has a 5-10 min range, no bonus applies
      const beatsEstimate = UtilityService.calculateBeatEstimate("flexible-duration", 4, 10);
      expect(beatsEstimate).toBe(false);
    });

    it("does NOT apply a bonus for timeboxing even with an estimate", () => {
      const beatsEstimate = UtilityService.calculateBeatEstimate("timeboxing", 5, 10);
      expect(beatsEstimate).toBe(false);
    });

    it("DOES apply a bonus for clear-objective when duration <= 80% of the estimate", () => {
      // 45 min estimated, 30 min actual (66%) → bonus applies
      expect(UtilityService.calculateBeatEstimate("clear-objective", 30, 45)).toBe(true);
      // Exact boundary case: 36 min of 45 (80%)
      expect(UtilityService.calculateBeatEstimate("clear-objective", 36, 45)).toBe(true);
    });

    it("does NOT apply a bonus for clear-objective when duration > 80% of the estimate", () => {
      // 37 min of 45 (82%) → no bonus
      expect(UtilityService.calculateBeatEstimate("clear-objective", 37, 45)).toBe(false);
    });

    it("does NOT apply a bonus if duration is 0", () => {
      expect(UtilityService.calculateBeatEstimate("clear-objective", 0, 45)).toBe(false);
    });

    it("does NOT apply a bonus if estimated is 0 or undefined", () => {
      expect(UtilityService.calculateBeatEstimate("clear-objective", 30, 0)).toBe(false);
      expect(UtilityService.calculateBeatEstimate("clear-objective", 30, undefined)).toBe(false);
    });

    it("does NOT apply a bonus if estimated is negative", () => {
      expect(UtilityService.calculateBeatEstimate("clear-objective", 30, -5)).toBe(false);
    });
  });
});
