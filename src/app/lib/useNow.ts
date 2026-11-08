import { useEffect, useState } from "react";

/**
 * UI clock. Re-renders every `intervalMs`, aligned to the second, so that
 * several stopwatches on screen tick at the same time.
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
