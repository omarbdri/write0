import { useDialogFocus } from '../hooks/useDialogFocus';
import React, { useRef, useState } from 'react';
import { X } from 'lucide-react';

type ConfirmVariant = 'danger' | 'default';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}) => {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isBusy, setIsBusy] = useState(false);

  useDialogFocus(isOpen, dialogRef, cancelButtonRef, () => {
    if (!isBusy) onCancel();
  });

  if (!isOpen) return null;

  const confirmClasses =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90';

  const handleConfirm = async () => {
    if (isBusy) return;
    const result = onConfirm();
    if (result && typeof (result as Promise<void>).then === 'function') {
      try {
        setIsBusy(true);
        await result;
      } finally {
        setIsBusy(false);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/10 dark:bg-black/40 backdrop-blur-[1px] animate-in fade-in duration-200"
      onClick={() => {
        if (!isBusy) onCancel();
      }}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg w-full max-w-md overflow-hidden relative animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="w0-confirm-title"
        aria-describedby={description ? 'w0-confirm-desc' : undefined}
      >
        <div className="px-5 pt-6 pb-1 flex justify-between items-center">
          <h2
            id="w0-confirm-title"
            className="text-base font-semibold text-gray-900 dark:text-white text-[20px]"
          >
            {title}
          </h2>
          <button
            onClick={() => {
              if (!isBusy) onCancel();
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label="Close dialog"
            disabled={isBusy}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          {description && (
            <p id="w0-confirm-desc" className="text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>

        <div className="px-5 py-4 pt-0 flex items-center justify-end gap-2">
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            disabled={isBusy}
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors active:scale-[0.99] ${confirmClasses} ${
              isBusy ? 'opacity-70 pointer-events-none' : ''
            }`}
            disabled={isBusy}
          >
            {isBusy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
