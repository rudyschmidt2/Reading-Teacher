"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ShieldIcon, WifiOffIcon, XIcon } from "@/components/Icons";

/**
 * Small shared pieces for both doors: the hold-to-open pill, a progress bar
 * that never fakes a number, a bottom sheet with a focus trap, the desk's
 * segment bar, and the offline pill.
 */

export function HoldToOpen({ onOpen, label = "Hold for parents", ms = 1600, className = "" }: { onOpen: () => void; label?: string; ms?: number; className?: string }) {
  const timer = useRef<number | null>(null);
  const [holding, setHolding] = useState(false);
  const start = () => {
    setHolding(true);
    timer.current = window.setTimeout(onOpen, ms);
  };
  const end = () => {
    setHolding(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <button
      type="button"
      className={`hold-btn ${className}`}
      aria-label={`${label}. Press and hold.`}
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={end}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className={`hold-ring relative grid h-11 w-11 shrink-0 place-items-center rounded-full ${holding ? "hold-ring--go" : ""}`}>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[#1b1440] text-white">
          <ShieldIcon size={20} />
        </span>
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block leading-none">{holding ? "Keep holding…" : label}</span>
        <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-white/15">
          <span className={`block h-full rounded-full bg-gradient-to-r from-amber-300 to-fuchsia-400 ${holding ? "hold-fill" : "w-0"}`} />
        </span>
      </span>
    </button>
  );
}

/** A bar that stays empty and unlabelled until there is a real number. */
export function Bar({ pct, label, className = "", size = "sm" }: { pct?: number; label?: string; className?: string; size?: "sm" | "md" }) {
  const has = pct !== undefined && Number.isFinite(pct);
  return (
    <span className={`${size === "md" ? "grade-bar" : "stat-bar"} ${className}`} role={has ? "img" : undefined} aria-label={has ? label ?? `${pct}%` : undefined} aria-hidden={has ? undefined : true}>
      <span style={{ width: `${has ? pct : 0}%` }} />
    </span>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Bottom sheet: portal, focus trap, Escape and backdrop close, restores focus to the opener. */
export function Sheet({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !ref.current) return;
    const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="sheet" onClick={onClose} role="presentation">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`sheet__panel ${wide ? "sm:max-w-3xl" : ""}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <span className="sheet__grip" aria-hidden />
        <header className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-title font-black text-white">{title}</h2>
          <button ref={closeRef} type="button" className="chip chip--icon" aria-label="Close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export type Segment<T extends string> = { id: T; label: string; icon?: ReactNode; dot?: boolean };

export function SegmentBar<T extends string>({ segments, value, onChange, label }: { segments: Segment<T>[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div className="segbar" role="tablist" aria-label={label}>
      {segments.map((s) => (
        <button key={s.id} type="button" role="tab" aria-selected={value === s.id} className="segbar__tab" onClick={() => onChange(s.id)} data-seg={s.id}>
          {s.icon}
          <span>{s.label}</span>
          {s.dot ? <span className="segbar__dot" aria-label="needs a decision" /> : null}
        </button>
      ))}
    </div>
  );
}

const onlineSubscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

export function useOnline() {
  return useSyncExternalStore(
    onlineSubscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** Shown only when the device is offline. Everything is saved on this phone already. */
export function OfflinePill() {
  const online = useOnline();
  if (online) return null;
  return (
    <span className="offline-pill" role="status">
      <WifiOffIcon size={14} />
      Offline — saved on this phone
    </span>
  );
}

export function Confirm({ open, onClose, title, body, confirmLabel, danger = false, onConfirm }: { open: boolean; onClose: () => void; title: string; body: string; confirmLabel: string; danger?: boolean; onConfirm: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text-body text-slate-300">{body}</p>
      <div className="mt-4 grid gap-2">
        <button
          type="button"
          className={`opt ${danger ? "bg-rose-500/80 text-white" : "opt--primary"}`}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
        <button type="button" className="opt" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}
