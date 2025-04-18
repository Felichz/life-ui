import { IconButton, Tooltip } from "@mui/material";
import type { IconButtonProps } from "@mui/material";
import type { ReactElement } from "react";

interface IconButtonWithTooltipProps extends Omit<IconButtonProps, "children"> {
  title: string;
  icon: ReactElement;
  placement?: "top" | "bottom" | "left" | "right";
}

const IconButtonWithTooltip = ({
  title,
  icon,
  placement = "top",
  disabled,
  ...props
}: IconButtonWithTooltipProps) => {
  // Si el botón está deshabilitado, envolver en span para que el tooltip funcione
  if (disabled) {
    return (
      <Tooltip title={title} placement={placement} arrow>
        <span>
          <IconButton disabled={disabled} {...props}>
            {icon}
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  // Si no está deshabilitado, renderizar normalmente
  return (
    <Tooltip title={title} placement={placement} arrow>
      <IconButton disabled={disabled} {...props}>
        {icon}
      </IconButton>
    </Tooltip>
  );
};

export default IconButtonWithTooltip;
