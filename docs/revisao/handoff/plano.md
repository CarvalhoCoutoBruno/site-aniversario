# Plano — Fatia 16: fechar a refatoração de idioma

Branch: `fix/fatia-16-fecha-idioma`

Entradas: `prompt.md` (Cowork) e `docs/revisao/auditoria-idioma.md`.

---

## Antes de tudo: uma correção de fato no item 2

**O banco já está restaurado.** Eu restaurei o estado operacional logo depois do recreate, na
mesma sessão, e conferi. O Cowork escreveu o item 2 sem essa informação — ele mesmo avisa que
estava reconstruindo de memória dos `status.md`. Conferi agora:

```
venue            : Salão Grande — Av. Cel. Marcos, 627, Pedra Redonda, Porto Alegre/RS
celebrant_3_name : JH Boca
preços           : pizza 20,00 · chopp 10,00 · refri 5,00 · água 3,00
taxa de chopp    : 2,500
prazo            : 01/10/2026 23:59:59 (São Paulo)
consumo dos 3    : [[1,T,F,T,T], [2,T,F,T,T], [3,F,T,T,T]]
```

Nada a restaurar, e **nada a confirmar com o Bruno** — não vou reescrever valor certo com valor
lembrado. O que sobra do item 2 é a **segunda metade, e ela continua valendo inteira**: o *seed*
do `supabase-setup.sql` está desatualizado, então o próximo recreate reverteria salão e nome. Isso
eu conserto.

## E uma coisa que não está no prompt: o site não publicou

Depois do push da refatoração, o GitHub Pages **não reconstruiu**. Fiquei ~5 minutos consultando e
ele segue servindo o `main.js` antigo:

```
from("party") no ar: 0
from("festa") ainda no ar: 1
last-modified: Thu, 06 Aug 2026 03:00:11 GMT   (anterior ao push)
```

Enquanto isso durar, **o convite está mostrando a tela de erro em produção**: JS velho falando com
schema novo. Não é regressão desta fatia — é a janela que o recreate abriu —, mas é o item mais
urgente da lista e entra como verificação obrigatória no fim: **convite no ar, funcionando**. Se o
Pages não destravar sozinho, isso vira investigação (build travado) e não "esperar mais".

---

## 1. 🔴 A trava do reset — está morta inteira

Confirmado, e pior do que o prompt descreve. Não são duas guardas: as **linhas 83 a 99** são o
bloco todo da `festa`, que hoje não roda nenhuma vez.

```
linha 30: to_regclass('public.rsvps')   -> existe   -> guarda VIVA
linha 46: to_regclass('public.config')  -> NULL     -> guarda MORTA
linha 83: to_regclass('public.festa')   -> NULL     -> guarda MORTA
```

`to_regclass` devolve NULL para nome que não existe mais, e o `if` cai fora sem erro. Sobrou só o
freio de `rsvps` — que hoje está vazia. Ou seja: **um `Run` no editor do Supabase, agora, apagaria
preço, taxa, prazo e o conteúdo do convite sem uma palavra de aviso.**

Correção: `public.config` → `public.settings`, `public.festa` → `public.party`, as colunas citadas
dentro dos dois blocos, e as três mensagens de `ABORTADO`.

**A prova que o Cowork pediu, e que eu faria de qualquer jeito:** rodar o script com `settings` e
`party` populados e `rsvps` vazia, e mostrar que **aborta**. Sem essa prova a correção é
afirmação — e o valor da trava é justamente disparar quando ninguém espera.

## 2. 🔴 O seed do convite

`party` semeia `'Salão 3 …'` e `'Bocão'`. Corrigir para `Salão Grande` e `JH Boca`.

**Não** semeio preço, taxa nem prazo: são operacionais, mudam com o tempo, e é exatamente o que a
trava existe para proteger. O `insert into public.settings (id) values (1)` continua criando a
linha com defaults.

## 3. 🟡 `calculo.js` → `calc.js`

`git mv` nos três arquivos, e as referências: `<script src>` das duas páginas, o `require` do
teste, o `verify.sh` (duas ocorrências: o loop de sintaxe usa glob, mas a linha do `jsc` cita o
caminho), o cabeçalho do próprio teste e o comando documentado no `FLUXO.md`.

