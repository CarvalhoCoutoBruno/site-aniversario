# Especificação Técnica — Site Aniversário

> Guia de implementação derivado de [REGRAS-NEGOCIO.md](REGRAS-NEGOCIO.md) (v4).
> Escopo: schema do Supabase, contrato dos RPCs, RLS, módulo de cálculo e contratos de UI.
> Versão 3 — 2026-08-02. Rateio pela lista de confirmados; presença não entra na conta.

## 1. Princípios

1. **Sem build.** HTML/CSS/JS puro servido pelo GitHub Pages. Nada de bundler, transpiler ou `node_modules`. Todo JS novo é carregado por `<script>` na ordem certa — e isso vale também para os testes.
2. **O banco é a última linha de defesa.** Toda regra dura da spec (chopp × criança, teto de acompanhantes, `convidado_por` válido, prazo de confirmação) é validada **no Postgres**, não só na tela. A UI valida para dar boa mensagem de erro; o banco valida para garantir.
3. **O anon não lê nada.** O visitante anônimo não tem `select` em tabela nenhuma. Ele só enxerga o que dois RPCs `security definer` devolvem de propósito.
4. **Dinheiro em centavos.** Todo cálculo de rateio roda em inteiros de centavos para as contas fecharem exatamente. Ver §6.3.
5. **Cálculo separado da tela.** `js/calculo.js` é puro: recebe dados, devolve números, não toca no DOM, não fala com o Supabase e não lê `window.CONFIG`. É o que permite testá-lo antes de o banco existir.

---

## 2. Estrutura de arquivos

```
site-aniversario/
├── index.html              → convite (carrossel + countdown + RSVP)
├── admin.html              → painel do organizador
├── css/style.css
├── js/
│   ├── config.js           → dados da festa + chaves Supabase (SEM preços)
│   ├── calculo.js          → funções puras: contagens, estimativa, rateio
│   ├── main.js             → lógica do convite
│   └── admin.js            → lógica do painel
├── tests/
│   ├── calculo.test.js     → teste do arredondamento (sem framework)
│   └── calculo.test.html   → o mesmo teste, rodando no navegador
├── supabase-setup.sql      → schema + RLS + RPCs (rodar 1x)
├── docs/
│   ├── REGRAS-NEGOCIO.md   → o "o quê" (negócio)
│   └── ESPECIFICACAO-TECNICA.md → este arquivo, o "como"
├── README.md
└── HANDOFF.md
```

**Ordem de carregamento** em `admin.html`: `config.js` → `calculo.js` → `admin.js`.
Em `index.html`, `calculo.js` não é necessário (o convidado não vê preço).

### 2.1 O que fica no `config.js`

Só o que não muda no dia a dia: dados da festa, os 3 nomes e as chaves do Supabase.
Preços, taxas de consumo e prazo de confirmação vivem na tabela `config` — corrigir o preço do chopp não pode depender de `git push`.

**A ordem de `aniversariantes` é o identificador.** O banco grava `convidado_por` como `smallint[]` com valores 1, 2 e 3 apontando para as posições da lista (Bruno=1, Braz=2, Bocão=3). Renomear é seguro; **reordenar ou remover depois que houver confirmação salva troca o dono dos registros**. Está comentado no próprio arquivo.

`bebidas` e `comidas` ainda estão lá marcados como temporários: o formulário atual monta os chips a partir deles. Saem na Fatia 1, quando viram colunas booleanas.

`subtitulo` foi removido — do config, do `index.html` e do `main.js`.

---

## 3. Modelo de dados

Três tabelas. Decisão estrutural principal: **`pessoas` é a única unidade de consumo do sistema**. Convidado principal, acompanhante e aniversariante são todos linhas de `pessoas`; o que os distingue é a coluna `papel`.

### 3.1 `rsvps` — o grupo

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `criado_em` | `timestamptz` | `now()` |
| `nome_principal` | `text` NOT NULL | 1–120 chars após trim |
| `contato` | `text` NOT NULL | 3–160 chars; é a chave de cobrança |
| `contato_norm` | `text` GENERATED | normalizado, base do dedupe (§3.5) |
| `convidado_por` | `smallint[]` NOT NULL | 1 a 3 itens, todos em {1,2,3}, sem repetir |
| `observacoes` | `text` NULL | até 500 chars |

