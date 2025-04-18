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
    if (!state.currentDay) return null;
    return getTimelineData(state.currentDay.day.id);
  }, [getTimelineData, state.currentDay]);

  // Renderizar skeleton loader si no hay datos disponibles
  if (!timelineData || !state.currentDay) {
    return (
      <Box sx={{ width: "100%" }}>
        <SkeletonLoader type="timeline" count={3} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <Timeline
        activities={timelineData.activities}
        events={timelineData.events}
        interruptions={timelineData.interruptions}
      />
    </Box>
  );
};

export default TimelineContainer;
