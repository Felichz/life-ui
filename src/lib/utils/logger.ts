/**
 * Formatea cualquier dato para mostrarlo en consola de forma legible
 */
export const formatLog = (label: string, data: unknown): void => {
  console.log(`${label}:`, JSON.stringify(data, null, 2));
};

/**
 * Formatea y muestra múltiples datos en consola de forma legible
 */
export const formatMultiLog = (...args: Array<{ label: string; data: unknown }>): void => {
  console.group("Debug Log");
  args.forEach(({ label, data }) => formatLog(label, data));
  console.groupEnd();
};
