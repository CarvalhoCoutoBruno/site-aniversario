# Review — Fatia 1

**Veredito: aprovado com ajustes.** Conferi no `main.js`/`index.html` (não só na tabela do
plano). Os itens já no ar batem; entram A1, A2 e A3, mais a higiene A4.

## Confirmado no código (o que já passou)
- TDZ corrigido: `let _n = 0` / `uid()` no topo (`main.js:12-13`). Era o bug que derrubava o
  script inteiro — bom ter pego.
- `convidado_por` manda **id** 1/2/3 (`main.js:139` `value=i+1`; `:255` `Number(value)`). ✓
- Acompanhante sem nome **entra** no payload (`main.js:234`, sem `.filter`). ✓ (o bug antigo morreu)
- Chopp × criança desmarca/desabilita/reabilita (`main.js:184`) + cinto-e-suspensório no
  `lerPessoa` (`:241`). ✓
- Envio só por `criar_rsvp`; erro real, sem fingir sucesso (`main.js:274,282,297`). ✓
- Obrigatórios com mensagem amigável: nome, contato **e ≥1 aniversariante** (`main.js:258-260`). ✓
  - (Ia pedir guard pro `convidado_por` vazio — já existe na `:260`. Sem ação.)

## Ajustes a incorporar
- **A1 — `observacoes` ≤ 500 no cliente.** Real: `#mensagem` (`main.js:254`) vai pro
  `p_observacoes` sem limite; >500 bate no CHECK e cai no genérico do `mensagemDeErro`. Fazer
  como proposto: `maxlength=500` + contador a partir de ~450 + guard no submit (maxlength não
  pega colar via script). **Entra.**
- **A2 — "Confirme até DD/MM" com o form aberto.** Real: `checarPrazo` (`main.js:107`) só trata
  `aberto===false`; com prazo no futuro o convidado não vê data. Exibir perto do botão quando
  `aberto===true && prazo!=null`, reusando `.campo-dica`. **Entra.**
- **A3 — rótulo "Acompanhante N" no formulário.** Fiel ao prompt (o "exibir como Acompanhante
  N" era do form; o fallback do admin é outra coisa). Numerar o card ajuda quem adiciona 4-5.
  Baixo risco, não toca payload/cálculo. **Entra** (leve).
- **A4 — apagar a branch `fatia-0-...` já mergeada.** Sim.

## Fora do escopo desta fatia (parking, não bloqueia)
- **XSS armazenado no painel:** nome/observações vêm do convidado e serão renderizados no
  admin. O convite escapa tudo com `esc()`, mas o **`admin.js` precisa escapar** o conteúdo do
  convidado ao listar (alguém pode mandar `<script>` no nome). Levar como item da fatia do admin.

## Verify (mantém o do plano)
`./verify.sh` verde + integrada com saída crua no `status.md`: 600 chars barrado no cliente;
"Confirme até DD/MM" com form aberto; prazo passado escondendo o form (sem regressão); um envio
real gravado, conferido por SELECT e apagado; base restaurada (`rsvps=0`, `pessoas=0`,
`prazo_confirmacao=NULL`).

## Processo (só registro, daqui pra frente)
A Fatia 1 foi ao ar antes do loop de review — A1/A2 são exatamente o que escapou por publicar
antes da conferência. Com o fluxo, plano→review antes do push.
