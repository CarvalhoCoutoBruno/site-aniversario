# Review — Fatia 11 (convite "cartaz de boteco")

**Veredito: aprovado, com um recorte de escopo** (o commit 6 sai) e as 6 respostas abaixo.

## Sobre o processo — de acordo
Design como **fase a montante**, não como terceira ponta do ciclo: certo, e pelo motivo certo —
trabalho de design fecha por aprovação humana com variações lado a lado, não por gatilho
determinístico sobre um arquivo sobrescrito. Nomear o pacote por superfície (`convite/`, `admin/`)
em vez de slot fixo evita duas telas se atropelarem, e commitar o pacote no repo fecha o buraco de
sincronia da Fatia 2 — aqui com aposta maior, porque o arquivo perdido seria a especificação
inteira de uma tela. O `WORKFLOW.md` intacto e o registro durável no `FLUXO.md` estão certos.

## Sobre esta fatia ter vindo sem o meu `prompt.md`
**Aceito.** O `prompt-design.md` vem mais especificado que o meu seria, e o núcleo de cálculo não é
tocado. Com uma ressalva honesta: a premissa era "só pele, sem schema, sem contrato de dados", e a
fatia **cresceu além da pele** — `passou` fecha o RSVP, o `<select>` de relação sai, o card "Você"
perde campo, entra `localStorage`, entra og:image, e P2/P6 encostam em schema e backend. Isso é
exatamente o que um `prompt.md` teria delimitado. Não peço um retroativo (só somaria cerimônia):
**escopo aqui**, mesmo efeito, um turno mais barato.

**Admin: confirmo que é meu.** 5 abas com roteamento, `admin.js` remexido e a aba de Contas com as
fases do acerto — é dinheiro, e provavelmente não cabe numa fatia só. Fatio por risco quando chegar.

## Recorte de escopo — o commit 6 sai desta fatia
**`localStorage` (commit 6) não entra aqui.** É outra classe de risco: estado persistido com dado
pessoal (contato, nomes) e mudança do modelo mental do RSVP para "já confirmei / mudar / cancelar",
com verificação própria (persistência entre reloads, limpeza). Ele nasce junto com o P6, se o P6
acontecer. Esta fatia fica **pele + estados + comportamento que o mockup impõe** — verificável por
screenshot e não-regressão, que é o que ela sabe provar.

Os demais commits (1, 2, 3, 4, 5, 7, 8) seguem como planejados.

## As 6 respostas

**P1 — carrossel: aprovado.** Moldura do mockup + dots, sem setas. Os dots informam o N e a coluna
de 460px não comporta setas. **Condição:** sem as setas, os dots viram a **única** navegação —
garanta que continuem clicáveis (hoje são) e com alvo de toque decente. Um swipe simples seria
bem-vindo, mas não bloqueia.

**P2 — telefone: só texto agora; a coluna vem na fatia do admin.** (Decisão do Bruno.) O card de
prazo encerrado fica sem botão nesta fatia. `whatsapp_contato` entra junto com a tela que edita —
e isso preserva a propriedade que justificou esta fatia andar sem o meu fatiamento: **sem schema**.
Registro para a fatia do admin: a `festa` é lida por qualquer visitante, então o telefone ali é
**publicamente legível** — decisão consciente a tomar lá, não aqui.

**P3 — "Salvar na agenda": entra.** É de graça e o mockup pede. Dois cuidados: **fuso** (gerar o
`DTSTART` correto a partir da ISO com -03:00 — é o nosso calcanhar histórico, e um `.ics` uma hora
errado é pior que nenhum) e preferir **Blob URL** a `data:` URI, que o Safari do iPhone trata mal.
Verifique abrindo o arquivo gerado, não só o clique.

**P4 — chopp para criança: mantém a regra, e sem hesitar.** A constraint do banco é a fonte da
verdade; o mockup não manda em regra de negócio. É a fronteira que o próprio `FLUXO.md` desenhou —
o design decide espaçamento, cor e hierarquia, não regra. Divergência consciente, bem registrada.

**P5 — confete: aprovado.** Fora do hero (a textura substitui), mantido no sucesso, recolorido. É a
recompensa emocional do envio e não disputa espaço com texto.

**P6 — desconfirmar: fica fora desta fatia; vira fatia própria depois.** (Decisão do Bruno.)
Obrigado pela correção — melhor descobrir agora que depois de prometer na tela. O desenho que você
propôs é sólido e fica registrado para quando for: **uuid como credencial** é o mesmo padrão de link
de descadastro (128 bits, não se adivinha), sem coluna nova. Quando virar fatia, o plano precisa
cobrir `security definer` + `revoke from public` + `grant execute to anon`, apagar só por id (o
cascade cuida de `pessoas`), e a interação com o dedupe atual (reenvio já substitui — cancelar é só
para "não vou mais"). Uma RPC anônima que **apaga** dado merece plano e review próprios, não um
rodapé de redesign.

## Também aprovado, com notas
- **`passou` fechando o RSVP:** certo. Nota: a trava real segue sendo o prazo no `criar_rsvp`; o
  `passou` é UI. Como o prazo atual (02/10) é anterior à festa, o servidor já cobre na prática.
- **Remover `.p-relacao` e o `relacoes` do config:** aprovado — escrito e nunca lido, bem verificado.
- **Card "Você" sem campo de nome:** aprovado, o payload não muda (`pessoas[0].nome = responsavel`).
- **`festa.local` → "Salão Grande":** é `UPDATE`, mesmo procedimento da Fatia 8 (backup, saída crua).
  Só confirme com o Bruno que o nome do salão mudou mesmo — é dado dele, não do mockup.
- **og:image:** use URL absoluta, e saiba que o WhatsApp **cacheia preview** com força — depois de
  publicar, o preview velho pode persistir por um tempo. Registre isso no `status.md` para ninguém
  depurar fantasma.
- **Modo escuro:** você identificou o risco número um corretamente. O remap dentro de
  `.pagina-convite` no **primeiro** commit e como asserção da verificação — exatamente assim.

## Verificação
A lista dos 7 estados a 390px, o fail-loud com **um estado só** (a asserção que já quebrou três
vezes), o modo escuro idêntico, o admin intacto e o contraste recalculado **sobre o CSS final** (não
sobre o mockup) cobrem o que importa. Com o commit 6 fora, o item 6 do verify (`localStorage`) sai
junto.

Pode `executa`.
