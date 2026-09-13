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

export function InstallHint() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone) return;
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    setShow(true);
  }, []);

  if (!show) return null;
  return (
    <p className="mt-4 text-center text-sm font-bold opacity-80">
      {ios
        ? "Add to Home Screen (Share → Add) so the teacher can hear what and again."
        : "Install this app on the tablet so the teacher can hear what and again."}
    </p>
  );
}
