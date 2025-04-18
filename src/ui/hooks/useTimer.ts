import { useState, useEffect, useRef, useCallback } from "react";

interface UseTimerOptions {
  autoStart?: boolean;
  onTick?: (elapsed: number) => void;
  onComplete?: () => void;
}

interface UseTimerResult {
  isRunning: boolean;
  elapsed: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  toggle: () => void;
}

/**
 * Hook para gestionar un temporizador preciso
 * @param duration Duración en milisegundos (0 para temporizador infinito)
 * @param options Opciones adicionales
 * @returns Objeto con el estado y métodos para manipularlo
 */
export const useTimer = (duration: number = 0, options: UseTimerOptions = {}): UseTimerResult => {
  const { autoStart = false, onTick, onComplete } = options;

  const [isRunning, setIsRunning] = useState(autoStart);
  const [elapsed, setElapsed] = useState(0);

  const startTimeRef = useRef<number | null>(null);
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number>(0);

  const animate = useCallback(
    (time: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = time;
        previousTimeRef.current = time;
      }

      const deltaTime = time - previousTimeRef.current;
      previousTimeRef.current = time;

      const newElapsed = elapsed + deltaTime;
      setElapsed(newElapsed);

      // Llamar al callback onTick si existe
      if (onTick) {
        onTick(newElapsed);
      }

      // Verificar si el temporizador ha terminado (solo si duration > 0)
      if (duration > 0 && newElapsed >= duration) {
        setIsRunning(false);
        if (onComplete) {
          onComplete();
        }
        return;
      }

      // Continuar la animación
      if (isRunning) {
        requestRef.current = requestAnimationFrame(animate);
      }
    },
    [duration, elapsed, isRunning, onComplete, onTick]
  );

  // Iniciar/Detener el temporizador
  useEffect(() => {
    if (isRunning) {
      requestRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isRunning, animate]);

  const start = useCallback(() => {
    setIsRunning(true);
    startTimeRef.current = null;
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setElapsed(0);
    startTimeRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    setIsRunning((prev) => !prev);
    if (!isRunning) {
      startTimeRef.current = null;
    }
  }, [isRunning]);

  return {
    isRunning,
    elapsed,
    start,
    pause,
    reset,
    toggle,
  };
};
