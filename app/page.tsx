"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRightIcon, GamepadIcon, ShieldIcon, SparklesIcon, StarIcon } from "@/components/Icons";

export default function Home() {
  const router = useRouter();
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);

  const startHold = () => {
    setHolding(true);
    timer.current = window.setTimeout(() => {
      router.push("/parent");
    }, 1600);
  };
  const endHold = () => {
    setHolding(false);
    if (timer.current) window.clearTimeout(timer.current);
  };

  return (
    <main className="kid-stage theme-planets-space flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="rise-in flex flex-col items-center text-center">
        <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-extrabold uppercase tracking-[0.18em] text-white/90">
          <SparklesIcon size={16} className="text-amber-300" />
          Phonics arcade
        </span>
        <h1 className="display gradient-text mt-5 text-6xl font-bold leading-[0.95] sm:text-7xl">Reading Teacher</h1>
        <p className="mt-4 max-w-sm text-lg font-bold text-white/80">Two doors. Kids play. Grown-ups grade.</p>
      </div>

      <div className="mt-10 grid w-full max-w-md gap-5">
        <Link
          href="/kids"
          className="fat-card rise-in stagger-2 group relative flex min-h-44 items-center gap-5 overflow-hidden p-6"
          style={{ ["--card" as string]: "#fff4d6" }}
        >
          <span className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-amber-300/40 blur-2xl" />
          <span className="orb orb-ring h-24 w-24 shrink-0 text-white" style={{ ["--orb-a" as string]: "#f59e0b", ["--orb-b" as string]: "#ec4899" }}>
            <GamepadIcon size={46} />
          </span>
          <span className="relative flex-1">
            <span className="display block text-5xl leading-none">Kids</span>
            <span className="mt-2 block text-lg font-bold text-ink/70">Stars and adventure</span>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3 py-1.5 text-sm font-extrabold text-amber-300">
              <StarIcon size={14} />
              Tap to play
              <ArrowRightIcon size={14} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </span>
        </Link>

        <button
          type="button"
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
          onContextMenu={(e) => e.preventDefault()}
          className="glass-strong rise-in stagger-4 relative flex min-h-32 select-none items-center gap-5 rounded-[28px] p-6 text-left text-white transition-transform active:scale-[0.99]"
        >
          <span className={`hold-ring relative grid h-20 w-20 shrink-0 place-items-center rounded-full ${holding ? "hold-ring--go" : ""}`}>
            <span className="grid h-16 w-16 place-items-center rounded-full bg-[#1b1440] text-white/90">
              <ShieldIcon size={30} />
            </span>
          </span>
          <span className="flex-1">
            <span className="display block text-4xl leading-none">Parent</span>
            <span className="mt-2 block text-base font-bold text-white/75">{holding ? "Keep holding…" : "Hold to open the desk"}</span>
            <span className="mt-3 block h-2 w-full overflow-hidden rounded-full bg-white/15">
              <span className={`block h-full rounded-full bg-gradient-to-r from-amber-300 to-fuchsia-400 ${holding ? "hold-fill" : "w-0"}`} />
            </span>
          </span>
        </button>
      </div>
    </main>
  );
}
