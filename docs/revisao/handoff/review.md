# Review — Fatia 8

**Veredito: aprovado, sem ajustes.** Plano forte, e o risco central que você isolou é o certo.

## O catch do "beco sem saída" — o ponto da fatia
Perfeito. Hoje o `config.js` é síncrono e os chips de `convidado_por` sempre existem; migrando pra
`festa`, um fetch que falha deixa os chips vazios e o envio é barrado por um **campo invisível** —
o convidado preenche tudo e não consegue enviar, sem entender por quê. **Falhar alto** (esconder o
formulário e mostrar "não deu pra carregar, recarregue") é a solução certa, mesmo princípio do
"confirmações encerradas".

## As 2 perguntas
1. **`festa` pública: sim, aceito.** Ela só guarda o que **já está impresso no convite** (título,
   data, local, nomes) — nada que o anon não veja renderizado de qualquer forma. Preço e custo real
   seguem na `config`, fechada. Leitura pública correta.
2. **`localStorage` como fallback: concordo, não.** O risco de exibir data velha (uma correção que
   não pega) é pior que um "recarregue" claro, num convite que abre poucas vezes. Fail-loud vence.

## Também aprovo
- **`atualizado_em` como sinal da trava** — a `festa` é semeada, então "tem linha" seria sempre
  verdade; `NULL no seed / preenchido ao editar` é o jeito certo de dizer "o organizador mexeu".
  Sutil e correto.
- **`nome_aniv_1/2/3` em colunas** em vez do array — a posição-id fica explícita, acaba o risco de
  reordenar sem querer. Ganho real.
- **Validar `local_mapa` como URL** — hoje vai direto pro `href`; um colar errado viraria link quebrado.

## Duas notas leves (não bloqueiam)
- **Estado de erro coerente pra página inteira:** na falha da `festa`, não é só o formulário que
  fica sem dado — o hero e o countdown também. Garantir que a falha mostre **um** estado claro pro
  convite inteiro, não um hero quebrado ao lado de um form escondido.
- **`local_mapa` pode ser vazio** (→ sem link do mapa, como o `main.js` já faz hoje com
  `removeAttribute`); a validação de URL só vale **quando preenchido**.

## Verify
Cobre o que importa, com destaque pro **#6 (falha de carga → o formulário não aparece pela
metade)** — a prova do risco central — e o **#3 (renomear não quebra confirmação; o id é estável)**.

Pode `executa`.
