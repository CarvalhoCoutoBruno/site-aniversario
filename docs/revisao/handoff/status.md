# Status — Fatia 16: fechar a refatoração de idioma

**Fatia fechada.** O convite voltou ao ar, a trava do reset está viva de novo, e o código não tem
mais identificador em português — nem em comentário.

| | |
|---|---|
| Branch | `fix/fatia-16-fecha-idioma` → merge `--ff-only` → apagada |
| Commits | 9, cada um verde no `./verify.sh` |
| Commit do código | `f887e9a3a6bc1aa92c585fd3ca1c2876a66e730b` |
| `origin/main` após o push | `5c958683ee384d06b3421c2e499b4370941dfc8a` |
| `main == origin/main` | **sim** |
| `tests/calc.test.js` | 63 asserções, inalteradas |

## Item zero — o site estava fora do ar, e o motivo era o Jekyll

O Pages não reconstruía desde o push da refatoração. Diagnóstico:

```
raw.githubusercontent .../js/main.js      -> from("party")   ← o código NOVO estava no GitHub
raw.githubusercontent .../.nojekyll       -> HTTP 200
carvalhocoutobruno.github.io/.nojekyll    -> HTTP 404        ← o Pages não publicou
last-modified do main.js publicado        -> anterior ao push
```

Ou seja: commit no GitHub, build não rodando. Sem `.nojekyll` o Pages roda **Jekyll**, e o repo
tem HTML com `{{ }}` nos mockups de design que o Liquid tenta interpretar. Adicionei `.nojekyll`
— o site é estático puro, Jekyll não fazia nada por ele além de acrescentar um modo de falha.

Destravou. Confirmado em produção:

```
FESTA DOS 160 ANOS · 40 BRUNO + 50 BRAZ + 70 JH BOCA = 160
DIA   Sábado, 31 de outubro de 2026, às 11h
ONDE  Salão Grande — Av. Cel. Marcos, 627, Pedra Redonda, Porto Alegre/RS
85 DIAS 22 HORAS 44 MIN
```

**Ganho durável:** arquivo novo no repo não pode mais quebrar a publicação do convite.

## Item 1 — a trava estava morta, e as duas metades importavam

`to_regclass('public.config')` e `('public.festa')` devolviam NULL depois do rename, então os dois
`if` caíam fora. Não eram duas linhas: eram os blocos 46–79 e 83–99 inteiros. Sobrou só o freio de
`rsvps`, que estava vazia — **um Run no editor do Supabase apagaria preço, taxa, prazo e o
convite sem uma palavra.**

A segunda metade, que o review sublinhou: as chaves lidas por `to_jsonb` também eram nomes
antigos, e chave inexistente em `jsonb` devolve NULL, não erro. Corrigir só as tabelas deixaria a
guarda passando calada e o conserto **parecendo** pronto.

Provado nas duas direções:

```
contra a base do Bruno:
  ABORTADO: public.settings tem dado real (prazo de confirmacao definido).
  party  : ['Salão Grande — …', 'JH Boca']     ← intacta
  prices : [20.00, 2.500]                       ← intacta
  people : 3                                    ← intacta

num schema de brinquedo vazio:
  a trava NÃO disparou — não é falso positivo
```

## Item 2 — corrigi o prompt, não o banco

O Cowork supunha que o recreate tinha deixado "Salão 3", "Bocão", preço zerado e sem prazo. Não
tinha: eu restaurei logo depois do recreate. Conferi na fonte antes de tocar em qualquer coisa:

```
venue: Salão Grande — …   celebrant_3_name: JH Boca
preços: 20 / 10 / 5 / 3   taxa de chopp: 2,500   prazo: 01/10/2026 23:59:59
```

**Não reescrevi valor certo com valor lembrado.** O que valia era a segunda metade: o *seed* do
`supabase-setup.sql` ainda tinha os valores velhos e o próximo recreate reverteria. Corrigido.
Preço, taxa e prazo continuam fora do seed — são operacionais, e é o que a trava protege.

## Item 3 — `calculo.js` → `calc.js`

