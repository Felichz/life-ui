/**
 * Clase que maneja la simulación del tiempo en el sistema.
 * Cuando el modo de prueba está activo, el tiempo se acelera según el multiplicador configurado.
 */
export class TimeSimulator {
  private static instance: TimeSimulator;
  private isTestMode: boolean = false;
  private timeMultiplier: number = 1;
  private simulationStartTime: number = Date.now();
  private simulationStartRealTime: number = Date.now();

  private constructor() {}

  static getInstance(): TimeSimulator {
    console.log("TimeSimulator.getInstance");

    if (!TimeSimulator.instance) {
      TimeSimulator.instance = new TimeSimulator();
    }
    return TimeSimulator.instance;
  }

  /**
   * Sincroniza el simulador con un timestamp persistido
   * Esto es necesario para mantener la continuidad del tiempo cuando se reinicia la aplicación
   */
  syncWithPersistedTimestamp(persistedTimestamp: number): void {
    const now = Date.now();
    if (persistedTimestamp > now) {
      // Si el timestamp persistido es mayor que el actual,
      // ajustamos el tiempo de inicio de la simulación para mantener la continuidad
      this.simulationStartTime = persistedTimestamp;
      this.simulationStartRealTime = now;
    }
  }

  /**
   * Activa o desactiva el modo de prueba
   */
  setTestMode(enabled: boolean) {
    if (this.isTestMode !== enabled) {
      const now = Date.now();

      if (enabled) {
        // Si activamos el modo prueba, empezamos la simulación desde ahora
        this.simulationStartTime = now;
        this.simulationStartRealTime = now;
        this.timeMultiplier = 1; // Iniciamos con multiplicador 1
      } else {
        // Si desactivamos el modo prueba, actualizamos el tiempo de inicio
        // para mantener la continuidad del tiempo real
        this.simulationStartTime = now;
        this.simulationStartRealTime = now;
        this.timeMultiplier = 1;
      }
    }
    this.isTestMode = enabled;
  }

  /**
   * Establece el multiplicador de tiempo para el modo de prueba
   */
  setTimeMultiplier(multiplier: number) {
    if (!this.isTestMode) return;

    const now = Date.now();
    // Actualizamos los tiempos de inicio para mantener la continuidad
    const currentSimulatedTime = this.now();
    this.simulationStartTime = currentSimulatedTime;
    this.simulationStartRealTime = now;
    this.timeMultiplier = multiplier;
  }

  /**
   * Obtiene el multiplicador de tiempo actual
   */
  getTimeMultiplier(): number {
    return this.timeMultiplier;
  }

  /**
   * Obtiene el timestamp actual, ya sea real o simulado
   */
  now(): number {
    if (!this.isTestMode) {
      return Date.now();
    }

    // En modo prueba, calculamos cuánto tiempo real ha pasado
    const realElapsedTime = Date.now() - this.simulationStartRealTime;

    // Multiplicamos por el factor de aceleración configurado
    const simulatedElapsedTime = realElapsedTime * this.timeMultiplier;

    // Retornamos el tiempo simulado desde el punto de inicio de la simulación
    return this.simulationStartTime + simulatedElapsedTime;
  }

  /**
   * Obtiene el intervalo de tiempo que debe usarse para los setInterval
   */
  getUpdateInterval(): number {
    if (!this.isTestMode || this.timeMultiplier === 0) return 60000;
    return Math.max(60000 / this.timeMultiplier, 50); // Mínimo 1000ms para evitar actualizaciones demasiado frecuentes
  }

  /**
   * Obtiene el incremento de tiempo que debe aplicarse en cada actualización
   */
  getTimeIncrement(): number {
    return 60000; // Siempre incrementamos un minuto
  }

  /**
   * Avanza manualmente un minuto en el tiempo simulado
   * Solo funciona en modo prueba y cuando el multiplicador es 0
   */
  advanceOneMinute(): void {
    if (!this.isTestMode || this.timeMultiplier !== 0) return;

    const now = Date.now();
    this.simulationStartTime += this.getTimeIncrement();
    this.simulationStartRealTime = now;
  }

  /**
   * Calcula el tiempo en milisegundos hasta el próximo minuto completo basado en el tiempo simulado.
   */
  getTimeUntilNextMinute(): number {
    const currentSimulatedTime = this.now();

    // Calcular el tiempo transcurrido desde el inicio de la simulación
    const elapsedTime = currentSimulatedTime - this.simulationStartTime;

    // Calcular cuántos minutos completos han pasado desde el inicio
    const completeMinutes = Math.floor(elapsedTime / 60000);

    // Calcular el timestamp del próximo minuto completo
    const nextMinuteTime = this.simulationStartTime + (completeMinutes + 1) * 60000;

    // Calcular cuánto tiempo simulado falta hasta el próximo minuto
    let timeUntilNextMinute = nextMinuteTime - currentSimulatedTime;

    // Ajustar el tiempo considerando el multiplicador cuando estamos en modo prueba
    if (this.isTestMode && this.timeMultiplier > 0) {
      // Convertir el tiempo simulado a tiempo real dividiendo por el multiplicador
      timeUntilNextMinute = timeUntilNextMinute / this.timeMultiplier;
    }

    return timeUntilNextMinute;
  }

  /**
   * Obtiene el segundo actual (0-59) basado en el tiempo simulado actual
   * Esta función se usa para calcular el progreso del círculo de minutos
   */
  getCurrentSecond(): number {
    const currentSimulatedTime = this.now();

    const elapsedTime = currentSimulatedTime - this.simulationStartTime;

    // Calcular los milisegundos transcurridos en el minuto actual
    const millisInCurrentMinute = elapsedTime % 60000;

    // Convertir a segundos (0-59)
    const currentSecond = Math.floor(millisInCurrentMinute / 1000);

    return currentSecond;
  }

  /**
   * Calcula el tiempo en milisegundos hasta el próximo segundo basado en el tiempo simulado.
   */
  getTimeUntilNextSecond(): number {
    const currentSimulatedTime = this.now();

    // Calcular milisegundos transcurridos dentro del segundo actual
    const millisInCurrentSecond = currentSimulatedTime % 1000;

    // Calcular cuánto tiempo simulado falta hasta el próximo segundo
    let timeUntilNextSecond = 1000 - millisInCurrentSecond;

    // Ajustar el tiempo considerando el multiplicador cuando estamos en modo prueba
    if (this.isTestMode && this.timeMultiplier > 0) {
      // Convertir el tiempo simulado a tiempo real dividiendo por el multiplicador
      timeUntilNextSecond = timeUntilNextSecond / this.timeMultiplier;
    }

    return timeUntilNextSecond;
  }

  /**
   * Obtiene el progreso dentro del minuto actual (0-100%)
   */
  getMinuteProgress(): number {
    const currentSecond = this.getCurrentSecond();
    const millisInCurrentSecond = this.now() % 1000;
    return ((currentSecond * 1000 + millisInCurrentSecond) / 60000) * 100;
  }
}
