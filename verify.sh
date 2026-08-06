#!/usr/bin/env bash
# =============================================================
#  verify — o "build verde" deste projeto
# =============================================================
#  Substitui o `./mvnw clean verify` do protocolo de handoff.
#  Projeto sem build: o que dá para verificar sem navegador e sem
#  banco é sintaxe, testes puros e higiene de credencial.
#
#      ./verify.sh
#
#  ⚠️ O QUE ISTO **NÃO** PROVA:
#  que o formulário grava no Supabase, que a RLS barra o anon, que o
#  painel renderiza. Isso é a "verificação integrada" do protocolo e
#  exige navegador + banco real, com saída crua colada no status.md.
#  Verde aqui não dispensa aquilo.
# =============================================================
set -uo pipefail
cd "$(dirname "$0")"

JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
falhas=0

secao() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()    { printf '  \033[32m✓\033[0m %s\n' "$1"; }
erro()  { printf '  \033[31m✗\033[0m %s\n' "$1"; falhas=$((falhas + 1)); }

# ---------- runtime ----------
if [ -x "$JSC" ]; then
  RUN_JS() { "$JSC" "$@"; }
elif command -v node >/dev/null 2>&1; then
  RUN_JS() { node "$@"; }   # node aceita os mesmos arquivos
else
  echo "Nenhum runtime JS (jsc ou node). Impossível verificar." >&2
  exit 2
fi

# ---------- 1. sintaxe ----------
secao "Sintaxe"
for f in js/*.js tests/*.js; do
  saida=$("$JSC" -e "
    try { new Function(readFile('$f')); print('OK'); }
    catch (e) { print('FALHOU: ' + e); }" 2>&1)
  case "$saida" in
    OK*) ok "$f" ;;
    *)   erro "$f — $saida" ;;
  esac
done

# ---------- 2. testes de cálculo ----------
secao "Testes de cálculo"
if saida=$("$JSC" js/calc.js tests/calc.test.js 2>&1); then
  ok "$(printf '%s' "$saida" | tail -1)"
else
  printf '%s\n' "$saida" | sed 's/^/  /'
  erro "suite de cálculo falhou"
fi

# ---------- 3. higiene de credencial ----------
secao "Higiene"
# A chave anon/publishable é pública por design; senha e service_role não são.
# Exclui *.md (documentação fala sobre credencial) e este próprio script,
# que contém os padrões de busca e casaria consigo mesmo.
achados=$(git grep -nIE 'service_role|postgresql://|PGPASSWORD|sb_secret' \
  -- . ':(exclude)*.md' ':(exclude)verify.sh' 2>/dev/null)
if [ -n "$achados" ]; then
  printf '%s\n' "$achados" | sed 's/^/    /'
  erro "credencial suspeita em arquivo rastreado"
else
  ok "sem connection string, service_role ou senha rastreada"
fi

if grep -q 'COLE_A_' js/config.js 2>/dev/null; then
  erro "js/config.js ainda tem placeholder COLE_A_*"
else
  ok "js/config.js preenchido"
fi

# ---------- 4. coerência do schema ----------
secao "Coerência"
if grep -q '<UID_DO_ADMIN>' supabase-setup.sql 2>/dev/null; then
  erro "supabase-setup.sql tem placeholder <UID_DO_ADMIN> por substituir"
else
  ok "supabase-setup.sql sem placeholder"
fi

# o formulário não pode voltar a inserir direto na tabela
if grep -qE '\.from\("rsvps"\)\.insert|\.from\("people"\)\.insert' js/main.js 2>/dev/null; then
  erro "js/main.js insere direto na tabela — a escrita anônima é só via create_rsvp"
else
  ok "js/main.js escreve só pelo RPC"
fi

# Formatação de data/hora presa ao fuso da festa.
#
# Dois bugs desta família já passaram: o prazo avançando um dia (Fatia 7) e
# o convite mostrando "confirme até 02/10" para quem abre a leste de São
# Paulo (Fatia 11). Os dois foram achados por inspeção, não por teste.
#
# A regra NÃO inclui `toLocaleString` genérico de propósito: `fmtNumeroBR` e
# `fmtLitros` o usam para formatar NÚMERO, que não tem fuso. Inclui, sim,
# `Intl.DateTimeFormat` — é a API que passamos a usar nas correções, e sem
# `timeZone` ela tem exatamente o mesmo defeito.
#
# A janela de 6 linhas existe porque o objeto de opções quase sempre quebra
# em várias linhas; um grep de linha única acusaria o código certo.
sem_fuso=""
for arq in js/*.js; do
  achado=$(awk -v arq="$arq" '
    { l[NR] = $0 }
    END {
      for (i = 1; i <= NR; i++) {
        if (l[i] ~ /toLocaleDateString|toLocaleTimeString|new Intl\.DateTimeFormat/) {
          ok = 0
          for (j = i; j <= i + 6 && j <= NR; j++) if (l[j] ~ /timeZone/) { ok = 1; break }
          if (!ok) printf "%s:%d:%s\n", arq, i, l[i]
        }
      }
    }' "$arq")
  [ -n "$achado" ] && sem_fuso="$sem_fuso$achado
"
done
if [ -n "$(printf '%s' "$sem_fuso" | tr -d '[:space:]')" ]; then
  erro "formatação de data/hora sem timeZone (usa o fuso de quem abre a página):"
  printf '%s' "$sem_fuso" | sed '/^$/d;s/^/      /'
else
  ok "toda formatação de data/hora fixa o timeZone"
fi

# ---------- resultado ----------
if [ "$falhas" -eq 0 ]; then
  printf '\n\033[32mVERDE\033[0m — verificação estática ok. Falta a integrada (navegador + banco).\n'
  exit 0
fi
printf '\n\033[31mVERMELHO\033[0m — %s problema(s).\n' "$falhas"
exit 1
