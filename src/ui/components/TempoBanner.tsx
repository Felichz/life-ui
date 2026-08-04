import React, { useMemo } from "react";
import { Box, Paper, Typography, LinearProgress, Stack } from "@mui/material";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import { useSystemCore } from "../hooks/useSystemCore";

const TempoBanner: React.FC = () => {
  const { state, getCurrentDay, getTempoSummary } = useSystemCore();

  const summary = useMemo(() => {
    const currentDay = getCurrentDay();
    if (!currentDay) return null;
    return getTempoSummary(currentDay.id);
  }, [state.global.completedActivityRecords, state.currentDay, getCurrentDay, getTempoSummary]);

  if (!summary) return null;

  const percent = summary.displayPercent;
  const barValue = summary.progressBarValue;
  const isOverTarget = summary.totalTempos >= summary.target;

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 2.5 },
        mb: 3,
        borderRadius: 4,
        background: isOverTarget
          ? "linear-gradient(135deg, #1d2b4a 0%, #315183 100%)"
          : "linear-gradient(135deg, #eef2ff 0%, #f7e9ff 100%)",
        color: isOverTarget ? "white" : "text.primary",
        border: isOverTarget ? "none" : "1px solid rgba(49,86,216,0.12)",
      }}
      data-testid="tempo-banner"
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            display: "grid",
            placeItems: "center",
            borderRadius: 2.5,
            bgcolor: isOverTarget ? "rgba(255,255,255,0.15)" : "rgba(49,86,216,0.12)",
            color: isOverTarget ? "#ffd166" : "primary.main",
            flexShrink: 0,
          }}
        >
          {isOverTarget ? <EmojiEventsRoundedIcon /> : <BoltRoundedIcon />}
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            variant="overline"
            sx={{
              color: isOverTarget ? "#aebcff" : "primary.main",
              letterSpacing: "0.12em",
              fontWeight: 800,
            }}
          >
            Hoy
          </Typography>

          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="h4" sx={{ fontWeight: 800 }} data-testid="tempo-total">
              {summary.totalTempos}
            </Typography>
            <Typography variant="body1" sx={{ color: isOverTarget ? "#aebcff" : "text.secondary" }}>
              / {summary.target} tempos
            </Typography>
            <Typography
              variant="body2"
              sx={{
                ml: 0.5,
                px: 1.5,
                py: 0.25,
                borderRadius: 999,
                bgcolor: isOverTarget ? "rgba(255,255,255,0.18)" : "rgba(49,86,216,0.10)",
                color: isOverTarget ? "white" : "primary.main",
                fontWeight: 700,
              }}
              data-testid="tempo-percent"
            >
              {percent}% de tu referencia diaria
            </Typography>
          </Box>

          <LinearProgress
            variant="determinate"
            value={barValue}
            sx={{
              mt: 1.5,
              height: 6,
              borderRadius: 3,
              bgcolor: isOverTarget ? "rgba(255,255,255,0.15)" : "rgba(49,86,216,0.10)",
              "& .MuiLinearProgress-bar": {
                bgcolor: isOverTarget ? "#ffd166" : "primary.main",
              },
            }}
            data-testid="tempo-progress"
          />
        </Box>
      </Box>

      {summary.lastReward && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: 1.5, color: isOverTarget ? "#aebcff" : "text.secondary" }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            Última:
          </Typography>
          <Typography variant="caption" data-testid="last-reward">
            {summary.lastReward.activityTitle} ·{" "}
            <strong>+{summary.lastReward.tempos} tempos</strong>
          </Typography>
        </Stack>
      )}
    </Paper>
  );
};

export default TempoBanner;
