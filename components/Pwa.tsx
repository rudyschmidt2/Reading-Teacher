"use client";

import { useEffect, useState } from "react";
import { XIcon } from "@/components/Icons";

const SEEN = "reading-teacher-install-hint";

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }, []);
  return null;
}

/** Only rendered after the house has loaded on the client, so window is safe to read once. */
function installHint(): { show: boolean; ios: boolean } {
  if (typeof window === "undefined") return { show: false, ios: false };
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  if (standalone || window.localStorage.getItem(SEEN)) return { show: false, ios: false };
  return { show: true, ios: /iPad|iPhone|iPod/.test(navigator.userAgent) };
}

/** One dismissible line. Once dismissed it stays dismissed on this device. */
export function InstallHint() {
  const [{ show, ios }, setHint] = useState(installHint);

  if (!show) return null;
  return (
    <p className="mx-auto mt-4 flex max-w-lg items-center justify-between gap-3 rounded-full bg-white/10 py-1 pl-4 pr-1 text-left text-label font-bold text-white/82">
      <span>{ios ? "Add to Home Screen (Share → Add) so the teacher's voice works offline." : "Install this app so the teacher's voice works offline."}</span>
      <button
        type="button"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10"
        aria-label="Dismiss"
        onClick={() => {
          window.localStorage.setItem(SEEN, "1");
          setHint({ show: false, ios });
        }}
      >
        <XIcon size={16} />
      </button>
    </p>
  );
}
