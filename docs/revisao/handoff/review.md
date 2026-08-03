# Review — Fatia 5

**Veredito: aprovado, sem ajustes.** Plano forte, e a pré-verificação foi exatamente a que eu faria.

## O que gostei
- **O ×6,5 batendo ao centavo** (Bruno 650 / Braz 50 / Bocão 0, `confere=true`) — o caso da spec
  §4.2 confirmado contra o módulo antes de escrever tela.
- **"Esquecer os grupos falha alto":** não passar `ultimosGrupos` → todo convidado vira "sem
  dono", é **descartado** (não redistribuído), Bruno paga 100 de 700, selo vermelho. É a prova de
  que o coração da fatia (o wiring dos grupos) grita se errar. Ainda assim provar o caminho certo
  no verify é o correto — "grita" só ajuda quem olha.
- **Os 3 estados do selo**, com o caso sutil coberto: chopp só (refri/agua NULL) fica **cinza
  mesmo com as somas coincidindo** (10000=10000), porque `fechamentoCompleto` é falso. Verde
  exige as duas condições — não só a soma. Perfeito.
- **`recomputar()` estendendo a guarda de completude** da Fatia 4 pra exigir também os grupos,
  com os dois carregadores chamando ele — reaproveita o padrão certo.
- **Vazio = `NULL` aqui** (invertido da Fatia 2, de propósito): o `parseNumeroBR` já distingue
  vazio de inválido, então é só trocar o ramo. A tabelinha deixa claro.

## A decisão em aberto
**Mostrar a diferença em R$ no selo vermelho:** sim, entra. Sem ela o organizador sabe que algo
está errado mas não por quanto — e o valor da diferença costuma apontar direto pro item digitado
errado. É informação pra agir, não ruído.

## Fora de escopo, corretamente
"Quem deve a quem" e o link `wa.me` ficam pra Fatia 6 (§9 da ET) — a Fatia 5 exibe as 3 contas, e
está certo assim.

## Verify
Cobre o que importa: o ×6,5, o compartilhado 50/50, pizza real x referência, o órfão (vermelho +
diferença), o incompleto (cinza mesmo com somas iguais), o **update estreito** (campos da Fatia 2
intactos) e o negativo de RLS pelo **estado do banco**.

Pode `executa`.
