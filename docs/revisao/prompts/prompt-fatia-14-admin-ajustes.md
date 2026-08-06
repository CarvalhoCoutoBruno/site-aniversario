# Fatia 14 — Admin: aba "Ajustes"

Terceira das quatro fatias do painel. Aqui saem os **últimos** `<details>` provisórios do Convite,
Preços/taxas/prazo e Aniversariantes, mais as fotos. Só Contas continua provisória, e ela é a
Fatia 15.

## ⚠️ Regra permanente
O banco tem dado real de convidado (a Rosaura, e o que vier até lá). Teste apaga **pelo próprio
identificador**, nunca em bloco; ao fim, provar que as confirmações reais continuam intactas.

## Fontes da verdade
`docs/revisao/design/admin/prompt-design.md` §2 (a aba Ajustes reagrupa Convite, preços, taxas,
prazo, aniversariantes e fotos), §3 tokens, §4 contraste — e o mockup, que manda em layout e
hierarquia, não em regra.

## Escopo
1. **Os quatro formulários no visual novo**, reagrupados na aba: Convite (título, subtítulo, data,
   local, mapa, os 3 nomes), Preços e taxas + prazo, Aniversariantes como consumidores, e Fotos
   (upload, listagem, exclusão).
2. **Inputs `date` e `url`** ganham o seletor do painel — a última parcela da dívida que a Fatia 12
   começou a pagar com `email`/`password`.
3. **Aviso sobre as `<meta>` `og:`**: na área do Convite, deixar explícito que **título, data e
   local do preview de link (WhatsApp) são escritos à mão no `index.html`** e **não** seguem o que
   se edita aqui. Quem mudar data ou local precisa saber que o preview vai continuar mentindo até
   alguém mexer no HTML. Texto curto e no lugar onde a pessoa está editando, não num rodapé.
4. **Limpeza:** as três seções provisórias saem, junto com o CSS órfão.
5. **A dívida do `:root`:** com Ajustes migrado, nenhuma página lê o `@media (prefers-color-scheme:
   dark)` do `:root`. Se for verdade **depois** desta fatia (Contas ainda é provisória — confira),
   remova o bloco; se ainda houver leitor, diga no plano e deixe para a 15.

## Riscos que quero endereçados no plano

**1. Esta é a aba que escreve mais.** Convite escreve em `festa`; Preços/taxas/prazo escrevem em
`config`. **`update` estreito é lei**: nenhuma tela pode mandar objeto amplo. Um `update` largo aqui
zeraria `custo_real_*`/`pago_por_*`, que são da Fatia 15 — e a essa altura podem já ter valor real.
Prove por `SELECT` que os campos das outras telas ficam intactos após salvar cada formulário.

**2. Renomear aniversariante mexe em duas moradas.** O nome vive em `festa.nome_aniv_*` (fonte da
verdade) e em `pessoas.nome` (snapshot). A Fatia 8 já fez a UI ler da `festa`; garanta que
renomear pelo Convite continue coerente em todo o painel **sem** exigir re-salvar Aniversariantes —
e que `convidado_por` continue apontando pelo id. A Rosaura está com `convidado_por [3]`; renomear o
id 3 não pode desamarrar nada.

**3. Prazo e fuso.** O campo de data grava fim do dia `-03:00` e lê de volta pelo fuso de São
Paulo. Já foi corrigido duas vezes nesta base; o invariante do `verify.sh` cobre a formatação, mas a
**ida e volta** (salvar 01/10 → recarregar → continuar 01/10) é teste de tela. Não regride.

**4. Fotos.** Upload e exclusão mexem no Storage, não no Postgres — e a exclusão de foto também não
tem desfazer. Confirmação nomeando o que sai, como ficou combinado para os RSVPs.

## Fora de escopo
`js/calculo.js`, `index.html`/`js/main.js` (exceto, se você quiser, um comentário no HTML junto das
`<meta>` apontando para o aviso — opcional), schema, RLS, e a aba Contas além de mantê-la funcional.

## Verify
- `./verify.sh` verde, com o invariante de fuso.
- **`update` estreito, formulário por formulário**, provado por `SELECT`: salvar Convite não toca
  `config`; salvar Preços não toca `custo_real_*`/`pago_por_*` nem `festa`.
- **Ida e volta do prazo** pela tela (salvar → recarregar → mesma data), e sob pelo menos dois fusos
  de navegador.
- **Renomear um aniversariante** e provar: o nome novo aparece em todo o painel, `convidado_por`
  segue por id, e a Rosaura continua ligada ao id 3.
- **Fotos:** subir, listar e excluir uma foto de teste; provar que as fotos reais que já estão no
  bucket **não** foram tocadas.
- **Confirmações reais intactas** ao fim, com saída crua.
- **Screenshots a 390px** de cada bloco da aba (Convite, Preços/taxas/prazo, Aniversariantes,
  Fotos), mais um de desktop.
- **Convite intacto** e **modo escuro idêntico** — as duas asserções que já pegaram regressão.
- Retomar a **tabela de hashes** no `status.md` (Branch, commit e `origin/main` pós-push): a da
  Fatia 13 veio sem ela, e é o que o `fechou` confere.

## Observação
Se o mockup não cobrir o agrupamento dos quatro formulários numa aba só (ordem, acordeões,
separadores), pergunte no plano — é hierarquia, e hierarquia é do Design.
