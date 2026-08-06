# Regras de Negócio — Site Aniversário

> Especificação para orientar o desenvolvimento (RSVP + estimativa de compra + rateio de custo).
> Versão 6 — inclui o **acerto** (quem deve a quem) sobre o rateio da v5: quem paga são os 3 aniversariantes, e o consumo de cada convidado é bancado por quem o convidou (`convidado_por`).

## 1. Objetivo dos dados

Todo dado coletado existe para alimentar **dois cálculos**:

1. **Estimativa (pré-festa)** — quanto comprar de chopp, refri, água e quantas pizzas (adulto/criança), para passar pro homem do chopp e pro homem da pizza.
2. **Rateio (fechamento)** — quanto cada **aniversariante** deve pagar, com base no **custo real** do que foi comprado. Os convidados **não pagam**: o consumo de cada convidado é bancado pelo(s) aniversariante(s) que o convidou.

---

## 2. Modelo de dados (3 tabelas no Supabase)

> Config de preços e taxas fica em **tabela**, não em `config.js` — assim se corrige o preço do chopp na tela, sem depender de `git push`.

### 2.1 `rsvps` — o grupo (uma linha por convidado que preenche)
- `id`
- `criado_em`
- `nome_principal` — nome de quem preencheu (obrigatório)
- `contato` — WhatsApp/e-mail do principal (obrigatório; é por onde o rateio vira cobrança e a chave de deduplicação)
- `convidado_por` — quais dos 3 aniversariantes convidaram (`smallint[]`, valores em {1,2,3}, **múltipla escolha**, 1 a 3, sem repetir); vale para o grupo inteiro. **É a CHAVE do rateio** (ver §4), não é informativo.
- `observacoes` — texto livre opcional (ex.: alergia, restrição)

### 2.2 `pessoas` — unidade de consumo (FK para `rsvps`)
> O convidado principal também é uma linha aqui. Os 3 aniversariantes também (via admin).
- `id`, `rsvp_id`
- `nome` — opcional para acompanhantes
- `tipo` — **adulto** ou **criança**
- `bebe_agua`, `bebe_refri`, `bebe_chopp` — booleanos (**múltipla**)
- `come_pizza` — booleano
- `papel` — principal | acompanhante | **aniversariante**
- `aniversariante_id` — 1/2/3 **só** para `papel='aniversariante'` (null nos demais); liga a linha pagante ao `convidado_por` e aos nomes do `config.js` (índice+1: Bruno=1, Braz=2, Bocão=3)

### 2.3 `config` — valores únicos (linha única, editável no admin)
**Preços:**
- `preco_litro_chopp`, `preco_litro_refri`, `preco_litro_agua`
- `preco_pizza_adulto`, `preco_pizza_crianca`

**Taxas de consumo estimado (sementes — editáveis na tela):**
- `litros_chopp_por_adulto` = **2,0**
- `litros_refri_por_pessoa` = **0,6**
- `litros_agua_por_pessoa` = **0,5**

**Prazo de confirmação (editável na tela):**
- `prazo_confirmacao` — timestamptz; **NULL = sem limite**. Admin escolhe a data; tratar como fim do dia (23:59:59 -03:00). Depois dele, o formulário público fecha.

**Fechamento (custo real gasto — preenchido depois da compra):**
- `custo_real_chopp`, `custo_real_refri`, `custo_real_agua` (R$ efetivamente gastos)
- preços reais de pizza (confirmam/ajustam os da config)

---

## 3. Regras do formulário público

