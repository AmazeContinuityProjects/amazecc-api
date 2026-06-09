"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function Home() {
  return (
    <main className="bg-white dark:bg-zinc-900 min-h-screen py-8">
      <SwaggerUI url="/api/docs" />
    </main>
  );
}
