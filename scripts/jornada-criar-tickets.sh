#!/usr/bin/env bash
# jornada-criar-tickets.sh — sobe os 18 tickets da Jornada (docs/jornada/tickets/J*.md)
# como issues no GitHub. Idempotente: pode rodar quantas vezes quiser.
#
#   bash scripts/jornada-criar-tickets.sh             # cria o que falta
#   bash scripts/jornada-criar-tickets.sh --dry-run   # só mostra o que faria
#   bash scripts/jornada-criar-tickets.sh --repo dono/repo
#
# O que faz, em ordem:
#   1. cria os labels que faltam (os do frontmatter + epic:jornada);
#   2. cria uma issue por ticket, com título e labels do frontmatter e o corpo do arquivo;
#      issue que já existe (mesmo título exato, aberta ou fechada) não é recriada nem
#      reescrita — só ganha epic:jornada, se faltar;
#   3. segunda passada: escreve em cada issue o bloco "Bloqueado por: #N" a partir de
#      bloqueado_por (as issues precisam existir antes de serem referenciadas). O bloco
#      fica entre marcadores e é substituído, nunca duplicado.
#
# Requer: gh autenticado e jq. Nunca fecha, mergeia nem apaga nada.
set -euo pipefail

REPO=${GH_REPO:-alissonrsilva20bxx/cortex-app}
DRY=0
while (($#)); do
  case $1 in
    --dry-run) DRY=1; shift ;;
    --repo) REPO=$2; shift 2 ;;
    -h | --help) sed -n '2,19p' "$0"; exit 0 ;;
    *) echo "opção desconhecida: $1" >&2; exit 2 ;;
  esac
done

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DIR=$ROOT/docs/jornada/tickets
EPIC=epic:jornada
INICIO='<!-- jornada:bloqueado_por:inicio -->'
FIM='<!-- jornada:bloqueado_por:fim -->'
command -v jq >/dev/null || { echo "falta o jq" >&2; exit 1; }
command -v gh >/dev/null || { echo "falta o gh" >&2; exit 1; }

say() { printf '%s\n' "$*"; }
run() { # executa, ou só descreve no --dry-run
  if ((DRY)); then say "  [dry-run] $*"; else "$@"; fi
}

# ---------------------------------------------------------------- frontmatter
campo() { # arquivo campo -> valor cru da linha "campo: valor" do frontmatter
  awk -v c="$2" 'NR == 1 && $0 != "---" { exit } NR > 1 && $0 == "---" { exit }
    NR > 1 && index($0, c ":") == 1 { sub("^" c ":[ ]*", ""); print; exit }' "$1"
}
titulo() { local t; t=$(campo "$1" titulo); t=${t#\"}; t=${t%\"}; printf '%s' "${t//\\\"/\"}"; }
lista() { tr ',' '\n' <<<"$1" | sed 's/^ *//; s/ *$//' | grep -v '^$' || true; }
corpo() { awk 'f >= 2 { print; next } $0 == "---" { f++ }' "$1" | sed '/./,$!d'; }

shopt -s nullglob
arquivos=("$DIR"/J[0-9][0-9].md)
((${#arquivos[@]} == 18)) || { echo "esperava 18 tickets em $DIR, achei ${#arquivos[@]}" >&2; exit 1; }

declare -A TITULO LABELS DEPS NUM
IDS=()
for f in "${arquivos[@]}"; do
  id=$(basename "$f" .md)
  IDS+=("$id")
  TITULO[$id]=$(titulo "$f")
  [[ -n ${TITULO[$id]} && ${TITULO[$id]} == "$id "* ]] || { echo "$id: titulo ausente ou não começa com $id" >&2; exit 1; }
  LABELS[$id]=$( (lista "$(campo "$f" labels)"; echo "$EPIC") | sort -u | paste -sd, -)
  DEPS[$id]=$(lista "$(campo "$f" bloqueado_por)" | paste -sd' ' -)
done
for id in "${IDS[@]}"; do
  for d in ${DEPS[$id]}; do
    [[ -n ${TITULO[$d]:-} ]] || { echo "$id: bloqueado_por cita $d, que não existe" >&2; exit 1; }
  done
done
say "repo: $REPO  ·  ${#IDS[@]} tickets lidos de docs/jornada/tickets$( ((DRY)) && echo '  ·  DRY-RUN: nada será escrito')"

# ---------------------------------------------------------------- estado remoto
ler() { # comando de leitura; no dry-run, falha vira "nada existe" com aviso
  local out
  if out=$("$@" 2>/dev/null); then printf '%s' "$out"
  elif ((DRY)); then say "  aviso: não consegui ler do GitHub ($2 $3); simulando repo vazio" >&2; echo '[]'
  else echo "falha ao ler do GitHub: $*" >&2; exit 1; fi
}
existentes_labels=$(ler gh label list -R "$REPO" --limit 500 --json name)
existentes_issues=$(ler gh issue list -R "$REPO" --state all --limit 1000 --json number,title,labels)

# ---------------------------------------------------------------- 1. labels
say ""
say "1. labels"
cor() { case $1 in epic:*) echo 5319e7 ;; tipo:*) echo 1d76db ;; area:*) echo 0e8a16 ;;
  bloqueado) echo b60205 ;; pronto-para-agente) echo 0e8a16 ;; requer-decisao-humana) echo d93f0b ;;
  proibido:*) echo 000000 ;; *) echo ededed ;; esac; }