- Uma pessoa pode marcar **mais de uma bebida** (chopp + refri + água juntos).
- **Chopp fica bloqueado para criança** (regra dura).
- Cada pessoa indica **adulto ou criança** — inclui o convidado principal.
- `convidado_por` é do grupo; **acompanhantes herdam** e não escolhem de novo.
- **Aniversariantes NÃO entram pelo formulário público** — são cadastrados pela área admin (adulto/criança, bebidas, pizza), sem `convidado_por`.
- **Comida = só pizza.** Sobremesa foi removida do formulário.
- Contato do principal é obrigatório; nome do acompanhante é opcional.
- **Teto de 5 acompanhantes** por convidado.
- Botão de enviar desabilita após o clique (evita duplo envio).
- **Prazo de confirmação**: depois de `prazo_confirmacao`, o formulário público fecha (mostra "confirmações encerradas"). A regra também roda no **RPC** (rejeita envio após o prazo). Vale só pro público — o admin continua cadastrando/ajustando normalmente.

---

## 4. Cálculos  (isolar em `js/calc.js` puro — estimativa e rateio compartilham as contagens)

### 4.1 Estimativa (pré-festa) — para comprar
Contagens sobre **todas** as pessoas confirmadas (convidados + acompanhantes + aniversariantes):
```
litros_chopp  = (nº de ADULTOS com chopp)  × litros_chopp_por_adulto
litros_refri  = (nº de PESSOAS com refri)  × litros_refri_por_pessoa
litros_agua   = (nº de PESSOAS com água)   × litros_agua_por_pessoa
pizza_adultos  = nº de adultos que comem pizza
pizza_criancas = nº de crianças que comem pizza
```
Custo estimado (referência antes de comprar): cada volume × seu preço + pizzas × preço por tipo.

### 4.2 Fechamento (custo real) — quem paga são os aniversariantes
**Quem paga:** só os 3 aniversariantes. Os convidados **não pagam nada** — o consumo de
cada convidado é bancado por quem o convidou (`convidado_por`), dividido igualmente quando
há mais de um. Cada aniversariante paga **100% do próprio** consumo.

**Atribuição — por pessoa que consome o item (a "unidade"):**
- Convidado (e acompanhante, que herda o `convidado_por` do grupo): 1 unidade dividida
  entre os aniversariantes do `convidado_por` (ex.: `[1,3]` → 0,5 pra cada um).
- Aniversariante: 1 unidade inteira pra ele mesmo.

**Bebidas (chopp / refri / água)** — custo real do item dividido pelo total de consumidores dele:
```
C_item = custo_real_item / (total de pessoas que consomem o item)   # aniversariantes + convidados
unidades(aniv k, item) = (1 se k consome o item)
                       + Σ convidados que consomem o item: peso 1/|convidado_por| se k ∈ convidado_por
conta_item(aniv k) = C_item × unidades(aniv k, item)
```
**Pizza** — preço por cabeça, atribuído da mesma forma (sem dividir por total):
```
conta_pizza(aniv k) = Σ pessoas que comem pizza atribuídas a k (mesmo peso) × preco_pizza(tipo)
```
Exemplo (chopp): 5 convidados só do Bruno + 1 convidado dividido Bruno/Braz + o próprio Bruno,
todos bebem chopp → unidades do Bruno = 5 + 0,5 + 1 = **6,5**; conta = 6,5 × C_chopp. O Braz leva os 0,5 restantes daquele convidado.

### 4.3 Conta por aniversariante e reconciliação
No fim existem **só 3 contas**: uma por aniversariante.
```
conta(aniv k) = Σ_item conta_item(aniv k) + conta_pizza(aniv k)
```
**Validação (selo "confere"):** a soma das 3 contas deve bater **exatamente** com o custo real total gasto.

**Centavos:** distribuir cada `custo_real_item` entre os 3 aniversariantes proporcional às
`unidades` (que podem ser fracionárias, ex. 6,5), em centavos inteiros, com **maior-resto** —
assim Σ = custo real exato. É o algoritmo que já existe, **generalizado para pesos**
(não mais divisão igual entre consumidores).

**Divisão por zero** (custo real lançado para um item que ninguém consumiu): pular o item;
o selo fica vermelho sozinho (Σ ≠ total gasto), sinalizando o erro de lançamento.

---

---

## Acerto (quem deve a quem)