Uma linha = um envio do formulário público. **Aniversariantes não geram linha aqui.**

`convidado_por` guarda **id, não nome**. Nome livre em três lugares (config, banco, tela) quebra estatística e impede renomear. É campo informativo — não entra no rateio.

A validação (1–3 itens, dentro de {1,2,3}, sem repetição) vive na função `convidado_por_valido(smallint[])`, chamada pelo `CHECK`. Precisa ser função porque `CHECK` não aceita subconsulta, e testar duplicidade exige `count(distinct)`.

### 3.2 `pessoas` — unidade de consumo

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | `uuid` PK | |
| `rsvp_id` | `uuid` FK → `rsvps` | `ON DELETE CASCADE`; **NULL para aniversariante** |
| `nome` | `text` NULL | obrigatório só para `papel='principal'` |
| `tipo` | `text` NOT NULL | `adulto` \| `crianca` |
| `bebe_agua` | `boolean` | default `false` |
| `bebe_refri` | `boolean` | default `false` |
| `bebe_chopp` | `boolean` | default `false` |
| `come_pizza` | `boolean` | default `false` |
| `papel` | `text` NOT NULL | `principal` \| `acompanhante` \| `aniversariante` |
| `ordem` | `smallint` | posição no grupo, para exibir na ordem digitada |

**Constraints (as regras duras):**

- `chopp_nao_para_crianca` — `NOT (bebe_chopp AND tipo = 'crianca')`.
- `aniversariante_sem_grupo` — `papel='aniversariante'` ⟺ `rsvp_id IS NULL`. Efeito colateral desejado: **é impossível o formulário público cadastrar um aniversariante**, porque todo insert do RPC vem com `rsvp_id` preenchido. A regra da spec §3 sai de graça do schema.
- `principal_tem_nome` — nome obrigatório quando `papel='principal'`; acompanhante pode ficar sem.
- Índice único parcial: **no máximo um `principal` por grupo**.

> **Por que `rsvp_id` NULL em vez de um grupo fake para os aniversariantes:** manter `rsvps` = "envios do formulário" deixa a lista de confirmações, a contagem de grupos e o dedupe por contato honestos. Aniversariante não tem contato de cobrança nem `convidado_por`, então forçá-lo num grupo exigiria afrouxar dois NOT NULL. No rateio, cada aniversariante é tratado como um grupo de uma pessoa (§6.2).

### 3.3 `config` — linha única

Preços e taxas (`numeric(10,2)` para dinheiro, `numeric(6,3)` para litros), prazo de confirmação e os campos de fechamento. Travada em uma linha só por `CHECK (id = 1)`.

Sementes: `litros_chopp_por_adulto = 2.0`, `litros_refri_por_pessoa = 0.6`, `litros_agua_por_pessoa = 0.5`. Preços nascem em `0` e são preenchidos na tela.

`prazo_confirmacao timestamptz` — **NULL = sem limite**. O painel oferece um seletor de data e grava como fim do dia: `AAAA-MM-DD 23:59:59-03:00`.

Campos de fechamento (`custo_real_*`) nascem **NULL** de propósito: `NULL` significa "ainda não fechei", `0` significaria "não gastei nada". O painel usa essa diferença para decidir se mostra o rateio e se acende o selo.

### 3.4 Diagrama

```
rsvps (1) ──< (N) pessoas
                   │
                   └── papel='aniversariante' → rsvp_id NULL (sem grupo)

config (linha única, sem relação)
```

### 3.5 Normalização do contato (dedupe)

Função `normaliza_contato(text)` IMMUTABLE, usada em coluna gerada:

- Contém `@` → e-mail: `lower(btrim(...))`.
- Senão → telefone: remove tudo que não é dígito. `(51) 99999-9999` e `51999999999` viram a mesma chave.

