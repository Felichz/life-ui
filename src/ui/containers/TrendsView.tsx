import React, { useMemo, useState } from "react";
import { Box, Typography, MenuItem, TextField, Paper, Stack } from "@mui/material";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useSystemCore } from "../hooks/useSystemCore";
import type { ISODateTimeString, TempoTrendPoint } from "../../types";

type TrendRange = "7" | "14" | "30" | "all";

/**
 * TrendsView: 3 series (tempos, progreso, satisfacción) en línea temporal.
 * Refleja la métrica diaria a lo largo de N días.
 */
const TrendsView: React.FC = () => {
  const { state, getTempoTrends } = useSystemCore();
  const [range, setRange] = useState<TrendRange>("30");

  const chartData = useMemo(() => {
    if (state.global.days.length === 0) return [];

    const sortedDays = [...state.global.days].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let cutoff: number | null = null;
    if (range !== "all") {
      const days = parseInt(range, 10);
      const lastDay = sortedDays[sortedDays.length - 1];
      if (lastDay) {
        cutoff = new Date(lastDay.createdAt).getTime() - days * 24 * 60 * 60 * 1000;
      }
    }

    const fromTime = cutoff;
    const toTime = Date.now();

    const fromIso: ISODateTimeString = new Date(
      fromTime ?? sortedDays[0]?.createdAt ?? Date.now()
    ).toISOString();
    const toIso: ISODateTimeString = new Date(toTime).toISOString();

    const points: TempoTrendPoint[] = getTempoTrends({ from: fromIso, to: toIso });

    return points.map((p) => ({
      label: new Date(p.date).toLocaleDateString("es", {
        month: "short",
        day: "numeric",
      }),
      totalTempos: p.totalTempos,
      targetProgress: Math.round(p.targetProgress * 100),
      averageSatisfaction: p.averageSatisfaction,
    }));
  }, [state.global.days, range, getTempoTrends]);

  const hasData = chartData.length > 0;

  // Eje derecho (porcentaje del objetivo) dinámico: si el usuario llega
  // a 184%, la línea se ve completa, no cortada. Mínimo de 100 para que
  // el 100% siempre sea visible como referencia.
  const rightDomainMax = (() => {
    const maxPct = chartData.reduce((m, p) => Math.max(m, p.targetProgress), 0);
    return Math.max(100, Math.ceil(maxPct / 50) * 50);
  })();

  return (
    <Box sx={{ width: "100%" }} data-testid="trends-view">
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 2, gap: 1 }}
      >
        <Box>
          <Typography variant="h5">Tendencia de tempos</Typography>
          <Typography variant="body2" color="text.secondary">
            Evolución de tu producción diaria.
          </Typography>
        </Box>
        <TextField
          select
          size="small"
          value={range}
          onChange={(e) => setRange(e.target.value as TrendRange)}
          label="Rango"
          inputProps={{ "data-testid": "trends-range-select" }}
        >
          <MenuItem value="7">Últimos 7 días</MenuItem>
          <MenuItem value="14">Últimos 14 días</MenuItem>
          <MenuItem value="30">Últimos 30 días</MenuItem>
          <MenuItem value="all">Todo</MenuItem>
        </TextField>
      </Stack>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid rgba(0,0,0,0.06)" }}>
        {hasData ? (
          <Box sx={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, rightDomainMax]}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalTempos"
                  name="Tempos"
                  stroke="#3156d8"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="targetProgress"
                  name="% del objetivo"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="averageSatisfaction"
                  name="Satisfacción"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        ) : (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography color="text.secondary" data-testid="trends-empty">
              Aún no hay suficientes datos para mostrar tendencias. Cierra algunas actividades con
              honestidad y vuelve luego.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default TrendsView;
