"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { HomeIcon, SparklesIcon, StarIcon, TelescopeIcon, TrophyIcon } from "@/components/Icons";
import { Loading } from "@/components/KidPlay";
import { themeOf } from "@/lib/catalog";
import { planOf } from "@/lib/house";
import { scoutDue } from "@/lib/scout";
import { useHouse } from "@/lib/store";

export default function DonePage() {
  return (
    <Suspense fallback={<Loading />}>
      <DoneInner />
    </Suspense>
  );
}

function DoneInner() {
  const { kidId } = useParams<{ kidId: string }>();
  const search = useSearchParams();
  const { kid, ready, state } = useHouse();
  const child = kid(kidId);
  const theme = themeOf(child?.themeToday);
  const kind = search.get("kind");

  if (!ready || !child) return <Loading />;
  const plan = planOf(child);
  const session = [...state.sessions].reverse().find((s) => s.kidId === kidId);
  const line = search.get("line") ?? (kind === "place" ? child.kidLine : undefined) ?? theme.win;
  const mapDone = kind === "place" && search.get("finished") === "1";
  const isReview = session?.kind === "review" && (kind === "daily" || kind === "review");
  const eyebrow =
    kind === "scout" ? "Tunnel cleared" : kind === "place" ? (mapDone ? "Map complete" : "Map saved") : isReview ? "Victory lap" : "Adventure done";
  const title =
    kind === "scout"
      ? "You finished the tunnel!"
      : kind === "place"
        ? mapDone
          ? "You mapped the whole world!"
          : "Great scouting!"
        : isReview
          ? "You still know it all!"
          : "What a run!";
  const wins = session && session.kind !== "place" && session.kind !== "scout" ? session.wins : undefined;
  const lateWins = session?.lateWins ?? 0;
  const heardWord = lateWins
    ? state.attempts.filter((a) => a.kidId === kidId && a.spokenGrade === "hit" && a.gradedAt).at(-1)
    : undefined;
  const mapToContinue = plan.mapRequested && child.diagnostic?.cursor && kind !== "place";
  const offerTunnel = kind !== "scout" && kind !== "place" && (scoutDue(child) || plan.scoutRequested) && (wins ?? 0) >= 1;
  const proposalWaiting = plan.proposals.some((p) => p.status === "pending") && kind !== "place";

  return (
    <main className={`kid-stage theme-${theme.id} flex min-h-dvh flex-col items-center justify-center px-4 py-10 text-center`}>
      <div className="relative">
        <span className="orb orb-ring party h-36 w-36 text-7xl">
          <span className="emoji-3d">{theme.hostEmoji}</span>
        </span>
        <span className="absolute -right-2 -top-2 grid h-12 w-12 place-items-center rounded-full bg-amber-300 text-amber-900 shadow-[0_4px_0_#b45309]">
          <TrophyIcon size={26} />
        </span>
      </div>

      <span className="eyebrow rise-in mt-8">
        <SparklesIcon size={14} className="text-amber-300" />
        {eyebrow}
      </span>
      <h1 className="display title-pop rise-in stagger-1 mt-3 max-w-md text-hero font-bold leading-none">{title}</h1>
      <p className="rise-in stagger-2 mt-3 max-w-sm text-2xl font-bold text-white/90">{line}</p>
      {wins !== undefined ? (
        <p className="rise-in stagger-2 mt-2 text-lg font-extrabold text-white/85" data-real-wins={wins}>
          {wins === 0 ? "Tough one today. Tomorrow is a new game." : wins === 1 ? "1 real win today." : `${wins} real wins today.`}
        </p>
      ) : null}
      {lateWins ? (
        <p className="rise-in stagger-3 mt-2 max-w-sm text-lg font-extrabold text-amber-200" data-late-wins={lateWins}>
          Dad heard you say {heardWord?.spokenText && heardWord.spokenText !== "parent-listen" ? `"${heardWord.spokenText}"` : "it"}. {lateWins === 1 ? "Star!" : `${lateWins} stars!`}
        </p>
      ) : null}

      <div className="star-pill rise-in stagger-3 mt-6 text-3xl">
        <StarIcon size={30} className="text-amber-700" />
        {child.stars}
        <span className="text-base font-extrabold uppercase tracking-wide opacity-70">stars</span>
      </div>
      {proposalWaiting ? <p className="rise-in stagger-3 mt-4 text-base font-bold text-white/80">More adventure is coming.</p> : null}

      <div className="mt-8 flex w-full max-w-md flex-col items-center gap-3">
        {offerTunnel ? (
          <Link href={`/kids/${kidId}/play?mode=scout`} className="btn-glow rise-in stagger-4 inline-flex min-h-16 items-center gap-3 px-8 py-4 text-xl font-black">
            <TelescopeIcon size={24} />
            {theme.host} found a secret tunnel. Go?
          </Link>
        ) : null}
        {mapToContinue ? (
          <Link href={`/kids/${kidId}/place`} className="btn-glow rise-in stagger-4 inline-flex min-h-16 items-center gap-3 px-8 py-4 text-xl font-black">
            <SparklesIcon size={24} />
            Scout more of the map?
          </Link>
        ) : null}
        <Link href="/kids" className={`${offerTunnel || mapToContinue ? "btn-solid" : "btn-glow"} rise-in stagger-4 inline-flex min-h-16 items-center gap-3 px-9 py-4 text-2xl font-black`}>
          <HomeIcon size={26} />
          Home
        </Link>
      </div>
    </main>
  );
}
