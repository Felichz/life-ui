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

  // Schema v2+: calculateBeatEstimate
  describe("calculateBeatEstimate", () => {
    it("NO aplica bonus para flexible-duration aunque haya estimado", () => {
      // Aunque flexible-duration tiene rango 5-10 min, no aplica bonus
      const beatsEstimate = UtilityService.calculateBeatEstimate("flexible-duration", 4, 10);
      expect(beatsEstimate).toBe(false);
    });

    it("NO aplica bonus para timeboxing aunque haya estimado", () => {
      const beatsEstimate = UtilityService.calculateBeatEstimate("timeboxing", 5, 10);
      expect(beatsEstimate).toBe(false);
    });

    it("SÍ aplica bonus para clear-objective cuando duration <= 80% del estimado", () => {
      // 45 min estimado, 30 min real (66%) → bonus aplica
      expect(UtilityService.calculateBeatEstimate("clear-objective", 30, 45)).toBe(true);
      // Caso límite exacto: 36 min de 45 (80%)
      expect(UtilityService.calculateBeatEstimate("clear-objective", 36, 45)).toBe(true);
    });

    it("NO aplica bonus para clear-objective cuando duration > 80% del estimado", () => {
      // 37 min de 45 (82%) → no bonus
      expect(UtilityService.calculateBeatEstimate("clear-objective", 37, 45)).toBe(false);
    });

    it("NO aplica bonus si duration es 0", () => {
      expect(UtilityService.calculateBeatEstimate("clear-objective", 0, 45)).toBe(false);
    });

    it("NO aplica bonus si estimated es 0 o undefined", () => {
      expect(UtilityService.calculateBeatEstimate("clear-objective", 30, 0)).toBe(false);
      expect(UtilityService.calculateBeatEstimate("clear-objective", 30, undefined)).toBe(false);
    });

    it("NO aplica bonus si estimated es negativo", () => {
      expect(UtilityService.calculateBeatEstimate("clear-objective", 30, -5)).toBe(false);
    });
  });

  // Schema v2+: calculateTemposAwarded (Fórmula MVP v3 simplificada)
