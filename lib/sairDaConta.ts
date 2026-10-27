/**
 * Sair da conta (o botão Sair: `handleSignOut` em `app/page.tsx`).
 *
 * ANTES de sair, apaga do aparelho o que é da conta, em memória (a próxima
 * conta nesta aba não herda nada) e no localStorage (req 4/6): o cache da
 * Rede, do Cofre (`cofreCache.limparTudo` apaga as duas camadas), do PIN e
 * da Jornada (o estado em cache e os dias de descanso marcados). Sair zera
 * também o limite de tentativas do PIN: para voltar é preciso a senha (ou o
 * Google) da conta. Cada limpeza roda mesmo que outra falhe. Depois sai do
 * Supabase e vai para o login.
 */

import * as redeCache from "@/lib/rede/redeCache";
import * as redeCachePersist from "@/lib/rede/redeCachePersist";
import * as cofreCache from "@/lib/cofre/cofreCache";
import * as pinHashCache from "@/lib/pinHashCache";
import { zerarTodasAsTentativas } from "@/lib/pinTentativas";
import { limparTudo as limparJornada } from "@/lib/jornada/cliente";

const LIMPEZAS: readonly (() => void)[] = [
  redeCache.limparTudo,
  redeCachePersist.limpar,
  cofreCache.limparTudo,
  pinHashCache.limparTudo,
  zerarTodasAsTentativas,
  limparJornada,
];

export async function sairDaConta({
  signOut,
  irPara,
}: {
  signOut: () => Promise<unknown>;
  irPara: (rota: string) => void;
}): Promise<void> {
  for (const limpar of LIMPEZAS) {
    try {
      limpar();
    } catch (_) {}
  }
  await signOut();
  irPara("/login");
}
