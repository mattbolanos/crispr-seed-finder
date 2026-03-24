import { Suspense } from "react";
import { SeedFinderForm } from "@/components/seed-finder-form";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <SeedFinderForm />
    </Suspense>
  );
}
