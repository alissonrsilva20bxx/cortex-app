#!/usr/bin/env bash
# Backup manual antes de aplicar as migrations 0028-0030 (fotos/retencao)
# num banco com dado real. Alternativa a PITR pago -- roda com as
# ferramentas que o projeto ja usa (Supabase CLI + psql), sem contratar
# nada.
#
# Uso:
#   PGPASSWORD=<senha-do-projeto> ./scripts/backup-antes-retencao.sh <project-ref> <regiao-pooler> <pasta-destino>
#
# Exemplo (produção, antes de aplicar 0028-0030):
#   PGPASSWORD=xxxx ./scripts/backup-antes-retencao.sh seciereacfestemdhzhp us-west-2 backups/2026-09-09-pre-retencao
#
# Escopo DELIBERADO: só as 4 tabelas que a retenção/limpeza desta feature
# pode apagar (rede_posts, rede_comentarios, rede_curtidas,
# rede_post_fotos) + os arquivos do bucket rede-midia -- não o banco
# inteiro. Um dump de schema `public` inteiro existe pra restaurar
# esvazia um projeto do zero (ex.: perda total), mas pra "a retenção
# apagou coisa que não devia" o que importa é só isso aqui. Restaurar
# tudo (ex.: `configuracoes`, que tem linha por usuário desde o cadastro)
# quebra no primeiro conflito de chave -- achado testando um ciclo
# completo backup->restore contra homologação antes deste script ser
# proposto (ver PR #105): a 1a tentativa, com dump do schema `public`
# inteiro, morria em "duplicate key... configuracoes_pkey" sem nunca
# chegar em rede_posts.
#
# Usa a connection string do POOLER (IPv4) -- a direta (db.<ref>.supabase.co)
# só resolve em IPv6, que não teve rota de saída no ambiente onde isto foi
# testado (container Docker do Supabase CLI). Achar a região do pooler:
# dashboard do projeto > Settings > Database > Connection string > Session
# pooler.
#
# Precisa de `psql` no PATH -- se não tiver, rodar de dentro de um
# container Postgres (foi assim que este script foi validado:
# `docker exec -i supabase_db_cortex-app bash -c '...'`).
set -euo pipefail

PROJECT_REF="${1:?uso: backup-antes-retencao.sh <project-ref> <regiao-pooler> <pasta-destino>}"
POOLER_REGION="${2:?uso: backup-antes-retencao.sh <project-ref> <regiao-pooler> <pasta-destino>}"
DEST="${3:?uso: backup-antes-retencao.sh <project-ref> <regiao-pooler> <pasta-destino>}"
PGPASSWORD="${PGPASSWORD:?defina PGPASSWORD com a senha do banco desse projeto}"

mkdir -p "$DEST"
ENC_PASS="$(node -e "console.log(encodeURIComponent(process.env.PGPASSWORD))")"
DB_URL="postgresql://postgres.${PROJECT_REF}:${ENC_PASS}@aws-0-${POOLER_REGION}.pooler.supabase.com:5432/postgres"

TABLES=(rede_posts rede_comentarios rede_curtidas rede_post_fotos)
for t in "${TABLES[@]}"; do
  echo "==> Exportando $t -> $DEST/$t.csv"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "\copy (select * from public.$t) to '$DEST/$t.csv' csv header"
done

echo "==> Baixando arquivos do bucket rede-midia -> $DEST/storage/"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?defina SUPABASE_SERVICE_ROLE_KEY desse projeto}" \
DEST_DIR="$DEST/storage" \
node "$(dirname "$0")/backup-storage.mjs"

echo "==> Feito. Conteúdo de $DEST:"
ls -la "$DEST"
