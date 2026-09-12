"use client";

import { DailySession } from "@/components/KidPlay";
import { useParams, useSearchParams } from "next/navigation";

export default function PlayPage() {
  const { kidId } = useParams<{ kidId: string }>();
  const search = useSearchParams();
  const mode = search.get("mode");
  return <DailySession kidId={kidId} mode={mode === "scout" || mode === "try" ? mode : "daily"} />;
}
