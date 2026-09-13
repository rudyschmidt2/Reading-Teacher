"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, ClockIcon, LockIcon } from "@/components/Icons";
import { Loading } from "@/components/KidPlay";
import { useHouse } from "@/lib/store";

export default function WaitingPage() {
  const { kidId } = useParams<{ kidId: string }>();
  const { kid, ready } = useHouse();
  const child = kid(kidId);
  if (!ready) return <Loading />;
  return (
    <main className="kid-stage theme-bugs flex min-h-dvh flex-col items-center justify-center px-4 py-10 text-center">
      <span
        className="orb orb-ring host-float h-36 w-36 text-white"
        style={{ ["--orb-a" as string]: "#94a3b8", ["--orb-b" as string]: "#334155" }}
      >
        <LockIcon size={64} />
      </span>
      <span className="glass rise-in mt-10 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-white/85">
        <ClockIcon size={14} className="text-lime-300" />
        Locked for now
      </span>
      <h1 className="display title-pop rise-in stagger-1 mt-4 text-5xl font-bold leading-none">{child?.name ?? "Coming later"}</h1>
      <p className="rise-in stagger-2 mt-4 text-2xl font-bold text-white/90">Coming later. Soon.</p>
      <p className="rise-in stagger-3 mt-2 max-w-xs text-base font-bold text-white/65">No lessons yet. No grades. Just waiting.</p>
      <Link href="/kids" className="btn-solid rise-in stagger-4 mt-10 inline-flex items-center gap-2 px-8 py-4 text-2xl font-black">
        <ArrowLeftIcon size={24} />
        Back
      </Link>
    </main>
  );
}
