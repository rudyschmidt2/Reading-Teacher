"use client";

import { ThemePicker } from "@/components/KidPlay";
import { useParams } from "next/navigation";

export default function ThemePage() {
  const { kidId } = useParams<{ kidId: string }>();
  return <ThemePicker kidId={kidId} />;
}
