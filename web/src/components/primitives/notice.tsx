import type { ReactNode } from "react";

export function Notice({
  tone = "info",
  children,
  onDismiss,
  id,
}: {
  tone?: "info" | "success" | "warning";
  children: ReactNode;
  onDismiss?: () => void;
  id?: string;
}) {
  return (
    <div className={`notice notice--${tone}`} role={tone === "warning" ? "alert" : "status"} id={id}>
      <p>{children}</p>
      {onDismiss ? (
        <button className="notice__dismiss" type="button" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      ) : null}
    </div>
  );
}
