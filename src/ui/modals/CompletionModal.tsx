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
import { UtilityService } from "../../system/utilityService";

const SCORE_LABELS: Record<number, string> = {
  0: "No completé. Está bien, lo importante es que lo declaré.",
  1: "Casi nada. Lo reconozco igual.",
  2: "Algo avancé. Mejor que nada.",
  3: "Me costó, pero registré.",
  4: "A medias, pero es honesto.",
  5: "Cumplí lo mínimo sin extras. Está bien.",
  6: "Cumpliste algo. Buen punto de partida.",
  7: "Lo hiciste. Eso es lo que cuenta.",
  8: "Bien hecho. Por encima del 100%.",
  9: "Muy bien. Casi el máximo.",
  10: "Excelente. Lo diste todo.",
};

/**
 * Score default del slider al abrir (= 100% de la base).
 * Fórmula: tempos = ceil(base × score / 7), por lo que score=7 da 100%.
 */
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

  // Reset al default (7 = 100% de la base) cada vez que se abre el
  // modal con un nuevo request. NO auto-10 por beat estimate: el
  // score es siempre decisión explícita del usuario en el slider.
  // `beatEstimate` se conserva como métrica informativa (mostrada en
  // "✓ batiste el estimado") pero ya no sesga el score.
  useEffect(() => {
    if (open) {
      setScore(SCORE_DEFAULT);
    }
  }, [open, request?.activityTitle]);

  const preview = useMemo(() => {
    if (!request) return { base: 0, multiplier: 0, total: 0 };
    // Fuente única de verdad: utilityService.resolveBaseMinutes +
    // calculatePreviewTempos. Mismo cálculo que el core (no puede divergir).
    const base = UtilityService.resolveBaseMinutes(
      request.estimatedMinutes,
      request.durationMinutes
    );
    // Fórmula lineal: cada punto del slider = base / 7 de recompensa.
    const multiplier = score / UtilityService.SCORE_DIVISOR;
    const total = UtilityService.calculatePreviewTempos(score, base);
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
            {request.estimatedMinutes !== undefined && request.estimatedMinutes > 0 && (
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
                  {preview.base} min × {score}/7 ≈ {preview.total} tempos
                </Typography>
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
