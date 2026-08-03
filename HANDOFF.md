# 🎉 Handoff — Site de Aniversário

> Documento para retomar o projeto em outra máquina, ou passar para outra pessoa.
> Última atualização: 2026-08-03, ao fim da Fatia 7.

## O que é

Convite de aniversário para **3 aniversariantes** — Bruno, Braz e Bocão — com RSVP e um painel
de organizador que vai da estimativa de compra até o acerto de contas entre os três.

- **No ar:** https://carvalhocoutobruno.github.io/site-aniversario/
- **Repositório:** https://github.com/CarvalhoCoutoBruno/site-aniversario
- **Festa:** 31/10/2026, 11h — Salão 3, Av. Cel. Marcos 627, Pedra Redonda, Porto Alegre/RS

Site estático (HTML/CSS/JS puro, sem build). Deploy automático no `git push` da `main`.
Backend Supabase.

## Estado

**Completo e no ar.** As sete fatias fecharam; não há backlog de desenvolvimento.

| Fatia | O que entregou |
|---|---|
| 0 | schema do Supabase, dados da festa, módulo de cálculo |
| 1 | formulário público no modelo novo |
| 2 | tela de preços, taxas e prazo |
| 3 | cadastro dos aniversariantes como consumidores |
| 4 | estimativa de compra |
| 5 | fechamento e rateio |
| 6 | acerto entre os aniversariantes |
| 7 | polimento e docs |

Cada fatia tem a evidência da verificação no `status.md` da rodada, no histórico do git.

## O modelo, em um parágrafo

Convidado **não paga**. O consumo de cada convidado é bancado pelo aniversariante que o
convidou — dividido igualmente quando foi mais de um. Cada aniversariante paga 100% do próprio
consumo. No fim existem **três contas**. Depois de lançar quem pagou cada item ao fornecedor, o
sistema calcula o **acerto**: quem transfere quanto para quem, no máximo duas transferências.

Detalhes em [docs/REGRAS-NEGOCIO.md](docs/REGRAS-NEGOCIO.md); o "como" em
[docs/ESPECIFICACAO-TECNICA.md](docs/ESPECIFICACAO-TECNICA.md).

## Como operar

Tudo pelo painel, em `.../admin.html`, com a conta criada no Supabase Auth.

1. **Antes de divulgar:** preencher preços e taxas, e definir o prazo de confirmação. Cadastrar
   o consumo dos 3 aniversariantes — sem isso a estimativa sai sem eles.
2. **Enquanto chegam confirmações:** acompanhar a lista e a estimativa. Os volumes são o que se
   passa ao fornecedor.
3. **Depois da compra:** lançar o custo real de chopp, refrigerante e água (e o preço real da
   pizza, se diferente do previsto). O rateio aparece com as 3 contas e um selo: verde quando a
   soma bate com o gasto, vermelho quando não bate — mostrando a diferença.
4. **Para acertar entre vocês:** marcar quem pagou cada item. O painel mostra os saldos e as
   transferências, e gera um resumo para copiar ou mandar no WhatsApp.

## Supabase

- Projeto `mbzuxkvrrtvbgkikrivh`, região São Paulo.
- 4 tabelas: `admins`, `rsvps`, `pessoas`, `config`.
- Escrita anônima **só** pela função `criar_rsvp`, que valida tudo numa transação. O visitante
  não tem acesso direto a tabela nenhuma.
- Leitura administrativa amarrada à tabela `admins` pela função `is_admin()`.
- Cadastro público **desligado**: contas de organizador são criadas à mão.
- Quatro contas cadastradas: Bruno, Braz, Bocão e Rosaura. Rosaura é organizadora sem ser
  aniversariante — admin, aniversariante e pagante são eixos independentes.

### O `supabase-setup.sql` recria, não migra

É a **fonte da verdade** do schema: quando o modelo muda, corrige-se o arquivo e recria-se do
zero, sem migrations de errata.

Para isso não virar perda de dados, ele **aborta** se houver confirmações salvas ou se a `config`
tiver dado real — preços, prazo, custo lançado ou pagadores marcados. Depois do lançamento, essa
trava é a única coisa entre um `Run` distraído e a perda do trabalho; **não a remova.**

## Como verificar

```bash
./verify.sh
```

Sintaxe dos arquivos JS, os testes de cálculo e busca por credencial vazada. Roda no `jsc`
(que já vem no macOS) ou no Node.

É **estático**. Não prova que o formulário grava, que a RLS barra ou que o painel calcula. Para
isso é preciso abrir o site e conferir o resultado no banco — o `docs/revisao/handoff/FLUXO.md`
tem a receita, incluindo as limitações do ambiente que já custaram tentativa falha.

## Pendências

- **Rotacionar a senha do Postgres.** Ela circulou em conversa durante o desenvolvimento. Nada
  no site depende dela: o site usa só a chave anon. Supabase → Settings → Database → Reset
  database password.
- Subir as fotos do carrossel pelo painel.
- Preencher preços e taxas reais antes de divulgar o link.

## Onde as coisas moram

```
index.html / admin.html   as duas telas
js/config.js              dados da festa e chaves (editar aqui)
js/calculo.js             estimativa, rateio e acerto — puro e testado
js/main.js / js/admin.js  lógica de cada tela
supabase-setup.sql        o schema inteiro
tests/                    os testes do cálculo
verify.sh                 a verificação
docs/REGRAS-NEGOCIO.md    o "o quê"
docs/ESPECIFICACAO-TECNICA.md  o "como"
docs/revisao/             o protocolo de trabalho e o histórico das fatias
```
