import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The refresh bar polls this and compares it with the stamp baked into the
// client bundle; a mismatch means a newer deploy is live.
export function GET() {
  return NextResponse.json(
    { stamp: process.env.NEXT_PUBLIC_BUILD_STAMP ?? "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
