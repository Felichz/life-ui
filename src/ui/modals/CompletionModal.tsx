import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Slider,
  Paper,
  Stack,
  Divider,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import type { CompletionRequest, CompletionResult } from "../../types";

const SCORE_LABELS: Record<number, string> = {
  0: "No completé. Está bien, lo importante es que lo declaré.",
  1: "No pude hoy. Volver a intentar.",
  2: "Casi no empecé. Mañana es otra oportunidad.",
  3: "Me costó mucho. Pero registré y eso cuenta.",
  4: "Avancé a medias. Reconocerlo es un paso.",
  5: "Cumplí lo mínimo sin extras. Está bien.",
  6: "Cumpliste. Base sólida para mañana.",
  7: "Buen trabajo. Hubo avance real y mantenido.",
  8: "Muy bien. Foco sostenido con pocas fricciones.",
  9: "Excelente. Fluiste casi todo el tiempo.",
  10: "Hyperfocus + eficiente. Tu estándar.",
};

interface CompletionModalProps {
  open: boolean;
  request: CompletionRequest | null;
  onConfirm: (assessment: { satisfactionScore: number }) => CompletionResult;
  onInterrupt: () => void;
  onClose: () => void;
}

const CompletionModal: React.FC<CompletionModalProps> = ({
  open,
  request,
  onConfirm,
  onInterrupt,
  onClose,
}) => {
  const [score, setScore] = useState<number>(5);

  // Auto-10 si aplica bonus y se cerró temprano
  useEffect(() => {
    if (open && request?.canApplyBonus) {
      setScore(10);
    } else if (open) {
      setScore(5);
    }
  }, [open, request?.canApplyBonus]);

  const preview = useMemo(() => {
    if (!request) return { base: 0, bonus: 0, total: 0 };
    const base = Math.ceil((request.durationMinutes * score) / 10);
    const bonus = request.canApplyBonus && score > 0 ? 5 : 0;
    return { base, bonus, total: score === 0 ? 0 : base + bonus };
  }, [request, score]);

  if (!request) return null;

  const handleConfirm = () => {
    onConfirm({ satisfactionScore: score });
  };

  const handleInterrupt = () => {
    onInterrupt();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" data-testid="completion-modal">
      <DialogTitle sx={{ pb: 1 }}>Terminaste &ldquo;{request.activityTitle}&rdquo;</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Tiempo real
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {request.durationMinutes} min
            </Typography>
            {request.estimatedMinutes !== undefined && (
              <Typography
                variant="body2"
                color={request.canApplyBonus ? "success.main" : "text.secondary"}
                sx={{ mt: 0.5 }}
                data-testid="estimate-info"
              >
                Estimado: {request.estimatedMinutes} min
                {request.canApplyBonus && " ✓ batiste el estimado"}
              </Typography>
            )}
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              ¿Qué tan satisfecho estás con lo que hiciste?
            </Typography>
            <Box sx={{ px: 2 }}>
              <Slider
                value={score}
                onChange={(_, v) => setScore(v as number)}
                min={0}
                max={10}
                step={1}
                marks
                valueLabelDisplay="auto"
                data-testid="satisfaction-slider"
              />
            </Box>
            <Typography
              variant="body2"
              sx={{ mt: 1, fontStyle: "italic", color: "text.secondary" }}
              data-testid="score-label"
            >
              {score}/10 — {SCORE_LABELS[score]}
            </Typography>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: preview.total > 0 ? "#eef5ee" : "#f5f5f5",
            }}
            data-testid="tempos-preview"
          >
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.12em" }}>
              Vista previa
            </Typography>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 0.5 }}>
              <Typography variant="h4" sx={{ fontWeight: 800 }} data-testid="preview-total">
                {preview.total}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                tempos
              </Typography>
            </Box>
            {preview.total > 0 && (
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {score} × {request.durationMinutes} min = {preview.base} base
                </Typography>
                {preview.bonus > 0 && (
                  <Typography variant="caption" color="success.main">
                    + {preview.bonus} bonus por eficiencia
                  </Typography>
                )}
              </Stack>
            )}
            {score === 0 && (
              <Typography variant="caption" color="text.secondary">
                Un 0/10 no otorga tempos. Está bien, no todos los días rinden igual.
              </Typography>
            )}
          </Paper>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
        <Button
          onClick={handleInterrupt}
          color="inherit"
          startIcon={<CancelRoundedIcon />}
          data-testid="interrupt-button"
        >
          No la terminé
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          startIcon={<CheckCircleRoundedIcon />}
          data-testid="confirm-button"
          disabled={score < 0 || score > 10}
        >
          {preview.total > 0 ? `Guardar y recibir ${preview.total} tempos` : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CompletionModal;
