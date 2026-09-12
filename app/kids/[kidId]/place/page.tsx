"use client";

import { PlacementSession } from "@/components/KidPlay";
import { useParams } from "next/navigation";

export default function PlacePage() {
  const { kidId } = useParams<{ kidId: string }>();
  return <PlacementSession kidId={kidId} />;
}
