import React from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Box, Typography, useTheme } from "@mui/material";
import type { TimeDistributionData } from "../../../types";

interface DistributionPieProps {
  categories: TimeDistributionData["categories"];
}

// Definir interfaces específicas para los componentes
interface ActivityDetail {
  title: string;
  minutes: number;
  percentage: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      name: string;
      value: number;
      percentage: number;
      details: ActivityDetail[];
    };
  }>;
}

interface LabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}

// Colores para diferentes categorías
const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#A28CFF",
  "#FF6B6B",
  "#4ECDC4",
  "#C7F464",
];

const DistributionPie: React.FC<DistributionPieProps> = ({ categories }) => {
  const theme = useTheme();

  // Si no hay categorías, mostrar mensaje
  if (!categories.length) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <Typography variant="body1" color="text.secondary">
          No hay datos de distribución disponibles
        </Typography>
      </Box>
    );
  }

  // Formatear los datos para el gráfico
  const data = categories.map((category) => ({
    name: category.name,
    value: category.totalMinutes,
    percentage: category.percentage,
    // Incluimos detalles para el tooltip
    details: category.activities.map((activity) => ({
      title: activity.title,
      minutes: activity.minutes,
      percentage: activity.percentage,
    })),
  }));

  // Componente personalizado para el tooltip
  const CustomTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <Box
          sx={{
            backgroundColor: theme.palette.background.paper,
            padding: 1.5,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            boxShadow: theme.shadows[3],
            maxWidth: 300,
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            {item.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {Math.round(item.percentage * 100)}% ({Math.round(item.value)} min)
          </Typography>
          {item.details && item.details.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: "bold", display: "block", mt: 1 }}>
                Actividades:
              </Typography>
              {item.details.map((detail: ActivityDetail, index: number) => (
                <Typography variant="caption" key={index} sx={{ display: "block", ml: 1 }}>
                  • {detail.title}: {Math.round(detail.percentage * 100)}% ({detail.minutes} min)
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      );
    }
    return null;
  };

  // Componente personalizado para renderizar etiquetas
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: LabelProps) => {
    // Solo mostrar etiqueta si el porcentaje es significativo
    if (percent < 0.05) return null;

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Box sx={{ width: "100%", height: 400 }} data-testid="distribution-pie">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={150}
            fill="#8884d8"
            dataKey="value"
            nameKey="name"
            isAnimationActive={true}
            animationDuration={800}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
                stroke={theme.palette.background.paper}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ paddingTop: "20px" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default DistributionPie;
