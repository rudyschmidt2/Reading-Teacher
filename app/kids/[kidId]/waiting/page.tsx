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
      <span className="orb orb-ring host-float h-28 w-28 text-white" style={{ ["--orb-a" as string]: "#94a3b8", ["--orb-b" as string]: "#334155" }}>
        <LockIcon size={56} />
      </span>
      <span className="eyebrow rise-in mt-8">
        <ClockIcon size={14} className="text-lime-300" />
        Locked for now
      </span>
      <h1 className="display title-pop rise-in stagger-1 mt-3 text-hero font-bold">{child?.name ?? "Coming later"}</h1>
      <p className="rise-in stagger-2 mt-3 text-title font-bold text-white/90">Coming later. Soon.</p>
      <p className="rise-in stagger-3 mt-2 max-w-xs text-body font-bold text-white/82">No lessons yet. Just waiting.</p>
      <Link href="/kids" className="btn-solid rise-in stagger-4 mt-8 inline-flex min-h-14 items-center gap-2 px-8 py-3 text-title font-black">
        <ArrowLeftIcon size={22} />
        Back
      </Link>
    </main>
  );
}
