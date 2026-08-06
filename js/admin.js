/* =============================================================
   SITE DE ANIVERSÁRIO — painel do organizador
   ============================================================= */
(function () {
  const C = window.CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const temSupabase = C.supabase.url && !C.supabase.url.includes("COLE_");
  if (!temSupabase || !window.supabase) {
    $("#loginBox").innerHTML =
      '<h1>Configuração pendente</h1><p>Cole a URL e a chave do Supabase em <code>js/config.js</code> para usar o painel.</p><p style="text-align:center"><a href="index.html">← Voltar</a></p>';
    return;
  }
  const sb = window.supabase.createClient(C.supabase.url, C.supabase.anonKey);

  /* ================= LOGIN ================= */
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#loginMsg");
    msg.className = "msg-toast"; msg.textContent = "Entrando...";
    const { error } = await sb.auth.signInWithPassword({
      email: $("#email").value.trim(),
      password: $("#senha").value,
    });
    if (error) { msg.className = "msg-toast err"; msg.textContent = "E-mail ou senha incorretos."; return; }
    mostrarPainel();
  });

  $("#btnSair").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });
  $("#btnAtualizar").addEventListener("click", async () => {
    await carregarConvite();
    carregarConfig(); carregarAniversariantes(); carregarRSVPs(); carregarFotos();
    carimbarAtualizacao();
  });

  /* ================= ABAS =================
     As abas trocam VISIBILIDADE e nada mais: não disparam carregamento.
     Carregar sob demanda derrubaria a guarda de completude do
     recomputar() — a aba Contas renderizaria antes de `pessoas` chegar,
     que é a corrida que a Fatia 4 matou. E não há o que otimizar: são
     ~30 grupos e ~60 pessoas.

     O estado vive no hash: sobrevive ao reload e ao botão voltar, é
     compartilhável, e não guarda nada no aparelho de ninguém. */
  const ABAS = ["resumo", "quem-vem", "compras", "contas", "ajustes"];
  const ABA_PADRAO = "resumo";

  function abaDoHash() {
    const h = (location.hash || "").replace(/^#/, "");
    return ABAS.includes(h) ? h : ABA_PADRAO;   // hash ausente ou desconhecido cai no padrão
  }

  function mostrarAba(id) {
    for (const a of ABAS) {
      $(`#aba-${a}`).hidden = a !== id;
      const botao = $(`#tab-${a}`);
      botao.classList.toggle("ativa", a === id);
      botao.setAttribute("aria-selected", String(a === id));
    }
    // o conteúdo da aba anterior pode ter deixado a página rolada
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  $$(".ad-aba-btn").forEach((b) => {
    b.addEventListener("click", () => {
      const id = b.dataset.aba;
      // replaceState e não hash direto: um toque em aba não merece uma
      // entrada no histórico, mas a URL precisa refletir onde você está
      history.replaceState(null, "", `#${id}`);
      mostrarAba(id);
    });
  });
  // o voltar/avançar do navegador mexe no hash sem passar pelo clique
  window.addEventListener("hashchange", () => mostrarAba(abaDoHash()));

  /* "atualizado às HH:MM" — a hora do último carregamento nesta sessão,
     que é o que responde "esse número na minha tela está velho?".
     No fuso da festa: o organizador pode estar viajando. */
  function carimbarAtualizacao() {
    $("#adAtualizado").textContent = "atualizado às " +
      new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(new Date());
  }

  // já logado?
  sb.auth.getSession().then(({ data }) => { if (data.session) mostrarPainel(); });

  async function mostrarPainel() {
    $("#loginBox").hidden = true;
    $("#painel").hidden = false;
    mostrarAba(abaDoHash());
    prepararUpload();
    // A festa vem PRIMEIRO e sozinha: os nomes dos aniversariantes saem
    // dela, e quem renderiza rótulo (cadastro, seletor de pagador,
    // coluna "convidou") pegaria o fallback se rodasse em paralelo.
    await carregarConvite();
    carregarConfig();
    carregarAniversariantes();
    carregarRSVPs();
    carregarFotos();
    carimbarAtualizacao();
  }

  /* ================= CONVITE: o que o convidado vê =================
     Tabela `festa` — a única que o anon lê direto. Aqui só entra o que
     já aparece impresso no convite; preço e custo real seguem na
     `config`, fechada.

     Os nomes dos aniversariantes moram aqui, e a POSIÇÃO é o id usado
     em convidado_por e aniversariante_id. Em colunas nomeadas em vez de
     array, não dá para reordenar sem perceber.                      */

  let ultimaFesta = null;

  const CAMPOS_CONVITE = ["titulo", "subtitulo", "data_texto", "local", "local_mapa",
                          "nome_aniv_1", "nome_aniv_2", "nome_aniv_3"];

  // datetime-local <-> timestamptz, sempre em -03:00, mesma disciplina
  // do prazo: o dia sai do fuso de São Paulo, não do navegador.
  function dataParaInput(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    }).formatToParts(d);
    const g = (t) => p.find((x) => x.type === t).value;
    return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
  }

  const inputParaData = (v) => (v ? `${v}:00-03:00` : null);

  async function carregarConvite() {
    const { data, error } = await sb.from("festa").select("*").eq("id", 1).single();
    if (error || !data) {
      console.error(error);
      return toastConvite("Não consegui carregar o convite.", "err");
    }
    ultimaFesta = data;
    for (const col of CAMPOS_CONVITE) $(`#cv_${col}`).value = data[col] || "";
    $("#cv_data").value = dataParaInput(data.data);
    $("#conviteAtualizado").textContent = data.atualizado_em
      ? `Editado em ${fmtData(data.atualizado_em)}`
      : "Ainda nos valores originais";
    recomputar();
  }

  function toastConvite(msg, classe) {
    const el = $("#conviteMsg");
    el.className = "msg-toast" + (classe ? " " + classe : "");
    el.textContent = msg;
  }

  $("#conviteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#btnSalvarConvite");
    toastConvite("");

    const txt = (id) => $(`#cv_${id}`).value.trim();
    const obrigatorios = [["titulo", "Título"], ["local", "Local"],
                          ["nome_aniv_1", "1º aniversariante"],
                          ["nome_aniv_2", "2º aniversariante"],
                          ["nome_aniv_3", "3º aniversariante"]];
    for (const [col, rotulo] of obrigatorios) {
      if (!txt(col)) return erroConvite(col, `Preencha "${rotulo}".`);
    }
    if (!$("#cv_data").value) return erroConvite("data", "Escolha a data e a hora da festa.");

    // o link vai direto para o href do convite: um valor colado errado
    // viraria link quebrado na cara do convidado
    const mapa = txt("local_mapa");
    if (mapa && !/^https?:\/\//i.test(mapa)) {
      return erroConvite("local_mapa", "O link do mapa precisa começar com http:// ou https://.");
    }

    const patch = {
      titulo: txt("titulo"),
      subtitulo: txt("subtitulo") || null,
      data: inputParaData($("#cv_data").value),
      data_texto: txt("data_texto") || null,
      local: txt("local"),
      local_mapa: mapa || null,
      nome_aniv_1: txt("nome_aniv_1"),
      nome_aniv_2: txt("nome_aniv_2"),
      nome_aniv_3: txt("nome_aniv_3"),
      atualizado_em: new Date().toISOString(),
    };

    btn.disabled = true;
    const rotulo = btn.textContent;
    btn.textContent = "Salvando...";
    const { error } = await sb.from("festa").update(patch).eq("id", 1);
    btn.disabled = false;
    btn.textContent = rotulo;

    if (error) {
      console.error(error);
      return toastConvite("Não consegui salvar o convite.", "err");
    }
    toastConvite("Convite salvo. ✅ O site já está mostrando isso.", "ok");
    // await antes dos dependentes: os rótulos dos blocos e a coluna
    // "convidou" saem dos nomes, e sem esperar pegariam os antigos.
    await carregarConvite();
    carregarAniversariantes();
    carregarRSVPs();
  });

  function erroConvite(col, msg) {
    toastConvite(msg, "err");
    const el = $(`#cv_${col}`);
    if (el) el.focus();
  }

  /* O rateio rotula as contas com `pessoas.nome`, que é o snapshot de
     quando o aniversariante foi cadastrado. Renomeando no Convite, a
     conta continuaria com o nome velho até alguém re-salvar o cadastro.
     A festa é a fonte única do nome — o snapshot serve só de reserva. */
  function nomeDoAniversariante(id, reserva) {
    return nomesAniversariantes()[id - 1] || reserva || `Aniversariante ${id}`;
  }

  // nomes dos 3, na ordem — a posição é o id
  function nomesAniversariantes() {
    return ultimaFesta
      ? [ultimaFesta.nome_aniv_1, ultimaFesta.nome_aniv_2, ultimaFesta.nome_aniv_3]
      : ["Aniversariante 1", "Aniversariante 2", "Aniversariante 3"];
  }

  /* ================= CONFIG: preços, taxas e prazo =================
     A linha única de `config` (id=1). Só admin lê e grava — a RLS via
     is_admin() garante no banco; a tela fica atrás do login.        */

  // numeric(10,2) e numeric(6,3) no banco: estourar a faixa volta como
  // erro cru de tipo, então a trava é aqui.
  const MAX_PRECO = 99999999.99;
  const MAX_TAXA = 999.999;

  const CAMPOS_PRECO = [
    ["preco_litro_chopp", "Chopp (por litro)"],
    ["preco_litro_refri", "Refrigerante (por litro)"],
    ["preco_litro_agua", "Água (por litro)"],
    ["preco_pizza_adulto", "Pizza — adulto (por pessoa)"],
    ["preco_pizza_crianca", "Pizza — criança (por pessoa)"],
  ];
  const CAMPOS_TAXA = [
    ["litros_chopp_por_adulto", "Chopp por adulto"],
    ["litros_refri_por_pessoa", "Refrigerante por pessoa"],
    ["litros_agua_por_pessoa", "Água por pessoa"],
  ];

  /* ---- parsing pt-BR ----
     NÃO reusa o paraCentavos do calculo.js: aquele só troca a primeira
     vírgula e serve para valores vindos do banco ("18.00"). Em entrada
     digitada, "1.234,56" viraria 0 silenciosamente.
     Regra: se há vírgula, ela é o decimal e os pontos são milhar;
     sem vírgula, um ponto é decimal. Distingue vazio de inválido para
     a mensagem poder ser específica.                                */
  function parseNumeroBR(txt) {
    const s = String(txt == null ? "" : txt).trim();
    if (s === "") return { vazio: true, valor: null };
    const norm = s.indexOf(",") >= 0 ? s.replace(/\./g, "").replace(",", ".") : s;
    if (!/^-?\d+(\.\d+)?$/.test(norm)) return { invalido: true, valor: null };
    const n = Number(norm);
    if (!isFinite(n)) return { invalido: true, valor: null };
    return { valor: n };
  }

  function fmtNumeroBR(n, minCasas, maxCasas) {
    if (n === null || n === undefined || n === "") return "";
    return Number(n).toLocaleString("pt-BR", {
      minimumFractionDigits: minCasas,
      maximumFractionDigits: maxCasas,
    });
  }

  /* ---- fuso do prazo ----
     Gravado às 23:59:59-03:00, o prazo cai SEMPRE no dia seguinte em
     UTC. Ler com toISOString() adiantaria a data em 1 dia toda vez (e
     em 31/12 mudaria o ano), fazendo o prazo andar a cada visita.
     Por isso o dia sai pelo fuso de São Paulo, não pelo do navegador
     — que pode ser outro, se o organizador estiver viajando.        */
  function dataDoPrazo(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(d);
    const parte = (t) => partes.find((x) => x.type === t).value;
    return `${parte("year")}-${parte("month")}-${parte("day")}`;
  }

  const prazoDaData = (data) => (data ? `${data}T23:59:59-03:00` : null);

  /* ---- montagem dos campos ---- */
  function montarCampos(destino, campos, dica) {
    $(destino).innerHTML = campos
      .map(([col, rotulo]) => `
        <label class="config-campo">
          <span>${esc(rotulo)}</span>
          <input type="text" inputmode="decimal" id="cfg_${col}"
                 data-coluna="${col}" placeholder="${esc(dica)}" />
        </label>`)
      .join("");
  }

  async function carregarConfig() {
    montarCampos("#configPrecos", CAMPOS_PRECO, "0,00");
    montarCampos("#configTaxas", CAMPOS_TAXA, "0,0");

    const { data, error } = await sb.from("config").select("*").eq("id", 1).single();
    if (error) {
      console.error(error);
      toastConfig("Não consegui carregar a configuração.", "err");
      return;
    }
    ultimaConfig = data;   // estimativa e rateio usam a config SALVA, não os inputs
    montarCamposFechamento();
    preencherFechamento(data);
    recomputar();
    for (const [col] of CAMPOS_PRECO) $(`#cfg_${col}`).value = fmtNumeroBR(data[col], 2, 2);
    for (const [col] of CAMPOS_TAXA) $(`#cfg_${col}`).value = fmtNumeroBR(data[col], 0, 3);
    $("#cfgPrazo").value = dataDoPrazo(data.prazo_confirmacao);
    $("#configAtualizado").textContent = data.atualizado_em
      ? `Última alteração: ${fmtData(data.atualizado_em)}`
      : "";
  }

  function toastConfig(msg, classe) {
    const el = $("#configMsg");
    el.className = "msg-toast" + (classe ? " " + classe : "");
    el.textContent = msg;
  }

  /* ---- salvar ---- */
  $("#configForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#btnSalvarConfig");
    toastConfig("");

    // Só os campos desta fatia. Nunca um objeto amplo: assim um bug aqui
    // não tem como zerar custo_real_* nem preco_real_pizza_*, da Fatia 5.
    const patch = {};
    const grupos = [
      [CAMPOS_PRECO, MAX_PRECO, "preço"],
      [CAMPOS_TAXA, MAX_TAXA, "taxa"],
    ];

    for (const [campos, maximo, tipo] of grupos) {
      for (const [col, rotulo] of campos) {
        const r = parseNumeroBR($(`#cfg_${col}`).value);
        // vazio e inválido são erros diferentes e merecem mensagem diferente:
        // deixar vazio virar 0 em silêncio seria zerar preço sem avisar.
        if (r.vazio) return erroConfig(col, `Preencha "${rotulo}". Use 0 se for zero mesmo.`);
        if (r.invalido) return erroConfig(col, `"${rotulo}" não é um número válido.`);
        if (r.valor < 0) return erroConfig(col, `"${rotulo}" não pode ser negativo.`);
        if (r.valor > maximo) {
          return erroConfig(col, `"${rotulo}" passou do máximo aceito para ${tipo} (${fmtNumeroBR(maximo, 2, 3)}).`);
        }
        patch[col] = r.valor;
      }
    }

    patch.prazo_confirmacao = prazoDaData($("#cfgPrazo").value);
    patch.atualizado_em = new Date().toISOString();

    btn.disabled = true;
    const anterior = btn.textContent;
    btn.textContent = "Salvando...";
    const { error } = await sb.from("config").update(patch).eq("id", 1);
    btn.disabled = false;
    btn.textContent = anterior;

    if (error) {
      console.error(error);
      return toastConfig("Não consegui salvar. Confira os valores e tente de novo.", "err");
    }
    toastConfig("Configuração salva. ✅", "ok");
    carregarConfig();
  });

  function erroConfig(col, msg) {
    toastConfig(msg, "err");
    const el = $(`#cfg_${col}`);
    if (el) el.focus();
  }

  /* ================= ANIVERSARIANTES como consumidores =================
     Linhas de `pessoas` com papel='aniversariante', rsvp_id NULL e
     aniversariante_id 1/2/3. É o que dá ao rateio o consumo próprio de
     cada um — sem elas, a Fatia 4 estima sem eles e a 5 fica sem pagante.

     ⚠️ NÃO usar .upsert(): o índice único de aniversariante_id é PARCIAL
     (where papel='aniversariante'), e o ON CONFLICT precisa repetir o
     predicado para inferir um índice parcial. O supabase-js só emite
     "on conflict (coluna)", forma que o Postgres rejeita com
     "no unique or exclusion constraint matching". Por isso o caminho é
     ler as linhas e decidir update ou insert.                         */

  const BEBIDAS_ANIV = [
    ["bebe_agua", "Água"],
    ["bebe_refri", "Refrigerante"],
    ["bebe_chopp", "Chopp"],
  ];

  // aniversariante_id -> id da linha em `pessoas` (ausente = ainda não cadastrado)
  const linhaDoAniversariante = new Map();

  function montarBlocosAniversariantes() {
    $("#anivBlocos").innerHTML = nomesAniversariantes()
      .map((nome, i) => {
        const k = i + 1;
        return `
        <fieldset class="config-bloco aniv-bloco" data-aniv="${k}">
          <legend>${esc(nome)} <small>(id ${k})</small></legend>
          <div class="pessoa-prefs">
            <div class="pref-grupo">
              <span class="pref-titulo">🎂 Idade</span>
              <div class="pref-chips a-tipo">
                <label class="chip marcado">
                  <input type="radio" name="aniv-tipo-${k}" value="adulto" checked /><span>Adulto</span>
                </label>
                <label class="chip">
                  <input type="radio" name="aniv-tipo-${k}" value="crianca" /><span>Criança</span>
                </label>
              </div>
            </div>
            <div class="pref-grupo">
              <span class="pref-titulo">🥤 Bebidas</span>
              <div class="pref-chips a-bebidas">
                ${BEBIDAS_ANIV.map(([col, rotulo]) => `
                  <label class="chip${col === "bebe_chopp" ? " a-chip-chopp" : ""}">
                    <input type="checkbox" data-col="${col}" /><span>${esc(rotulo)}</span>
                  </label>`).join("")}
              </div>
              <small class="campo-dica a-aviso-chopp" hidden>Chopp só para adultos.</small>
            </div>
            <div class="pref-grupo">
              <span class="pref-titulo">🍕 Comida</span>
              <div class="pref-chips a-comida">
                <label class="chip"><input type="checkbox" data-col="come_pizza" /><span>Pizza</span></label>
              </div>
            </div>
          </div>
        </fieldset>`;
      })
      .join("");

    $$(".aniv-bloco").forEach((bloco) => {
      ativarChips(bloco);
      ligarRegraChoppAniv(bloco);
    });
  }

  /* Espelho de UX da constraint chopp_nao_para_crianca. A fonte da
     verdade da regra é o banco; isto só evita o erro cru na tela. */
  function ligarRegraChoppAniv(bloco) {
    const chopp = bloco.querySelector('[data-col="bebe_chopp"]');
    const chip = bloco.querySelector(".a-chip-chopp");
    const aviso = bloco.querySelector(".a-aviso-chopp");
    function aplicar() {
      const ehCrianca = bloco.querySelector('.a-tipo input[value="crianca"]').checked;
      chopp.disabled = ehCrianca;
      chip.classList.toggle("desabilitado", ehCrianca);
      aviso.hidden = !ehCrianca;
      if (ehCrianca && chopp.checked) {
        chopp.checked = false;
        chip.classList.remove("marcado");
      }
    }
    $$(".a-tipo input", bloco).forEach((r) => r.addEventListener("change", aplicar));
    aplicar();
  }

  function marcarChip(input, ligado) {
    input.checked = ligado;
    input.closest(".chip").classList.toggle("marcado", ligado);
  }

  async function carregarAniversariantes() {
    montarBlocosAniversariantes();
    linhaDoAniversariante.clear();

    const { data, error } = await sb.from("pessoas").select("*").eq("papel", "aniversariante");
    if (error) {
      console.error(error);
      return toastAniv("Não consegui carregar os aniversariantes.", "err");
    }

    for (const p of data || []) {
      if (!p.aniversariante_id) continue;
      linhaDoAniversariante.set(p.aniversariante_id, p.id);
      const bloco = $(`.aniv-bloco[data-aniv="${p.aniversariante_id}"]`);
      if (!bloco) continue; // linha órfã: id sem nome correspondente no config.js

      const radio = bloco.querySelector(`.a-tipo input[value="${p.tipo}"]`);
      if (radio) { radio.checked = true; $$(".a-tipo .chip", bloco).forEach((c) => c.classList.remove("marcado")); radio.closest(".chip").classList.add("marcado"); }
      for (const [col] of BEBIDAS_ANIV) marcarChip(bloco.querySelector(`[data-col="${col}"]`), !!p[col]);
      marcarChip(bloco.querySelector('[data-col="come_pizza"]'), !!p.come_pizza);
      ligarRegraChoppAniv(bloco); // reaplica: se veio criança, o chopp precisa travar
    }
  }

  function toastAniv(msg, classe) {
    const el = $("#anivMsg");
    el.className = "msg-toast" + (classe ? " " + classe : "");
    el.textContent = msg;
  }

  $("#anivForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#btnSalvarAniv");
    toastAniv("");
    btn.disabled = true;
    const rotulo = btn.textContent;
    btn.textContent = "Salvando...";

    let erro = null;
    for (const bloco of $$(".aniv-bloco")) {
      const k = Number(bloco.dataset.aniv);
      const tipo = bloco.querySelector('.a-tipo input[value="crianca"]').checked ? "crianca" : "adulto";
      const registro = {
        // nome sempre do config.js: renomear lá propaga aqui no próximo save
        nome: nomesAniversariantes()[k - 1],
        tipo,
        papel: "aniversariante",
        aniversariante_id: k,
        come_pizza: bloco.querySelector('[data-col="come_pizza"]').checked,
      };
      for (const [col] of BEBIDAS_ANIV) registro[col] = bloco.querySelector(`[data-col="${col}"]`).checked;
      if (tipo === "crianca") registro.bebe_chopp = false; // cinto e suspensório
      // rsvp_id fica de fora de propósito: aniversariante vive sem grupo
      // (constraint aniversariante_sem_grupo).

      const existente = linhaDoAniversariante.get(k);
      const r = existente
        ? await sb.from("pessoas").update(registro).eq("id", existente)
        : await sb.from("pessoas").insert(registro);
      if (r.error) { erro = r.error; break; }
    }

    btn.disabled = false;
    btn.textContent = rotulo;

    if (erro) {
      console.error(erro);
      const m = String(erro.message || "");
      if (/pessoas_aniversariante_id_unico|duplicate key/i.test(m)) {
        toastAniv("Alguém acabou de cadastrar por outra tela. Recarregue e tente de novo.", "err");
      } else if (/chopp_nao_para_crianca/.test(m)) {
        toastAniv("Chopp não é liberado para criança.", "err");
      } else {
        toastAniv("Não consegui salvar. Tente de novo.", "err");
      }
      return;
    }

    toastAniv("Aniversariantes salvos. ✅", "ok");
    await carregarAniversariantes();
    carregarRSVPs(); // a contagem "cadastrados: N/3" vive nas estatísticas
  });

  /* ================= ESTIMATIVA DE COMPRA =================
     Só leitura: nenhuma escrita no banco nesta seção.

     ⚠️ Coordenação. Os carregadores rodam em PARALELO no mostrarPainel,
     e a estimativa precisa de config + pessoas juntas. Calcular dentro
     de um deles rodaria com metade do estado, de forma intermitente
     conforme a ordem em que as promessas resolvem. Por isso cada um
     guarda a sua parte e chama atualizarEstimativa(), que não faz nada
     enquanto faltar alguma: quem chega por último dispara.

     A config usada é a SALVA (a linha do banco), não a dos inputs —
     estimativa não deve refletir edição não salva.                   */

  let ultimaConfig = null;
  let ultimasPessoas = null;
  let ultimosGrupos = null;
  let ultimoResumo = null;

  const fmtLitros = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

  function cartao(valor, rotulo) {
    return `<div class="stat"><b>${esc(String(valor))}</b><span>${esc(rotulo)}</span></div>`;
  }

  // Guarda de completude única: os carregadores rodam em paralelo, e
  // tanto a estimativa quanto o rateio precisam do conjunto inteiro.
  // Quem chegar por último dispara os dois.
  function recomputar() {
    // ultimaFesta entra na guarda: os nomes dos aniversariantes vêm
    // dela, e o rateio/acerto rotula as contas com esses nomes.
    if (!ultimaConfig || !ultimasPessoas || !ultimosGrupos || !ultimaFesta) return;
    atualizarEstimativa();
    atualizarRateio();
    // o Resumo é remontado aqui porque a barra do prazo só existe com a
    // config na mão, e o render() pode ter rodado antes dela chegar
    if (ultimoResumo) montarResumo(ultimoResumo.grupos, ultimoResumo.todas, ultimoResumo.cont);
  }

  /* ================= ABA "COMPRAS" =================
     Só leitura, sobre a mesma Calculo.estimativa() de sempre. */

  function atualizarEstimativa() {
    if (!ultimaConfig || !ultimasPessoas) return;
    const e = Calculo.estimativa(ultimasPessoas, ultimaConfig);
    const c = e.contagens;

    // Litro é litro: NÃO arredondo para barril. Quantos barris comprar é
    // decisão do organizador com o fornecedor, e embutir isso aqui
    // esconderia uma regra de negócio dentro de um texto.
    const itens = [
      ["Chopp", fmtLitros(e.litrosChopp) + " L"],
      ["Refrigerante", fmtLitros(e.litrosRefri) + " L"],
      ["Água", fmtLitros(e.litrosAgua) + " L"],
      ["Pizza (adulto)", String(e.pizzaAdultos)],
      ["Pizza (criança)", String(e.pizzaCriancas)],
    ];

    $("#comprasBase").textContent =
      `Calculada sobre ${c.totalPessoas} ${c.totalPessoas === 1 ? "confirmado" : "confirmados"}, ` +
      "aniversariantes incluídos.";
    $("#comprasLista").innerHTML = itens.map(([nome, valor]) => `
      <div class="compras-linha">
        <span>${esc(nome)}</span>
        <b class="mono">${esc(valor)}</b>
      </div>`).join("");
    $("#comprasCusto").textContent = Calculo.formatarBRL(e.custoEstimado);

    // Com os preços ainda nas sementes (0), o custo sai zerado. Os
    // volumes seguem úteis; a tela avisa em vez de deixar o organizador
    // achar que a conta quebrou.
    const precos = ["preco_litro_chopp", "preco_litro_refri", "preco_litro_agua",
                    "preco_pizza_adulto", "preco_pizza_crianca"];
    const semPreco = precos.every((k) => Number(ultimaConfig[k]) === 0);
    const aviso = $("#comprasAviso");
    aviso.hidden = !semPreco;
    aviso.className = "msg-toast" + (semPreco ? " err" : "");
    aviso.textContent = semPreco
      ? "Os preços ainda estão zerados em Ajustes — os volumes valem, o custo não."
      : "";

    $("#comprasTexto").value = textoDoFornecedor(itens, c.totalPessoas);
  }

  /* Texto para colar no WhatsApp do fornecedor. Sem preço: é lista, não
     orçamento. Com a data no cabeçalho, que é a primeira coisa que o
     fornecedor pergunta. */
  function textoDoFornecedor(itens, total) {
    const f = ultimaFesta;
    return [
      `${(f && f.titulo) || "Festa"}${quandoDaFesta(f) ? " — " + quandoDaFesta(f) : ""}`,
      "Lista de compra",
      "",
      ...itens.map(([nome, valor]) => `${nome}: ${valor}`),
      "",
      `Base: ${total} ${total === 1 ? "confirmado" : "confirmados"}`,
    ].join("\n");
  }

  // "31/10/2026, sábado, 11h" — no fuso da festa, não no de quem clica
  function quandoDaFesta(f) {
    if (!f || !f.data) return "";
    const d = new Date(f.data);
    if (isNaN(d)) return "";
    const partes = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", hour12: false,
      weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).formatToParts(d);
    const g = (t) => (partes.find((x) => x.type === t) || {}).value || "";
    const hora = g("minute") === "00" ? `${g("hour")}h` : `${g("hour")}h${g("minute")}`;
    return `${g("day")}/${g("month")}/${g("year")}, ${g("weekday")}, ${hora}`;
  }

  $("#btnCopiarCompras").addEventListener("click", async () => {
    const texto = $("#comprasTexto").value;
    const msg = $("#comprasCopiaMsg");
    try {
      // exige contexto seguro e pode ser negada pelo usuário
      await navigator.clipboard.writeText(texto);
      msg.textContent = "Copiado! ✅";
    } catch (e) {
      // sem saída melhor que mostrar erro: expõe o texto para copiar na mão
      console.warn("clipboard indisponível:", e);
      const area = $("#comprasTexto");
      area.hidden = false;
      area.select();
      msg.textContent = "Não consegui copiar sozinho — o texto está aí embaixo, selecionado.";
    }
  });

  /* ================= FECHAMENTO E RATEIO =================
     Lança o custo real e mostra as 3 contas — uma por aniversariante.
     Convidado não paga: o consumo dele é bancado por quem o convidou.

     ⚠️ O rateio precisa dos GRUPOS (rsvps.convidado_por), não só das
     pessoas: é o elo convidado -> pagante. Sem eles todo convidado vira
     "consumo sem dono" e é descartado (não redistribuído), o rateio sai
     muito abaixo do gasto e o selo fica vermelho. Falha alto, mas o
     wiring de ultimosGrupos é o coração desta fatia.               */

  const CAMPOS_CUSTO = [
    ["custo_real_chopp", "Chopp"],
    ["custo_real_refri", "Refrigerante"],
    ["custo_real_agua", "Água"],
  ];
  const CAMPOS_PIZZA_REAL = [
    ["preco_real_pizza_adulto", "Pizza — adulto (por pessoa)"],
    ["preco_real_pizza_crianca", "Pizza — criança (por pessoa)"],
  ];

  function montarCamposFechamento() {
    const campo = ([col, rotulo]) => `
      <label class="config-campo">
        <span>${esc(rotulo)}</span>
        <input type="text" inputmode="decimal" id="fec_${col}" placeholder="em branco = não fechado" />
      </label>`;
    $("#fecCustos").innerHTML = CAMPOS_CUSTO.map(campo).join("");
    $("#fecPizzas").innerHTML = CAMPOS_PIZZA_REAL.map(campo).join("");
  }

  function preencherFechamento(cfg) {
    for (const [col] of [...CAMPOS_CUSTO, ...CAMPOS_PIZZA_REAL]) {
      const el = $(`#fec_${col}`);
      if (el) el.value = cfg[col] === null || cfg[col] === undefined ? "" : fmtNumeroBR(cfg[col], 2, 2);
    }
  }

  function toastFec(msg, classe) {
    const el = $("#fecMsg");
    el.className = "msg-toast" + (classe ? " " + classe : "");
    el.textContent = msg;
  }

  /* ---- salvar: update estreito, só os 5 campos de fechamento ----
     Vazio = NULL aqui, ao contrário da Fatia 2: lá vazio era
     esquecimento e se recusava; aqui significa "ainda não fechei". */
  $("#fecForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#btnSalvarFec");
    toastFec("");

    const patch = {};
    for (const [col, rotulo] of [...CAMPOS_CUSTO, ...CAMPOS_PIZZA_REAL]) {
      const r = parseNumeroBR($(`#fec_${col}`).value);
      if (r.vazio) { patch[col] = null; continue; }
      if (r.invalido) return erroFec(col, `"${rotulo}" não é um número válido.`);
      if (r.valor < 0) return erroFec(col, `"${rotulo}" não pode ser negativo.`);
      if (r.valor > MAX_PRECO) {
        return erroFec(col, `"${rotulo}" passou do máximo aceito (${fmtNumeroBR(MAX_PRECO, 2, 2)}).`);
      }
      patch[col] = r.valor;
    }
    patch.atualizado_em = new Date().toISOString();

    btn.disabled = true;
    const rotulo = btn.textContent;
    btn.textContent = "Salvando...";
    const { error } = await sb.from("config").update(patch).eq("id", 1);
    btn.disabled = false;
    btn.textContent = rotulo;

    if (error) {
      console.error(error);
      return toastFec("Não consegui salvar. Confira os valores e tente de novo.", "err");
    }
    toastFec("Fechamento salvo. ✅", "ok");
    carregarConfig(); // recarrega a config e recomputa o rateio
  });

  function erroFec(col, msg) {
    toastFec(msg, "err");
    const el = $(`#fec_${col}`);
    if (el) el.focus();
  }

  /* ---- o rateio (só leitura) ---- */
  const ITENS_CONTA = [["chopp", "Chopp"], ["refri", "Refri"], ["agua", "Água"], ["pizza", "Pizza"]];

  function atualizarRateio() {
    if (!ultimaConfig || !ultimasPessoas || !ultimosGrupos) return;
    const r = Calculo.rateio(ultimasPessoas, ultimaConfig, ultimosGrupos);

    $("#fecContas").innerHTML = r.porAniversariante.length
      ? r.porAniversariante.map((a) => {
          const itens = ITENS_CONTA
            .filter(([k]) => a.detalhe[k] > 0)
            .map(([k, rot]) => `<span class="pill">${esc(rot)}: ${esc(Calculo.formatarBRL(a.detalhe[k]))}</span>`)
            .join("");
          return `<div class="conta-aniv">
            <div class="conta-topo">
              <b>${esc(nomeDoAniversariante(a.aniversarianteId, a.nome))}</b>
              <span class="conta-total">${esc(Calculo.formatarBRL(a.total))}</span>
            </div>
            <div class="conta-itens">${itens || "<small>não consumiu nada</small>"}</div>
          </div>`;
        }).join("")
      : '<p class="vazio">Nenhum aniversariante cadastrado ainda.</p>';

    $("#fecTotais").innerHTML = [
      cartao(Calculo.formatarBRL(r.custoRealTotal), "Total gasto"),
      cartao(Calculo.formatarBRL(r.totalRateado), "Total rateado"),
    ].join("");

    // Três estados. Verde exige as DUAS condições: fechamento completo
    // E soma batendo. Só comparar os totais deixaria passar por verde um
    // fechamento incompleto cujas somas coincidem por acaso.
    const selo = $("#fecSelo");
    if (!r.fechamentoCompleto) {
      selo.className = "selo cinza";
      selo.textContent = "Fechamento incompleto — lance o custo real de chopp, refrigerante e água para fechar as contas.";
    } else if (r.confere) {
      selo.className = "selo verde";
      selo.textContent = "✓ As contas fecham: a soma das 3 é exatamente o total gasto.";
    } else {
      const dif = r.custoRealTotal - r.totalRateado;
      selo.className = "selo vermelho";
      selo.textContent =
        `✗ A soma das contas não bate com o total gasto — diferença de ${Calculo.formatarBRL(Math.abs(dif))}. ` +
        (dif > 0
          ? "Sobrou custo sem ninguém para ratear: confira se lançou algo que ninguém consumiu."
          : "O rateio passou do total: confira os valores lançados.");
    }

    montarPagadores(r.custosPorItem);
    preencherPagadores(ultimaConfig);
    atualizarAcerto(r);
  }

  /* ================= ACERTO: quem deve a quem =================
     O rateio diz quanto cada aniversariante DEVE. Aqui se registra
     quanto cada um PAGOU — só o pagador de cada item; o valor vem do
     custo já calculado no fechamento.

     ⚠️ O acerto só aparece quando o rateio CONFERE. Se o fechamento tem
     custo órfão, Σ deve ≠ Σ pagou, os saldos não somam zero e as
     transferências não quitariam nada. Checar só "todo item tem
     pagador" produziria um acerto silenciosamente errado.        */

  const CAMPOS_PAGO_POR = [
    ["pago_por_chopp", "chopp", "Chopp"],
    ["pago_por_refri", "refri", "Refrigerante"],
    ["pago_por_agua", "agua", "Água"],
    ["pago_por_pizza", "pizza", "Pizza"],
  ];

  function montarPagadores(custosPorItem) {
    const opcoes = ['<option value="">—</option>']
      .concat(nomesAniversariantes().map((nome, i) => `<option value="${i + 1}">${esc(nome)}</option>`))
      .join("");
    $("#acertoPagadores").innerHTML = CAMPOS_PAGO_POR
      .map(([col, item, rotulo]) => {
        const valor = custosPorItem ? Calculo.formatarBRL(custosPorItem[item] || 0) : "";
        return `<label class="config-campo">
          <span>${esc(rotulo)} <small>${esc(valor)}</small></span>
          <select id="ac_${col}">${opcoes}</select>
        </label>`;
      })
      .join("");
  }

  function preencherPagadores(cfg) {
    for (const [col] of CAMPOS_PAGO_POR) {
      const el = $(`#ac_${col}`);
      if (el) el.value = cfg[col] === null || cfg[col] === undefined ? "" : String(cfg[col]);
    }
  }

  function toastAcerto(msg, classe) {
    const el = $("#acertoMsg");
    el.className = "msg-toast" + (classe ? " " + classe : "");
    el.textContent = msg;
  }

  $("#acertoForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#btnSalvarAcerto");
    toastAcerto("");

    // update estreito: só os 4 pago_por. Nunca encosta em custo_real_*
    // (Fatia 5) nem nos campos da Fatia 2.
    const patch = { atualizado_em: new Date().toISOString() };
    for (const [col] of CAMPOS_PAGO_POR) {
      const v = $(`#ac_${col}`).value;
      patch[col] = v === "" ? null : Number(v);
    }

    btn.disabled = true;
    const rotulo = btn.textContent;
    btn.textContent = "Salvando...";
    const { error } = await sb.from("config").update(patch).eq("id", 1);
    btn.disabled = false;
    btn.textContent = rotulo;

    if (error) {
      console.error(error);
      return toastAcerto("Não consegui salvar quem pagou.", "err");
    }
    toastAcerto("Pagadores salvos. ✅", "ok");
    carregarConfig();
  });

  function atualizarAcerto(resultadoRateio) {
    const pagoPor = {};
    for (const [col, item] of CAMPOS_PAGO_POR) pagoPor[item] = ultimaConfig[col];
    const a = Calculo.acerto(resultadoRateio, pagoPor);

    $("#acertoSaldos").innerHTML = a.saldos.map((s) => {
      const rotulo = s.saldo > 0 ? "a pagar" : s.saldo < 0 ? "a receber" : "quite";
      const classe = s.saldo > 0 ? "saldo-pagar" : s.saldo < 0 ? "saldo-receber" : "";
      return `<div class="conta-aniv">
        <div class="conta-topo">
          <b>${esc(nomeDoAniversariante(s.aniversarianteId, s.nome))}</b>
          <span class="conta-total ${classe}">${esc(Calculo.formatarBRL(Math.abs(s.saldo)))} <small>${rotulo}</small></span>
        </div>
        <div class="conta-itens">
          <span class="pill">deve: ${esc(Calculo.formatarBRL(s.deve))}</span>
          <span class="pill">pagou: ${esc(Calculo.formatarBRL(s.pagou))}</span>
        </div>
      </div>`;
    }).join("");

    const selo = $("#acertoSelo");
    const lista = $("#acertoTransferencias");

    // Antes do return: se ficasse depois, o acerto voltando a incompleto
    // deixaria o botão de compartilhar na tela com o texto anterior —
    // pronto para mandar no grupo um acerto que não vale mais.
    prepararCompartilhar(a);

    if (a.status !== "completo") {
      selo.className = "selo cinza";
      selo.textContent = a.motivo;
      lista.innerHTML = "";
      return;
    }
    selo.className = "selo verde";
    selo.textContent = "✓ Acerto fechado: os saldos somam zero.";
    lista.innerHTML = a.transferencias.length
      ? `<ul class="transferencias">${a.transferencias.map((t) =>
          `<li><b>${esc(nomeDoAniversariante(t.de, t.deNome))}</b> → <b>${esc(nomeDoAniversariante(t.para, t.paraNome))}</b>: ${esc(Calculo.formatarBRL(t.valor))}</li>`
        ).join("")}</ul>`
      : '<p class="campo-dica">Ninguém deve nada a ninguém — cada um pagou exatamente a própria parte.</p>';
  }

  /* ---- compartilhar o acerto ----
     Só aparece com o acerto completo: sem acerto fechado não há o que
     mandar no grupo. O texto sai do resumoAcerto (puro e testado), não
     é montado aqui. */
  function prepararCompartilhar(a) {
    const caixa = $("#acertoCompartilhar");
    const texto = Calculo.resumoAcerto(a, `${(ultimaFesta && ultimaFesta.titulo) || "A festa"} 🎉`);
    caixa.hidden = !texto;
    $("#acertoTexto").hidden = true;
    $("#acertoCopiaMsg").textContent = "";
    if (!texto) return;

    $("#acertoTexto").value = texto;
    // wa.me sem número: o organizador escolhe o contato ou o grupo
    $("#btnWhatsAcerto").href = "https://wa.me/?text=" + encodeURIComponent(texto);
  }

  $("#btnCopiarAcerto").addEventListener("click", async () => {
    const texto = $("#acertoTexto").value;
    const msg = $("#acertoCopiaMsg");
    try {
      // exige contexto seguro e pode ser negada pelo usuário
      await navigator.clipboard.writeText(texto);
      msg.textContent = "Copiado! ✅";
    } catch (e) {
      // sem saída melhor que mostrar erro: expõe o texto para copiar na mão
      console.warn("clipboard indisponível:", e);
      const area = $("#acertoTexto");
      area.hidden = false;
      area.select();
      msg.textContent = "Não consegui copiar sozinho — o texto está aí embaixo, selecionado.";
    }
  });

  /* ================= CONFIRMAÇÕES =================
     Lê o schema novo: rsvps + pessoas por FK. As telas de config,
     aniversariantes, estimativa e fechamento são as Fatias 2 a 5 —
     aqui só a lista e as contagens.                                */
  async function carregarRSVPs() {
    const [g, p] = await Promise.all([
      sb.from("rsvps").select("*").order("criado_em", { ascending: false }),
      sb.from("pessoas").select("*").order("ordem", { ascending: true }),
    ]);
    if (g.error || p.error) { console.error(g.error || p.error); return; }

    const porGrupo = new Map();
    const aniversariantes = [];
    for (const pessoa of p.data || []) {
      if (pessoa.papel === "aniversariante") { aniversariantes.push(pessoa); continue; }
      if (!porGrupo.has(pessoa.rsvp_id)) porGrupo.set(pessoa.rsvp_id, []);
      porGrupo.get(pessoa.rsvp_id).push(pessoa);
    }
    ultimasPessoas = p.data || [];   // TODAS: as de grupo e as 3 de aniversariante
    ultimosGrupos = g.data || [];    // o elo convidado -> pagante (convidado_por)
    recomputar();
    render(g.data || [], porGrupo, aniversariantes);
  }

  /* ================= ABA RESUMO =================
     Só leitura, e tudo sai do que o render() já calculou — nenhuma
     consulta nova. */

  const CONSUMO_CORES = {
    "Água": "var(--ad-azul)", "Refri": "#7c5a1e", "Chopp": "#14110d", "Pizza": "var(--ad-vermelho)",
  };

  function montarResumo(grupos, todas, cont) {
    $("#resConfirmados").textContent = todas.length;
    $("#resComposicao").textContent =
      `${cont.adultos} ${cont.adultos === 1 ? "adulto" : "adultos"} · ` +
      `${cont.criancas} ${cont.criancas === 1 ? "criança" : "crianças"}`;
    $("#resGrupos").textContent = grupos.length;

    montarPrazoResumo(grupos);

    // barra proporcional ao total de pessoas; 0 pessoas não divide por zero
    const base = todas.length || 1;
    const itens = [["Água", cont.agua], ["Refri", cont.refri], ["Chopp", cont.chopp], ["Pizza", cont.pizza]];
    $("#resConsumo").innerHTML = itens.map(([nome, n]) => `
      <div class="res-linha">
        <span class="res-linha-nome">${esc(nome)}</span>
        <div class="res-barra">
          <div class="res-barra-fill" style="width:${Math.round((n / base) * 100)}%;background:${CONSUMO_CORES[nome]}"></div>
        </div>
        <span class="mono res-linha-n">${n}</span>
      </div>`).join("");

    montarRecados(grupos);
  }

  /* A régua da barra: da PRIMEIRA confirmação recebida até o prazo. Não
     existe "data de abertura" no schema, e essa é a origem que responde
     "quanto do período já passou" com dado real. Sem confirmação ainda,
     a barra não aparece — só a data e o "faltam N dias". */
  function montarPrazoResumo(grupos) {
    const bloco = $("#resPrazoBloco");
    const prazo = ultimaConfig && ultimaConfig.prazo_confirmacao
      ? new Date(ultimaConfig.prazo_confirmacao) : null;
    if (!prazo || isNaN(prazo)) { bloco.hidden = true; return; }
    bloco.hidden = false;

    $("#resPrazoData").textContent = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
    }).format(prazo);

    const agora = Date.now();
    const restaMs = prazo.getTime() - agora;
    const dias = Math.ceil(restaMs / 864e5);
    const vencido = restaMs <= 0;

    const primeira = grupos.reduce((min, g) => {
      const t = new Date(g.criado_em).getTime();
      return isNaN(t) ? min : Math.min(min, t);
    }, Infinity);

    const wrap = $("#resPrazoBarraWrap");
    if (primeira === Infinity) {
      wrap.hidden = true;                       // ninguém confirmou: não há régua
    } else {
      wrap.hidden = false;
      const total = prazo.getTime() - primeira;
      // vencido trava em 100%: a barra não passa do fim
      const pct = vencido || total <= 0 ? 100
        : Math.max(0, Math.min(100, ((agora - primeira) / total) * 100));
      $("#resPrazoBarra").style.width = pct.toFixed(1) + "%";
      $("#resPrazoBarra").classList.toggle("cheia", vencido);
    }

    // e nada de "faltam -3 dias"
    $("#resPrazoNota").innerHTML = vencido
      ? "As confirmações estão <b>encerradas</b>."
      : `Faltam <b>${dias} ${dias === 1 ? "dia" : "dias"}</b> para fechar as confirmações.`;
  }

  // O que separa restrição de recado é o que muda a compra.
  const RESTRICAO = /alergi|intoler|restri|cel[ií]ac|vegetarian|vegan|di?abet|lactose|gl[úu]ten/i;

  function montarRecados(grupos) {
    const comRecado = grupos.filter((g) => g.observacoes && g.observacoes.trim());
    $("#resRecadosNota").textContent = comRecado.length
      ? `${comRecado.length} ${comRecado.length === 1 ? "pessoa escreveu" : "pessoas escreveram"} algo.`
      : "Ninguém escreveu nada ainda.";
    // esc() em tudo: é texto que o convidado escreveu
    $("#resRecados").innerHTML = comRecado.map((g) => `
      <div class="res-recado${RESTRICAO.test(g.observacoes) ? " restricao" : ""}">
        <span class="res-recado-quem">${esc(g.nome_principal)}</span>
        <span class="res-recado-txt">${esc(g.observacoes)}</span>
      </div>`).join("");
  }

  const NOMES_BEBIDA = { bebe_agua: "Água", bebe_refri: "Refri", bebe_chopp: "Chopp" };

  function preferencias(pessoa) {
    const t = Object.keys(NOMES_BEBIDA).filter((k) => pessoa[k]).map((k) => NOMES_BEBIDA[k]);
    if (pessoa.come_pizza) t.push("Pizza");
    return t;
  }

  function render(grupos, porGrupo, aniversariantes) {
    // contagens sobre TODAS as pessoas confirmadas, aniversariantes incluídos
    const todas = [...aniversariantes];
    for (const lista of porGrupo.values()) todas.push(...lista);

    const cont = { agua: 0, refri: 0, chopp: 0, pizza: 0, adultos: 0, criancas: 0 };
    for (const p of todas) {
      if (p.tipo === "adulto") cont.adultos++; else cont.criancas++;
      if (p.bebe_agua) cont.agua++;
      if (p.bebe_refri) cont.refri++;
      if (p.bebe_chopp && p.tipo === "adulto") cont.chopp++;
      if (p.come_pizza) cont.pizza++;
    }

    // guardado para o recomputar(): a barra do prazo depende de
    // `ultimaConfig`, que pode chegar DEPOIS de render() — é a guarda de
    // completude em miniatura, e a solução é a mesma, não calcular com
    // metade do estado.
    ultimoResumo = { grupos, todas, cont };
    montarResumo(grupos, todas, cont);

    // busca e filtro NÃO são remontados aqui: moram em variáveis, então
    // sobrevivem à recarga que o excluir dispara. Perder a busca no meio
    // de uma limpeza seria irritante justamente na pior hora.
    ultimaLista = { grupos, porGrupo };
    montarFiltros();
    montarLista();
  }

  /* ================= ABA "QUEM VEM" =================
     Um card por grupo, expansível. A tabela de 7 colunas saiu: no
     celular — que é onde o painel é usado — ela era ilegível. */

  let filtroAtivo = "todos";           // "todos" | "criancas" | "1" | "2" | "3"
  const abertos = new Set();           // ids dos cards expandidos
  let ultimaLista = null;              // { grupos, porGrupo } do último carregamento

  function montarFiltros() {
    const nomes = nomesAniversariantes();
    const defs = [["todos", "Todos"], ["criancas", "Com crianças"],
                  ["1", nomes[0]], ["2", nomes[1]], ["3", nomes[2]]];
    $("#filtrosGrupos").innerHTML = defs.map(([id, nome]) =>
      `<button type="button" class="ad-filtro${id === filtroAtivo ? " ativo" : ""}" data-filtro="${id}">${esc(nome)}</button>`
    ).join("");
    $$("#filtrosGrupos .ad-filtro").forEach((b) => b.addEventListener("click", () => {
      filtroAtivo = b.dataset.filtro;
      montarFiltros();
      montarLista();
    }));
  }

  // "Acompanhante N" quando não tem nome: a pessoa existe no rateio mesmo
  // sem nome, e sumir com ela já foi bug uma vez.
  const nomeDaPessoa = (p, i) => p.nome || `Acompanhante ${i}`;

  function combinaBusca(g, pessoas, termo) {
    if (!termo) return true;
    // varre também o nome dos acompanhantes: "o Léo vem?" é pergunta natural
    const alvo = [g.nome_principal, g.contato,
                  ...pessoas.map((p, i) => nomeDaPessoa(p, i))].join(" ").toLowerCase();
    return alvo.includes(termo);
  }

  function combinaFiltro(g, pessoas) {
    if (filtroAtivo === "todos") return true;
    if (filtroAtivo === "criancas") return pessoas.some((p) => p.tipo === "crianca");
    // O filtro é LENTE, não contabilidade: um grupo com convidado_por
    // [1,3] aparece nos dois. Quem paga o quê está em Contas, onde o
    // mesmo convidado vale meia unidade para cada anfitrião — por isso
    // esta aba não mostra total nenhum por aniversariante.
    return (g.convidado_por || []).map(String).includes(filtroAtivo);
  }

  function montarLista() {
    if (!ultimaLista) return;
    const { grupos, porGrupo } = ultimaLista;
    const termo = $("#buscaGrupos").value.trim().toLowerCase();

    const visiveis = grupos.filter((g) => {
      const pessoas = porGrupo.get(g.id) || [];
      return combinaFiltro(g, pessoas) && combinaBusca(g, pessoas, termo);
    });

    const filtrando = !!termo || filtroAtivo !== "todos";
    $("#listaVazia").hidden = grupos.length > 0;
    $("#listaSemResultado").hidden = !(grupos.length > 0 && visiveis.length === 0 && filtrando);

    $("#listaGrupos").innerHTML = visiveis.map((g) => cardDoGrupo(g, porGrupo.get(g.id) || [])).join("");
    ligarCards();
  }

  function cardDoGrupo(g, pessoas) {
    const aberto = abertos.has(g.id);
    const anfitrioes = (g.convidado_por || [])
      .map((id) => nomeDoAniversariante(id, "?" + id)).join(", ");
    const linhas = pessoas.map((p, i) => {
      const itens = preferencias(p);
      return `<div class="pessoa-linha">
        <span class="pessoa-linha-nome">${esc(nomeDaPessoa(p, i))}</span>
        <span class="mono pessoa-linha-tipo${p.tipo === "crianca" ? " crianca" : ""}">${p.tipo === "crianca" ? "criança" : "adulto"}</span>
        <span class="mono pessoa-linha-itens">${itens.length ? esc(itens.join(" · ").toLowerCase()) : "—"}</span>
      </div>`;
    }).join("");

    return `<div class="grupo-card">
      <button type="button" class="grupo-topo" data-toggle="${esc(g.id)}" aria-expanded="${aberto}">
        <span class="grupo-quem">
          <b>${esc(g.nome_principal)}</b>
          <span class="mono grupo-meta">${esc(g.contato)}${anfitrioes ? " · convidado por " + esc(anfitrioes) : ""}</span>
        </span>
        <span class="mono grupo-qtd">${pessoas.length}</span>
        <span class="grupo-seta" aria-hidden="true">${aberto ? "▲" : "▼"}</span>
      </button>
      ${aberto ? `<div class="grupo-corpo">
        ${linhas}
        ${g.observacoes ? `<p class="grupo-recado">${esc(g.observacoes)}</p>` : ""}
        <p class="mono grupo-quando">chegou em ${esc(fmtData(g.criado_em))}</p>
        <div class="grupo-acoes">
          ${linkDeContato(g)}
          <button type="button" class="grupo-excluir" data-excluir="${esc(g.id)}">Excluir</button>
        </div>
      </div>` : ""}
    </div>`;
  }

  /* ---- contato -> link ----
     `contato` é o que o convidado digitou. Um wa.me com os dígitos crus
     manda para o país errado: a Rosaura está como 51995509956, e +51 é
     o Peru.

     ⚠️ A decisão é por COMPRIMENTO antes de prefixo, e isso não é
     detalhe: 55 é o DDI do Brasil E o DDD de Santa Maria/RS. Um número
     de lá (55987654321, 11 dígitos) tem que virar 5555987654321. Uma
     regra do tipo "começa com 55, logo já tem DDI" mandaria a mensagem
     para outra pessoa — e Porto Alegre convive com 51, 54 e 55.

     Comprimento desconhecido não vira link: melhor não ter botão do que
     ter botão que abre conversa com desconhecido. */
  function numeroWhats(contato) {
    const bruto = String(contato || "").trim();
    if (bruto.includes("@")) return null;
    const d = bruto.replace(/\D/g, "");

    // O "+" é declaração explícita de DDI e vence qualquer heurística de
    // comprimento. Sem esta saída, +34611223344 (Espanha, 11 dígitos)
    // caía na regra do celular brasileiro e virava 5534611223344 — uma
    // conversa com um desconhecido no Brasil.
    if (bruto.startsWith("+")) return d.length >= 8 && d.length <= 15 ? d : null;

    if (d.length === 10 || d.length === 11) return "55" + d;                  // DDD + número
    if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d; // já tem DDI
    return null;
  }

  function linkDeContato(g) {
    const contato = String(g.contato || "");
    if (contato.includes("@")) {
      return `<a class="grupo-acao" href="mailto:${encodeURIComponent(contato)}">Enviar e-mail</a>`;
    }
    const num = numeroWhats(contato);
    if (!num) return `<span class="grupo-acao grupo-acao-morta">Contato: ${esc(contato)}</span>`;
    return `<a class="grupo-acao" href="https://wa.me/${encodeURIComponent(num)}" target="_blank" rel="noopener">Chamar no WhatsApp</a>`;
  }

  function ligarCards() {
    $$("[data-toggle]").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.toggle;
      if (abertos.has(id)) abertos.delete(id); else abertos.add(id);
      montarLista();
    }));
    $$("[data-excluir]").forEach((b) => b.addEventListener("click", () => excluirGrupo(b.dataset.excluir)));
  }

  async function excluirGrupo(id) {
    const { grupos, porGrupo } = ultimaLista;
    const g = grupos.find((x) => x.id === id);
    if (!g) return;
    const pessoas = porGrupo.get(id) || [];

    // Nomear quem vai sumir, e a consequência. "Tem certeza?" genérico
    // não diz o que se perde.
    const quantas = pessoas.length === 1 ? "a 1 pessoa" : `as ${pessoas.length} pessoas`;
    const frase = `Apagar a confirmação de ${g.nome_principal} e ${quantas} do grupo? ` +
      "Isso não tem como desfazer.";
    if (!confirm(frase)) return;

    // O conteúdo apagado, em texto, montado ANTES de sumir: não é
    // desfazer, mas é o que permite refazer à mão se foi engano.
    const copia = [
      `${g.nome_principal} · ${g.contato}`,
      `convidado por: ${(g.convidado_por || []).map((i) => nomeDoAniversariante(i, "?" + i)).join(", ") || "—"}`,
      ...pessoas.map((p, i) => `- ${nomeDaPessoa(p, i)} (${p.tipo}): ${preferencias(p).join(", ") || "nada"}`),
      g.observacoes ? `recado: ${g.observacoes}` : null,
    ].filter(Boolean).join("\n");

    const { error } = await sb.from("rsvps").delete().eq("id", id);
    if (error) { console.error(error); return toastLista("Não consegui apagar.", "err"); }

    abertos.delete(id);
    toastLista("Apagado. O que sumiu:\n" + copia, "ok");
    // Recarrega em vez de remendar os arrays: é o que garante que Resumo,
    // Compras e Contas mudem junto. Busca e filtro sobrevivem porque
    // moram em variáveis, não no HTML.
    await carregarRSVPs();
  }

  function toastLista(msg, classe) {
    const el = $("#listaMsg");
    el.className = "msg-toast" + (classe ? " " + classe : "");
    el.textContent = msg;
  }

  $("#buscaGrupos").addEventListener("input", montarLista);
  $("#btnLimparBusca").addEventListener("click", () => {
    $("#buscaGrupos").value = "";
    filtroAtivo = "todos";
    montarFiltros();
    montarLista();
  });

  /* ================= FOTOS ================= */
  async function carregarFotos() {
    const grid = $("#fotosGrid");
    const { data, error } = await sb.storage.from(C.supabase.bucketFotos).list("", { limit: 100, sortBy: { column: "name", order: "asc" } });
    if (error) { console.error(error); return; }
    const fotos = (data || []).filter((f) => f.name && !f.name.startsWith(".") && /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name));
    if (!fotos.length) { grid.innerHTML = '<p class="vazio">Nenhuma foto ainda.</p>'; return; }
    grid.innerHTML = fotos.map((f) => {
      const url = sb.storage.from(C.supabase.bucketFotos).getPublicUrl(f.name).data.publicUrl;
      return `<div class="foto-item"><img src="${esc(url)}" alt=""><button data-nome="${esc(f.name)}" title="Apagar">✕</button></div>`;
    }).join("");
    $$(".foto-item button", grid).forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Apagar esta foto?")) return;
      const { error } = await sb.storage.from(C.supabase.bucketFotos).remove([b.dataset.nome]);
      if (error) alert("Erro ao apagar foto."); else carregarFotos();
    }));
  }

  function prepararUpload() {
    const drop = $("#uploadDrop");
    const input = $("#fileInput");
    input.addEventListener("change", () => enviarFotos(input.files));
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("drag"); }));
    drop.addEventListener("drop", (e) => enviarFotos(e.dataTransfer.files));
  }

  async function enviarFotos(files) {
    const msg = $("#fotoMsg");
    const arr = [...files].filter((f) => f.type.startsWith("image/"));
    if (!arr.length) return;
    msg.className = "msg-toast"; msg.textContent = `Enviando ${arr.length} foto(s)...`;
    let ok = 0;
    for (const file of arr) {
      const nome = `${Date.now()}_${limparNome(file.name)}`;
      const { error } = await sb.storage.from(C.supabase.bucketFotos).upload(nome, file, { cacheControl: "3600", upsert: false });
      if (error) console.error(error); else ok++;
    }
    msg.className = "msg-toast ok"; msg.textContent = `${ok} foto(s) enviada(s)!`;
    $("#fileInput").value = "";
    carregarFotos();
  }

  /* ================= HELPERS ================= */
  // Espelha o comportamento visual dos chips do convite. Vive aqui e no
  // main.js: são dois IIFEs sem módulo compartilhado, e a alternativa
  // seria um quarto arquivo só para isto.
  function ativarChips(root) {
    $$(".chip input", root).forEach((inp) => {
      inp.addEventListener("change", () => {
        if (inp.type === "radio" && inp.name) {
          $$(`input[name="${inp.name}"]`, document).forEach((outro) => {
            const chip = outro.closest(".chip");
            if (chip) chip.classList.toggle("marcado", outro.checked);
          });
          return;
        }
        inp.closest(".chip").classList.toggle("marcado", inp.checked);
      });
    });
  }

  function limparNome(n) {
    return n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  }
  // "quando chegou" no fuso da FESTA, não no de quem abre o painel: são 5
  // organizadores e a resposta tem que ser a mesma para todos.
  function fmtData(iso) {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      }).format(d).replace(",", "");
    } catch { return iso; }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
