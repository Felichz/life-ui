import React from "react";
import TimeBlockModal from "../modals/TimeBlockModal";

interface TimeBlockModalContainerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Contenedor para el modal de gestión de bloques de tiempo
 * Puede ser controlado externamente o usar su estado interno
 */
const TimeBlockModalContainer: React.FC<TimeBlockModalContainerProps> = ({ open, onClose }) => {
  return (
    <>
      <TimeBlockModal open={open} onClose={onClose} />
    </>
  );
};

export default TimeBlockModalContainer;
