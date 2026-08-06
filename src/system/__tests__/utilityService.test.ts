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

  // Schema v2+: calculateTemposAwarded (Fórmula MVP v3.1 lineal)
  // tempos = ceil(baseMinutos × score / 7)
  // score 0 → 0, score 1 → 14%, score 7 → 100%, score 10 → 143%
  describe("calculateTemposAwarded (fórmula MVP v3.1 lineal)", () => {
    it("score 5 + estimado 30 min → 22 tempos (ejemplo del usuario)", () => {
      // ceil(30 × 5 / 7) = ceil(21.43) = 22
      expect(UtilityService.calculateTemposAwarded(30, 5, 30)).toBe(22);
    });

    it("score 1 + estimado 30 min → 5 tempos (ejemplo del usuario)", () => {
      // ceil(30 × 1 / 7) = ceil(4.28) = 5
      expect(UtilityService.calculateTemposAwarded(30, 1, 30)).toBe(5);
    });

    it("score 7 + estimado 30 min → 30 tempos (100%)", () => {
      // ceil(30 × 7 / 7) = ceil(30) = 30
      expect(UtilityService.calculateTemposAwarded(30, 7, 30)).toBe(30);
    });

    it("score 10 + estimado 30 min → 43 tempos (143%)", () => {
      // ceil(30 × 10 / 7) = ceil(42.86) = 43
      expect(UtilityService.calculateTemposAwarded(30, 10, 30)).toBe(43);
    });

    it("se usa el estimado (no la duración real) cuando hay estimado", () => {
      // duración real baja (acaba de iniciar) pero estimado es 45
      // score 7: ceil(45 × 7 / 7) = 45
      expect(UtilityService.calculateTemposAwarded(2, 7, 45)).toBe(45);
    });

    it("sin estimado: usa la duración real", () => {
      // flexible-duration sin estimado → ceil(25 × 7 / 7) = 25
      expect(UtilityService.calculateTemposAwarded(25, 7, undefined)).toBe(25);
    });

    it("score 0 → 0 tempos (no completó)", () => {
      expect(UtilityService.calculateTemposAwarded(30, 0, 30)).toBe(0);
    });

    it("BUG FIX: duration 0 con estimado válido → usa estimado (no 0)", () => {
      // Si la actividad estuvo activa menos de 1 minuto y Math.round
      // devuelve 0, NO debemos devolver 0 tempos cuando hay estimado.
      // score 10 + estimado 30: ceil(30 × 10 / 7) = 43
      expect(UtilityService.calculateTemposAwarded(0, 10, 30)).toBe(43);
      // score 7 + estimado 45: ceil(45 × 7 / 7) = 45
      expect(UtilityService.calculateTemposAwarded(0, 7, 45)).toBe(45);
    });

    it("duration 0 sin estimado → 0 tempos (no hay base válida)", () => {
      expect(UtilityService.calculateTemposAwarded(0, 10, undefined)).toBe(0);
      expect(UtilityService.calculateTemposAwarded(0, 10, 0)).toBe(0);
    });

    it("duration negativa → 0 tempos (sanidad)", () => {
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
      // ceil(20 × 7 / 7) = 20
      expect(UtilityService.calculateTemposAwarded(20, 7, 0)).toBe(20);
      expect(UtilityService.calculateTemposAwarded(20, 7, -5)).toBe(20);
    });

    it("caso extremo: score 10, estimado 120 min → 172 tempos", () => {
      // ceil(120 × 10 / 7) = ceil(171.43) = 172
      expect(UtilityService.calculateTemposAwarded(120, 10, 120)).toBe(172);
    });

    it("escala lineal: cada punto del slider aumenta ~14% de la base", () => {
      // Para base=30: score N → ceil(30 × N / 7)
      // score 1 → 5, score 2 → 9, score 3 → 13, score 4 → 18, score 5 → 22
      // score 6 → 26, score 7 → 30, score 8 → 35, score 9 → 39, score 10 → 43
      const expected = [5, 9, 13, 18, 22, 26, 30, 35, 39, 43];
      for (let s = 1; s <= 10; s++) {
        expect(UtilityService.calculateTemposAwarded(30, s, 30)).toBe(expected[s - 1]);
      }
    });
  });

  // Helper compartido entre core y UI (CompletionModal) para el preview
  // en vivo. Garantía: calculatePreviewTempos(N, base) === resultado del
  // cálculo final con esa base. Si la fórmula cambia, preview se actualiza
  // automáticamente.
  describe("calculatePreviewTempos (helper compartido preview ↔ core)", () => {
    it("score 5 + base 30 → 22 tempos (ejemplo del usuario)", () => {
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

  // Resolución de la base: estimado si es válido (> 0), sino duración real.
  // Fuente única compartida por core (calculateTemposAwarded) y UI
  // (CompletionModal.preview) para garantizar consistencia incluso
  // ante estados corruptos/legacy.
  describe("resolveBaseMinutes (fuente única de la base)", () => {
    it("estimado válido (> 0) → retorna el estimado", () => {
      expect(UtilityService.resolveBaseMinutes(30, 15)).toBe(30);
      expect(UtilityService.resolveBaseMinutes(45, 5)).toBe(45);
    });

    it("estimado 0 NO es válido: cae a duración real", () => {
      // Bug defensivo: estado legacy con estimado 0 (no es un estimado
      // real) debe usar la duración real para que preview y core
      // coincidan.
      expect(UtilityService.resolveBaseMinutes(0, 25)).toBe(25);
    });

    it("estimado negativo NO es válido: cae a duración real", () => {
      expect(UtilityService.resolveBaseMinutes(-10, 25)).toBe(25);
    });

    it("estimado undefined → usa duración real", () => {
      expect(UtilityService.resolveBaseMinutes(undefined, 20)).toBe(20);
    });

    it("estimado null → usa duración real", () => {
      expect(UtilityService.resolveBaseMinutes(null, 20)).toBe(20);
    });

    it("ambos 0 → retorna 0 (no se premia nada)", () => {
      expect(UtilityService.resolveBaseMinutes(0, 0)).toBe(0);
      expect(UtilityService.resolveBaseMinutes(undefined, 0)).toBe(0);
    });

    it("INVARIANTE: resolveBaseMinutes === base que usa calculateTemposAwarded", () => {
      // El core y la UI deben usar la misma base para cualquier caso.
      for (const estimated of [undefined, null, 0, -5, 30, 60]) {
        for (const duration of [0, 5, 30, 60]) {
          const baseFromHelper = UtilityService.resolveBaseMinutes(
            estimated,
            duration
          );
          // Simula la lógica anterior de calculateTemposAwarded
          const baseFromLegacy =
            typeof estimated === "number" && estimated > 0
              ? estimated
              : duration;
          expect(baseFromHelper).toBe(baseFromLegacy);
        }
      }
    });
  });
});
