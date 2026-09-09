#!/usr/bin/env bash
# Restaura um backup feito por backup-antes-retencao.sh. Seguro rodar
# mesmo com parte dos dados ainda presente: carrega cada CSV numa tabela
# temporária e só INSERE as linhas cujo id não existe mais na tabela real
# (merge, não overwrite) -- uma restauração "ingênua" (INSERT direto)
# quebra na primeira linha que já existe, achado testando isto contra
# homologação antes de propor (ver PR #105).
#
# Uso:
#   PGPASSWORD=<senha-do-projeto-alvo> ./scripts/restore-apos-backup.sh <project-ref-alvo> <regiao-pooler> <pasta-do-backup>
#
# Precisa de `psql` no PATH (mesma nota de backup-antes-retencao.sh).
set -euo pipefail

PROJECT_REF="${1:?uso: restore-apos-backup.sh <project-ref-alvo> <regiao-pooler> <pasta-do-backup>}"
POOLER_REGION="${2:?uso: restore-apos-backup.sh <project-ref-alvo> <regiao-pooler> <pasta-do-backup>}"
BACKUP_DIR="${3:?uso: restore-apos-backup.sh <project-ref-alvo> <regiao-pooler> <pasta-do-backup>}"
PGPASSWORD="${PGPASSWORD:?defina PGPASSWORD com a senha do banco do projeto ALVO}"

ENC_PASS="$(node -e "console.log(encodeURIComponent(process.env.PGPASSWORD))")"
DB_URL="postgresql://postgres.${PROJECT_REF}:${ENC_PASS}@aws-0-${POOLER_REGION}.pooler.supabase.com:5432/postgres"

# Chave de identidade por tabela -- rede_curtidas não tem coluna `id`
# (chave composta post_id+user_id). Assumir `id` em toda tabela quebrou
# no teste real contra homologação ("column p.id does not exist") antes
# deste script ser proposto -- daí o mapa explícito em vez de um `id`
# genérico.
declare -A CHAVE=(
  [rede_posts]="id"
  [rede_comentarios]="id"
  [rede_post_fotos]="id"
  [rede_curtidas]="post_id,user_id"
)

TABLES=(rede_posts rede_comentarios rede_curtidas rede_post_fotos)
for t in "${TABLES[@]}"; do
  CSV="$BACKUP_DIR/$t.csv"
  if [ ! -f "$CSV" ]; then
    echo "==> $CSV não existe, pulando $t"
    continue
  fi
  echo "==> Restaurando $t (merge, não sobrescreve linhas já existentes)"
  IFS=',' read -ra COLS <<< "${CHAVE[$t]}"
  COND=""
  for c in "${COLS[@]}"; do
    [ -n "$COND" ] && COND="$COND and "
    COND="${COND}p.$c = r.$c"
  done
  psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
    create temp table _restore_$t (like public.$t including all);
    \copy _restore_$t from '$CSV' csv header
    insert into public.$t
      select * from _restore_$t r
      where not exists (select 1 from public.$t p where $COND);
    drop table _restore_$t;
SQL
done

echo "==> Re-subindo arquivos de Storage ($BACKUP_DIR/storage/)"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?defina SUPABASE_SERVICE_ROLE_KEY do projeto ALVO}" \
SRC_DIR="$BACKUP_DIR/storage" \
node "$(dirname "$0")/restore-storage.mjs"

echo "==> Restauração concluída. Confira as contagens antes de considerar pronto."
