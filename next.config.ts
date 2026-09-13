import type { NextConfig } from "next";

// Inlined at build time so the client can show which deploy it is running and
// compare against /api/build to notice a newer one.
const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "";
const builtAt = new Date().toISOString().slice(0, 16).replace("T", " ") + "Z";
const buildStamp = `${sha ? sha.slice(0, 7) : "local"} · ${builtAt}`;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_STAMP: buildStamp,
  },
};

export default nextConfig;
