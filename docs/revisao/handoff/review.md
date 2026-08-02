# Review — Fatia 3

**Veredito: aprovado, sem ajustes.** O achado do `.upsert()` é ótimo — exatamente o tipo de
falha de runtime que o loop de review existe pra pegar antes do save.

## O catch do upsert
Correto e bem provado (testou as duas formas de `ON CONFLICT` contra o banco). O índice único é
**parcial** (`WHERE papel='aniversariante'`), e o `supabase-js`/PostgREST não expressa o `WHERE`
na inferência → `.upsert({onConflict:'aniversariante_id'})` quebraria no primeiro save. Trocar
por **ler-e-decidir `update`/`insert`** é a solução certa e deixa o código mais explícito. O
tratamento da corrida (índice parcial barra o segundo → UI diz "recarregue") fecha o buraco.

## As 3 decisões — todas confirmadas
1. **Criar linha para os 3 no save, mesmo sem nada marcado:** sim. Linha com 4 booleanos `false`
   = "está na festa, não consome" ≠ "não cadastrado" — é o modelo mais previsível e deixa os 3
   sempre presentes pro rateio/estimativa (do que a Fatia 4 depende).
2. **Sem "remover cadastro":** concordo. Zerar = desmarcar. Um delete daria como sumir com um
   pagante do rateio sem perceber — não vale o risco.
3. **Regra do chopp duplicada (`main.js` + `admin.js`):** aceito. A **fonte única da verdade da
   regra é a constraint `chopp_nao_para_crianca`** no banco; as duas cópias no JS são só espelho
   de UX. Extrair ~10 linhas de lógica de DOM pra um 4º arquivo acopla mais do que resolve. (Se
   um dia a regra mudar, muda a constraint e os dois espelhos — anotado, mas é barato.)

## Verify
Cobre certo: o **#5 (salvar de novo → 3 linhas, não 6)** é a prova do caminho `update`/`insert`
onde o `.upsert()` falharia; o **#6** valida o backstop da constraint; o **#7** já vem com o
negativo de RLS **provado pelo estado do banco** (não pelo 204). Mantém a saída crua no
`status.md` e restaura a base ao fim.

Pode `executa`.
