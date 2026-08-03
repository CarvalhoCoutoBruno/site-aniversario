# Plano — Fatia 7: polimento (fechar o projeto)

Branch: `chore/fatia-7-polimento`

## O countdown: o estado não pode sair do sinal do `diff`

Hoje o `tick()` faz `Math.max(0, diff)` — depois da festa mostra 0/0/0/0 para sempre.

A armadilha não é essa, é a correção óbvia. Trocar por "se `diff <= 0` então passou" **quebra
durante a festa**: a festa é às 11h de 31/10, então das 11h às 23h59 daquele dia o `diff` já é
negativo. O site diria "a festa já aconteceu" com a festa rolando — 13 horas antes da hora.

O estado tem de sair da **comparação de datas em São Paulo**. Validei em três fusos:

```
fuso do runtime: America/Sao_Paulo        (idem Asia/Tokyo e Pacific/Kiritimati)
  vespera 23:59 SP         -> contagem  OK  | diff: futuro
  virada do dia SP         -> e-hoje    OK  | diff: futuro
  1 min antes da festa     -> e-hoje    OK  | diff: futuro
  hora da festa            -> e-hoje    OK  | diff: negativo   ← aqui o ingênuo erraria
  fim do dia da festa      -> e-hoje    OK  | diff: negativo   ← e aqui
  dia seguinte SP          -> passou    OK  | diff: negativo
  erros: 0
```

Mesma disciplina do prazo na Fatia 2: `Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"`
e comparação de `AAAA-MM-DD` como string. Independente do fuso do navegador — o convidado pode
estar viajando.

> **Duplicação consciente:** o `dataDoPrazo` do `admin.js` faz o mesmo cálculo. São dois IIFEs
> sem módulo compartilhado, e o `calculo.js` é puro e não deveria conhecer fuso de apresentação.
> Mesmo raciocínio que o review aceitou para a regra do chopp. ~8 linhas.

## Compartilhar o acerto

Helper **puro** em `calculo.js` (`resumoAcerto`), não string montada na tela — assim entra no
`verify.sh` e ganha teste, como o prompt sugere.

- devolve `""` quando o acerto não está `completo` (o botão some);
- lista as transferências em linhas ("Braz → Bruno: R$ 50,00");
- caso especial: acerto completo **sem** transferências (cada um pagou exatamente a própria
  parte) — texto próprio, não uma lista vazia.

Na tela: um botão que **copia** e outro que abre o WhatsApp com `https://wa.me/?text=…` (sem
número, como o prompt pede). A `navigator.clipboard` exige contexto seguro e pode ser negada —
se falhar, mostro o texto num `<textarea>` selecionado para o organizador copiar na mão, em vez
de um erro sem saída.

## Docs — verificar antes de escrever

O princípio do fluxo é "doc corrigida quando diverge da realidade, nada de número inventado".
Então conferi o que vou afirmar, em vez de escrever de memória:

| Afirmação | Conferido |
|---|---|
| README manda usar Netlify | sim — linhas 8, 65, 67, 69, 72, 77 |
| HANDOFF está desatualizado | "Última atualização: 2026-07-25", ainda fala em "modo teste" |
| REGRAS está na v5 | sim, e não descreve o acerto |
| Seções reais do admin | Confirmações · Preços/taxas/prazo · Aniversariantes · Estimativa · Fechamento e rateio |
| Nº de asserções | 57 |

**README:** reescrever o passo de publicação para GitHub Pages (push na `main`) e o de Supabase
(rodar o `supabase-setup.sql`, criar o admin, inserir em `admins`, pegar URL/anon key). Enxuto.

**HANDOFF:** reescrever para o estado atual — o que o app faz, como operar, como está o Supabase.
Some a seção "o que falta", que hoje descreve trabalho já entregue.

**REGRAS-NEGOCIO → v6:** colar a seção do acerto que veio no prompt e bumpar o cabeçalho.

## Fora de escopo
Nenhuma mudança em rateio, acerto, estimativa ou fechamento — só apresentação e docs.

## Verify

`./verify.sh` verde, com asserções novas do `resumoAcerto` (sobe de 57).

Integrada, com saída crua no `status.md`:

1. **countdown nos três estados**, forçando a data da festa: futuro (contagem correndo), **o dia
   da festa depois da hora dela** (tem de dizer "É hoje!", não "passou" — é o caso que o
   ingênuo erra) e o dia seguinte (escondido/neutro);
2. **compartilhar:** com acerto completo, o texto gerado bate com as transferências na tela
   (saída crua); com acerto incompleto, o botão some;
3. **docs:** `grep` provando que sumiu "Netlify" do README, que o REGRAS está na v6 com a seção
   do acerto, e que o HANDOFF descreve o estado atual;
4. `verify.sh` verde ao fim.

## Para o review

O `resumoAcerto` no `calculo.js` mistura formatação de texto num módulo que até aqui só devolvia
números. A alternativa é montar a string no `admin.js` — mais coerente com a separação, porém sem
teste. Escolhi testável; se preferir a separação estrita, movo e o `verify` fica com 57.

Parado, sem implementar, aguardando `review.md`.
