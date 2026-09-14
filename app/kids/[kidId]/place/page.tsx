"use client";

import { DiagnosticSession } from "@/components/KidPlay";
import { useParams } from "next/navigation";

export default function PlacePage() {
  const { kidId } = useParams<{ kidId: string }>();
  return <DiagnosticSession kidId={kidId} />;
}
