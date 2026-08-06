# Review — Fatia 18 (lixeira e fechar a porta do apagar)

**Veredito: aprovado, com um achado que mexe no schema, uma correção de fato, a autorização do §5
concedida e uma exigência de sequenciamento por causa do deploy.** Nada disso pede re-planejar —
cabe tudo no `executa`.

Plano forte. A cerca topológica do §2 (duas variáveis, dois mapas, sem interseção) é a resposta
certa para o risco 1, e o detalhe do `delete` casando com `deleted_at` na sua própria medição é o
tipo de coisa que só aparece em quem desconfia da própria ferramenta.

## 1. O achado: o reenvio vai encher a lixeira de linha restaurável que não deve ser restaurada

Nem o meu prompt nem o teu plano olharam para a **terceira** coisa que grava `deleted_at`. Não são
duas portas, são três:

```sql
-- create_rsvp, linha 439: o dedupe
update public.rsvps set deleted_at = now()
 where contact_norm = public.normalize_contact(p_contact) and deleted_at is null;
```

Toda vez que alguém reenviar o formulário — trocar de ideia sobre refrigerante, corrigir o nome do
filho, acrescentar um acompanhante —, a confirmação anterior vira **cancelada**. Com o teu
`deleted_by` como está planejado, ela cai na lixeira com procedência `null` e o rótulo "saiu da
lista", com botão **Trazer de volta** do lado.

Duas consequências, as duas ruins:

- **A lixeira mente.** Ninguém saiu da lista; a pessoa está lá, na versão nova. O organizador olha
  para a lixeira procurando quem desistiu e encontra fantasmas dos próprios convidados.
- **Restaurar essas é sempre colisão.** Existe linha ativa com o mesmo `contact_norm` — por
  definição, é o que o dedupe acabou de fazer. Então o teu tratamento do `23505`, que é para a
  corrida rara, viraria o caminho comum. Uma defesa contra caso raro não deve ser exercitada toda
  semana; quando é, ela vira ruído e alguém "simplifica" ela fora.

**O conserto é barato e é agora, porque é a mesma migração:** um terceiro valor.

```sql
check (deleted_by in ('guest','admin','resend'))
```

O dedupe do `create_rsvp` grava `'resend'`. Na tela: **"substituída por um reenvio"**, e **sem
botão de restaurar** — restaurar não faz sentido nenhum ali, a confirmação que vale é a nova. A
linha continua visível e continua no banco (o modelo é esse: nada evapora), mas não oferece uma ação
que só pode dar errado.

Repare no ganho colateral: tirando esse caminho da mesa, o `23505` volta a ser o que devia ser — a
rede para a corrida de verdade (cancelou, reconfirmou, e alguém restaura a antiga). **Mantém as
duas defesas do §3**, a checagem no cliente pela boa frase e a captura pela correção. Você estava
certo em querer as duas; eu só estou tirando delas o trabalho que não era delas.

## 2. Correção de fato — o `check` não protege do que você disse que protege

Você escreveu que o `check (deleted_by in ('guest','admin'))` protege contra "a terceira porta que
não existe": se alguém acrescentar um caminho e esquecer a procedência, o insert falharia alto.

**Não falha.** `check` com `NULL` avalia `NULL`, que **não** é falso — a restrição passa. Um caminho
novo que esqueça de gravar procedência grava `null` em silêncio, exatamente o que você quis impedir.
O `in (...)` só pega typo (`'Guest'`, `'organizer'`), o que já vale, mas é outra coisa.

A restrição que faz o que você descreveu é a **de par**:

```sql
check (deleted_at is null or deleted_by is not null)
```

"Cancelada implica procedência registrada." Aplicável hoje sem dor, porque não há uma linha
cancelada sequer no banco. Ponha as duas.

Mantenha mesmo assim o rótulo de `null` na tela ("saiu da lista"). Custa um `else` e cobre a linha
que alguém criar por SQL num dia estranho.

## 3. §5 — **autorizado**, e obrigado por ter perguntado

Faça o `revoke delete on public.rsvps, public.people from anon, authenticated`. A razão que você deu
é a certa e eu acrescento uma: com o revoke, o `anon` deixa de depender **só** da RLS para não
apagar. Hoje ele tem o grant e é barrado por política; a distância entre isso e um estrago é uma
política mal escrita por alguém apressado. Grant ausente não tem como ser reaberto por descuido de
política.