mapfile -t todos < <(printf '%s\n' "${LABELS[@]}" | tr ',' '\n' | sort -u)
for l in "${todos[@]}"; do
  if jq -e --arg l "$l" 'any(.[]; .name == $l)' <<<"$existentes_labels" >/dev/null; then
    say "  ok      $l"
  else
    say "  criar   $l"
    desc=""; [[ $l == "$EPIC" ]] && desc="Jornada: 5 telas novas + gamificação Sua Jornada (docs/jornada)"
    run gh label create "$l" -R "$REPO" --color "$(cor "$l")" --description "$desc"
  fi
done

# ---------------------------------------------------------------- 2. issues
say ""
say "2. issues"
for id in "${IDS[@]}"; do
  t=${TITULO[$id]}
  n=$(jq -r --arg t "$t" '[.[] | select(.title == $t)] | if length > 1 then "DUP" else (.[0].number // "") end' <<<"$existentes_issues")
  if [[ $n == DUP ]]; then
    echo "$id: mais de uma issue com o título \"$t\"; resolva à mão antes de rodar de novo" >&2; exit 1
  fi
  if [[ -n $n ]]; then
    NUM[$id]=$n
    if jq -e --arg t "$t" --arg e "$EPIC" 'any(.[]; .title == $t and any(.labels[]; .name == $e))' <<<"$existentes_issues" >/dev/null; then
      say "  existe  $id #$n"
    else
      say "  existe  $id #$n (falta $EPIC)"
      run gh issue edit "$n" -R "$REPO" --add-label "$EPIC" >/dev/null
    fi
    continue
  fi
  say "  criar   $id  \"$t\"  [${LABELS[$id]}]"
  if ((DRY)); then NUM[$id]="?$id"; continue; fi
  url=$(gh issue create -R "$REPO" --title "$t" --label "${LABELS[$id]}" --body-file <(corpo "$DIR/$id.md"))
  NUM[$id]=${url##*/}
  say "          -> #${NUM[$id]}"
done

# ---------------------------------------------------------------- 3. dependências
say ""
say "3. bloqueado_por"
for id in "${IDS[@]}"; do
  [[ -n ${DEPS[$id]} ]] || continue
  refs=""
  for d in ${DEPS[$id]}; do refs+="${refs:+, }#${NUM[$d]} ($d)"; done
  bloco="$INICIO"$'\n'"**Bloqueado por:** $refs"$'\n'"$FIM"
  if ((DRY)); then say "  [dry-run] #${NUM[$id]} ($id) <- $refs"; continue; fi
  atual=$(gh issue view "${NUM[$id]}" -R "$REPO" --json body -q .body)
  if grep -qF "$bloco" <<<"$atual"; then say "  ok      $id <- $refs"; continue; fi
  novo=$(awk -v i="$INICIO" -v f="$FIM" '$0 == i { skip = 1 } !skip { print } $0 == f { skip = 0 }' <<<"$atual" | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}')
  gh issue edit "${NUM[$id]}" -R "$REPO" --body-file <(printf '%s\n\n%s\n' "$novo" "$bloco") >/dev/null
  say "  ligado  $id <- $refs"
done

say ""
say "pronto$( ((DRY)) && echo ' (dry-run: nada foi escrito)')."
