import React, { useState } from "react";
import type { SelectChangeEvent } from "@mui/material";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormHelperText,
  CircularProgress,
  Stack,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import type { InterruptionCause, UUID } from "../../types";

interface InterruptionModalProps {
  open: boolean;
  onClose: () => void;
  activityTitle?: string;
  causes: InterruptionCause[];
  isCreatingCause: boolean;
  onConfirm: (isAvoidable: boolean, causeId?: UUID) => void;
  onCreateCause: (description: string) => Promise<InterruptionCause | null>;
}

/**
 * Modal para gestionar la interrupción de una actividad
 */
const InterruptionModal: React.FC<InterruptionModalProps> = ({
  open,
  onClose,
  activityTitle,
  causes,
  isCreatingCause,
  onConfirm,
  onCreateCause,
}) => {
  // Estado para el tipo de interrupción (evitable o no)
  const [isAvoidable, setIsAvoidable] = useState<boolean | null>(null);

  // Estado para la causa seleccionada
  const [selectedCauseId, setSelectedCauseId] = useState<UUID | "new" | "">("");

  // Estado para la descripción de una nueva causa
  const [newCauseDescription, setNewCauseDescription] = useState("");

  // Estado para errores de validación
  const [error, setError] = useState<string | null>(null);

  // Estado para indicar si estamos procesando
  const [isProcessing, setIsProcessing] = useState(false);

  // Resetear estados al abrir el modal
  React.useEffect(() => {
    if (open) {
      setIsAvoidable(null);
      setSelectedCauseId("");
      setNewCauseDescription("");
      setError(null);
      setIsProcessing(false);
    }
  }, [open]);

  // Manejar cambio en el tipo de interrupción
  const handleAvoidableChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsAvoidable(event.target.value === "true");
    // Si no es evitable, resetear la causa seleccionada
    if (event.target.value === "false") {
      setSelectedCauseId("");
      setNewCauseDescription("");
    }
  };

  // Manejar cambio en la causa seleccionada
  const handleCauseChange = (event: SelectChangeEvent) => {
    setSelectedCauseId(event.target.value as UUID | "new");
    if (event.target.value !== "new") {
      setNewCauseDescription("");
    }
  };

  // Manejar cambio en la descripción de la nueva causa
  const handleNewCauseChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewCauseDescription(event.target.value);
    // Limpiar error si el usuario empieza a escribir
    if (error && event.target.value.trim()) {
      setError(null);
    }
  };

  // Manejar la confirmación
  const handleConfirm = async () => {
    // Validar que se haya seleccionado un tipo de interrupción
    if (isAvoidable === null) {
      setError("Por favor, indica si la causa era evitable o no");
      return;
    }

    // Si es evitable, validar que se haya seleccionado o creado una causa
    if (isAvoidable) {
      if (selectedCauseId === "") {
        setError("Por favor, selecciona o crea una causa de interrupción");
        return;
      }

      // Si se está creando una nueva causa, validar la descripción
      if (selectedCauseId === "new") {
        if (!newCauseDescription.trim()) {
          setError("Por favor, describe la causa de interrupción");
          return;
        }

        try {
          setIsProcessing(true);
          const newCause = await onCreateCause(newCauseDescription.trim());
          setIsProcessing(false);

          if (newCause) {
            // Confirmar con la nueva causa creada
            onConfirm(true, newCause.id);
          } else {
            setError("No se pudo crear la causa");
          }
        } catch (err) {
          setIsProcessing(false);
          setError(
            "Error al crear la causa: " + (err instanceof Error ? err.message : "Error desconocido")
          );
        }
      } else {
        // Confirmar con la causa seleccionada
        onConfirm(true, selectedCauseId as UUID);
      }
    } else {
      // Si no es evitable, confirmar sin causa
      onConfirm(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="interrupcion-dialogo-titulo"
      data-testid="interruption-modal"
    >
      <DialogTitle id="interrupcion-dialogo-titulo">Interrumpir actividad</DialogTitle>
      <DialogContent>
        <Box mt={2}>
          {activityTitle && (
            <Typography variant="subtitle1" gutterBottom>
              Interrumpiendo: <strong>{activityTitle}</strong>
            </Typography>
          )}

          <Typography variant="body1" gutterBottom mt={2}>
            ¿Fue por una causa que podrías evitar en el futuro?
          </Typography>

          <RadioGroup
            aria-label="causa-evitable"
            name="causa-evitable"
            value={isAvoidable === null ? "" : isAvoidable.toString()}
            onChange={handleAvoidableChange}
          >
            <FormControlLabel
              value="true"
              control={<Radio />}
              label="Sí, podría evitarse"
              data-testid="avoidable-yes"
            />
            <FormControlLabel
              value="false"
              control={<Radio />}
              label="No, era inevitable"
              data-testid="avoidable-no"
            />
          </RadioGroup>

          {isAvoidable && (
            <Stack spacing={2} mt={2}>
              <FormControl fullWidth error={isAvoidable && selectedCauseId === "" && !!error}>
                <InputLabel id="causa-interrupcion-label">Causa de interrupción</InputLabel>
                <Select
                  labelId="causa-interrupcion-label"
                  value={selectedCauseId}
                  onChange={handleCauseChange}
                  label="Causa de interrupción"
                  data-testid="cause-select"
                >
                  <MenuItem value="">
                    <em>Selecciona una causa</em>
                  </MenuItem>
                  {causes.map((cause) => (
                    <MenuItem key={cause.id} value={cause.id}>
                      {cause.description}
                    </MenuItem>
                  ))}
                  <MenuItem value="new" data-testid="new-cause-option">
                    <Box display="flex" alignItems="center">
                      <AddIcon fontSize="small" sx={{ mr: 1 }} />
                      Nueva causa
                    </Box>
                  </MenuItem>
                </Select>
                {isAvoidable && selectedCauseId === "" && error && (
                  <FormHelperText>{error}</FormHelperText>
                )}
              </FormControl>

              {selectedCauseId === "new" && (
                <TextField
                  fullWidth
                  label="Descripción de la causa"
                  value={newCauseDescription}
                  onChange={handleNewCauseChange}
                  error={selectedCauseId === "new" && !newCauseDescription && !!error}
                  helperText={
                    selectedCauseId === "new" && !newCauseDescription && error
                      ? error
                      : "Describe brevemente la causa de interrupción"
                  }
                  data-testid="new-cause-input"
                />
              )}
            </Stack>
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          color="primary"
          variant="contained"
          disabled={isProcessing || isAvoidable === null}
          data-testid="confirm-button"
        >
          {isProcessing ? <CircularProgress size={24} /> : "Confirmar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InterruptionModal;
