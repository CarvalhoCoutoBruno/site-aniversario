# Fatia 7 — Polimento (fechar o projeto)

## Objetivo
Os arremates que sobraram: countdown no passado, docs desatualizadas e compartilhar o acerto.
Nada de feature nova — é a faxina final antes de considerar o projeto pronto.

## Fontes da verdade
- Estado real: o código no ar + `docs/ESPECIFICACAO-TECNICA.md` + os `status.md` das fatias 1–6.
- Princípio do fluxo: **doc corrigida quando diverge da realidade** — nada de número inventado.

## Escopo (o que entra)
1. **Countdown no passado.** Hoje trava em zero. No **dia** da festa, mostrar "É hoje! 🎉"; depois
   do dia, esconder o countdown (ou um estado neutro "A festa já aconteceu"). Cuidar do fuso
   -03:00 — a virada do dia é no horário de São Paulo, não no do navegador.
2. **README.md.** Tirar a instrução obsoleta de publicar arrastando a pasta no **Netlify**.
   Refletir a realidade: **GitHub Pages** (deploy automático no push da `main`) + **Supabase**
   (rodar o `supabase-setup.sql`, criar admin, pegar URL/anon key pro `config.js`). Enxuto e correto.
3. **HANDOFF.md.** Está em julho, antes do modelo de rateio. Atualizar pro estado atual: o que o
   app faz (RSVP → cadastro aniversariantes → config → estimativa → fechamento/rateio → acerto),
   como operar e como está o Supabase. Sem inventar — descrever o que existe.
4. **REGRAS-NEGOCIO.md → v6.** Adicionar a seção do **acerto** (texto pronto abaixo) e bumpar a
   versão pra v6 no cabeçalho.
5. **Compartilhar o acerto.** Um botão que gera o **resumo do acerto** (as transferências: "Braz
   → Bruno: R$ 50,00; …") pra mandar no grupo. Copiar pra área de transferência **e/ou** abrir o
   WhatsApp com o texto pré-preenchido (`https://wa.me/?text=…` — **não precisa** de número, o
   organizador escolhe o contato). Só aparece quando o acerto está **completo** (selo verde).

### Texto pronto pra seção do `REGRAS-NEGOCIO.md` (v6)
> ## Acerto (quem deve a quem)
> Depois do rateio (quanto cada aniversariante **deve**) e do fechamento (custo real), registra-se
> **quem pagou** cada item (chopp/refri/água/pizza) — um pagador por item, marcado no admin; o
> valor é o custo já calculado, não digitado.
> - `pagou_k` = soma dos itens que k bancou.
> - `saldo_k = deve_k − pagou_k` — positivo = a **pagar**; negativo = a **receber**.
> - Como Σ deve = Σ pagou = custo real total, **Σ saldo = 0** e o acerto sempre fecha.
> - Gera as **transferências mínimas** entre os 3 (≤ 2): "quem deve a quem".
> - Só fecha quando o rateio **confere** (fechamento completo, sem órfão) **e** todo item com
>   custo > 0 tem pagador.
> - Tudo em centavos; herda a exatidão do rateio.
> - Campos: `config.pago_por_chopp/refri/agua/pizza` (`smallint` 1/2/3 ou NULL).

## Fora de escopo (não tocar)
Nenhuma mudança de lógica de rateio/acerto/estimativa/fechamento — só apresentação e docs. Extras
fora do modelo (gorjeta/frete) seguem fora.

## Verify (portão desta fatia)
- `./verify.sh` verde (57 asserções; se o resumo do acerto usar um helper, dá pra cobrir com teste).
- **Integrada / manual, com saída crua no `status.md`:**
  - countdown: data **no futuro** (conta normal), **hoje** ("É hoje!"), **no passado**
    (escondido/neutro) — provar os três, respeitando o fuso -03:00;
  - **compartilhar acerto:** com um acerto completo, o resumo gerado bate com as transferências
    (saída crua do texto); some quando o acerto não está completo;
  - **docs:** conferir que README/HANDOFF/REGRAS descrevem o **estado real** (sem número inventado,
    sem Netlify), e o REGRAS está na v6 com a seção do acerto.

## Observações
- Fuso do countdown: mesma disciplina do resto — a virada do dia é -03:00.
- O compartilhar **não** precisa dos telefones dos aniversariantes (o `wa.me/?text=` deixa o
  organizador escolher o contato); não adicionar campo de telefone.
- Depois desta, o backlog de fatias zera. Fica só a pendência operacional do Bruno (rotacionar a
  senha do Postgres), que é fora do repo.
