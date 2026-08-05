# Fatia — Área do organizador (admin)

Mockup de referência: **`mockups/admin-organizador.html`** — arquivo autônomo, abre no
navegador sem servidor. Tweaks: `tela` (painel/login) e `faseContas`
(pendente/nao-confere/falta-pagador/completo).

Substitui o visual de `admin.html`. **`js/calculo.js` não muda** — o mockup foi
desenhado a partir dele. `js/admin.js` muda por causa da navegação em abas.

---

## 1. O problema que isto resolve

Hoje o admin é uma pilha de `<details>`: Convite, Preços, Aniversariantes, Estimativa,
Fechamento, Acerto, stats, tabela de 7 colunas e fotos — tudo numa rolagem só. No
celular (que é onde ele é usado) não dá para achar nada, e a tabela é ilegível.

## 2. Estrutura nova: 5 abas

Barra fixa no rodapé, alvo de 58px, rótulo de texto e barra azul de 3px na aba ativa.
Sem ícones — glifos ambíguos foram testados e descartados.

| Aba | Conteúdo | Vem de |
|---|---|---|
| **Resumo** | Confirmados (adultos/crianças), nº de grupos, prazo com barra, "quem consome o quê" em barras, recados e restrições | `#stats`, `estContagens` |
| **Quem vem** | Busca + filtros; **cards expansíveis** no lugar da tabela | `#tabelaBody` |
| **Compras** | Lista de compra (litros e unidades) + custo estimado + copiar para fornecedor | `estVolumes`, `estPizzas`, `estCusto` |
| **Contas** | Custo real → rateio → selo → acerto → quem pagou cada item | `fecCustos`, `fecContas`, `fecSelo`, `acerto*` |
| **Ajustes** | Convite, preços, taxas, prazo, aniversariantes, fotos | `conviteForm`, `configForm`, `anivForm`, `fotosGrid` |

⚠ A tabela de 7 colunas **sai**. Cada grupo vira um card: nome, contato, quem convidou,
nº de pessoas. Ao tocar, expande com uma linha por pessoa (tipo + o que consome), o
recado e as ações (WhatsApp / excluir).

## 3. Tokens (sóbrio, oposto ao convite)

```css
--fundo:      #eceae5;   /* fora da coluna */
--painel:     #f7f6f3;   /* fundo do app */
--card:       #fff;
--borda:      #dedbd4;
--borda-2:    #cfcbc2;   /* inputs */
--tinta:      #14110d;
--mudo:       #6b665d;   /* secundário — NÃO usar #8a857c, reprova AA */
--azul:       #1d4ed8;   /* aba ativa, salvar, acento */
--vermelho:   #d8352a;   /* excluir, alerta */
--âmbar-bg:   #fdf6ec;  --âmbar-borda: #e8d5b5;  --âmbar-txt: #7c5a1e;
--erro-bg:    #fdefee;  --erro-borda:  #f0c9c6;  --erro-txt:  #9b2c22;
--ok-bg:      #eef2fd;  --ok-borda:    #c9d6f7;  --ok-txt:    #1e3a8a;
```

Fontes: **Space Grotesk** (interface) + **DM Mono** (todo número, valor, telefone).
Nada de Anton aqui — a tipografia gritada é do convite, não do admin.

## 4. Contraste (medido)

| Par | Ratio | |
|---|---|---|
| `#14110d` sobre `#fff` | 17.9:1 | ✔ |
| `#6b665d` sobre `#fff` | 5.72:1 | ✔ AA em 12.5px |
| `#8a857c` sobre `#fff` | 3.67:1 | ✘ **não usar em texto** |
| `#7c5a1e` sobre `#fdf6ec` | 6.4:1 | ✔ selo pendente |
| `#9b2c22` sobre `#fdefee` | 7.1:1 | ✔ selo erro |
| `#1e3a8a` sobre `#eef2fd` | 9.7:1 | ✔ selo ok |

## 5. Aba Contas — os 4 estados, direto do `calculo.js`

O mockup **não** desenha só o caso feliz. Estados, na ordem em que aparecem na vida real:

| Fase | Gatilho no `calculo.js` | Selo | Acerto |
|---|---|---|---|
| `pendente` | `fechamentoCompleto === false` | âmbar ○ "falta lançar o gasto de X" | bloqueado, mostra `motivo` |
| `nao-confere` | `fechamentoCompleto && !confere` | vermelho ! "as contas não fecham" | bloqueado |
| `falta-pagador` | `acerto().faltaPagador.length` | azul ✓ (rateio ok) | bloqueado, "Indique quem pagou: …" |
| `completo` | `acerto().status === "completo"` | azul ✓ | transferências + botão WhatsApp |

Regras que o mockup respeita e a implementação precisa manter:
- Campo de custo vazio = **"ainda não sei"**, nunca zero. Placeholder `não sei`, borda
  âmbar. Nada de `0,00` cinza.
- O texto de `motivo` vem do `calculo.js`, não é reescrito na tela.
- "Quem pagou cada item" mostra o **valor calculado** ao lado de cada item; o organizador
  só escolhe o nome. Ninguém digita valor.
- Convidado não paga — a nota "quem chamou banca" fica visível no card do rateio.

## 6. Mobile primeiro, mas usável no note

Coluna de `max-width: 560px` centralizada. No notebook fica uma coluna larga e
confortável — não vira dashboard de 3 colunas, e isso é decisão consciente: são 5
organizadores, o uso principal é no celular, e duas layouts distintas dobrariam o custo
de manutenção sem ganho real.

Alvos ≥44px em tudo. Inputs a 16px. Barra de abas com `env(safe-area-inset-bottom)`.

## 7. Ordem sugerida

1. Casca: abas + roteamento + login.
2. Resumo (só leitura, risco baixo).
3. Quem vem (cards) — apaga a tabela.
4. Compras.
5. Contas com as 4 fases — aqui está o cuidado; rode `tests/calculo.test.js`.
6. Ajustes (formulários existentes, reagrupados).

Screenshot a 390px de cada aba + das 4 fases de Contas fecha a fatia.
