import { Suspense } from "react";
import WavelengthApp from "@/components/WavelengthApp";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <WavelengthApp />
    </Suspense>
  );
}
