# Fatia 8 — Convite editável pelo admin

## Objetivo
Tirar os dados de exibição do convite do `config.js` e deixá-los editáveis pelo admin: título,
subtítulo, data/hora, local, link do mapa e os nomes dos 3 aniversariantes. Hoje mudar qualquer um
exige editar o arquivo e dar push; a meta é o organizador editar pela tela. (É também o 1º passo
concreto rumo a produtizar isto.)

## O problema central (por que não é só "jogar na `config`")
O site **público** precisa ler esses dados, mas o anon **não pode ler a tabela `config`** (tem
preço lá). Solução: um lugar **público por design** só pros dados de exibição do convite — uma
tabela `festa` que o **anon lê** e **só admin grava**. Dado sensível (preços, custo real) fica na
`config`, que segue fechada.

## Fontes da verdade
- `js/config.js` — o que existe hoje (`festa.*` e `aniversariantes[]`) e vai migrar pra DB.
- `supabase-setup.sql` — onde entra a tabela `festa` + RLS, e a trava do reset (Fatia 6).
- `js/main.js` / `js/admin.js` — quem lê `C.festa.*` e `C.aniversariantes` hoje.

## Escopo (o que entra)
1. **Tabela `festa`** (linha única, id=1): `titulo`, `subtitulo` (nullable), `data` (a ISO com
   -03:00, base do countdown), `data_texto` (nullable — vazio = gerado da data), `local`,
   `local_mapa`, e os **3 nomes** (`nome_aniv_1/2/3` — a posição é o id, igual ao `config.js` fazia).
   RLS: **anon SELECT liberado** (dado público do convite); **UPDATE só admin** (`is_admin()`).
2. **Seed** em `supabase-setup.sql` com os valores atuais (migrar o que está hoje no `config.js`:
   "Festa dos 160 anos", a data, o "Salão 3…", o link do Maps, Bruno/Braz/Bocão).
3. **`config.js` enxuga:** fica só o bloco `supabase` (url/anonKey/bucket). `festa` e
   `aniversariantes` saem de lá.
4. **Frontend (`index.html`/`main.js`) passa a ler da `festa`** (SELECT público), não do
   `config.js`: título, subtítulo, countdown (da `data`, com -03:00 e os 3 estados da Fatia 7),
   local + link do mapa, e os nomes no hero **e nos chips de `convidado_por`** (o value segue sendo
   o id 1/2/3; o rótulo vem da `festa`).
5. **Admin — seção "Convite"** (atrás do login): campos pra todos os itens acima, com validação
   (data/hora → grava `data` com -03:00, mesma disciplina do prazo; `local_mapa` é URL). **Update
   estreito** só da `festa`. `data_texto` gerado da data se ficar em branco (override opcional).
6. **Trava do reset:** a `festa` agora guarda dado real do organizador — estender a trava (Fatia 6)
   pra proteger também a `festa`, como já faz com a `config`.

## Ponto delicado (sinalizado)
Os **nomes dos aniversariantes** eram a fonte única do id (1/2/3) no `config.js`, lida de forma
**síncrona** em vários pontos. Movendo pra DB, o hero e principalmente os **chips de
`convidado_por` do formulário público** passam a depender do load assíncrono da `festa`. A posição
segue sendo o id (renomear é seguro; **reordenar não**). Cuidar do load: estado de carregando /
fallback se a `festa` não vier, senão o formulário não mostra quem convidou.

## Fora de escopo (não tocar)
Preços/taxas/prazo/`custo_real`/`pago_por` (seguem na `config`), rateio/acerto/estimativa, e a visão
maior de produtização (multi-tenant, por-cliente, cobrança) — conversa à parte.

## Verify (portão desta fatia)
- `./verify.sh` verde.
- **Integrada, com saída crua no `status.md`:**
  - editar **cada campo** do convite no admin → salvar → recarregar o **site público** e provar
    que mudou (título, subtítulo, countdown/data, local + link do mapa, os 3 nomes no hero e nos chips);
  - **countdown** segue com o -03:00 e os 3 estados (futuro / é-hoje / passou) lendo a `data` nova;
  - **renomear um aniversariante** não quebra confirmações existentes (o id não muda) — provar;
  - **anon LÊ a `festa`** (SELECT público) mas **não lê a `config`** (preços) — pelo estado/retorno do banco;
  - **anon não grava a `festa`** (só admin) — provar pelo **estado do banco** (o 204);
  - **trava do reset** protege a `festa` com dado real;
  - restaurar / re-seed ao fim.

## Observações
- Um só source of truth pro convite (a `festa`), sem meio-termo com o `config.js`.
- Data: gravar sempre -03:00; o countdown e o "É hoje!" da Fatia 7 continuam válidos.
- Isto deixa o convite editável, mas **não** é multi-tenant — cada deploy ainda é uma festa. A
  produtização de verdade é um passo maior, que a gente desenha depois.
