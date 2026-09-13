import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Reading Teacher",
    short_name: "Reading",
    description: "Phonics for Riley, Hudson, Myles, and Cassidy.",
    start_url: "/kids",
    scope: "/",
    display: "standalone",
    background_color: "#1e1b4b",
    theme_color: "#1e1b4b",
    categories: ["education", "kids"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