Depois do rateio (quanto cada aniversariante **deve**) e do fechamento (custo real), registra-se
**quem pagou** cada item (chopp/refri/água/pizza) — um pagador por item, marcado no admin; o
valor é o custo já calculado, não digitado.

- `pagou_k` = soma dos itens que k bancou.
- `saldo_k = deve_k − pagou_k` — positivo = a **pagar**; negativo = a **receber**.
- Como Σ deve = Σ pagou = custo real total, **Σ saldo = 0** e o acerto sempre fecha.
- Gera as **transferências mínimas** entre os 3 (≤ 2): "quem deve a quem".
- Só fecha quando o rateio **confere** (fechamento completo, sem órfão) **e** todo item com
  custo > 0 tem pagador.
- Tudo em centavos; herda a exatidão do rateio.
- Campos: `config.pago_por_chopp/refri/agua/pizza` (`smallint` 1/2/3 ou NULL).

> As duas condições são necessárias. Se o rateio não confere, `Σ deve` e `Σ pagou` divergem, os
> saldos não somam zero e as transferências não quitariam nada — alguém transferiria um valor
> que não resolve.

## 5. Área administrativa
- **Login** protegido (ver segurança).
- **Cadastro dos 3 aniversariantes** como consumidores (com `aniversariante_id` 1/2/3).
- **Config** de preços, taxas e **prazo de confirmação** (editável).
- **Estimativa**: volumes + pizzas + custo aproximado.
- **Fechamento**: lançar custo real → rateio final **por aniversariante** (3 contas), com a validação de que a soma bate.
- **Acerto**: marcar quem pagou cada item → saldos e transferências entre os 3, com resumo para compartilhar.
- **Lista de confirmações** (grupos e pessoas).
- **Gestão de fotos** do carrossel.

---

## 6. Segurança (Supabase) — CRÍTICO
- RLS de leitura/exclusão amarrado aos admins via função **`is_admin()`** (tabela `admins` com os UIDs; ver §8), **nunca** ao papel genérico `authenticated`.
- **Desligar o cadastro público** (sign-up) no Supabase Auth.
- `rsvps` e `pessoas`: o anon **não** tem policy direta — escreve **só** via RPC `criar_rsvp` (`security definer`); `select`/`delete` só admin.
- **Insert atômico**: gravar grupo + pessoas via `criar_rsvp` numa transação — evita RSVP meio-salvo e centraliza a escrita anônima.
- Leitura pública mínima do anon: só o RPC `status_rsvp()` (devolve `{aberto, prazo}`), pro formulário saber se ainda dá pra confirmar.
- Storage (bucket `fotos`): **leitura pública**, **escrita só admin** (mesma regra de UID).
- Chave anon é pública por natureza (ok no repo). Chave `service_role` **nunca** vai pro repositório.

---

## 7. Decisões extras (fechadas — Fatia 6)
- **Editar RSVP**: como o anon não lê, aceitar **reenvio** e deduplicar pelo `contato` (vale o mais recente).
- **Countdown**: gravar a data com offset (`-03:00`) para a contagem não variar com o fuso de quem abre.
- **README**: remover a instrução obsoleta de publicar no Netlify (hoje é GitHub Pages).

---

## 8. Admins (acesso à área administrativa)
- Tabela **`admins`** (uid, nome) + função **`is_admin()`** (SECURITY DEFINER, STABLE); as policies usam `is_admin()`.
- Admin ≠ aniversariante ≠ pagante: são eixos independentes. Adicionar admin = inserir uma linha (contas criadas manualmente no painel, sign-up público desligado).
- Admins atuais: Bruno, Braz, Bocão (os 3 aniversariantes) e **Rosaura** (organizadora, **não** é aniversariante).
- Rosaura é admin **e** convidada normal (RSVP pelo formulário, consumo bancado por quem a convidou). Não tem tratamento especial de pagamento — como todo convidado, ela não paga; quem convidou paga.
