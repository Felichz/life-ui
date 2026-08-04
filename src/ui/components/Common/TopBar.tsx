import { AppBar, Toolbar, Typography, Button, Box, IconButton, Tooltip, Chip } from "@mui/material";
import { Link as RouterLink, useInRouterContext, useLocation } from "react-router-dom";
import BedtimeIcon from "@mui/icons-material/Bedtime";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import type { ReactNode } from "react";

interface TopBarProps {
  isDayActive?: boolean;
  onEndDayClick?: () => void;
  actionButtons?: ReactNode;
}

const TopBar = ({ isDayActive = false, onEndDayClick, actionButtons }: TopBarProps) => {
  const inRouter = useInRouterContext();
  // TopBar can also be rendered as an isolated component in previews/tests.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const location = inRouter ? useLocation() : null;
  const isPath = (path: string) => location?.pathname === path;

  return (
    <AppBar
      position="sticky"
      color="transparent"
      elevation={0}
      sx={{
        bgcolor: "rgba(255,255,255,0.88)",
        borderBottom: "1px solid rgba(99, 115, 145, 0.14)",
        backdropFilter: "blur(14px)",
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 64, md: 72 }, gap: 1.5, px: { xs: 2, md: 4 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, mr: { md: 3 } }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              display: "grid",
              placeItems: "center",
              borderRadius: 2.5,
              bgcolor: "primary.main",
              color: "primary.contrastText",
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 19 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ lineHeight: 1.05, letterSpacing: "-0.03em" }}>
              Qualia Control
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              Tu interfaz para el día real
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Button
            component={inRouter ? RouterLink : "a"}
            to="/"
            href="/"
            color={isPath("/") ? "primary" : "inherit"}
            startIcon={
              <Box component="span" sx={{ fontSize: 16 }}>
                ◷
              </Box>
            }
            sx={{ color: isPath("/") ? "primary.main" : "text.secondary", px: 1.5 }}
          >
            Hoy
          </Button>
          <Button
            component={inRouter ? RouterLink : "a"}
            to="/overview"
            href="/overview"
            color={isPath("/overview") ? "primary" : "inherit"}
            startIcon={
              <Box component="span" sx={{ fontSize: 16 }}>
                ▥
              </Box>
            }
            sx={{ color: isPath("/overview") ? "primary.main" : "text.secondary", px: 1.5 }}
          >
            Resumen
          </Button>
        </Box>

        <Box sx={{ flexGrow: 1 }} />
        {isDayActive && (
          <Chip
            size="small"
            label="Día en curso"
            sx={{
              display: { xs: "none", sm: "inline-flex" },
              color: "success.dark",
              bgcolor: "rgba(33,139,105,0.1)",
              border: "1px solid rgba(33,139,105,0.18)",
            }}
          />
        )}
        {actionButtons}
        {isDayActive && (
          <Tooltip title="Finalizar día">
            <IconButton
              color="primary"
              onClick={onEndDayClick}
              aria-label="finalizar día"
              sx={{ ml: 0.5, bgcolor: "rgba(49,86,216,0.08)" }}
            >
              <BedtimeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
