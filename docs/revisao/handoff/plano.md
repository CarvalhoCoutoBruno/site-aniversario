# Plano — Fatia 2: config de preços, taxas e prazo

Branch: `feat/fatia-2-config-admin`

## Ponto de partida

`admin.html` tem login + confirmações + fotos. A tabela `config` já existe com a linha única,
as sementes (2,0 / 0,6 / 0,5) e as policies `admin le config` / `admin edita config` via
`is_admin()`. Falta só a tela.

## Dois riscos que medi antes de planejar

### 1. O fuso faz a data andar — em 100% dos casos, não em borda

Como o prazo é gravado às `23:59:59-03:00`, em UTC ele **sempre** cai no dia seguinte. Ler de
volta com o caminho ingênuo (`new Date(x).toISOString().slice(0,10)`) erra sempre:

```
armazenado (UTC)          | ingênuo    | com fuso   | anda?
2026-10-21T02:59:59+00:00 | 2026-10-21 | 2026-10-20 | SIM (bug)
2026-07-16T02:59:59+00:00 | 2026-07-16 | 2026-07-15 | SIM (bug)
2026-01-01T02:59:59+00:00 | 2026-01-01 | 2025-12-31 | SIM (bug)  ← muda o ANO
2026-03-01T02:59:59+00:00 | 2026-03-01 | 2026-02-28 | SIM (bug)
```

O sintoma seria cruel: o organizador abre a tela, vê a data um dia à frente, salva sem mexer,
e o prazo **anda um dia a cada visita**.

**Solução:** ler com `Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })` e montar
`AAAA-MM-DD` via `formatToParts` — sem depender do formato de saída do locale nem do fuso do
navegador (o organizador pode estar viajando). Gravar como `${data}T23:59:59-03:00`, literal.

> Uso a zona IANA na leitura e o offset fixo na escrita, que é o que o prompt pede e o que a
> mensagem de erro do `criar_rsvp` já faz (`at time zone 'America/Sao_Paulo'`). Bate enquanto o
> Brasil ficar sem horário de verão; se voltar, os dois lados mudam juntos.

### 2. `paraCentavos` **não** serve para entrada digitada

```
"18,00"     -> 1800     ✓
"1.234,56"  -> 0        ✗  silenciosamente zero
"1234,5"    -> 123450   ✓
"-5"        -> -500     ✗  aceita negativo
"abc"       -> 0        ✗  silenciosamente zero
```

Ele só troca a **primeira** vírgula por ponto — o que basta para valores vindos do banco
(`"18.00"`), que é o único uso hoje. Para entrada de usuário, um preço de R$ 1.234,56 viraria
R$ 0,00 sem avisar.

**Solução:** parser próprio no `admin.js` (`parseNumeroBR`), que remove separador de milhar,
troca a vírgula decimal e **devolve `null` em vez de `0`** quando não é número — para o
chamador distinguir "vazio" de "inválido". **Não** vou mexer no `paraCentavos`: ele está certo
para o que faz, e alterá-lo arrisca o cálculo, que tem 41 asserções em cima.

A paridade que o prompt pede se mantém no banco: gravo `1234.56`, o `calculo.js` lê `"1234.56"`
e converte igual.

## Implementação

### `admin.html`
Seção nova, antes das confirmações (ordem da ET §7.2: config vem primeiro), dentro de um
`<details>` **fechado por padrão** — config é set-once, consultada raramente, e aberta por
padrão empurraria as confirmações para baixo da dobra.

Campos: 5 preços (`text`, aceita vírgula), 3 taxas (`text`), 1 `<input type="date">` para o
prazo, botão salvar e um `.msg-toast` de feedback.

### `js/admin.js`
- `carregarConfig()` — `select` na `config` id=1, popula o form; prazo pelo conversor de fuso.
- `salvarConfig()` — valida, monta o objeto e dá `update`.
- `parseNumeroBR(txt)` → número ou `null`.
- `fmtNumeroBR(n, casas)` → exibição com vírgula.
- `dataDoPrazo(iso)` / `prazoDaData(data)` → a ida e a volta do fuso.
- Chamar `carregarConfig()` no `mostrarPainel()` e no botão "↻ Atualizar".

**O `update` envia só os 9 campos em escopo + `atualizado_em`.** Nunca um objeto amplo: assim
um bug aqui não tem como zerar `custo_real_*` nem `preco_real_pizza_*`, que são da Fatia 5.

### Validação no cliente
- número inválido → mensagem apontando o campo;
- negativo → recusado (o `numeric` do banco aceitaria, então a trava é só aqui);
- estouro de faixa: preço > 99.999.999,99 (`numeric(10,2)`) e taxa > 999,999 (`numeric(6,3)`) —
  senão o overflow volta como erro cru de tipo;
- prazo vazio → `NULL` (sem limite), que é o comportamento documentado.

Zero é aceito em taxa e preço (config recém-criada tem preço 0), mas aviso na tela que taxa
zerada faz a estimativa daquele item dar zero.

### `css/style.css`
Grade dos campos e estilo do `<details>`. Nada estrutural.

## Fora de escopo (não encosto)
`custo_real_*` e `preco_real_pizza_*` (Fatia 5), estimativa (4), cadastro de aniversariantes
(3), listagem de confirmações (já existe).

> Nota: `admin.html` **não** carrega `js/calculo.js`. Não faz falta nesta fatia (não há cálculo
> na tela de config), mas a Fatia 4 vai precisar. Posso incluir a tag agora, se o review achar
> melhor — é uma linha e evita esquecer depois.

## Verify

`./verify.sh` verde (o cálculo não muda; espero 41/41 sem alteração).

Integrada, com saída crua no `status.md`:

1. logar como admin → config carrega mostrando as sementes 2,0 / 0,6 / 0,5;
2. editar um preço (com vírgula), uma taxa e definir um prazo → salvar → `SELECT` cru provando
   os valores e o prazo gravado como `23:59:59-03:00` **da data escolhida**;
3. **recarregar a tela** e conferir que a data volta igual — é o teste que pega o bug de fuso,
   que só aparece na ida e volta;
4. ponta a ponta: com o prazo definido, o formulário público mostra "Confirme até DD/MM"; com
   data passada, fecha;
5. limpar o prazo → `NULL` → formulário público sem aviso de prazo;
6. **negativo:** anon tenta `select` e `update` em `config` → bloqueado pela RLS, saída crua;
7. **defensivo:** setar `custo_real_*` na mão, salvar a config pela tela, e provar por `SELECT`
   que continuam intactos;
8. `"1.234,56"` grava `1234.56` (o caso que o `paraCentavos` erraria);
9. valor negativo recusado no cliente, sem chegar ao banco;
10. restaurar as sementes e zerar o prazo ao fim.

## Para o review

1. **`<details>` fechado por padrão** para a config, ou seção sempre aberta?
2. **Incluir `calculo.js` no `admin.html` agora** ou deixar para a Fatia 4?
3. **`atualizado_em`** vai pelo cliente (`new Date().toISOString()`). Funciona e atende o
   prompt, mas depende do relógio do navegador. A alternativa robusta é um trigger
   `before update` no Postgres — mexe no schema, que hoje está estável e verificado. Minha
   recomendação: **cliente agora**, trigger se algum dia o campo virar dado de auditoria.

Parado, sem implementar, aguardando `review.md`.
