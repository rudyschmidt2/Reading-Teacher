"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, GamepadIcon, SparklesIcon, StarIcon } from "@/components/Icons";
import { HoldToOpen, OfflinePill } from "@/components/ui";

export default function Home() {
  const router = useRouter();
  return (
    <main className="kid-stage theme-planets-space flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <OfflinePill />
      <div className="rise-in flex flex-col items-center text-center">
        <span className="eyebrow">
          <SparklesIcon size={14} className="text-amber-300" />
          Reading Teacher
        </span>
        <h1 className="display gradient-text mt-4 text-hero font-bold sm:text-7xl">Let&apos;s read.</h1>
        <p className="mt-3 max-w-sm text-body font-bold text-white/82">Kids play. Parents plan.</p>
      </div>

      <div className="mt-8 grid w-full max-w-md gap-4">
        <Link href="/kids" className="fat-card rise-in stagger-2 relative flex min-h-44 items-center gap-5 overflow-hidden p-6" style={{ ["--card" as string]: "#fff4d6" }} data-door="kids">
          <span className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-amber-300/40 blur-2xl" />
          <span className="orb orb-ring h-24 w-24 shrink-0 text-white" style={{ ["--orb-a" as string]: "#f59e0b", ["--orb-b" as string]: "#ec4899" }}>
            <GamepadIcon size={46} />
          </span>
          <span className="relative flex-1">
            <span className="display block text-5xl leading-none">Kids</span>
            <span className="mt-2 block text-body font-bold text-ink/70">Stars and adventure</span>
            <span className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-stone-900 px-3 py-1.5 text-label font-extrabold text-amber-300">
              <StarIcon size={14} />
              Tap to play
              <ArrowRightIcon size={14} />
            </span>
          </span>
        </Link>
        <div className="rise-in stagger-3">
          <HoldToOpen onOpen={() => router.push("/parent")} label="Parents — hold to open" />
        </div>
      </div>
    </main>
  );
}
