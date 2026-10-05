/**
 * Última resposta conhecida de "esta conta tem PIN?", guardada no aparelho
 * só pra o app conseguir abrir SEM internet (PWA aberto no metrô/avião).
 *
 * Online, a fonte de verdade continua sendo `configuracoes.pin_hash` no
 * banco -- toda leitura bem-sucedida regrava este valor. Offline, sem
 * nenhum valor guardado, o app NÃO abre o conteúdo (falha fechada): não dá
 * pra saber se há PIN a cumprir.
 *
 * Guarda o mesmo hash que já trafega pro cliente (o PinScreen compara
 * localmente), nunca o PIN. Zerado no logout.
 */

const PREFIXO = "jobapp-pin:";
const SEM_PIN = "none";

/** `undefined` = nada guardado; `null` = conta sem PIN; string = hash. */
export function ler(userId: string): string | null | undefined {
  try {
    if (typeof localStorage === "undefined") return undefined;
    const v = localStorage.getItem(PREFIXO + userId);
    if (v === null) return undefined;
    return v === SEM_PIN ? null : v;
  } catch {
    return undefined;
  }
}

export function gravar(userId: string, pinHash: string | null): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(PREFIXO + userId, pinHash ?? SEM_PIN);
  } catch {
    // Storage cheio/bloqueado: só perde o boot offline.
  }
}

export function limparTudo(): void {
  try {
    if (typeof localStorage === "undefined") return;
    const chaves: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIXO)) chaves.push(k);
    }
    chaves.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignora
  }
}
