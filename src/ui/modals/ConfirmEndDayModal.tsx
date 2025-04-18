import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";

interface ConfirmEndDayModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Modal de confirmación para finalizar el día
 */
const ConfirmEndDayModal: React.FC<ConfirmEndDayModalProps> = ({ open, onClose, onConfirm }) => {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="end-day-dialog-title"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="end-day-dialog-title">Finalizar día</DialogTitle>
      <DialogContent>
        <Typography variant="body1">¿Estás seguro que deseas finalizar el día?</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Si hay alguna actividad en curso, se completará automáticamente. Las actividades no
          iniciadas estarán disponibles para el próximo día.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button onClick={handleConfirm} color="primary" variant="contained">
          Finalizar día
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmEndDayModal;
