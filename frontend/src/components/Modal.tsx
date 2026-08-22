import React, { useEffect } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass =
    maxWidth === 'sm'
      ? 'max-w-sm'
      : maxWidth === 'lg'
      ? 'max-w-xl'
      : maxWidth === 'xl'
      ? 'max-w-2xl'
      : 'max-w-lg';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`card-box bg-white ${maxWidthClass} w-full p-6 shadow-2xl space-y-4 border border-gray-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start border-b border-gray-100 pb-3">
          <div>
            <h3 className="font-bold text-sm text-gray-900">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 font-mono">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-gray-400 hover:text-gray-900 text-sm font-bold p-1 rounded hover:bg-gray-50 transition"
          >
            &times;
          </button>
        </div>

        <div className="space-y-3 text-xs">{children}</div>

        {footer && <div className="pt-3 border-t border-gray-100 flex justify-end space-x-2">{footer}</div>}
      </div>
    </div>
  );
};