Conferi as tuas quatro checagens do que não quebra e todas se sustentam — `security definer` roda
como dono, a cascata do FK é ação interna de integridade, e a trava do reset é DDL.

Duas exigências:

1. **O revoke tem de entrar no `supabase-setup.sql`.** O Supabase concede `all` para `anon` e
   `authenticated` nas tabelas novas do `public` por padrão — sem a linha no script, uma instalação
   do zero nasce com o grant de volta e o banco novo passa a divergir do de produção em silêncio. É
   o mesmo tipo de divergência que a auditoria de idioma pegou na trava do reset.
2. **A nona invariante cobre o revoke junto**, não só a ausência de `create policy … for delete`.
   O que se está protegendo é a propriedade "esta base não apaga linha de convidado" — e ela agora
   se apoia em duas linhas do arquivo. Uma invariante que vigia metade dá falsa sensação.

Se der conflito com o teste da política de fotos, lembre que o alvo é `rsvps`/`people`: o teste que
você já planejou (plantar a de fotos e o script continuar **verde**) é exatamente o certo.

## 4. Sequenciamento — o deploy quebrado muda o significado de fechar a porta

Isto é o que eu quero que fique claro no `status.md`, porque o Bruno vai ler e precisa saber.

Produção hoje serve a **Fatia 16**. Aquele painel apaga com `.from("rsvps").delete()` direto —
a RPC só chegou na 17. Então, neste momento, o botão de excluir do painel **no ar** faz exclusão
dura de verdade, por cima da trava do custo, e o dado evapora. É mais um motivo para fechar a porta
já, e não esperar o Pages voltar.

Feito o drop (e o revoke), no intervalo até o deploy sair o excluir do painel velho **para de
funcionar**. Com o revoke ele erra alto, com toast, que é bem melhor do que o silêncio do drop
sozinho — mais um ponto a favor do §5.

Então: **aplique, não espere**, e escreva no `status.md`, com todas as letras, que até o deploy da
17+18 sair o botão de excluir do painel no ar vai dar erro, e que isso é o desejado. Um aviso desses
vale mais que o conserto, porque o Bruno pode apertar o botão amanhã.

Sobre o incidente do GitHub em si: reconferir e reenfileirar está certo, e ele não é responsabilidade
tua. Só não feche a fatia dizendo "publicado" se não publicou — se ainda estiver parado, diga
**parado**, com a saída do build.

## 5. O que está muito bom

- **A resposta à minha pergunta do §3.** "Aponto a atual" com o argumento de que não custa consulta
  nenhuma (o `contact_norm` já vem no `select("*")`, a linha ativa já está em `lastGroups`) é
  exatamente o raciocínio que eu queria ver: a boa mensagem saiu de graça de dado que já estava na
  mão.
- **Checagem no cliente para a frase, banco para a correção.** A justificativa — outra aba, outro
  organizador, reconfirmação entre o carregar e o clicar — é a razão certa, e é a mesma razão pela
  qual as travas de dinheiro moram no banco.
- **O bloco só existir no DOM quando N > 0.** Lixeira vazia ocupando o fim da aba o ano inteiro
  seria ruído permanente para um evento raro.
- **A tabela de procedência com a linha do `null`** — não inventar dado que não se tem é o mesmo
  princípio do "sem oráculo" da 17, aplicado à interface.

## 6. Verificação — some ao que já está no plano

- **O reenvio na lixeira**: reenviar com o mesmo contato e provar que a linha anterior aparece como
  `'resend'`, com o rótulo de substituída e **sem** botão de restaurar. E que a atual segue única e
  ativa.
- **A restrição de par**: tentar `update rsvps set deleted_at = now()` sem procedência, direto por
  SQL, e provar que o banco **recusa**.
- **O revoke**: `DELETE` com JWT de admin devolvendo `42501` (não mais sucesso silencioso), a linha
  intacta no `select` depois — em `rsvps` e em `people`. E a mesma prova para o `anon`.
- **Instalação do zero coerente**: mostrar que o `supabase-setup.sql` contém o revoke, e que a nona
  invariante fica vermelha se ele sumir do arquivo.

Pode `executa`.
