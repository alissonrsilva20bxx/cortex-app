"use client";

// PROTOTYPE-ONLY — floating bottom bar to flip between UI variants via
// ?variant=. Delete alongside the variants once one wins. Hidden in prod.

import { useEffect, type CSSProperties } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Variant {
  key: string;
  label: string;
}

interface Props {
  variants: Variant[];
  paramName?: string;
}

export function PrototypeSwitcher({ variants, paramName = "variant" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentKey = searchParams.get(paramName) ?? variants[0].key;
  const currentIndex = Math.max(
    0,
    variants.findIndex((v) => v.key === currentKey)
  );

  function go(index: number) {
    const next = variants[(index + variants.length) % variants.length];
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, next.key);
    // `as any` — typedRoutes can't know this dynamic prototype path; fine
    // to bypass since this whole file is throwaway.
    router.replace(`${pathname}?${params.toString()}` as any);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;
      if (e.key === "ArrowLeft") go(currentIndex - 1);
      if (e.key === "ArrowRight") go(currentIndex + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  if (process.env.NODE_ENV === "production") return null;

  const current = variants[currentIndex];

  const arrowStyle: CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.1)",
    border: "none",
    color: "#fff",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 18,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px 8px 14px",
        borderRadius: 999,
        background: "rgba(18,18,22,0.92)",
        boxShadow:
          "0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.09)",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
        fontWeight: 600,
        backdropFilter: "blur(10px)",
      }}
    >
      <button
        onClick={() => go(currentIndex - 1)}
        aria-label="Variante anterior"
        style={arrowStyle}
      >
        <ChevronLeft size={16} />
      </button>
      <span style={{ minWidth: 132, textAlign: "center" }}>
        {current.key} — {current.label}
      </span>
      <button
        onClick={() => go(currentIndex + 1)}
        aria-label="Próxima variante"
        style={arrowStyle}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