Faço `git mv` **antes** de editar o conteúdo, para o histórico seguir o arquivo em vez de virar
delete+add.

## 4. 🟡 Nomes de policy

14 policies com nome em português. `drop policy` + `create policy` num bloco só, no
`supabase-setup.sql`, e aplicado à parte no banco.

Nomes: `admin reads admins`, `admin reads rsvps`, `admin deletes rsvps`, `admin reads people`,
`admin creates people`, `admin edits people`, `admin deletes people`, `admin reads settings`,
`admin edits settings`, `party public read`, `admin edits party`, `photos public read`,
`admin uploads photos`, `admin deletes photos`.

⚠️ Mexe em RLS de produção. A prova é a de sempre neste repo: **o teste negativo do anon**, provado
pelo **estado do banco** e não pelo código HTTP — anon lê `party`, não lê `settings`, não lê
`rsvps`, e escreve só pela RPC.

## 5. 🟡 Comentários que nomeiam coisa extinta

Varredura de `festa`, `pessoas`, `config`, `criar_rsvp`, `status_rsvp`, `normaliza_contato`,
`convidado_por_valido`. Achei **20 ocorrências** em `js/calculo.js`, `supabase-setup.sql`,
`index.html` e `js/main.js`.

⚠️ Cuidado que o prompt não menciona: **"festa" também é palavra portuguesa de texto corrido**
("o dia da festa", "quem vai à festa"). Só troco onde o comentário está nomeando a *tabela* — o
resto é português legítimo e fica.

## 6. 🟢 Bucket `fotos` — fica

Concordo e não renomeio: bucket não tem rename, seria criar outro e mover objeto, com foto real
dentro. Ponho a linha no `config.js` dizendo que o nome é legado e proposital.

## 7. A regra no FLUXO

"Este foi o último recreate barato" — registro no `FLUXO.md`, ao lado da exceção que já anotei lá.

---

## Commits

1. `fix`: a trava do reset (item 1) — sozinha, porque é a correção crítica
2. `fix`: seed do convite (item 2)
3. `refactor`: `calculo.js` → `calc.js` e referências (item 3)
4. `refactor`: nomes de policy (item 4)
5. `chore`: comentários e a nota do bucket (5 e 6), mais a regra no FLUXO (7)

## Verificação

`./verify.sh` verde em cada commit, 63 asserções e o invariante de fuso.

1. **A trava aborta** — com `settings` e `party` populados e `rsvps` vazia, saída crua do erro.
2. **A trava não é falso positivo** — num banco de brinquedo vazio, o script roda até o fim.
3. **RLS depois do rename das policies** — teste negativo do anon, pelo estado do banco.
4. **RSVP ponta a ponta em produção**, para provar tabela e RPC novos de pé; apagar pelo próprio
   identificador depois.
5. **Convite no ar funcionando** — é o desbloqueio do que está quebrado agora.
6. **Zero ocorrências** dos identificadores antigos em `js/`, `*.html`, `*.sql`, `verify.sh`.
7. **Nenhum arquivo de código com nome em pt-BR**, e verify verde depois do `git mv`.
8. **Convite intacto** e **modo escuro idêntico**, as duas asserções de sempre.
9. Tabela de hashes no `status.md`.

---

## Perguntas

**P1 — o `git mv` do `calculo.js` some com o histórico do arquivo mais testado do projeto?**
Não: `git mv` preserva, e `git log --follow` acompanha. Só registro porque é o arquivo com 63
asserções e alguém pode se assustar ao ver o `git log` curto sem o `--follow`. Não bloqueia.

**P2 — o rename de policy roda em produção sem janela?** `drop policy` e `create policy` na mesma
transação não deixam buraco: dentro da transação a tabela nunca fica sem política. Vou aplicar
assim, num bloco só. Se você preferir que eu não toque em RLS enquanto o site está fora do ar,
seguro o item 4 para depois de o Pages destravar — **diga se prefere**, porque a ordem muda.

**P3 — o site fora do ar entra nesta fatia ou é atendimento à parte?** Vou tratar como parte dela:
sem convite no ar, a verificação 5 não fecha e a fatia não pode ser dada como pronta. Se o Pages
não destravar sozinho, investigo o build em vez de esperar.