O dedupe roda **dentro do RPC**: antes de inserir, apaga o grupo anterior de mesmo `contato_norm`. Como `pessoas` tem `ON DELETE CASCADE`, o grupo antigo some inteiro. Reenvio vale o mais recente.

> **Efeito a documentar para o usuário final:** o reenvio **substitui**, não soma. Quem confirmar 2 pessoas e depois reenviar com 1 fica com 1. A tela precisa avisar isso no formulário.

### 3.6 Presença não é modelada — de propósito

**A população do sistema é a lista de confirmados no prazo, e só.** Quem confirmou paga a parte dele, tendo ido à festa ou não: o custo já está comprometido no momento da compra e não se devolve barril.

Não existe coluna `compareceu`, nem lista de presença, nem filtro por comparecimento em lugar nenhum. Estimativa e fechamento leem exatamente a mesma população — a diferença entre eles é só a fórmula (litros estimados × preço *versus* custo real ÷ consumidores).

Se o organizador quiser mesmo tirar alguém da conta, o `delete` do painel resolve. É decisão manual e explícita, não regra do sistema.

---

## 4. RPCs

### 4.1 `criar_rsvp` — insert atômico

```
criar_rsvp(
  p_nome_principal text,
  p_contato        text,
  p_convidado_por  smallint[],
  p_observacoes    text,
  p_pessoas        jsonb   -- array de {nome, tipo, bebe_*, come_pizza, papel}
) RETURNS uuid
```

`LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = public, pg_temp`.

**Validações dentro da função** (todas levantam exceção, abortando a transação inteira):

| Regra | Limite |
|---|---|
| **Prazo de confirmação** | rejeita se `now() > prazo_confirmacao` |
| `nome_principal` não vazio | — |
| `contato` não vazio | — |
| `convidado_por` | 1 a 3 itens, em {1,2,3}, sem repetir |
| `p_pessoas` é array | — |
| Tamanho do grupo | 1 a **6** (1 principal + teto de 5 acompanhantes) |
| Exatamente 1 `papel='principal'` | — |

Chopp × criança e "aniversariante não vem do form" ficam por conta das constraints da tabela — não duplico a regra na função, para não ter dois lugares para corrigir.

O prazo é checado **primeiro**, antes de qualquer validação de conteúdo: depois do prazo a mensagem certa é "encerrado", não "faltou o nome".

**Por que `SECURITY DEFINER` dispensa política de insert para `anon`:** a função roda com o privilégio do dono e a RLS das tabelas não se aplica a ele (não usamos `FORCE ROW LEVEL SECURITY`). Isso é mais restritivo que a spec §6 pedia: em vez de liberar `insert` direto para `anon`, o anônimo **não tem nenhuma política** — o único caminho de escrita é o RPC, que valida tudo. Um atacante não consegue inserir uma pessoa solta, um grupo sem principal, nem um "aniversariante" forjado.

`REVOKE ALL ... FROM public` seguido de `GRANT EXECUTE ... TO anon, authenticated` fecha o resto.

**Retorno:** o `uuid` do grupo. Não vaza dado (o anon já sabe o que enviou) e serve de confirmação.

### 4.2 `status_rsvp` — o formulário precisa saber se está aberto

```
status_rsvp() RETURNS TABLE (aberto boolean, prazo timestamptz)
```

Sem isso o requisito de fechar o formulário seria **impossível de cumprir**: a regra "o público vê 'confirmações encerradas'" exige ler `prazo_confirmacao`, mas `config` também guarda preço e custo real, que o convidado não pode ver. Liberar `select` na tabela vazaria o orçamento da festa.

A função `security definer` devolve só dois campos — se está aberto e qual a data — e é a única leitura que o anon tem no sistema inteiro.

---

## 5. Segurança e RLS

### 5.1 Ordem de execução — importa

O SQL referencia o UID do organizador, que só existe depois do usuário criado. A sequência correta:

1. Criar o projeto no Supabase (região São Paulo).
2. **Authentication → Users → Add user** (marcar *Auto Confirm*).
3. Copiar o **UID** do usuário criado.
4. Substituir `<UID_DO_ADMIN>` no `supabase-setup.sql` — **13 ocorrências**, substituição global.
5. **SQL Editor → Run.**
6. **Authentication → Sign In / Providers → Email → desligar "Allow new users to sign up".**
7. Copiar Project URL + chave anon para o `config.js`.

