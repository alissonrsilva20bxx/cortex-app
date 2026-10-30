/**
 * Sair da conta (o botão Sair: `handleSignOut` em `app/page.tsx`).
 *
 * ANTES de sair, apaga do aparelho o que é da conta, em memória (a próxima
 * conta nesta aba não herda nada) e no localStorage (req 4/6): o cache da
 * Rede, do Cofre (`cofreCache.limparTudo` apaga as duas camadas), do PIN e
 * da Jornada (o estado em cache e os dias de descanso marcados). Cada
 * limpeza roda mesmo que outra falhe. Depois sai do Supabase e vai para o
 * login; só então zera o limite de tentativas do PIN (para voltar é preciso
 * a senha ou o Google da conta).
 *
 * Se o Supabase não sair (sem rede, erro 5xx ou 429, ele devolve erro e
 * guarda a sessão), a pessoa continua logada: fica no app com o aviso, sem
 * ir ao login (que fingia que saiu e voltava ao início, R18rev BAIXA 3), e
 * o limite do PIN fica como estava.
 */

import * as redeCache from "@/lib/rede/redeCache";
import * as redeCachePersist from "@/lib/rede/redeCachePersist";
import * as cofreCache from "@/lib/cofre/cofreCache";
import * as pinHashCache from "@/lib/pinHashCache";
import { zerarTodasAsTentativas } from "@/lib/pinTentativas";
import { limparTudo as limparJornada } from "@/lib/jornada/cliente";
import { TEXTOS_AUTH } from "@/lib/textosAuth";

const LIMPEZAS: readonly (() => void)[] = [
  redeCache.limparTudo,
  redeCachePersist.limpar,
  cofreCache.limparTudo,
  pinHashCache.limparTudo,
  limparJornada,
];

export async function sairDaConta({
  signOut,
  irPara,
  avisarFalha,
}: {
  signOut: () => Promise<{ error: unknown }>;
  irPara: (rota: string) => void;
  avisarFalha: (texto: string) => void;
}): Promise<void> {
  for (const limpar of LIMPEZAS) {
    try {
      limpar();
    } catch (_) {}
  }
  let saiu = false;
  try {
    saiu = !(await signOut()).error;
  } catch (_) {}
  if (!saiu) {
    avisarFalha(TEXTOS_AUTH.sair.falhou);
    return;
  }
  try {
    zerarTodasAsTentativas();
  } catch (_) {}
  irPara("/login");
}
