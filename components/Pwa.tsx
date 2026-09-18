"use client";

import { useEffect, useState } from "react";

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
  if (standalone) return { show: false, ios: false };
  return { show: true, ios: /iPad|iPhone|iPod/.test(navigator.userAgent) };
}

export function InstallHint() {
  const [{ show, ios }] = useState(installHint);

  if (!show) return null;
  return (
    <p className="mt-4 text-center text-sm font-bold opacity-80">
      {ios
        ? "Add to Home Screen (Share → Add) so the teacher can hear what and again."
        : "Install this app on the tablet so the teacher can hear what and again."}
    </p>
  );
}
