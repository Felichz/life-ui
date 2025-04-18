import { useState, useCallback } from "react";

interface UseModalResult {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/**
 * Hook para controlar el estado de un modal
 * @param initialState Estado inicial del modal (abierto o cerrado)
 * @returns Objeto con el estado y métodos para manipularlo
 */
export const useModal = (initialState: boolean = false): UseModalResult => {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prevState) => !prevState);
  }, []);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
};
