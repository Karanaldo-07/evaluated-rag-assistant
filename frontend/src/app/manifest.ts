import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VeriRAG Evaluated Document Assistant",
    short_name: "VeriRAG",
    description: "Hybrid search RAG assistant with citations and faithfulness evaluation.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f7",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}