`git mv` nos três arquivos; o git reconheceu como rename (`R099`, `R098`, `R095`), então
`git log --follow` acompanha. Referências atualizadas no `admin.html`, no `require` e no cabeçalho
do teste, no `test.html`, no `verify.sh`, no `FLUXO.md` e nos docs vivos.

**Os prompts arquivados em `docs/revisao/prompts/` não foram tocados**: são registro do que foi
pedido na época, e reescrevê-los para nomear um arquivo que não existia falsificaria o histórico.

De quebra: a ET dizia "41 asserções" desde a Fatia 5.

## Item 4 — policies, e uma pegadinha

14 renomeadas, aplicadas em transação única, **depois** de o site voltar — a ordem que o review
pediu, e ele estava certo: não se gasta risco de produção com estética no meio de uma queda.

**A pegadinha:** aplicar os blocos do arquivo não renomeia, **duplica**. O `drop policy if exists`
cita o nome NOVO, que ainda não existia, então as 14 antigas ficaram e o banco foi para 28. Como
policy é permissiva e as regras eram idênticas, o comportamento não mudou — mas o estado ficou
sujo. Derrubei as antigas num segundo bloco, também em transação. Final: 14, todas em inglês.

**RLS provada pelo estado do banco, não pelo HTTP:**

```
RSVP gravado em produção pela RPC   -> banco: rsvps = 1
anon lendo rsvps                    -> []      ← [] com tabela NÃO vazia = RLS barrando
anon lendo settings (tem preço)     -> []
anon lendo party                    -> a linha do convite  ← leitura pública, correta
POST direto em rsvps/people/settings/party -> 401
```

Isso fecha junto o **RSVP ponta a ponta em produção** com tabela e RPC novas. Apagado pelo próprio
identificador depois.

## Itens 5, 6 e 7

**70 comentários** passaram a nomear o que existe. O que **não** mudou, de propósito: `pessoas` e
`festa` como palavra portuguesa em frase corrida — *"4 pessoas perde a conta"*, *"a festa já
rolou"*, *"Fotos da festa"*. É a diferença entre varrer e rodar um `sed` burro.

O bucket `fotos` fica, com a nota no `config.js` de que é legado proposital — renomear bucket no
Supabase é criar outro e mover objeto a objeto, com foto real dentro.

`FLUXO.md` registra a regra do último recreate barato e, mais útil, **como a trava morre**:
`to_regclass` e `to_jsonb` devolvem NULL em silêncio quando o nome muda. Por isso o teste tem duas
direções.

## A auditoria do `verify.sh` que o review pediu

Plantei violação em cada um dos 5 invariantes. Todos reprovam:

```
credencial vazada           ✗ reprova
placeholder COLE_A_*        ✗ reprova
placeholder <UID_DO_ADMIN>  ✗ reprova
insert direto na tabela     ✗ reprova   (com os nomes NOVOS: from("people"))
data/hora sem timeZone      ✗ reprova
```

⚠️ O primeiro deu **falso alívio**: plantei a connection string num `.md`, que o invariante exclui
de propósito, e li isso como "não pega". Replantado em arquivo coberto, reprova. O teste de um
invariante também pode estar errado — vale conferir o teste antes de acusar a regra.

## Estado final

```
tabelas : admins · party · people · rsvps · settings
funções : create_rsvp · is_admin · normalize_contact · rsvp_status · valid_invited_by
policies: 14, todas em inglês
party   : 'Festa dos 160 anos' · Salão Grande · Bruno · Braz · JH Boca · 31/10/2026 11:00
settings: pizza 20,00 · chopp 10,00 · taxa 2,500 · prazo 01/10/2026 23:59:59
people  : 3 aniversariantes, name NULL de propósito
rsvps   : 0 · admins: 4 · fotos: 3
convite : no ar e correto
```

## O que sobra no projeto

A fatia **opcional** de sempre: lixeira + `cancelar_rsvp` + `whatsapp_contato`. A festa funciona
sem.

Pendência sua: **rotacionar a senha do Postgres**, que circulou na conversa.
