import React from "react";
import EventLibraryModal from "../modals/EventLibraryModal";

interface EventLibraryModalContainerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Contenedor para el modal de gestión de biblioteca de eventos
 */
const EventLibraryModalContainer: React.FC<EventLibraryModalContainerProps> = ({
  open,
  onClose,
}) => {
  return <EventLibraryModal open={open} onClose={onClose} />;
};

export default EventLibraryModalContainer;
