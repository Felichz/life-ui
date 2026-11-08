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

  // Schema v2+: calculateTemposAwarded (linear MVP v3.1 formula)
  // tempos = ceil(baseMinutes × score / 7)
  // score 0 → 0, score 1 → 14%, score 7 → 100%, score 10 → 143%
  describe("calculateTemposAwarded (linear MVP v3.1 formula)", () => {
    it("score 5 + 30 min estimate → 22 tempos (user's example)", () => {
      // ceil(30 × 5 / 7) = ceil(21.43) = 22
      expect(UtilityService.calculateTemposAwarded(30, 5, 30)).toBe(22);
    });

    it("score 1 + 30 min estimate → 5 tempos (user's example)", () => {
      // ceil(30 × 1 / 7) = ceil(4.28) = 5
      expect(UtilityService.calculateTemposAwarded(30, 1, 30)).toBe(5);
    });

    it("score 7 + 30 min estimate → 30 tempos (100%)", () => {
      // ceil(30 × 7 / 7) = ceil(30) = 30
      expect(UtilityService.calculateTemposAwarded(30, 7, 30)).toBe(30);
    });

    it("score 10 + 30 min estimate → 43 tempos (143%)", () => {
      // ceil(30 × 10 / 7) = ceil(42.86) = 43
      expect(UtilityService.calculateTemposAwarded(30, 10, 30)).toBe(43);
    });

    it("uses the estimate (not the actual duration) when there is an estimate", () => {
      // low actual duration (just started) but the estimate is 45
      // score 7: ceil(45 × 7 / 7) = 45
      expect(UtilityService.calculateTemposAwarded(2, 7, 45)).toBe(45);
    });

    it("without an estimate: uses the actual duration", () => {
      // flexible-duration without an estimate → ceil(25 × 7 / 7) = 25
      expect(UtilityService.calculateTemposAwarded(25, 7, undefined)).toBe(25);
    });

    it("score 0 → 0 tempos (not completed)", () => {
      expect(UtilityService.calculateTemposAwarded(30, 0, 30)).toBe(0);
    });

    it("BUG FIX: duration 0 with a valid estimate → uses the estimate (not 0)", () => {
      // If the activity was active for less than 1 minute and Math.round
      // returns 0, we must NOT return 0 tempos when there is an estimate.
      // score 10 + estimate 30: ceil(30 × 10 / 7) = 43
      expect(UtilityService.calculateTemposAwarded(0, 10, 30)).toBe(43);
      // score 7 + estimate 45: ceil(45 × 7 / 7) = 45
      expect(UtilityService.calculateTemposAwarded(0, 7, 45)).toBe(45);
    });

    it("duration 0 without an estimate → 0 tempos (no valid base)", () => {
      expect(UtilityService.calculateTemposAwarded(0, 10, undefined)).toBe(0);
      expect(UtilityService.calculateTemposAwarded(0, 10, 0)).toBe(0);
    });

    it("negative duration → 0 tempos (sanity)", () => {
      expect(UtilityService.calculateTemposAwarded(-10, 10, 30)).toBe(0);
    });

    it("invalid score (>10) → 0 tempos", () => {
      expect(UtilityService.calculateTemposAwarded(45, 11, 30)).toBe(0);
    });

    it("invalid score (<0) → 0 tempos", () => {
      expect(UtilityService.calculateTemposAwarded(45, -1, 30)).toBe(0);
    });

    it("fractional score (non-integer) → 0 tempos", () => {
      expect(UtilityService.calculateTemposAwarded(45, 7.5, 30)).toBe(0);
    });

    it("estimate 0 or negative: falls back to the actual duration", () => {
      // estimate 0 is not valid, uses the actual duration
      // ceil(20 × 7 / 7) = 20
      expect(UtilityService.calculateTemposAwarded(20, 7, 0)).toBe(20);
      expect(UtilityService.calculateTemposAwarded(20, 7, -5)).toBe(20);
    });

    it("extreme case: score 10, 120 min estimate → 172 tempos", () => {
      // ceil(120 × 10 / 7) = ceil(171.43) = 172
      expect(UtilityService.calculateTemposAwarded(120, 10, 120)).toBe(172);
    });

    it("linear scale: each slider point adds ~14% of the base", () => {
      // For base=30: score N → ceil(30 × N / 7)
      // score 1 → 5, score 2 → 9, score 3 → 13, score 4 → 18, score 5 → 22
      // score 6 → 26, score 7 → 30, score 8 → 35, score 9 → 39, score 10 → 43
      const expected = [5, 9, 13, 18, 22, 26, 30, 35, 39, 43];
      for (let s = 1; s <= 10; s++) {
        expect(UtilityService.calculateTemposAwarded(30, s, 30)).toBe(expected[s - 1]);
      }
    });
  });

  // Helper shared between core and UI (CompletionModal) for the live
  // preview. Guarantee: calculatePreviewTempos(N, base) === result of the
  // final calculation with that base. If the formula changes, the preview
  // updates automatically.
  describe("calculatePreviewTempos (shared preview ↔ core helper)", () => {
    it("score 5 + base 30 → 22 tempos (user's example)", () => {
      expect(UtilityService.calculatePreviewTempos(5, 30)).toBe(22);
    });

    it("score 1 + base 30 → 5 tempos", () => {
      expect(UtilityService.calculatePreviewTempos(1, 30)).toBe(5);
    });

    it("score 7 + base 30 → 30 tempos (100%)", () => {
      expect(UtilityService.calculatePreviewTempos(7, 30)).toBe(30);
    });

    it("score 10 + base 30 → 43 tempos (143%)", () => {
      expect(UtilityService.calculatePreviewTempos(10, 30)).toBe(43);
    });

    it("score 0 → 0 tempos", () => {
      expect(UtilityService.calculatePreviewTempos(0, 30)).toBe(0);
    });

    it("base 0 or negative → 0 tempos", () => {
      expect(UtilityService.calculatePreviewTempos(10, 0)).toBe(0);
      expect(UtilityService.calculatePreviewTempos(10, -5)).toBe(0);
    });

    it("invalid score (>10, <0, non-integer) → 0 tempos", () => {
      expect(UtilityService.calculatePreviewTempos(11, 30)).toBe(0);
      expect(UtilityService.calculatePreviewTempos(-1, 30)).toBe(0);
      expect(UtilityService.calculatePreviewTempos(7.5, 30)).toBe(0);
    });

    it("INVARIANT: preview === calculateTemposAwarded(score, base, base)", () => {
      // The preview ALWAYS matches the final calculation when the same
      // base is used (estimate when present, duration otherwise).
      for (const score of [7, 8, 9, 10]) {
        for (const base of [10, 25, 30, 60, 120]) {
          const preview = UtilityService.calculatePreviewTempos(score, base);
          // estimatedMinutes === base simulates the case where the actual
          // duration matches the estimate.
          const finalT = UtilityService.calculateTemposAwarded(base, score, base);
          expect(preview).toBe(finalT);
        }
      }
    });
  });

  // Base resolution: estimate if valid (> 0), otherwise actual duration.
  // Single source shared by core (calculateTemposAwarded) and UI
  // (CompletionModal.preview) to guarantee consistency even with
  // corrupt/legacy states.
  describe("resolveBaseMinutes (single source of the base)", () => {
    it("valid estimate (> 0) → returns the estimate", () => {
      expect(UtilityService.resolveBaseMinutes(30, 15)).toBe(30);
      expect(UtilityService.resolveBaseMinutes(45, 5)).toBe(45);
    });

    it("estimate 0 is NOT valid: falls back to actual duration", () => {
      // Defensive bug: a legacy state with estimate 0 (not a real
      // estimate) must use the actual duration so preview and core
      // match.
      expect(UtilityService.resolveBaseMinutes(0, 25)).toBe(25);
    });

    it("negative estimate is NOT valid: falls back to actual duration", () => {
      expect(UtilityService.resolveBaseMinutes(-10, 25)).toBe(25);
    });

    it("undefined estimate → uses actual duration", () => {
      expect(UtilityService.resolveBaseMinutes(undefined, 20)).toBe(20);
    });

    it("null estimate → uses actual duration", () => {
      expect(UtilityService.resolveBaseMinutes(null, 20)).toBe(20);
    });

    it("both 0 → returns 0 (nothing is awarded)", () => {
      expect(UtilityService.resolveBaseMinutes(0, 0)).toBe(0);
      expect(UtilityService.resolveBaseMinutes(undefined, 0)).toBe(0);
    });

    it("INVARIANT: resolveBaseMinutes === base used by calculateTemposAwarded", () => {
      // The core and the UI must use the same base in every case.
      for (const estimated of [undefined, null, 0, -5, 30, 60]) {
        for (const duration of [0, 5, 30, 60]) {
          const baseFromHelper = UtilityService.resolveBaseMinutes(estimated, duration);
          // Simulates the previous calculateTemposAwarded logic
          const baseFromLegacy =
            typeof estimated === "number" && estimated > 0 ? estimated : duration;
          expect(baseFromHelper).toBe(baseFromLegacy);
        }
      }
    });
  });
});
