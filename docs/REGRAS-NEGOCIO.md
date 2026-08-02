# Regras de Negócio — Site Aniversário

> Especificação para orientar o desenvolvimento (RSVP + estimativa de compra + rateio de custo).
> Versão 4 — decisões fechadas. Rateio pela lista de confirmados; presença não afeta nada (sem `compareceu`). Serve de handoff para o Claude Code.

## 1. Objetivo dos dados

Todo dado coletado existe para alimentar **dois cálculos**:

1. **Estimativa (pré-festa)** — quanto comprar de chopp, refri, água e quantas pizzas (adulto/criança), para passar pro homem do chopp e pro homem da pizza.
2. **Rateio (fechamento)** — quanto cada convidado deve pagar, com base no **custo real** do que foi comprado, dividido de forma **justa por consumo**.

---

## 2. Modelo de dados (3 tabelas no Supabase)

> Config de preços e taxas fica em **tabela**, não em `config.js` — assim se corrige o preço do chopp na tela, sem depender de `git push`.

### 2.1 `rsvps` — o grupo (uma linha por convidado que preenche)
- `id`
- `criado_em`
- `nome_principal` — nome de quem preencheu (obrigatório)
- `contato` — WhatsApp/e-mail do principal (obrigatório; é por onde o rateio vira cobrança e a chave de deduplicação)
- `convidado_por` — quais dos 3 aniversariantes convidaram (**múltipla escolha**, 1 a 3); vale para o grupo inteiro
- `observacoes` — texto livre opcional (ex.: alergia, restrição)

### 2.2 `pessoas` — unidade de consumo (FK para `rsvps`)
> O convidado principal também é uma linha aqui. Os 3 aniversariantes também (via admin).
- `id`, `rsvp_id`
- `nome` — opcional para acompanhantes
- `tipo` — **adulto** ou **criança**
- `bebe_agua`, `bebe_refri`, `bebe_chopp` — booleanos (**múltipla**)
- `come_pizza` — booleano
- `papel` — principal | acompanhante | **aniversariante**

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

## 4. Cálculos  (isolar em `js/calculo.js` puro — estimativa e rateio compartilham as contagens)

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

### 4.2 Fechamento (custo real) — para cobrar
**População = todos os confirmados no prazo.** Presença/ausência não filtra nada: quem
confirmou paga sua parte, tenha ido ou não (o custo já está comprometido — não há como
devolver barril). Estimativa e fechamento usam exatamente a mesma população; diferem só
em *litros estimados × preço* (estimativa) versus *custo real ÷ consumidores* (fechamento).

Admin lança o custo real de cada bebida. Como a taxa de consumo é uniforme por pessoa,
o custo real de cada bebida é dividido **igualmente entre quem a consumiu**:
```
custo_chopp_por_pessoa = custo_real_chopp / (nº de pessoas que bebem chopp)
custo_refri_por_pessoa = custo_real_refri / (nº de pessoas que bebem refri)
custo_agua_por_pessoa  = custo_real_agua  / (nº de pessoas que bebem água)
```
Pizza é por cabeça (sem sobra): cada pessoa que come pizza paga `preco_pizza_adulto` ou `preco_pizza_crianca`.

> A sobra do barril de chopp fica embutida no custo real e é rateada só entre quem bebe chopp.

### 4.3 Conta por pessoa e por grupo
```
conta_da_pessoa = (chopp? custo_chopp_por_pessoa:0) + (refri? custo_refri_por_pessoa:0)
                + (água?  custo_agua_por_pessoa:0)  + (pizza? preco_pizza_do_tipo:0)
conta_do_grupo  = soma das pessoas do grupo   (o principal paga pelo grupo inteiro)
```
**Aniversariantes pagam a própria parte**, como qualquer pessoa.
Validação: a soma de todas as contas de grupo deve bater com o custo real total gasto.

Divisão por zero (custo real lançado para uma bebida que nenhum confirmado marcou):
pular aquela bebida — não atribuir a ninguém. O selo de validação fica vermelho sozinho
(Σ contas ≠ total gasto), sinalizando o provável erro de digitação. Sem tela de aviso.

---

## 5. Área administrativa
- **Login** protegido (ver segurança).
- **Cadastro dos 3 aniversariantes** como consumidores.
- **Config** de preços, taxas e **prazo de confirmação** (editável).
- **Estimativa**: volumes + pizzas + custo aproximado.
- **Fechamento**: lançar custo real → rateio final por grupo, com a validação de que a soma bate.
- **Lista de confirmações** (grupos e pessoas).
- **Gestão de fotos** do carrossel.

---

## 6. Segurança (Supabase) — CRÍTICO
- RLS de leitura/exclusão amarrado ao **UID do organizador** (`auth.uid() = '<uid-admin>'`), **nunca** ao papel `authenticated`.
- **Desligar o cadastro público** (sign-up) no Supabase Auth.
- `rsvps` e `pessoas`: `insert` liberado para visitante anônimo; `select`/`delete` só admin.
- **Insert atômico**: gravar grupo + pessoas via função Postgres (RPC `security definer`) numa transação — evita RSVP meio-salvo e centraliza o RLS de insert.
- Storage (bucket `fotos`): **leitura pública**, **escrita só admin** (mesma regra de UID).
- Chave anon é pública por natureza (ok no repo). Chave `service_role` **nunca** vai pro repositório.

---

## 7. Decisões extras (fechadas — Fatia 6)
- **Editar RSVP**: como o anon não lê, aceitar **reenvio** e deduplicar pelo `contato` (vale o mais recente).
- **Countdown**: gravar a data com offset (`-03:00`) para a contagem não variar com o fuso de quem abre.
- **README**: remover a instrução obsoleta de publicar no Netlify (hoje é GitHub Pages).
