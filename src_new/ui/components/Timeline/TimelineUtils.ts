export const formatMinutesToTime = (minutes: number): string => {
    const roundedMinutes = Math.min(Math.max(0, minutes), 1439);
    const hours = Math.floor(roundedMinutes / 60);
    const mins = Math.floor(roundedMinutes % 60);
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
};

export const calculatePosition = (startMinute: number, durationMinutes: number): { left: string; width: string } => {
    // En un día de 24 horas (1440 minutos), cada minuto es un porcentaje del total
    const leftPos = (startMinute / 1440) * 100;
    // Calculamos el ancho tomando en cuenta el número total de horas para no desbordar
    const maxAllowedDuration = 1440 - startMinute;
    const actualDuration = Math.min(durationMinutes, maxAllowedDuration);

    const widthPos = (actualDuration / 1440) * 100;

    return {
        left: `${Math.max(0, Math.min(leftPos, 100))}%`,
        width: `${Math.max(0, Math.min(widthPos, 100))}%`
    };
};
