import React from 'react';
import './Button.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'glass' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({
        className = '',
        variant = 'primary',
        size = 'md',
        fullWidth = false,
        leftIcon,
        rightIcon,
        isLoading,
        children,
        disabled,
        ...props
    }, ref) => {

        const classes = [
            'qc-btn',
            `qc-btn-${variant}`,
            `qc-btn-${size}`,
            fullWidth ? 'qc-btn-full' : '',
            isLoading ? 'qc-btn-loading' : '',
            className
        ].filter(Boolean).join(' ');

        return (
            <button
                ref={ref}
                className={classes}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && (
                    <span className="qc-btn-spinner">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    </span>
                )}

                {!isLoading && leftIcon && <span className="qc-btn-icon-left">{leftIcon}</span>}
                <span className="qc-btn-content">{children}</span>
                {!isLoading && rightIcon && <span className="qc-btn-icon-right">{rightIcon}</span>}
            </button>
        );
    }
);

Button.displayName = 'Button';
