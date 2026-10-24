/**
 * O banco ainda sem uma migration que já está escrita e não aplicada: o
 * PostgREST responde que não acha a tabela ou a coluna. Quem usa tabela ou
 * coluna nova (0042 `prazo`, 0044 `guardar_historico`) cai no caminho de
 * antes em vez de falhar, e o app funciona com e sem a migration.
 *
 * Códigos: PGRST205 (tabela) e PGRST204 (coluna) no PostgREST 13 ou mais
 * novo; 42P01 e 42703 vêm do Postgres (PostgREST antigo). O nome precisa
 * aparecer na mensagem: um 42P01 de outra tabela (dentro de uma policy, por
 * exemplo) continua sendo erro.
 */

type ErroDoBanco = { code?: string; message?: string } | null | undefined;

export function faltaTabela(erro: ErroDoBanco, tabela: string): boolean {
  if (!erro || (erro.code !== "PGRST205" && erro.code !== "42P01")) {
    return false;
  }
  return (erro.message ?? "").includes(tabela);
}

export function faltaColuna(erro: ErroDoBanco, coluna: string): boolean {
  if (!erro || (erro.code !== "PGRST204" && erro.code !== "42703")) {
    return false;
  }
  const msg = erro.message ?? "";
  return msg.includes(`'${coluna}'`) || msg.includes(`"${coluna}"`);
}