> Rodar o SQL antes do passo 2 deixa o painel inacessível — nenhum UID casa com a política.

### 5.2 Matriz de acesso

| Recurso | `anon` | admin (UID) |
|---|---|---|
| `rsvps` select | ❌ | ✅ |
| `rsvps` insert | ❌ direto — só via RPC | ✅ via RPC |
| `rsvps` delete | ❌ | ✅ |
| `pessoas` select | ❌ | ✅ |
| `pessoas` insert | ❌ direto — só via RPC | ✅ (cadastro de aniversariante) |
| `pessoas` update/delete | ❌ | ✅ |
| `config` select/update | ❌ | ✅ |
| `criar_rsvp()` execute | ✅ | ✅ |
| `status_rsvp()` execute | ✅ | ✅ |
| Storage `fotos` leitura | ✅ (bucket público) | ✅ |
| Storage `fotos` escrita/delete | ❌ | ✅ |

Toda política de admin usa `auth.uid() = '<UID_DO_ADMIN>'::uuid`. **Nenhuma** usa o papel genérico `authenticated`.

### 5.3 Riscos residuais aceitos

- **Spam de RSVP.** O anon pode chamar `criar_rsvp` em loop. Mitigado por: teto de 6 pessoas por grupo, dedupe por contato (um contato = uma linha), prazo de confirmação e o fato de o painel permitir apagar. Não vale rate limit para uma festa.
- **Dedupe por contato é sequestrável.** Quem souber o contato de outro convidado pode sobrescrever o RSVP dele. É o preço de aceitar reenvio sem login, decisão fechada na spec §7. Vale conferir a lista antes da festa.
- **`status_rsvp` expõe a data limite.** É informação que o convidado vai ver na tela de qualquer forma.
- **Chave anon é pública.** Por design; a segurança está na RLS. A `service_role` nunca entra no repo.

---

## 6. Módulo de cálculo (`js/calculo.js`)

Funções puras. Entrada: array plano de pessoas + objeto de config (no formato da tabela, em reais). Saída: números, sempre em **centavos**.

Exporta para os dois mundos: `module.exports` quando há CommonJS, `globalThis.Calculo` no navegador.

### 6.1 Contagens e estimativa

```js
contagens(pessoas) → {
  totalPessoas, adultos, criancas,
  chopp,   // adultos com bebe_chopp
  refri, agua,
  pizzaAdultos, pizzaCriancas
}

estimativa(pessoas, config) → {
  contagens,
  litrosChopp, litrosRefri, litrosAgua,
  pizzaAdultos, pizzaCriancas,
  custoEstimado   // centavos
}
```

`chopp` conta **apenas adultos** — a função ignora `bebe_chopp` em criança mesmo que o dado venha sujo, espelhando a constraint do banco.

Nenhuma das duas filtra por presença: recebem a lista de confirmados inteira (§3.6).

### 6.2 Rateio

```js
rateio(pessoas, config, grupos) → {
  porPessoa: Map<pessoaId, centavos>,
  porGrupo: [{ chave, rsvpId, ehAniversariante, nomePrincipal,
               contato, pessoas[], total }],
  totalRateado, custoRealTotal,
  fechamentoCompleto, confere
}
```

Aniversariantes (`rsvp_id === null`) entram como **grupo de uma pessoa só**. Pagam a própria parte.

**Preço de pizza:** usa `preco_real_pizza_*` quando preenchido, cai em `preco_pizza_*` quando NULL.

**Bebida sem consumidor:** se lançarem custo real de uma bebida que nenhum confirmado marcou, a bebida é **pulada** — nada de dividir por zero. O custo continua somando em `custoRealTotal`, então `totalRateado ≠ custoRealTotal` e o selo cai sozinho. É o sinal de erro de digitação, sem precisar de aviso próprio na tela.

