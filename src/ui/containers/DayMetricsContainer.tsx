import React, { useMemo } from "react";
import { Box, Typography, Stack, Paper } from "@mui/material";
import { useSystemCore } from "../hooks/useSystemCore";
import type { UUID } from "../../types";

interface DayMetricsContainerProps {
  dayId?: UUID;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: "primary" | "success" | "warning" | "info";
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, subtitle, accent = "primary" }) => {
  const accentColor = {
    primary: "primary.main",
    success: "success.main",
    warning: "warning.main",
    info: "info.main",
  }[accent];

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        border: "1px solid rgba(0,0,0,0.06)",
        flex: 1,
        minWidth: 160,
      }}
      data-testid={`metric-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <Typography
        variant="overline"
        sx={{ color: "text.secondary", letterSpacing: "0.12em", fontWeight: 700 }}
      >
        {label}
      </Typography>
      <Typography variant="h4" sx={{ color: accentColor, mt: 0.5, fontWeight: 800 }}>
        {value}
      </Typography>
      {subtitle && (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {subtitle}
        </Typography>
      )}
    </Paper>
  );
};

const DayMetricsContainer: React.FC<DayMetricsContainerProps> = ({ dayId }) => {
  const { state, getCurrentDay, getTempoSummary } = useSystemCore();

  const targetDayId = dayId || getCurrentDay()?.id || null;

  const metrics = useMemo(() => {
    if (!targetDayId) return null;

    const dayRecords = state.global.completedActivityRecords.filter((r) => r.dayId === targetDayId);

    const completedRecords = dayRecords.filter((r) => r.state === "completed");
    const interruptedRecords = dayRecords.filter((r) => r.state === "interrupted");

    const totalActivities = dayRecords.length;
    const completionRate =
      totalActivities > 0 ? Math.round((completedRecords.length / totalActivities) * 100) : 0;

    const totalMinutes = completedRecords.reduce((sum, r) => sum + r.durationMinutes, 0);

    const averageSatisfaction =
      completedRecords.length > 0
        ? Math.round(
            (completedRecords.reduce((sum, r) => sum + (r.satisfactionScore || 0), 0) /
              completedRecords.length) *
              10
          ) / 10
        : 0;

    const beatCount = completedRecords.filter((r) => r.beatEstimate).length;
    const beatRate =
      completedRecords.length > 0 ? Math.round((beatCount / completedRecords.length) * 100) : 0;

    const tempoSummary = getTempoSummary(targetDayId);

    return {
      totalActivities,
      completedCount: completedRecords.length,
      interruptedCount: interruptedRecords.length,
      completionRate,
      totalMinutes,
      totalTempos: tempoSummary.totalTempos,
      targetProgress: tempoSummary.targetProgress,
      displayPercent: tempoSummary.displayPercent,
      averageSatisfaction,
      beatRate,
    };
  }, [targetDayId, state.global.completedActivityRecords, getTempoSummary]);

  if (!targetDayId) {
    return (
      <Box sx={{ p: 2 }} data-testid="day-metrics-container">
        <Typography color="text.secondary">No hay un día seleccionado.</Typography>
      </Box>
    );
  }

  if (!metrics) {
    return (
      <Box sx={{ p: 2 }} data-testid="day-metrics-container">
        <Typography color="text.secondary">Cargando métricas...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }} data-testid="day-metrics-container">
      <Typography variant="h5" sx={{ mb: 2 }}>
        Métricas del día
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ flexWrap: "wrap", gap: 2 }}>
        <MetricCard
          label="Actividades"
          value={metrics.totalActivities}
          subtitle={`${metrics.completedCount} completadas, ${metrics.interruptedCount} interrumpidas`}
        />
        <MetricCard
          label="Tasa de cierre"
          value={`${metrics.completionRate}%`}
          subtitle="completadas sobre el total"
          accent="success"
        />
        <MetricCard
          label="Tiempo total"
          value={`${metrics.totalMinutes}m`}
          subtitle="en actividades completadas"
          accent="info"
        />
        <MetricCard
          label="Tempos"
          value={metrics.totalTempos}
          subtitle={`${metrics.displayPercent}% del objetivo diario`}
          accent="warning"
        />
        <MetricCard
          label="Satisfacción"
          value={metrics.averageSatisfaction}
          subtitle="promedio del día"
          accent="primary"
        />
        <MetricCard
          label="Beat rate"
          value={`${metrics.beatRate}%`}
          subtitle="actividades bajo el estimado"
          accent="success"
        />
      </Stack>
    </Box>
  );
};

export default DayMetricsContainer;
