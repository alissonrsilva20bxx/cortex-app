#!/usr/bin/env bash
# Retrato SOMENTE LEITURA do esquema public do banco ativo (Cortex App).
# Só consulta o catálogo (SELECT); nunca altera nada. `supabase db dump` não
# serve aqui porque exige Docker. Precisa da CLI logada (`supabase login`).
# Saída: /mnt/c/Users/miguel/Desktop/BACKUP-SCHEMA/schema-public-AAAA-MM-DD-HHMM.json
set -euo pipefail

REF="seciereacfestemdhzhp"
SUPABASE="${SUPABASE_BIN:-/home/miguel/.local/bin/supabase}"
DESTINO="${DESTINO:-/mnt/c/Users/miguel/Desktop/BACKUP-SCHEMA}"
RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
DESTINO="$(realpath -m "$DESTINO")"
case "$DESTINO/" in
  "$RAIZ_REPO"/*) echo "DESTINO dentro do repo ($RAIZ_REPO) é recusado: use uma pasta fora dele." >&2; exit 1 ;;
esac
mkdir -p "$DESTINO"
ARQ="$DESTINO/schema-public-$(date +%Y-%m-%d-%H%M).json"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

consulta() { # nome, sql
  "$SUPABASE" db query --linked --project-ref "$REF" --output-format json "set transaction read only; $2" > "$TMP/$1.json"
}

consulta colunas "select table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
  from information_schema.columns where table_schema='public' order by table_name, ordinal_position"
consulta constraints "select c.conrelid::regclass::text as tabela, c.conname, c.contype, pg_get_constraintdef(c.oid) as definicao
  from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' order by 1,2"
consulta indices "select tablename, indexname, indexdef from pg_indexes where schemaname='public' order by 1,2"
consulta policies "select tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies where schemaname='public' order by 1,2"
consulta rls "select c.relname as tabela, c.relrowsecurity as rls_ligado, c.relforcerowsecurity as rls_forcado
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by 1"
consulta funcoes "select p.proname as nome, pg_get_functiondef(p.oid) as definicao
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p') order by 1, p.oid"
consulta triggers "select event_object_table as tabela, trigger_name, action_timing, event_manipulation, action_statement
  from information_schema.triggers where trigger_schema='public' order by 1,2"

python3 - "$TMP" "$ARQ" "$REF" <<'PY'
import json, sys, os, datetime
tmp, arq, ref = sys.argv[1:4]
saida = {"projeto": ref, "gerado_em": datetime.datetime.now().isoformat(timespec="seconds"), "somente_leitura": True}
for nome in ["colunas", "constraints", "indices", "policies", "rls", "funcoes", "triggers"]:
    bruto = json.load(open(os.path.join(tmp, nome + ".json")))
    saida[nome] = bruto["rows"] if isinstance(bruto, dict) and "rows" in bruto else bruto
json.dump(saida, open(arq, "w"), indent=2, ensure_ascii=False)
PY

echo "Gerado: $ARQ ($(wc -c < "$ARQ") bytes)"
