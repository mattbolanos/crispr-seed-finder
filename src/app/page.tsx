import { Suspense } from "react";
import { SeedFinderPage } from "@/components/seed-finder-page";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <SeedFinderPage />
    </Suspense>
  );
}
