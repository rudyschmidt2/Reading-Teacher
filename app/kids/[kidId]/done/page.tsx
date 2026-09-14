"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { HomeIcon, SparklesIcon, StarIcon, TrophyIcon } from "@/components/Icons";
import { Loading } from "@/components/KidPlay";
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

  if (!ready || !child) return <Loading />;
  const line = search.get("line") ?? child.kidLine ?? theme.win;
  const mapDone = kind === "place" && search.get("finished") === "1";
  const eyebrow = kind === "scout" ? "Tunnel cleared" : kind === "place" ? (mapDone ? "Map complete" : "Map saved") : "Level complete";
  const title =
    kind === "scout"
      ? "You finished the tunnel!"
      : kind === "place"
        ? mapDone
          ? "You mapped the whole world!"
          : "Great scouting!"
        : "That is enough adventure!";
  const offerTunnel = kind !== "scout" && kind !== "place" && scoutDue(child);
  return (
    <main className={`kid-stage theme-${theme.id} flex min-h-dvh flex-col items-center justify-center px-4 py-10 text-center`}>
      <div className="relative">
        <span className="spin-slow pointer-events-none absolute -inset-10 rounded-full border-2 border-dashed border-white/25" aria-hidden />
        <span className="orb orb-ring party h-40 w-40 text-8xl">
          <span className="emoji-3d">{theme.hostEmoji}</span>
        </span>
        <span className="absolute -right-3 -top-3 grid h-12 w-12 place-items-center rounded-full bg-amber-300 text-amber-900 shadow-[0_4px_0_#b45309]">
          <TrophyIcon size={26} />
        </span>
      </div>

      <span className="glass rise-in mt-10 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-white/85">
        <SparklesIcon size={14} className="text-amber-300" />
        {eyebrow}
      </span>
      <h1 className="display title-pop rise-in stagger-1 mt-4 max-w-md text-5xl font-bold leading-none">{title}</h1>
      <p className="rise-in stagger-2 mt-4 max-w-sm text-2xl font-bold text-white/90">{line}</p>

      <div className="star-pill rise-in stagger-3 mt-6 text-3xl">
        <StarIcon size={30} className="text-amber-700" />
        {child.stars}
        <span className="text-base font-extrabold uppercase tracking-wide opacity-70">stars</span>
      </div>

      <div className="mt-10 flex w-full max-w-md flex-col items-center gap-3">
        {offerTunnel ? (
          <Link href={`/kids/${kidId}/play?mode=scout`} className="btn-glow rise-in stagger-4 inline-flex items-center gap-3 px-9 py-4 text-2xl font-black">
            <SparklesIcon size={26} />
            {theme.host} found a secret tunnel. Another adventure?
          </Link>
        ) : null}
        <Link href="/kids" className="btn-glow rise-in stagger-4 inline-flex items-center gap-3 px-9 py-4 text-2xl font-black">
          <HomeIcon size={26} />
          Home
        </Link>
      </div>
    </main>
  );
}
