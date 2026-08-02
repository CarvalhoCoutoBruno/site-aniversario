# CONTINUIDADE — estado vivo do projeto

> Estado atual, backlog e gotchas. Atualizado a cada fatia.
> O protocolo está em [WORKFLOW.md](WORKFLOW.md) e a adaptação a este repo em
> [handoff/FLUXO.md](handoff/FLUXO.md) — aqueles são evergreen, este aqui não é.
>
> Última atualização: 2026-08-02, após a Fatia 1.

## O que é

Convite de aniversário para 3 aniversariantes (Bruno, Braz, Bocão), com carrossel de fotos, contagem regressiva, RSVP e painel de organizador. HTML/CSS/JS puro, **sem build**. Backend Supabase. Deploy GitHub Pages automático a cada push na `main`.

- Repo: https://github.com/CarvalhoCoutoBruno/site-aniversario
- No ar: https://carvalhocoutobruno.github.io/site-aniversario/
- Festa: **31/10/2026, 11h**, Salão 3 — Av. Cel. Marcos, 627, Porto Alegre/RS

## Entregue

### Fatia 0 — fundação
Schema completo aplicado e verificado; `js/config.js` com os dados reais e as chaves; `js/calculo.js` (módulo puro) com 41 asserções passando.

Três commits: schema inicial, correção do modelo de rateio, correção do `CHECK` com NULL.

### Fatia 1 — formulário público *(no ar)*
Formulário no modelo novo, falando com o schema via RPC. Verificado ponta a ponta contra o banco real.

- tipo adulto/criança; criança desmarca e desabilita o chopp
- bebidas e pizza como colunas booleanas fixas
- `convidado_por` envia **IDs 1/2/3**, nunca nome
- contato obrigatório; aviso de que reenviar substitui
- teto de 5 acompanhantes
- `status_rsvp()` fecha o formulário fora do prazo
- erro real do RPC na tela (o formulário antigo fingia sucesso)

Painel adaptado ao schema novo (lista + contagens). O resto do painel são as fatias 2-5.

**Dois bugs corrigidos:** o `.filter(p => p.nome)` que descartava acompanhante sem nome; e um `uid()` chamado antes do `let _n = 0` (zona morta temporal) que **derrubava o script inteiro** — pré-existente, o formulário no ar nunca funcionou de verdade.

## Backlog

| Fatia | Entrega | Depende de |
|---|---|---|
| **2** | Tela de config: preços, taxas de consumo e prazo de confirmação | — |
| **3** | Cadastro dos 3 aniversariantes como consumidores (`aniversariante_id` 1/2/3) | — |
| **4** | Estimativa: litros e pizzas + custo aproximado | 2, 3 |
| **5** | Fechamento: lançar custo real → **3 contas**, com selo `confere` | 4 |
| **6** | Countdown "É hoje!", README (ainda cita Netlify), HANDOFF, link `wa.me` | 5 |

A 3 vem antes da 4: sem aniversariante cadastrado não há pagante, e a estimativa nasce errada sem o consumo deles.

## Pendências do Bruno (fora do código)

- [ ] **Sign-up público ainda LIGADO.** Testado duas vezes contra a API: a conta é criada. Não é exploitável (`is_admin()` barra quem não está em `admins`), mas é superfície aberta. Authentication → Sign In / Providers → Email.
- [ ] Rotacionar a senha do Postgres quando o desenvolvimento avançar — ela circulou no chat.

## Gotchas do ambiente

- **Sem Node e sem `psql`** nesta máquina; daemon do Docker parado. Testes rodam no **`jsc`** (vem no macOS); banco via **`pg8000`** em venv descartável no scratchpad.
- **O sandbox impede servir de `~/Documents`** — servir cópia no scratchpad (receita em [handoff/FLUXO.md](handoff/FLUXO.md)).
- **Injeção de script no site publicado é bloqueada** pelo classificador. Verificação em produção é read-only (`get_page_text`); o teste que dirige a página roda contra a cópia local.
- **Screenshot sai em branco** quando o painel do navegador está oculto — usar inspeção de DOM.
- **GoTrue recusa login** se as colunas de token estiverem `NULL` em vez de `''`.

## Dados de teste

Base fica **zerada** ao fim de cada verificação: `rsvps = 0`, `pessoas = 0`, `config.prazo_confirmacao = NULL`.

`admins` tem 4 linhas (Bruno, Braz, Bocão, Rosaura) e **não** deve ser limpa — sobrevive ao reset do schema de propósito.

Contas em `auth.users`: as 4 reais. Qualquer `cc-temp-*` é resíduo de verificação e pode ser apagada.