`ratearCentavos(total, [])` devolve Map vazio, então o caso é absorvido na primitiva — sem ramo especial no `rateio`.

**`confere`** é `true` quando:
1. `fechamentoCompleto` — os três `custo_real_*` preenchidos (`NULL` ≠ `0`); e
2. `totalRateado === custoRealTotal`.

### 6.3 Arredondamento — o ponto crítico

`custo_real_chopp / nº de pessoas que bebem chopp` quase nunca dá um valor exato em centavos. Se cada pessoa receber o valor arredondado, **a soma não bate com o gasto real** e o selo `confere` seria mentira.

Algoritmo (maior resto), por bebida:

```
base  = floor(custoCentavos / n)
resto = custoCentavos - base * n        // 0 <= resto < n
→ as `resto` primeiras pessoas (ordenadas por id) pagam base + 1
→ as demais pagam base
```

Garante `Σ contas = custo real`, exatamente. A ordenação por `id` torna o resultado **determinístico**: recarregar a tela não muda quem pagou o centavo a mais.

Pizza não precisa disso — é preço por cabeça, sem divisão.

Formatação em reais só na borda da UI (`formatarBRL`, via `Intl.NumberFormat`). Nada de `toFixed` no meio do cálculo.

### 6.4 Teste

`tests/calculo.test.js` — sem framework e sem dependência, coerente com o projeto não ter build. Roda em três lugares:

```bash
node tests/calculo.test.js
```
```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc js/calculo.js tests/calculo.test.js
```

…ou abrindo `tests/calculo.test.html` no navegador (selo verde/vermelho na tela).

O `jsc` já vem no macOS — útil porque esta máquina não tem Node.

**O que ele prova:** 20.000 divisões aleatórias e 3.000 cenários completos (número de pessoas, mistura adulto/criança, quem bebe o quê, custos quebrados de propósito) em que a soma das contas tem de bater no centavo com o custo real. Mais os casos de regra: criança fora do chopp, todo confirmado dentro do rateio, aniversariante como grupo próprio, bebida sem consumidor sendo pulada sem `NaN`, selo caindo sozinho, fechamento incompleto, e estimativa e rateio contando a mesma população.

Nos cenários aleatórios, só é lançado custo de bebida que tem consumidor — o caso sem consumidor é testado à parte. Misturar os dois mascararia uma falha real de arredondamento atrás de uma diferença esperada.

**Estado atual: 27 asserções, 27 passando.** Verificado também por mutação — trocando o maior resto por `Math.round`, 2.578 dos 3.000 cenários quebram, o que confirma que o teste não é decorativo.

---

## 7. Contratos de UI

### 7.1 Formulário público (`index.html`)

Antes de montar o formulário: chamar `status_rsvp()`. Se `aberto === false`, esconder o formulário e mostrar "confirmações encerradas" com a data. Erro de rede na chamada → deixa o formulário aberto (o RPC rejeita de qualquer jeito; melhor errar para o lado de deixar tentar).

Por pessoa (card): **tipo** (adulto/criança, obrigatório) · **água** · **refri** · **chopp** · **pizza**.

- Marcar "criança" **desmarca e desabilita** o chopp na hora, com aviso visível. Marcar "adulto" reabilita.
- Botão "+ Adicionar acompanhante" **some ao chegar em 5** acompanhantes.
- Nome do acompanhante vazio é aceito e exibido como "Acompanhante 2" — e **precisa entrar no cálculo**. Hoje [main.js](../js/main.js) descarta pessoa sem nome com `.filter(p => p.nome)`; isso vira bug de rateio no modelo novo e sai nesta fatia.
- Contato passa a ser obrigatório.
- Os chips de aniversariante enviam **índice + 1**, não o nome.
- O botão de enviar desabilita no clique e **não reabilita** em caso de sucesso.
- Aviso de que reenviar com o mesmo contato substitui a confirmação anterior.

Envio: uma chamada `sb.rpc('criar_rsvp', {...})`. Não há mais `insert` direto. As mensagens de erro do RPC são escritas para o convidado ler — dá para exibi-las direto.

### 7.2 Painel (`admin.html`)

