# Fatia 1 — Formulário público no modelo novo

## Objetivo
Reescrever o formulário público (`index.html` + `js/main.js`) para gravar no modelo novo
via o RPC `criar_rsvp`, encerrando o "modo teste". Hoje o `main.js` ainda monta o payload
antigo — publicar sem esta fatia quebra o RSVP.

## Fontes da verdade
- `docs/REGRAS-NEGOCIO.md` (v5) — §3 (regras do formulário), §2 (modelo), §4 (`convidado_por` é a chave do rateio).
- `docs/ESPECIFICACAO-TECNICA.md` — contrato do RPC e do formulário.
- `supabase-setup.sql` — assinatura de `criar_rsvp`/`status_rsvp` e as constraints (o banco é a última linha).

## Escopo (o que entra)
1. **Cards de pessoa.** O primeiro card é o próprio convidado (papel `principal`); os demais
   são acompanhantes. Por pessoa: `tipo` (adulto/criança, obrigatório) + checkboxes água,
   refri, chopp, pizza.
2. **Chopp × criança.** Marcar "criança" desmarca e desabilita o chopp na hora, com aviso
   visível; marcar "adulto" reabilita. Espelha a constraint `chopp_nao_para_crianca` (o banco
   segue como backstop).
3. **`convidado_por`.** Checkboxes com os NOMES dos 3 aniversariantes (de `config.js`),
   obrigatório **ao menos 1**, no máximo 3. Envia os **ids 1/2/3** (índice+1 da lista
   `aniversariantes`), **nunca** o nome. É a chave do rateio.
4. **Acompanhantes.** Botão "+ adicionar acompanhante" some ao chegar em **5**. Nome do
   acompanhante é **opcional** e, quando vazio, a pessoa **entra no payload assim mesmo**
   (exibir como "Acompanhante N"). ⚠️ Corrigir o bug antigo (`.filter(p => p.nome)` no
   `main.js`) que descartava pessoa sem nome — no modelo novo isso é um consumidor perdido no rateio.
5. **Obrigatórios.** Contato (WhatsApp/e-mail) e nome do principal. `observacoes` opcional,
   limitado a 500 chars no cliente (a tabela tem CHECK ≤ 500 — não deixar estourar como erro cru).
6. **Botão de enviar** desabilita no clique e **não reabilita no sucesso**.
7. **Envio** = uma chamada `sb.rpc('criar_rsvp', { p_nome_principal, p_contato,
   p_convidado_por, p_observacoes, p_pessoas })`. `p_pessoas` = array de
   `{ nome, tipo, bebe_agua, bebe_refri, bebe_chopp, come_pizza, papel }` (papel `principal`
   no primeiro, `acompanhante` nos demais). Sem insert direto — só o RPC.
8. **Erro real.** Se o RPC falhar (prazo encerrado, validação, rede), mostrar a **mensagem
   real** ao usuário. Nada de fingir sucesso (fim do "modo teste").
9. **Prazo.** No load, chamar `status_rsvp()`; se `aberto=false`, esconder o formulário e
   mostrar "confirmações encerradas em DD/MM" (usando `prazo`). Se aberto e houver prazo,
   exibir "confirme até DD/MM".
10. **Reenvio.** Avisar no formulário que reenviar com o **mesmo contato substitui** a
    confirmação anterior (não soma) — é o dedupe do `criar_rsvp`.
11. **Limpeza.** Remover a renderização de bebidas/comidas dirigida por config (viraram
    colunas booleanas fixas) e o caminho de "modo teste".

## Fora de escopo
Área admin, estimativa, fechamento, cadastro de aniversariante (fatias seguintes).

## Verify (portão desta fatia)
- `node tests/calculo.test.js` (ou `jsc`) continua **verde** (sem regressão).
- **Verificação integrada com saída crua:** submeter uma confirmação real ponta a ponta
  contra o Supabase (pelo form ou um fetch ao `criar_rsvp` com a publishable key) e provar no
  banco (SELECT via admin, saída crua) que gravou: grupo + pessoas, `convidado_por` como ids,
  **acompanhante sem nome preservado**, `papel` correto. Depois **apagar** o registro de teste.
- Testar o **caminho de erro** (forçar prazo passado → RPC rejeita → mensagem aparece) e o
  **status fechado** (form escondido).
- Colar a saída crua no `status.md`, não "✅ funcionou".

## Observações
- O principal do formulário é sempre um **convidado** (papel principal), nunca aniversariante —
  aniversariante só entra pelo admin.
- Não dar push sem o `fechou` do Cowork.
