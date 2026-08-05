import { UtilityService } from "../utilityService";

describe("UtilityService", () => {
  // Prueba de generación de UUID
  describe("generateUUID", () => {
    it("debe generar un UUID válido", () => {
      const uuid = UtilityService.generateUUID();
      expect(uuid).toBeDefined();
      // Validar el formato UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it("debe generar UUIDs únicos en llamadas consecutivas", () => {
      const uuid1 = UtilityService.generateUUID();
      const uuid2 = UtilityService.generateUUID();
      expect(uuid1).not.toEqual(uuid2);
    });
  });

  // Prueba de getCurrentISODateTime
  describe("getCurrentISODateTime", () => {
    it("debe retornar una fecha en formato ISO", () => {
      const isoDateTime = UtilityService.getCurrentISODateTime();
      expect(isoDateTime).toBeDefined();
      // Validar formato ISO: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(isoDateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });
  });

  // Prueba de getCurrentDayMinutes
  describe("getCurrentDayMinutes", () => {
    it("debe retornar un número entre 0 y 1439", () => {
      const dayMinutes = UtilityService.getCurrentDayMinutes();
      expect(dayMinutes).toBeDefined();
      expect(dayMinutes).toBeGreaterThanOrEqual(0);
      expect(dayMinutes).toBeLessThan(24 * 60);
    });

    it("debe calcular correctamente los minutos del día", () => {
      // Mock de la fecha actual para una prueba determinista
      const mockDate = new Date(2023, 0, 1, 14, 30); // 14:30
      jest.spyOn(global, "Date").mockImplementation(() => mockDate);

      const dayMinutes = UtilityService.getCurrentDayMinutes();
      expect(dayMinutes).toEqual(14 * 60 + 30); // 870 minutos

      // Restaurar Date original
      jest.restoreAllMocks();
    });
  });

  // Prueba de formatDuration
  describe("formatDuration", () => {
    it("debe formatear solo minutos correctamente", () => {
      expect(UtilityService.formatDuration(30)).toEqual("30m");
    });

    it("debe formatear solo horas correctamente", () => {
      expect(UtilityService.formatDuration(120)).toEqual("2h");
    });

    it("debe formatear horas y minutos correctamente", () => {
      expect(UtilityService.formatDuration(90)).toEqual("1h 30m");
    });

    it("debe lanzar error para valores negativos", () => {
      expect(() => UtilityService.formatDuration(-10)).toThrow();
    });

    it("debe lanzar error para valores NaN", () => {
      expect(() => UtilityService.formatDuration(NaN)).toThrow();
    });
  });

  // Prueba de formatTime
  describe("formatTime", () => {
    it("debe formatear los minutos a formato hora correctamente", () => {
      expect(UtilityService.formatTime(0)).toEqual("00:00");
      expect(UtilityService.formatTime(60)).toEqual("01:00");
      expect(UtilityService.formatTime(90)).toEqual("01:30");
      expect(UtilityService.formatTime(870)).toEqual("14:30");
      expect(UtilityService.formatTime(1439)).toEqual("23:59");
    });

    it("debe lanzar error para valores fuera del rango", () => {
      expect(() => UtilityService.formatTime(-1)).toThrow();
      expect(() => UtilityService.formatTime(1440)).toThrow();
    });

    it("debe lanzar error para valores NaN", () => {
      expect(() => UtilityService.formatTime(NaN)).toThrow();
    });
  });

  // Prueba de parseTime
  describe("parseTime", () => {
    it("debe convertir correctamente de string a minutos", () => {
      expect(UtilityService.parseTime("00:00")).toEqual(0);
      expect(UtilityService.parseTime("01:00")).toEqual(60);
      expect(UtilityService.parseTime("01:30")).toEqual(90);
      expect(UtilityService.parseTime("14:30")).toEqual(870);
      expect(UtilityService.parseTime("23:59")).toEqual(1439);
    });

    it("debe aceptar formatos sin ceros iniciales", () => {
      expect(UtilityService.parseTime("1:30")).toEqual(90);
      expect(UtilityService.parseTime("9:05")).toEqual(545);
    });

    it("debe lanzar error para formatos inválidos", () => {
      expect(() => UtilityService.parseTime("24:00")).toThrow();
      expect(() => UtilityService.parseTime("12:60")).toThrow();
      expect(() => UtilityService.parseTime("abc")).toThrow();
      expect(() => UtilityService.parseTime("12-30")).toThrow();
    });
  });

  // Prueba de deepCopy
  describe("deepCopy", () => {
    it("debe realizar una copia profunda de un objeto", () => {
      const original = {
        a: 1,
        b: { c: 2, d: [3, 4, 5] },
        e: new Date(),
      };

      const copy = UtilityService.deepCopy(original);

      // Verificar que es una copia y no el mismo objeto
      expect(copy).toEqual(original);
      expect(copy).not.toBe(original);
      expect(copy.b).not.toBe(original.b);
      expect(copy.b.d).not.toBe(original.b.d);

      // Modificar el original no afecta la copia
      original.a = 10;
      original.b.c = 20;
      original.b.d[0] = 30;

      expect(copy.a).toBe(1);
      expect(copy.b.c).toBe(2);
      expect(copy.b.d[0]).toBe(3);
    });

    it("debe manejar tipos primitivos", () => {
      expect(UtilityService.deepCopy(123)).toBe(123);
      expect(UtilityService.deepCopy("test")).toBe("test");
      expect(UtilityService.deepCopy(true)).toBe(true);
      expect(UtilityService.deepCopy(null)).toBe(null);
      expect(UtilityService.deepCopy(undefined)).toBe(undefined);
    });
  });

  // Schema v2+: shouldApplyBonus
  describe("shouldApplyBonus", () => {
    it("NO aplica bonus para flexible-duration aunque haya estimado", () => {
      // Aunque flexible-duration tiene rango 5-10 min, no aplica bonus
      const canApply = UtilityService.shouldApplyBonus("flexible-duration", 4, 10);
      expect(canApply).toBe(false);
    });

    it("NO aplica bonus para timeboxing aunque haya estimado", () => {
      const canApply = UtilityService.shouldApplyBonus("timeboxing", 5, 10);
      expect(canApply).toBe(false);
    });

    it("SÍ aplica bonus para clear-objective cuando duration <= 80% del estimado", () => {
      // 45 min estimado, 30 min real (66%) → bonus aplica
      expect(UtilityService.shouldApplyBonus("clear-objective", 30, 45)).toBe(true);
      // Caso límite exacto: 36 min de 45 (80%)
      expect(UtilityService.shouldApplyBonus("clear-objective", 36, 45)).toBe(true);
    });

    it("NO aplica bonus para clear-objective cuando duration > 80% del estimado", () => {
      // 37 min de 45 (82%) → no bonus
      expect(UtilityService.shouldApplyBonus("clear-objective", 37, 45)).toBe(false);
    });

    it("NO aplica bonus si duration es 0", () => {
      expect(UtilityService.shouldApplyBonus("clear-objective", 0, 45)).toBe(false);
    });

    it("NO aplica bonus si estimated es 0 o undefined", () => {
      expect(UtilityService.shouldApplyBonus("clear-objective", 30, 0)).toBe(false);
      expect(UtilityService.shouldApplyBonus("clear-objective", 30, undefined)).toBe(false);
    });

    it("NO aplica bonus si estimated es negativo", () => {
      expect(UtilityService.shouldApplyBonus("clear-objective", 30, -5)).toBe(false);
    });
  });

  // Schema v2+: calculateTemposAwarded
  describe("calculateTemposAwarded", () => {
    it("caso base: score 10, 45 min → 45 tempos", () => {
      const total = UtilityService.calculateTemposAwarded(45, 10, false);
      expect(total).toBe(45);
    });

    it("caso 80%: score 8, 45 min → 36 tempos (ceil(36))", () => {
      const total = UtilityService.calculateTemposAwarded(45, 8, false);
      expect(total).toBe(36);
    });

    it("caso 50%: score 5, 45 min → 23 tempos (ceil de 22.5)", () => {
      const total = UtilityService.calculateTemposAwarded(45, 5, false);
      expect(total).toBe(23);
    });

    it("caso 10%: score 1, 45 min → 5 tempos (ceil de 4.5)", () => {
      const total = UtilityService.calculateTemposAwarded(45, 1, false);
      expect(total).toBe(5);
    });

    it("score 0 → 0 tempos totales (coherencia)", () => {
      const total = UtilityService.calculateTemposAwarded(45, 0, true);
      expect(total).toBe(0);
    });

    it("score 0 → 0 tempos incluso sin bonus", () => {
      const total = UtilityService.calculateTemposAwarded(45, 0, false);
      expect(total).toBe(0);
    });

    it("score 10 + bonus → base 45 + bonus 5 = 50", () => {
      const total = UtilityService.calculateTemposAwarded(45, 10, true);
      expect(total).toBe(50);
    });

    it("score 8 + bonus → 36 + 5 = 41", () => {
      const total = UtilityService.calculateTemposAwarded(45, 8, true);
      expect(total).toBe(41);
    });

    it("duration 0 → 0 tempos (no se premia tiempo nulo)", () => {
      const total = UtilityService.calculateTemposAwarded(0, 10, true);
      expect(total).toBe(0);
    });

    it("duration negativa → 0 tempos", () => {
      const total = UtilityService.calculateTemposAwarded(-10, 10, true);
      expect(total).toBe(0);
    });

    it("score inválido (>10) → 0 tempos", () => {
      const total = UtilityService.calculateTemposAwarded(45, 11, true);
      expect(total).toBe(0);
    });

    it("score inválido (<0) → 0 tempos", () => {
      const total = UtilityService.calculateTemposAwarded(45, -1, true);
      expect(total).toBe(0);
    });

    it("score fraccionario (no entero) → 0 tempos", () => {
      const total = UtilityService.calculateTemposAwarded(45, 7.5, true);
      expect(total).toBe(0);
    });

    it("duration fraccionaria → ceil correcto (45.5 × 10/10 = 46)", () => {
      const total = UtilityService.calculateTemposAwarded(45.5, 10, false);
      expect(total).toBe(46);
    });

    it("score 5 con duration 11 → ceil(5.5) = 6 tempos", () => {
      const total = UtilityService.calculateTemposAwarded(11, 5, false);
      expect(total).toBe(6);
    });

    it("score 5 con duration 10 → ceil(5) = 5 tempos", () => {
      const total = UtilityService.calculateTemposAwarded(10, 5, false);
      expect(total).toBe(5);
    });

    it("duration muy corta 1 min × score 10 = 1 tempo (sin bonus)", () => {
      // ceil(1 * 10 / 10) = 1
      const total = UtilityService.calculateTemposAwarded(1, 10, false);
      expect(total).toBe(1);
    });

    it("duration muy corta 1 min × score 10 = 6 tempos (con bonus)", () => {
      // ceil(1 * 10 / 10) + 5 = 1 + 5 = 6
      const total = UtilityService.calculateTemposAwarded(1, 10, true);
      expect(total).toBe(6);
    });

    it("duration 120 min × score 10 = 120 tempos (caso extremo)", () => {
      const total = UtilityService.calculateTemposAwarded(120, 10, true);
      expect(total).toBe(125);
    });
  });
});
