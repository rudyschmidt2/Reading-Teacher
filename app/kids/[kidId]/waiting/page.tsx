"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useHouse } from "@/lib/store";

export default function WaitingPage() {
  const { kidId } = useParams<{ kidId: string }>();
  const { kid, ready } = useHouse();
  const child = kid(kidId);
  if (!ready) return <p className="p-8">Loading…</p>;
  return (
    <main className="kid-stage theme-bugs flex min-h-dvh flex-col items-center justify-center px-4">
      <p className="text-7xl">🔒</p>
      <p className="display mt-4 text-center text-5xl">{child?.name ?? "Coming later"}</p>
      <p className="mt-3 text-center text-2xl">Coming later. Soon.</p>
      <p className="mt-2 text-center text-lg opacity-80">No lessons yet. No grades. Just waiting.</p>
      <Link href="/kids" className="fat-card mt-8 px-8 py-4 text-2xl">
        Back
      </Link>
    </main>
  );
}
