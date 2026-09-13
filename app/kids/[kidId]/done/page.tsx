"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { themeOf } from "@/lib/catalog";
import { scoutDue } from "@/lib/scout";
import { useHouse } from "@/lib/store";

export default function DonePage() {
  const { kidId } = useParams<{ kidId: string }>();
  const search = useSearchParams();
  const { kid, ready, markDailyDone, markScoutDone } = useHouse();
  const child = kid(kidId);
  const theme = themeOf(child?.themeToday);
  const kind = search.get("kind");
  const marked = useRef(false);

  useEffect(() => {
    if (!ready || !child || marked.current) return;
    if (kind === "scout") {
      marked.current = true;
      markScoutDone(kidId);
      return;
    }
    if (kind && kind !== "daily") return;
    marked.current = true;
    markDailyDone(kidId);
  }, [ready, child, kind, kidId, markDailyDone, markScoutDone]);

  if (!ready || !child) return <p className="p-8">Loading…</p>;
  const line = search.get("line") ?? child.kidLine ?? theme.win;
  const offerTunnel = kind !== "scout" && kind !== "try" && scoutDue(child);
  return (
    <main className={`kid-stage theme-${theme.id} flex min-h-dvh flex-col items-center justify-center px-4`}>
      <p className="party text-8xl">{theme.hostEmoji}</p>
      <p className="display mt-4 text-center text-5xl">{kind === "scout" ? "You finished the tunnel!" : "That is enough adventure!"}</p>
      <p className="mt-3 text-center text-2xl">{line}</p>
      <p className="mt-2 text-xl">⭐ {child.stars}</p>
      <div className="mt-8 flex flex-col gap-3">
        {offerTunnel ? (
          <Link href={`/kids/${kidId}/play?mode=scout`} className="fat-card px-8 py-4 text-center text-2xl">
            {theme.host} found a secret tunnel. Another adventure?
          </Link>
        ) : null}
        <Link href="/kids" className="fat-card px-8 py-4 text-center text-2xl">
          Home
        </Link>
      </div>
    </main>
  );
}
