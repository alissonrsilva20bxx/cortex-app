"use client";

// PROTOTYPE — throwaway route. Three splash-screen motion directions,
// switchable via ?variant=A|B|C. Delete this whole folder once one wins
// and fold the choice into components/LoadingScreen.tsx.
// Public without login: folder name starts with "dev-preview", already
// whitelisted in middleware.ts.

import { useSearchParams } from "next/navigation";
import { PrototypeSwitcher } from "@/components/prototype/PrototypeSwitcher";
import { VariantA } from "./VariantA";
import { VariantB } from "./VariantB";
import { VariantC } from "./VariantC";

const VARIANTS = [
  { key: "A", label: "Constelação" },
  { key: "B", label: "Traço vivo" },
  { key: "C", label: "Respiração" },
];

export default function PrototypeSplash() {
  const searchParams = useSearchParams();
  const variant = searchParams.get("variant") ?? "A";

  return (
    <>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      <PrototypeSwitcher variants={VARIANTS} />
    </>
  );
}
