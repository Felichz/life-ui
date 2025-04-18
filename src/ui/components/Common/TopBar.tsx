import { AppBar, Toolbar, Typography, Button, Box, IconButton, Tooltip } from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";
import BedtimeIcon from "@mui/icons-material/Bedtime";
import type { ReactNode } from "react";

interface TopBarProps {
  isDayActive?: boolean;
  onEndDayClick?: () => void;
  actionButtons?: ReactNode;
}

/**
 * TopBar - Barra de navegación superior
 * Contiene el título de la aplicación, enlaces de navegación, botones de acción
 * y el botón para finalizar el día cuando está activo
 */
const TopBar = ({ isDayActive = false, onEndDayClick, actionButtons }: TopBarProps) => {
  // Obtener la ruta actual para resaltar el botón activo
  const location = useLocation();
  const isPath = (path: string) => location.pathname === path;

  return (
    <AppBar position="static" color="primary" elevation={0}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Qualia Control
        </Typography>
        <Box sx={{ display: { xs: "none", sm: "block" } }}>
          {/* Enlace a la vista principal */}
          <Button
            component={RouterLink}
            to="/"
            color="inherit"
            sx={{
              mx: 1,
              fontWeight: isPath("/") ? "bold" : "normal",
              borderBottom: isPath("/") ? "2px solid white" : "none",
            }}
          >
            Día
          </Button>
          {/* Enlace a la vista de resumen */}
          <Button
            component={RouterLink}
            to="/overview"
            color="inherit"
            sx={{
              mx: 1,
              fontWeight: isPath("/overview") ? "bold" : "normal",
              borderBottom: isPath("/overview") ? "2px solid white" : "none",
            }}
          >
            Resumen
          </Button>
        </Box>

        {/* Botones de acción adicionales */}
        {actionButtons}

        {/* Botón para finalizar el día (visible sólo cuando hay un día activo) */}
        {isDayActive && (
          <Tooltip title="Finalizar día">
            <IconButton
              color="inherit"
              onClick={onEndDayClick}
              sx={{ ml: 1 }}
              aria-label="finalizar día"
            >
              <BedtimeIcon />
            </IconButton>
          </Tooltip>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
