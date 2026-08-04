import { useEffect, useRef } from "react";

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmTone?: "danger" | "primary";
  onConfirm(): void;
  onCancel(): void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!props.open) return;
    cancel.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onCancel();
      if (event.key === "Tab") {
        const dialog = document.querySelector<HTMLElement>(".dialog-card");
        const controls = dialog?.querySelectorAll<HTMLElement>("button") ?? [];
        if (controls.length < 2) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [props.open, props.onCancel]);
  if (!props.open) return null;
  return (
    <div className="dialog-backdrop">
      <div
        className="dialog-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
      >
        <h2 id="dialog-title">{props.title}</h2>
        <p id="dialog-description">{props.description}</p>
        <div className="dialog-actions">
          <button ref={cancel} className="button secondary" type="button" onClick={props.onCancel}>
            Quay lại
          </button>
          <button
            className={`button ${props.confirmTone ?? "danger"}`}
            type="button"
            onClick={props.onConfirm}
          >
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
