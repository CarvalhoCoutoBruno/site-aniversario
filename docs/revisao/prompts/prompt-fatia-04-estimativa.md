# Fatia 4 — Estimativa de compra no admin

## Objetivo
Tela no admin que mostra a **estimativa de compra**: litros de chopp/refri/água, pizzas
(adulto/criança) e o custo aproximado (preços de referência). É o que o organizador passa pro
homem do chopp e pro da pizza. O cálculo já existe e está testado (`calculo.estimativa`); falta
a tela.

## Fontes da verdade
- `docs/REGRAS-NEGOCIO.md` (v5) — §4.1 (a estimativa conta **todas** as pessoas confirmadas,
  aniversariantes inclusive).
- `js/calculo.js` — `estimativa(pessoas, config)` (já carregado no `admin.html` desde a Fatia 2;
  devolve `contagens`, `litrosChopp/Refri/Agua`, `pizzaAdultos/Criancas`, `custoEstimado` em centavos).
- `supabase-setup.sql` — `config` (taxas + preços de referência) e `pessoas`.

## Escopo (o que entra)
1. **Seção nova no admin** (atrás do login), em `<details>` como as outras, na ordem da ET §7.2
   (depois de aniversariantes). Reaproveita o join que `carregarRSVPs` já faz (pessoas de grupos
   + as 3 de `papel='aniversariante'`).
2. **Chamar `calculo.estimativa(todasAsPessoas, config)`** — todas as pessoas (grupos + os 3
   aniversariantes) e a `config` já carregada. Não recalcular à mão; usar o módulo testado.
3. **Exibir:**
   - Volumes: **chopp**, **refri**, **água** em litros (`litrosChopp/Refri/Agua`).
   - Pizzas: **N adultos** e **M crianças** (`pizzaAdultos/Criancas`).
   - **Custo aproximado** (`custoEstimado`, em BRL via `formatarBRL`) — rotulado como *preços de
     referência*, pra não confundir com a conta real (fechamento, Fatia 5).
   - Um detalhamento curto das contagens (quantos bebem cada coisa, adultos/crianças) pra dar
     contexto aos números.
4. **Aviso quando `cadastrados < 3`:** usar o contador N/3 dos aniversariantes; se faltar algum,
   avisar que a estimativa **não inclui o consumo dos aniversariantes não cadastrados**.
5. **Recalcular:** botão "↻ Atualizar" (ou recomputar ao abrir a seção). Tela **só leitura** —
   estimativa é computada, não editada; **sem save**.

## Fora de escopo (não tocar)
Fechamento e `custo_real_*` (Fatia 5), edição de config (Fatia 2, pronta), cadastro de
aniversariantes (Fatia 3, pronta), formulário público.

## Verify (portão desta fatia)
- `./verify.sh` verde (o `calculo.js` não muda; 41/41).
- **Integrada, com saída crua no `status.md`:**
  - montar um conjunto conhecido (alguns grupos com consumo definido + os 3 aniversariantes
    cadastrados) → abrir a estimativa → **saída crua** com litros/pizzas/custo, conferidos contra
    a conta na mão (ex.: `nº que bebem chopp × taxa`);
  - **prova de que conta os aniversariantes:** mesma base **com** e **sem** as 3 linhas de
    aniversariante → os volumes mudam conforme o consumo deles;
  - **aviso N/3:** com menos de 3 cadastrados o aviso aparece; com 3, some;
  - custo aproximado usa os **preços de referência** da config (não `custo_real_*`);
  - restaurar a base ao fim.

## Observações
- É leitura pura da estimativa — nenhuma escrita no banco nesta fatia.
- Deixar claro na tela que é *estimativa / preços de referência*, distinta do fechamento real.
- Litros: usar o que o `calculo` já devolve (3 casas); arredondar pra cima na compra (barris)
  fica com o organizador — não embutir aqui.
