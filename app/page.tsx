"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

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
    <main className="kid-stage theme-planets-space flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <p className="display text-center text-5xl font-bold">Reading Teacher</p>
      <p className="mt-2 text-center text-xl">Two doors. Kids play. Grown-ups grade.</p>
      <div className="mt-8 grid w-full max-w-md gap-4">
        <Link href="/kids" className="fat-card bounce-in flex min-h-40 flex-col items-center justify-center p-6 text-center">
          <span className="text-6xl">⭐</span>
          <span className="display mt-2 text-4xl">Kids</span>
          <span className="text-lg">Stars and adventure</span>
        </Link>
        <button
          type="button"
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          className="fat-card flex min-h-32 flex-col items-center justify-center bg-stone-100 p-6 text-center"
        >
          <span className="display text-3xl">Parent</span>
          <span className="text-lg">Hold to open the desk</span>
          <span className="mt-3 h-2 w-full overflow-hidden rounded-full bg-stone-200">
            <span className={`block h-full bg-stone-900 ${holding ? "hold-fill" : "w-0"}`} />
          </span>
        </button>
      </div>
    </main>
  );
}
