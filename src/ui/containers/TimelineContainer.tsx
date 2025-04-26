import React, { useMemo } from "react";
import { Box } from "@mui/material";
import { useSystemCore } from "../hooks/useSystemCore";
import Timeline from "../components/Timeline/Timeline";
import SkeletonLoader from "../components/Common/SkeletonLoader";

const TimelineContainer: React.FC = () => {
  // Obtener métodos y estado desde el contexto
  const { getTimelineData, state } = useSystemCore();

  // Obtener datos del timeline para el día actual
  const timelineData = useMemo(() => {
    const currentDayId = state.currentDay?.day.id;
    return getTimelineData(currentDayId);
    // Simplificar dependencias: Solo recalcular si cambian los registros completados
    // o si la función getTimelineData cambia (poco probable pero seguro incluirla)
  }, [getTimelineData, state.global.completedActivityRecords]);

  // Renderizar skeleton loader si no hay datos disponibles O no hay día
  if (!timelineData || !state.currentDay) {
    return (
      <Box sx={{ width: "100%" }}>
        <SkeletonLoader type="timeline" count={3} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      <Timeline
        activities={timelineData.activities}
        events={timelineData.events}
        interruptions={timelineData.interruptions}
      />
    </Box>
  );
};

export default TimelineContainer;
