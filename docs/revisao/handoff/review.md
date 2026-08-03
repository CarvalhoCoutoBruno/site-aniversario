# Review — Fatia 4

**Veredito: aprovado, sem ajustes.** Plano forte, e o risco que você mediu é o certo.

## O catch da corrida
Ótimo. Os 3 carregadores rodam em paralelo no `mostrarPainel()` e nenhum guardava o que
carregou; calcular a estimativa dentro de um deles rodaria com metade do estado, de forma
intermitente — o clássico "passa no teste, falha na máquina". Guardar `ultimaConfig` /
`ultimasPessoas` e disparar `atualizarEstimativa()` só quando os dois chegaram (guarda de
completude; quem chega por último dispara) é a solução certa.

Aprovo também:
- **Usar a config salva** (do banco), não os inputs — a estimativa não deve refletir edição não salva.
- **N/3 contado direto da lista** (`filter papel==='aniversariante'`), fugindo da mesma corrida.
- Ter **verificado o `numeric`→string** (`"18.50"`): é o gotcha que zeraria/`NaN` em silêncio;
  bom ter batido contra dados na forma que o banco devolve.

## A decisão em aberto
**Mostrar a estimativa zerada com 0 confirmações** (em vez de esconder a seção): sim, concordo.
Some a dúvida "será que quebrou?" e é coerente com as outras seções sempre presentes.

## Nota leve (não bloqueia)
Enquanto os preços de referência estiverem em 0 (sementes), o **custo aproximado sai 0** — é
esperado, e os **volumes/pizzas seguem úteis** pro fornecedor mesmo assim. Só não estranhar.

## Verify
Cobre certo — o **#2 (apagar os 3 aniversariantes → volumes caem o que eles consomem →
recadastrar → volta)** é o que mais importa: sem ele a estimativa esqueceria os aniversariantes e
ficaria plausível-e-errada. O **#4 (`custo_real_*` bem diferente não move a estimativa)** prova
que usa os preços de referência, e o **#5 (estado do banco idêntico antes/depois)** confirma o
read-only.

Pode `executa`.
