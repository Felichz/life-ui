import React from "react";
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
import { Box, Typography, useTheme } from "@mui/material";
import { format, parseISO } from "date-fns";
import type { UUID, SubjectiveVariablesData } from "../../../types";

interface SubjectiveChartProps {
  data: SubjectiveVariablesData;
  hiddenVariables: UUID[];
  onToggle: (varId: UUID) => void;
}

// Colores para diferentes variables
const COLORS = [
  "#8884d8", // Morado
  "#82ca9d", // Verde
  "#ffc658", // Amarillo
  "#ff8042", // Naranja
  "#0088FE", // Azul
  "#FF6B6B", // Rojo suave
  "#4ECDC4", // Turquesa
  "#C7F464", // Lima
];

// Tipo para los datos de punto temporal en el gráfico
interface ChartDataPoint {
  timestamp: string;
  [key: string]: string | number | string[] | undefined;
}

// Interfaces para componentes específicos
interface TooltipEntry {
  name: string;
  value: number;
  dataKey: string; // Añadido dataKey para obtener el ID de la variable
  color?: string;
  payload: ChartDataPoint;
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

// Interfaces para la leyenda personalizada
interface LegendPayloadItem {
  value: string;
  type: string;
  id: string;
  color: string;
  payload: {
    value: number;
    variableId: UUID;
    variableName: string;
  };
}

interface CustomLegendProps {
  payload?: LegendPayloadItem[];
}

const SubjectiveChart: React.FC<SubjectiveChartProps> = ({ data, hiddenVariables, onToggle }) => {
  const theme = useTheme();

  // Si no hay variables o todas las variables están ocultas, mostrar mensaje
  const visibleVariables = data.variables.filter((v) => !hiddenVariables.includes(v.id));

  if (!data.variables.length) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <Typography variant="body1" color="text.secondary">
          No hay datos de variables subjetivas disponibles
        </Typography>
      </Box>
    );
  }

  if (visibleVariables.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <Typography variant="body1" color="text.secondary">
          Todas las variables están ocultas. Haga clic en la leyenda para mostrarlas.
        </Typography>
      </Box>
    );
  }

  // Formatear los datos para el gráfico de líneas
  const chartData = prepareChartData(data);

  // Componente personalizado para el tooltip
  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            backgroundColor: theme.palette.background.paper,
            padding: 1.5,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            boxShadow: theme.shadows[3],
            maxWidth: 350,
          }}
          data-testid="subjective-chart-tooltip"
        >
          <Typography variant="subtitle2" gutterBottom>
            {label ? format(parseISO(label), "HH:mm") : ""}
          </Typography>
          {payload.map((entry, index) => {
            // Extraer el ID de la variable desde dataKey que tiene formato "value_<UUID>"
            const variableId = entry.dataKey.split("_")[1];

            // Acceder a los datos dinámicos usando el ID extraído
            const variableName = entry.payload[`variableName_${variableId}`] as string;
            const value = entry.value;
            const relatedActivities = entry.payload[`relatedActivities_${variableId}`] as string[];
            const relatedEvents = entry.payload[`relatedEvents_${variableId}`] as string[];

            return (
              <Box key={index} sx={{ mb: 1 }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: entry.color,
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      backgroundColor: entry.color || "#000",
                      marginRight: 8,
                      borderRadius: "50%",
                    }}
                  ></span>
                  {variableName}: {value}
                </Typography>

                {relatedActivities && relatedActivities.length > 0 && (
                  <Box sx={{ mt: 0.5, ml: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: "bold", display: "block" }}>
                      Actividades relacionadas:
                    </Typography>
                    {relatedActivities.map((activity, i) => (
                      <Typography variant="caption" key={i} sx={{ display: "block", ml: 1 }}>
                        • {activity}
                      </Typography>
                    ))}
                  </Box>
                )}

                {relatedEvents && relatedEvents.length > 0 && (
                  <Box sx={{ mt: 0.5, ml: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: "bold", display: "block" }}>
                      Eventos relacionados:
                    </Typography>
                    {relatedEvents.map((event, i) => (
                      <Typography variant="caption" key={i} sx={{ display: "block", ml: 1 }}>
                        • {event}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      );
    }
    return null;
  };

  // Componente personalizado para la leyenda
  const CustomLegend = ({ payload }: CustomLegendProps) => {
    if (!payload) return null;

    return (
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 2,
          mt: 2,
        }}
        data-testid="subjective-chart-legend"
      >
        {payload.map((entry, index) => {
          const isHidden = hiddenVariables.includes(entry.payload.variableId);
          return (
            <Box
              key={`item-${index}`}
              sx={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                opacity: isHidden ? 0.5 : 1,
                transition: "opacity 0.3s",
                "&:hover": {
                  opacity: 0.8,
                },
              }}
              onClick={() => onToggle(entry.payload.variableId)}
              data-testid={`legend-item-${entry.payload.variableId}`}
            >
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  backgroundColor: entry.color,
                  borderRadius: "50%",
                  marginRight: 1,
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  textDecoration: isHidden ? "line-through" : "none",
                }}
              >
                {entry.value}
              </Typography>
            </Box>
          );
        })}
      </Box>
    );
  };

  return (
    <Box sx={{ width: "100%", height: 400 }} data-testid="subjective-chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(timestamp) => format(parseISO(timestamp), "HH:mm")}
            tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            stroke={theme.palette.divider}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            stroke={theme.palette.divider}
            label={{
              value: "Valor (1-10)",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle", fill: theme.palette.text.secondary },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />

          {data.variables.map((variable, index) => {
            const color = COLORS[index % COLORS.length];
            const isHidden = hiddenVariables.includes(variable.id);

            return (
              <Line
                key={variable.id}
                type="monotone"
                dataKey={`value_${variable.id}`}
                name={variable.name}
                stroke={color}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, fill: theme.palette.background.paper }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                hide={isHidden}
                isAnimationActive={true}
                animationDuration={800}
                data-testid={`subjective-chart-line-${variable.id}`}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

// Función para preparar los datos para el gráfico
function prepareChartData(data: SubjectiveVariablesData): ChartDataPoint[] {
  // Crear un mapa de puntos temporales
  const timestampMap: Record<string, ChartDataPoint> = {};

  // Para cada variable, procesar sus valores
  data.variables.forEach((variable) => {
    variable.values.forEach((entry) => {
      // Usar el timestamp como clave para agrupar valores del mismo momento
      if (!timestampMap[entry.timestamp]) {
        timestampMap[entry.timestamp] = {
          timestamp: entry.timestamp,
        };
      }

      // Añadir el valor de esta variable en este timestamp
      timestampMap[entry.timestamp][`value_${variable.id}`] = entry.value;

      // Añadir metadatos para el tooltip
      timestampMap[entry.timestamp][`variableName_${variable.id}`] = variable.name;
      timestampMap[entry.timestamp][`variableId_${variable.id}`] = variable.id;
      timestampMap[entry.timestamp][`relatedActivities_${variable.id}`] = entry.relatedActivities;
      timestampMap[entry.timestamp][`relatedEvents_${variable.id}`] = entry.relatedEvents;
    });
  });

  // Convertir el mapa a un array y ordenar por timestamp
  const chartData = Object.values(timestampMap).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return chartData;
}

export default SubjectiveChart;
