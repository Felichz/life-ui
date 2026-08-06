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
  Alert,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import type { CompletionRequest } from "../../types";

const SCORE_LABELS: Record<number, string> = {
  0: "No completé. Está bien, lo importante es que lo declaré.",
  1: "No pude hoy. Volver a intentar.",
  2: "Casi no empecé. Mañana es otra oportunidad.",
  3: "Me costó mucho. Pero registré y eso cuenta.",
  4: "Avancé a medias. Reconocerlo es un paso.",
  5: "Cumplí lo mínimo sin extras. Está bien.",
  6: "Cumpliste algo. Reconocerlo es un paso.",
  7: "Lo hiciste. Eso es lo que cuenta.",
  8: "Bien hecho. Bonus del 10% por encima.",
  9: "Muy bien. Bonus del 20% por encima.",
  10: "Excelente. Bonus del 30% por encima.",
};

/**
 * Score mínimo que otorga tempos (default del slider al abrir).
 * Score 7 = 100% × minutos estimados.
 */
const SCORE_REWARD_THRESHOLD = 7;
const SCORE_DEFAULT = 7;

interface CompletionModalProps {
  open: boolean;
  request: CompletionRequest | null;
  /**
   * Mensaje de error si el cierre anterior falló. Si está presente, el modal
   * permanece abierto para que el usuario pueda reintentar o cancelar.
   */
  error?: string | null;
  onConfirm: (assessment: { satisfactionScore: number }) => void;
  onInterrupt: () => void;
  onClose: () => void;
  /** Limpia el error del flow (al reintentar o al cambiar el score). */
  onRetry?: () => void;
}

const CompletionModal: React.FC<CompletionModalProps> = ({
  open,
  request,
  error,
  onConfirm,
  onInterrupt,
  onClose,
  onRetry,
}) => {
  const [score, setScore] = useState<number>(SCORE_DEFAULT);

  // Reset a 7 (default) cada vez que se abre el modal con un nuevo
  // request. NO auto-10 por beat estimate: el bonus debe ser decisión
  // explícita del usuario en el slider (score 8/9/10 = 110%/120%/130%).
  // `beatEstimate` se conserva como métrica informativa (mostrada en
  // "✓ batiste el estimado") pero ya no sesga el score.
  useEffect(() => {
    if (open) {
      setScore(SCORE_DEFAULT);
    }
  }, [open, request?.activityTitle]);

  const preview = useMemo(() => {
    if (!request) return { base: 0, multiplier: 1, total: 0 };
    // El score 7 es el umbral: 100% × base. Los scores 8/9/10 son
    // bonus 110%/120%/130%. Score 0-6 = 0 tempos.
    const multipliers: Record<number, number> = {
      7: 1.0,
      8: 1.1,
      9: 1.2,
      10: 1.3,
    };
    const multiplier = multipliers[score] ?? 0;
    const base =
      request.estimatedMinutes !== undefined
        ? request.estimatedMinutes
        : request.durationMinutes;
    const total = Math.ceil(base * multiplier);
    return { base, multiplier, total };
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
          {error && (
            <Alert
              severity="error"
              data-testid="completion-error"
              onClose={onRetry}
              action={
                onRetry && (
                  <Button color="inherit" size="small" onClick={onRetry} data-testid="completion-retry">
                    Reintentar
                  </Button>
                )
              }
            >
              No pudimos guardar el cierre: {error}. Vuelve a intentarlo o cancela.
            </Alert>
          )}
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
                color={request.beatEstimate ? "success.main" : "text.secondary"}
                sx={{ mt: 0.5 }}
                data-testid="estimate-info"
              >
                Estimado: {request.estimatedMinutes} min
                {request.beatEstimate && " ✓ batiste el estimado"}
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
                onChange={(_, v) => {
                  setScore(v as number);
                  // Al ajustar el score, limpiamos el error para que
                  // el usuario sepa que el nuevo intento aún no se hizo.
                  if (error && onRetry) onRetry();
                }}
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
                  {preview.base} min × {Math.round(preview.multiplier * 100)}% = {preview.total} tempos
                </Typography>
              </Stack>
            )}
            {score < SCORE_REWARD_THRESHOLD && (
              <Typography variant="caption" color="text.secondary">
                {score < SCORE_REWARD_THRESHOLD
                  ? `Un score ${score}/10 no otorga tempos. Mueve el slider a ${SCORE_REWARD_THRESHOLD}+ para registrar tu esfuerzo.`
                  : null}
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
