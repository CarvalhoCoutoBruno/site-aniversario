# Fatia 15 — Admin: aba "Contas" (as 4 fases)

Última das quatro fatias do painel. Sai a última seção provisória e acaba a era do `<details>`.
**É a aba do dinheiro** — e a única do painel cujo erro custa dinheiro de verdade, não incômodo.

## ⚠️ Regras permanentes
- O banco tem confirmação real (a Rosaura, e o que vier). Teste apaga **pelo próprio
  identificador**; ao fim, provar que o que é real continua intacto.
- **`js/calculo.js` não muda.** O design foi desenhado a partir dele. Nenhum número desta tela pode
  ser recalculado no `admin.js`: tudo vem de `Calculo.rateio()` / `Calculo.acerto()` /
  `Calculo.resumoAcerto()`. Se a tela precisar de um número que o módulo não devolve, **pare e
  pergunte no plano** — não derive na tela.

## Fontes da verdade
`docs/revisao/design/admin/prompt-design.md` §5 (as 4 fases, com os gatilhos vindos do
`calculo.js`) e §3/§4; o mockup para layout e hierarquia. E as regras de negócio já fechadas:
`docs/REGRAS-NEGOCIO.md` v6 (§4.2, §4.3 e a seção do acerto).

## Escopo
1. **Lançar o custo real:** os três `custo_real_*` e os dois `preco_real_pizza_*`. **Vazio = "ainda
   não sei", nunca zero** — placeholder `não sei`, borda âmbar, e grava `NULL`. É a semântica que a
   Fatia 5 fixou; não pode virar `0,00` cinza.
2. **Rateio:** as 3 contas por aniversariante, com o detalhe por item, o total gasto e o total
   rateado. A nota **"convidado não paga — quem chamou banca"** fica visível no card.
3. **O selo, nas 4 fases**, com o gatilho vindo do módulo:

   | Fase | Gatilho | Acerto |
   |---|---|---|
   | `pendente` | `fechamentoCompleto === false` | bloqueado, mostra o `motivo` |
   | `nao-confere` | `fechamentoCompleto && !confere` | bloqueado |
   | `falta-pagador` | `acerto().faltaPagador.length` | bloqueado, nomeia o item |
   | `completo` | `acerto().status === "completo"` | transferências + compartilhar |

   **Verde exige as duas condições** (fechamento completo **e** soma batendo) — não basta os totais
   coincidirem, e isso já foi teste na Fatia 5. O texto do `motivo` **vem do `calculo.js`**, não é
   reescrito na tela.
4. **Quem pagou cada item:** um seletor por item, com o **valor calculado ao lado**. O organizador
   escolhe o nome; **ninguém digita valor**.
5. **Compartilhar o acerto:** o texto vem do `Calculo.resumoAcerto()` e vai por `wa.me/?text=…`
   (sem número — quem compartilha escolhe o contato), com a queda para `<textarea>` se a
   `clipboard` for negada. Só aparece com o acerto completo.
6. **O conserto do nome, agora que sai de graça:** parar de guardar o nome na linha de
   aniversariante. A `festa` é a fonte; a coluna pode ficar nula nessas linhas (a constraint
   `principal_tem_nome` só exige nome para `papel='principal'`). Os leitores principais — contas,
   saldos, transferências — estão sendo reescritos **nesta fatia**, então a auditoria é o próprio
   trabalho. Se algum leitor fora daqui ainda depender do snapshot, diga no plano.
7. **Limpeza final:** a seção provisória sai; o CSS órfão junto.

## Fora de escopo
`js/calculo.js`, `index.html`/`js/main.js`, RLS, e as outras abas além de mantê-las funcionais.

**Também fora, e com destino registrado:** a coluna `whatsapp_contato` (P2 da Fatia 11) **não**
entra aqui — ela vai junto da fatia de **lixeira + `cancelar_rsvp`**, que já mexe em schema, em
painel e no convite. Enfiar schema na aba do dinheiro por conveniência de agenda é o tipo de
mistura que a gente vem evitando.

## Riscos que quero endereçados no plano

**1. `update` estreito, agora com dinheiro real do outro lado.** Contas escreve `custo_real_*`,
`preco_real_pizza_*` e `pago_por_*`. Um `patch` largo daqui zeraria preços, taxas ou prazo — que são
da Ajustes e **estão preenchidos com os valores do Bruno**. Mesma prova da Fatia 14, invertida:
plante valor nos campos da Ajustes, salve cada formulário desta aba, prove que sobreviveram.

**2. Nenhum número derivado na tela.** O risco específico desta aba é reimplementar meia conta no
`admin.js` "só para exibir" — e aí duas fontes discordam sobre dinheiro. Toda cifra sai do módulo.
Diga no plano de onde vem cada número que a tela mostra.

**3. Comparação de moeda formatada.** Se a verificação comparar string de `formatarBRL`, lembre do
**espaço não-quebrável** (char 160) entre `R$` e o número — já deu falso negativo na Fatia 4.

**4. As 4 fases precisam ser alcançadas de verdade.** Não basta desenhar: plante os valores que
levam a cada fase (inclusive o **caso órfão**, custo lançado para item que ninguém consome) e
mostre a tela em cada uma. Limpe depois.

## Verify
- `./verify.sh` verde, com as 63 asserções **inalteradas** — se o número mudar, `calculo.js` mudou,
  e não devia.
- **As 4 fases**, com screenshot a 390px de cada uma e a saída crua do estado que a produziu.
- **Reconciliação:** com o fechamento completo, `Σ das 3 contas === custo real total`, ao centavo.
- **O caso do ×6,5** (regra §4.2) conferido na tela, se a base de teste permitir montá-lo.
- **`update` estreito** provado por `SELECT`, com plantio nos campos da Ajustes.
- **O conserto do nome:** com `pessoas.nome` nulo nas linhas de aniversariante, provar que contas,
  saldos, transferências, filtros e Resumo continuam mostrando os nomes certos (da `festa`).
- **Compartilhar:** o texto bate com as transferências da tela; e o caminho de clipboard negada.
- **Confirmações reais intactas** ao fim; `custo_real_*` e `pago_por_*` de volta a `NULL` (o
  fechamento de verdade é depois da festa).
- **Convite intacto** e **modo escuro idêntico**.
- **Tabela de hashes** no `status.md`.

## Observação
Quando esta fechar, o painel está migrado por inteiro e o backlog do admin zera. O que sobra no
projeto é a fatia de **lixeira + `cancelar_rsvp` + `whatsapp_contato`**, e ela é opcional — a festa
funciona sem.
