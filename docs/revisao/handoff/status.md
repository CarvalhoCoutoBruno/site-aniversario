# Status — Fatia 1 (ajustes da revisão)

**Fatia fechada.** Os 4 ajustes do `review.md` entraram, com verificação integrada contra o
Supabase real. O item de parking (XSS no painel) **já estava resolvido** — provado abaixo.

| | |
|---|---|
| Branch | `fix/fatia-1-ajustes-prazo-e-limite` → merge `--ff-only` → apagada |
| Commits | 1 (`A1+A2+A3` são o mesmo concern: ajustes de UX do formulário) |
| `./verify.sh` | **VERDE** — 41/41, sem regressão |
| **`origin/main` pós-push** | preenchido no fim deste arquivo |

## `./verify.sh`

```
Sintaxe
  ✓ js/admin.js
  ✓ js/calculo.js
  ✓ js/config.js
  ✓ js/main.js
  ✓ tests/calculo.test.js

Testes de cálculo
  ✓ ✓ 41 passaram, 0 falharam

Higiene
  ✓ sem connection string, service_role ou senha rastreada
  ✓ js/config.js preenchido

Coerência
  ✓ supabase-setup.sql sem placeholder
  ✓ js/main.js escreve só pelo RPC

VERDE — verificação estática ok. Falta a integrada (navegador + banco).
```

## Verificação integrada — saída crua

### A2 — "Confirme até DD/MM" com o formulário aberto
`config.prazo_confirmacao = '2026-10-20 23:59:59-03'`, formulário carregado:

```json
{ "A2_prazoAbertoVisivel": true,
  "A2_texto": "⏳ Confirme até 20/10/2026.",
  "A2_formAberto": true }
```

### A3 — numeração dos cards, inclusive após remoção
```json
{ "A3_inicial":  ["Você"],
  "A3_com3":     ["Você", "Acompanhante 1", "Acompanhante 2", "Acompanhante 3"],
  "A3_aposRemoverDoMeio": ["Você", "Acompanhante 1", "Acompanhante 2"] }
```
Removi o card **do meio** de propósito: a renumeração não deixa buraco na sequência.

### A1 — limite de 500 no cliente, incluindo o bypass por script
```json
{ "aos440_contadorOculto": true,
  "aos460_contador": "460/500 caracteres",
  "aos500_contador": "500/500 caracteres",
  "aos500_classeLimite": true,
  "bypass_valorAceito": 600,
  "bypass_erro": "O recado passou de 500 caracteres (tem 600). Encurte um pouco.",
  "bypass_naoEnviou": true }
```
O `maxlength` corta a digitação mas **não** a atribuição por script — daí o guard no submit.
Com 600 caracteres o envio é barrado no cliente, sem chegar ao `CHECK` da tabela.

### Envio real gravado no banco
Enviado pelo formulário; conferido por `SELECT` como dono:

```
GRUPO : ['<img src=x onerror=alert(1)>Chico', '51 93333-2222', '51933332222', [2], 'recado curto <b>com tag</b>', 27]
PESSOAS (ordem, nome, tipo, papel, agua, refri, chopp, pizza, aniv_id):
   [0, '<img src=x onerror=alert(1)>Chico', 'adulto', 'principal', False, False, True, True, None]
   [1, '(NULL)', 'adulto', 'acompanhante', False, True, False, False, None]
   [2, '(NULL)', 'crianca', 'acompanhante', True, False, False, False, None]
```

Confirma: **acompanhante sem nome preservado** (`NULL`, não descartado), `papel` correto,
criança sem chopp, `aniversariante_id` nulo em todos, `contato_norm` só dígitos.

### Múltipla escolha de `convidado_por`
```
grupos:
   ['<img src=x onerror=alert(1)>Chico', [2]]
   ['Multi Escolha', [1, 3]]
```
Marcados na tela: `["1","3"]` → gravado `[1, 3]`. **IDs, nunca nome.**

> O `[2]` do primeiro grupo é artefato do meu script de teste, não defeito: o chip do Bruno
> já estava marcado de um passo anterior e meu clique o desmarcou. Refiz limpo no segundo.

### Parking do review — XSS no painel: **já resolvido**
O nome acima carrega `<img src=x onerror=alert(1)>`. No painel, com `window.alert` instrumentado:

```json
{ "imgInjetadas": 0,
  "alertDisparou": false,
  "htmlDaCelula": "<b>&lt;img src=x onerror=alert(1)&gt;Chico</b><br><small>51 93333-2222</small>",
  "recadoRenderizado": "recado curto &lt;b&gt;com tag&lt;/b&gt;",
  "convidouMulti": ["BrunoBocão", "Braz"] }
```

O `admin.js` já passa por `esc()` tudo que vem do convidado. Auditei as interpolações sem
`esc()`: são índice numérico, data formatada por `toLocaleDateString`, uuid e literais —
nenhuma controlada pelo convidado. **Sugiro tirar o item do backlog do admin.**

### Prazo vencido — sem regressão
`prazo_confirmacao = '2026-07-15'`:
```json
{ "formEscondido": true,
  "avisoEncerradoVisivel": true,
  "textoEncerrado": "O prazo para confirmar presença terminou em 15/07/2026.",
  "prazoAbertoOculto": true }
```
Os dois avisos são mutuamente exclusivos.

### Base restaurada
```
rsvps = 0
pessoas = 0
admins = 4
prazo_confirmacao = None
auth.users = ['bruno.carvalho@gmail.com', 'brazrs@gmail.com', 'rscouto47@hotmail.com', 'jhboca@hotmail.com']
admins = ['Bocão', 'Braz', 'Bruno', 'Rosaura']
```
Usuário temporário de verificação apagado; nenhum `cc-temp-*` restante.

## Notas para a próxima fatia

- **`admins` está completo** (4 linhas), `is_admin()` conferido para cada UID. A pendência que
  o antigo doc de estado listava não existe mais.
- **Sign-up público está desligado** — refiz o teste: `{"code":422,"error_code":"signup_disabled"}`.
- **Fatia 3 (cadastro de aniversariantes) é pré-requisito da 4 e da 5.** Sem linha com
  `aniversariante_id`, o rateio não tem pagante e a estimativa nasce sem o consumo deles.
- Ainda pendente do Bruno: rotacionar a senha do Postgres quando o desenvolvimento avançar.

## Processo

Concordo com a nota do review: A1 e A2 são exatamente o tipo de coisa que escapa quando se
publica antes da conferência. Daqui em diante, plano → review → push.

Uma consequência do fluxo que vale registrar: o `prompt.md` desta rodada descrevia trabalho já
entregue, porque o doc de estado que o alimentava estava defasado. Com o `CONTINUIDADE.md`
removido, o `status.md` passa a ser a única fonte do estado — e é escrito **depois** do push,
com o hash, então não tem como descrever um mundo que não existe.

---

**`origin/main` após o push:** `PREENCHER_APOS_PUSH`
