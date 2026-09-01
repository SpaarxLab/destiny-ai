import { forwardRef, type ButtonHTMLAttributes } from "react";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "primary" | "secondary" | "quiet" | "danger";
  fullWidth?: boolean;
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton({
  className = "",
  tone = "secondary",
  fullWidth = false,
  type = "button",
  ...props
}, ref) {
  return (
    <button
      className={`action-button action-button--${tone}${fullWidth ? " action-button--full" : ""} ${className}`}
      ref={ref}
      type={type}
      {...props}
    />
  );
});
