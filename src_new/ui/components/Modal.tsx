import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    closeOnOverlayClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    maxWidth = 'md',
    closeOnOverlayClick = true
}) => {
    const [isMounted, setIsMounted] = useState(false);
    const [isRendered, setIsRendered] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setIsRendered(true);
            document.body.style.overflow = 'hidden';
        } else {
            // Small delay for exit animation
            const timer = setTimeout(() => setIsRendered(false), 300);
            document.body.style.overflow = '';
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isMounted || (!isOpen && !isRendered)) return null;

    const modalClasses = [
        'qc-modal-content',
        'glass-panel',
        `qc-modal-${maxWidth}`,
        isOpen ? 'qc-modal-enter' : 'qc-modal-exit'
    ].join(' ');

    const overlayClasses = [
        'qc-modal-overlay',
        isOpen ? 'qc-overlay-enter' : 'qc-overlay-exit'
    ].join(' ');

    return createPortal(
        <div className="qc-modal-portal">
            <div
                className={overlayClasses}
                onClick={closeOnOverlayClick ? onClose : undefined}
                aria-hidden="true"
            />

            <div className="qc-modal-wrapper" role="dialog" aria-modal="true">
                <div className={modalClasses} onClick={e => e.stopPropagation()}>

                    <div className="qc-modal-header">
                        {title && <h2 className="qc-modal-title">{title}</h2>}
                        <button className="qc-modal-close" onClick={onClose} aria-label="Close modal">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    <div className="qc-modal-body">
                        {children}
                    </div>

                    {footer && (
                        <div className="qc-modal-footer">
                            {footer}
                        </div>
                    )}

                </div>
            </div>
        </div>,
        document.body
    );
};
