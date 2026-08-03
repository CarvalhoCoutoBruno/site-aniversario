# Plano — Fatia 8: convite editável pelo admin

Branch: `feat/fatia-8-convite-editavel`

## O risco central: hoje o convite **não pode** falhar em carregar

O prompt sinaliza o problema do load assíncrono. Medindo, ele é mais grave do que "o hero
demora": os chips de `convidado_por` nascem vazios no HTML —

```
92:      <div class="chips" id="chipsAniversariantes"></div>
```

— e são preenchidos por JS a partir do `config.js`, que é **síncrono e sempre existe**. Movendo
para a `festa`, um fetch que falhe deixa os chips vazios. E a validação do envio exige pelo menos
um marcado:

```js
if (!convidadoPor.length) return falha(status, "Escolha quem te convidou.");
```

Resultado: **o convidado vê um formulário completo, preenche tudo, clica em enviar e é barrado
por um campo que não existe na tela.** Um soluço de rede transforma o convite num beco sem saída.

Hoje isso é impossível — o `config.js` garante os chips. Depois desta fatia, passa a depender da
rede.

São 11 pontos de leitura síncrona a migrar (6 no `main.js`, 5 no `admin.js`), e o
`const alvo = new Date(C.festa.data)` do countdown é avaliado no topo do módulo.

### Como resolvo

**Falhar alto, não pela metade.** Se a `festa` não carregar, o formulário não aparece: no lugar
dele, uma mensagem dizendo que não deu para carregar os dados e pedindo para recarregar. É o
mesmo princípio do "confirmações encerradas" da Fatia 1 — melhor um estado explícito do que um
formulário que rejeita o envio por um motivo invisível.

Enquanto carrega, um estado de "carregando" em vez do hero com placeholders (`Aniversário`, `—`,
`—`), que hoje aparecem por um instante e passariam a ser o que se vê num erro.

> Considerei guardar a última `festa` conhecida em `localStorage` como rede de segurança. **Não
> vou** — a complexidade e o risco de exibir dado velho (uma data corrigida que não pega) não
> compensam num convite que se abre poucas vezes. Se o review preferir, é fácil de somar.

## A trava do reset precisa de um sinal novo

A trava da Fatia 6 pergunta "a `config` tem dado real?". Para a `festa` isso não funciona: ela é
**semeada pelo próprio script**, então tem linha sempre — "tem dado" seria verdade desde o
primeiro `Run`, e o script nunca mais rodaria.

**Solução:** `festa.atualizado_em`, `NULL` no seed e preenchido pelo admin ao salvar. A trava
aborta quando é não-nulo. Ou seja: recriar é livre enquanto ninguém editou o convite; depois
disso, bloqueia — que é exatamente o comportamento desejado.

## Implementação

### Schema
Tabela `festa` (linha única, `check (id = 1)`): `titulo`, `subtitulo` (nullable), `data` (ISO com
-03:00), `data_texto` (nullable — vazio = gerado), `local`, `local_mapa`, `nome_aniv_1/2/3`,
`atualizado_em` (nullable).

**RLS:** `select` liberado para `anon` — é a **primeira tabela** que o visitante lê direto. Por
isso ela guarda só o que já está impresso no convite; preço e custo real seguem na `config`,
fechada. `update` só admin, via `is_admin()`.

Seed com os valores que estão hoje no `config.js`.

> Ganho colateral: hoje a posição no array é o id dos aniversariantes, e reordenar quebra
> silenciosamente. Em colunas `nome_aniv_1/2/3` a posição vira explícita — não dá para reordenar
> sem querer.

### `data_texto` gerado
Validei a geração a partir da ISO, no fuso de São Paulo:
```
2026-10-31T11:00:00-03:00  ->  Sábado, 31 de outubro de 2026, às 11h
2026-12-25T19:30:00-03:00  ->  Sexta-feira, 25 de dezembro de 2026, às 19h30
2027-01-01T00:00:00-03:00  ->  Sexta-feira, 1 de janeiro de 2027, às 00h
```
A primeira linha é **idêntica** ao que está hoje no `config.js` — o seed não muda o que o
convidado vê. O campo continua editável para quem quiser escrever à mão.

### `js/main.js`
- `carregarFesta()` no início; hero, countdown e chips passam a ser montados por ela.
- `alvo` deixa de ser `const` de topo; o cronômetro só começa quando a data chega.
- Falha → esconde o formulário e mostra o aviso.

### `js/admin.js`
Seção **Convite** com todos os campos, `update` estreito só na `festa` + `atualizado_em`.
`ultimaFesta` entra no mesmo padrão de guarda de completude que já existe para config/pessoas/
grupos — os cinco pontos que hoje leem `C.aniversariantes` passam a ler dela.

Validação: título e local obrigatórios; `data` válida; `local_mapa` precisa ser URL `http(s)` —
hoje vai direto para o `href`, e um valor colado errado viraria link quebrado no convite.

### `js/config.js`
Fica só o bloco `supabase`. O `temSupabase` continua sendo o guarda de "site não configurado".

### Docs
A ET §2.1 descreve o `config.js` guardando os dados da festa e a ordem do array como id — passa a
estar errado. Corrijo junto, mesmo princípio da Fatia 7.

## Fora de escopo
Preços, taxas, prazo, `custo_real_*`, `pago_por_*` (seguem na `config`), rateio, acerto,
estimativa, e a produtização (multi-tenant) — que é conversa à parte.

## Verify

`./verify.sh` verde.

Integrada, com saída crua no `status.md`:

1. editar **cada campo** no admin → salvar → recarregar o site público e provar a mudança
   (título, subtítulo, data/countdown, local + link, os 3 nomes no hero **e nos chips**);
2. **countdown** com a data nova: os três estados da Fatia 7 (futuro / é-hoje / passou),
   incluindo o caso do `diff` negativo no dia da festa;
3. **renomear um aniversariante não quebra confirmação existente** — gravo um RSVP, renomeio, e
   provo que `convidado_por` continua apontando para o mesmo id e o painel mostra o nome novo;
4. **anon lê a `festa` e não lê a `config`** — as duas chamadas, saída crua;
5. **anon não grava a `festa`** — pelo estado do banco, não pelo HTTP;
6. **falha de carga:** simulo a `festa` indisponível e provo que o formulário **não** aparece
   pela metade — é o risco central desta fatia;
7. **trava do reset** protege a `festa` depois de editada, e libera antes;
8. `data_texto` em branco → gerado da data; preenchido → respeitado;
9. re-seed e base restaurada ao fim.

## Para o review

1. **Confirmar que a `festa` é pública.** É a primeira leitura direta que o anon ganha no
   projeto. Só entra ali o que já aparece impresso no convite, mas vale o aceite explícito.
2. **`localStorage` como fallback** — minha recomendação é não; digo acima o porquê.

Parado, sem implementar, aguardando `review.md`.
