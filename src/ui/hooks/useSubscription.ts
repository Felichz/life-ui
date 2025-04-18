import type { DependencyList } from "react";
import { useEffect } from "react";

/**
 * Hook para gestionar suscripciones a eventos o cambios de estado
 * @param callback Función a ejecutar cuando ocurra el evento
 * @param dependencies Dependencias que disparan la re-suscripción
 */
export const useSubscription = <T>(
  subscribe: (callback: (data: T) => void) => () => void,
  callback: (data: T) => void,
  dependencies: DependencyList = []
): void => {
  useEffect(() => {
    // Suscribirse al evento o cambio
    const unsubscribe = subscribe(callback);

    // Limpiar suscripción al desmontar o cambiar dependencias
    return () => {
      unsubscribe();
    };
  }, dependencies);
};
