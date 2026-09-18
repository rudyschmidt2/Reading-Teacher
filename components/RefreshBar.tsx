"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { RefreshIcon } from "@/components/Icons";

const STAMP = process.env.NEXT_PUBLIC_BUILD_STAMP ?? "";
const POLL_MS = 60_000;

export const BUILD_STAMP = STAMP || "dev";

async function hardRefresh() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } finally {
    // A fresh query string defeats any cached HTML; the bar strips it on load.
    const url = new URL(window.location.href);
    url.searchParams.set("refresh", String(Date.now()));
    window.location.replace(url.toString());
  }
}

function useFreshBuild() {
  const [fresh, setFresh] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("refresh")) {
      url.searchParams.delete("refresh");
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  useEffect(() => {
    if (!STAMP) return;
    let cancelled = false;
    const check = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/build", { cache: "no-store" });
        const data = (await res.json()) as { stamp?: string };
        if (!cancelled && data.stamp && data.stamp !== STAMP) setFresh(data.stamp);
      } catch {
        // offline or mid-deploy; try again next tick
      }
    };
    void check();
    const timer = window.setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  return fresh;
}

/** Parent door: the build strip. Kid door: nothing, unless a new version is live — then one toast. */
export function RefreshBar() {
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const fresh = useFreshBuild();
  const parent = pathname?.startsWith("/parent");

  const refresh = () => {
    setBusy(true);
    void hardRefresh();
  };

  if (!parent) {
    if (!fresh) return null;
    return (
      <div className="toast rise-in" role="status">
        <button type="button" className="toast__button" disabled={busy} onClick={refresh}>
          <RefreshIcon size={14} className={busy ? "animate-spin" : ""} />
          {busy ? "Refreshing…" : "New version — tap to update"}
        </button>
      </div>
    );
  }

  return (
    <div className={`refresh-bar ${fresh ? "refresh-bar--fresh" : ""}`} role="region" aria-label="App version">
      <span className="refresh-bar__stamp" title={fresh ? `Live: ${fresh}` : undefined}>
        {fresh ? "New version is live" : BUILD_STAMP}
      </span>
      <button type="button" className="refresh-bar__button" disabled={busy} onClick={refresh}>
        <RefreshIcon size={14} className={busy ? "animate-spin" : ""} />
        {busy ? "Refreshing…" : fresh ? "Refresh to update" : "Hard refresh"}
      </button>
    </div>
  );
}
