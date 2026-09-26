import { useEffect, useState } from "react";

/**
 * Reloj de la UI. Re-renderiza cada `intervalMs` alineado al segundo para
 * que varios cronómetros en pantalla cambien a la vez.
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const align = setTimeout(
      () => {
        setNow(new Date());
        interval = setInterval(() => setNow(new Date()), intervalMs);
      },
      1000 - (Date.now() % 1000)
    );
    return () => {
      clearTimeout(align);
      if (interval) clearInterval(interval);
    };
  }, [intervalMs]);

  return now;
}