// score 7 → 100% × base, score 8 → 110%, score 9 → 120%, score 10 → 130%
// score 0-6 → 0 tempos
  describe("calculateTemposAwarded (fórmula MVP v3)", () => {
    it("score 7 + estimado 30 min → 30 tempos (100%)", () => {
      expect(UtilityService.calculateTemposAwarded(30, 7, 30)).toBe(30);
    });

    it("score 8 + estimado 30 min → 33 tempos (110% × 30)", () => {
      expect(UtilityService.calculateTemposAwarded(30, 8, 30)).toBe(33);
    });

    it("score 9 + estimado 30 min → 36 tempos (120% × 30)", () => {
      expect(UtilityService.calculateTemposAwarded(30, 9, 30)).toBe(36);
    });

    it("score 10 + estimado 30 min → 39 tempos (130% × 30)", () => {
      expect(UtilityService.calculateTemposAwarded(30, 10, 30)).toBe(39);
    });

    it("se usa el estimado (no la duración real) cuando hay estimado", () => {
      // duración real baja (acaba de iniciar) pero estimado es 45
      // El score 7 da 100% × 45 = 45, no sobre la duración real
      expect(UtilityService.calculateTemposAwarded(2, 7, 45)).toBe(45);
    });

    it("sin estimado: usa la duración real", () => {
      // flexible-duration sin estimado → usa 25 min × 100% = 25
      expect(UtilityService.calculateTemposAwarded(25, 7, undefined)).toBe(25);
    });

    it("score 0-6 → 0 tempos (este día no fue)", () => {
      for (let s = 0; s <= 6; s++) {
        expect(UtilityService.calculateTemposAwarded(30, s, 30)).toBe(0);
      }
    });

    it("BUG FIX: duration 0 con estimado válido → usa estimado (no 0)", () => {
      // Caso reportado por Codex: si la actividad estuvo activa menos de
      // 1 minuto y Math.round devuelve 0, NO debemos devolver 0 tempos
      // cuando hay un estimado. Usamos el estimado como base.
      expect(UtilityService.calculateTemposAwarded(0, 10, 30)).toBe(39); // 130% × 30
      expect(UtilityService.calculateTemposAwarded(0, 7, 45)).toBe(45); // 100% × 45
    });

    it("duration 0 sin estimado → 0 tempos (no hay base válida)", () => {
      expect(UtilityService.calculateTemposAwarded(0, 10, undefined)).toBe(0);
      expect(UtilityService.calculateTemposAwarded(0, 10, 0)).toBe(0);
    });

    it("duration negativa → 0 tempos (sanidad)", () => {
      expect(UtilityService.calculateTemposAwarded(-10, 10, 30)).toBe(0);
    });

    it("duration negativa → 0 tempos", () => {
      expect(UtilityService.calculateTemposAwarded(-10, 10, 30)).toBe(0);
    });

    it("score inválido (>10) → 0 tempos", () => {
      expect(UtilityService.calculateTemposAwarded(45, 11, 30)).toBe(0);
    });

    it("score inválido (<0) → 0 tempos", () => {
      expect(UtilityService.calculateTemposAwarded(45, -1, 30)).toBe(0);
    });

    it("score fraccionario (no entero) → 0 tempos", () => {
      expect(UtilityService.calculateTemposAwarded(45, 7.5, 30)).toBe(0);
    });

    it("estimado 0 o negativo: cae a la duración real", () => {
      // estimado 0 no es válido, usa duración real
      expect(UtilityService.calculateTemposAwarded(20, 7, 0)).toBe(20);
      expect(UtilityService.calculateTemposAwarded(20, 7, -5)).toBe(20);
    });

    it("caso extremo: score 10, estimado 120 min → 156 tempos", () => {
      // 120 × 1.3 = 156
      expect(UtilityService.calculateTemposAwarded(120, 10, 120)).toBe(156);
    });
  });

  // Helper compartido entre core y UI (CompletionModal) para el preview
  // en vivo. Garantía: calculatePreviewTempos(N, base) === resultado del
  // cálculo final con esa base. Si la fórmula cambia, preview se actualiza
  // automáticamente.
  describe("calculatePreviewTempos (helper compartido preview ↔ core)", () => {
    it("score 7 + base 30 → 30 tempos", () => {
      expect(UtilityService.calculatePreviewTempos(7, 30)).toBe(30);
    });

    it("score 8 + base 30 → 33 tempos (110%)", () => {
      expect(UtilityService.calculatePreviewTempos(8, 30)).toBe(33);
    });

    it("score 9 + base 30 → 36 tempos (120%)", () => {
      expect(UtilityService.calculatePreviewTempos(9, 30)).toBe(36);
    });

    it("score 10 + base 30 → 39 tempos (130%)", () => {
      expect(UtilityService.calculatePreviewTempos(10, 30)).toBe(39);
    });

    it("score 0-6 → 0 tempos", () => {
      for (let s = 0; s <= 6; s++) {
        expect(UtilityService.calculatePreviewTempos(s, 30)).toBe(0);
      }
    });

    it("base 0 o negativa → 0 tempos", () => {
      expect(UtilityService.calculatePreviewTempos(10, 0)).toBe(0);
      expect(UtilityService.calculatePreviewTempos(10, -5)).toBe(0);
    });

    it("score inválido (>10, <0, no entero) → 0 tempos", () => {
      expect(UtilityService.calculatePreviewTempos(11, 30)).toBe(0);
      expect(UtilityService.calculatePreviewTempos(-1, 30)).toBe(0);
      expect(UtilityService.calculatePreviewTempos(7.5, 30)).toBe(0);
    });

    it("INVARIANTE: preview === calculateTemposAwarded(score, base, base)", () => {
      // El preview SIEMPRE coincide con el cálculo final cuando se usa
      // la misma base (estimado cuando hay, duración cuando no).
      for (const score of [7, 8, 9, 10]) {
        for (const base of [10, 25, 30, 60, 120]) {
          const preview = UtilityService.calculatePreviewTempos(score, base);
          // estimatedMinutes === base simula el caso donde la duración
          // real coincide con el estimado.
          const finalT = UtilityService.calculateTemposAwarded(base, score, base);
          expect(preview).toBe(finalT);
        }
      }
    });
  });
});