Seções, na ordem de dependência:

1. **Config** — preços, taxas e **prazo de confirmação**, com salvar.
2. **Aniversariantes** — cadastro dos 3 como consumidores (tipo, bebidas, pizza).
3. **Estimativa** — litros e pizzas para passar ao fornecedor + custo aproximado.
4. **Fechamento** — lançar `custo_real_*` → rateio por grupo, com selo da validação `confere`. Sem tela de presença e sem aviso extra: selo vermelho já significa "os números não fecham, confira o que foi lançado".
5. **Confirmações** — lista de grupos e pessoas.
6. **Fotos** — já existe, sem mudança.

O painel carrega `rsvps` e `pessoas` numa consulta com join e monta a lista plana que `calculo.js` consome.

---

## 8. Fatiamento e dependências

| Fatia | Entrega | Depende de |
|---|---|---|
| **0** | `config.js` com dados reais ✅ · `supabase-setup.sql` completo ✅ · `calculo.js` + teste ✅ · projeto criado e SQL rodado ⏳ | você (criar projeto/usuário, passar UID e chaves) |
| **1** | Formulário público no modelo novo (tipo, chopp bloqueado, pizza, contato obrigatório, teto 5, `convidado_por` numérico, RPC, tela de encerrado) | 0 |
| **2** | Tela de config: preços, taxas e prazo | 0 |
| **3** | Cadastro dos aniversariantes | 0 |
| **4** | Estimativa | 1, 2, 3 |
| **5** | Fechamento e rateio | 4 |
| **6** | Countdown (`-03:00` ✅, "É hoje!") · README · HANDOFF · link `wa.me` do rateio | 1, 5 |

A Fatia 3 vem antes da 4 de propósito: aniversariante entra no volume, então uma estimativa entregue sem eles nasce errada.

O dedupe já está no schema, então a Fatia 6 não precisa mexer em banco.

---

## 9. Pontos resolvidos e o que sobra

Fechados nesta versão:

1. **Pizza no fechamento** — preço real quando preenchido, estimado quando NULL. Implementado em `precoPizza`.
2. **Selo `confere`** — verde só com os três `custo_real_*` de bebida preenchidos e a soma batendo.
3. **Refri/água em pacote** — sem ação: custo real total ÷ consumidores já cobre pacote.
4. **Presença** — não modelada. A lista de confirmados é a população, indo ou não (§3.6). Sem coluna, sem filtro, sem tela.
5. **Divisão por zero** — bebida sem consumidor é pulada; o selo acusa sozinho.

Ainda em aberto:

- **Link `wa.me` do rateio** (Fatia 6). Como já temos o contato normalizado em dígitos, dá para montar `https://wa.me/55<contato_norm>?text=<resumo>`. Falta decidir o texto da mensagem — e vale lembrar que o link **abre** o WhatsApp com o texto pronto; quem aperta enviar é você.
- **Countdown no passado** — "É hoje!" no dia e esconder depois. Cosmético.
- **Reordenar `aniversariantes` no config** é destrutivo depois que houver dado. Hoje isso é só um comentário no arquivo. Se quiser trava de verdade, dá para gravar os nomes numa tabela e referenciar por FK — mais robusto, mais peça móvel. Não recomendo para 3 nomes.

---

## Onde me afastei da spec (de propósito)

1. **§6 pede "`insert` liberado para visitante anônimo" nas duas tabelas.** Não liberei. Com o RPC `security definer`, o anon não precisa de política nenhuma — e sem política ele não consegue inserir uma pessoa avulsa nem um grupo malformado por fora da função.
2. **§2.2 diz que `pessoas` tem FK para `rsvps`, e que os aniversariantes também são linhas ali.** As duas coisas juntas exigiriam um grupo fake. Deixei `rsvp_id` nulável com uma constraint que amarra `NULL` ⟺ `aniversariante` (§3.2).
3. **A spec trata o prazo como regra de tela + RPC.** Precisei de um terceiro elemento não previsto: `status_rsvp()`, porque o anon não pode ler `config` (§4.2). Sem ele, "o formulário fecha" não teria como funcionar.
