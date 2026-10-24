import type { Moeda } from "@/lib/moeda";

/** Texto visível do seletor de moeda (Ajustes e onboarding). */
export const TEXTOS_MOEDA = {
  titulo: "Moeda",
  rotuloDoSeletor: "Moeda do app",
  nome: { EUR: "Euro", USD: "Dólar" } satisfies Record<Moeda, string>,
  aviso:
    "Trocar a moeda muda só o símbolo e o preço dos planos: os valores que você digitou continuam os mesmos.",
} as const;
