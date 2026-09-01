"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ActionButton } from "./action-button";

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog className="dialog" ref={ref} onClose={onCancel} aria-labelledby="dialog-title">
      <h2 id="dialog-title">{title}</h2>
      <div className="dialog__body">{children}</div>
      <div className="button-row">
        <ActionButton onClick={onCancel}>Keep everything</ActionButton>
        <ActionButton onClick={onConfirm} tone="danger">{confirmLabel}</ActionButton>
      </div>
    </dialog>
  );
}
