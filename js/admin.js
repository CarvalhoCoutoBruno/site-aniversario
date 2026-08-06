/* =============================================================
   SITE DE ANIVERSÁRIO — painel do organizador
   ============================================================= */
(function () {
  const C = window.CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const hasSupabase = C.supabase.url && !C.supabase.url.includes("COLE_");
  if (!hasSupabase || !window.supabase) {
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
      password: $("#password").value,
    });
    if (error) { msg.className = "msg-toast err"; msg.textContent = "E-mail ou senha incorretos."; return; }
    showPanel();
  });

  $("#btnSignOut").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });
  $("#btnRefresh").addEventListener("click", async () => {
    await loadParty();
    loadSettings(); loadCelebrants(); loadRSVPs(); loadPhotos();
    stampRefresh();
  });

  /* ================= ABAS =================
     As abas trocam VISIBILIDADE e nada mais: não disparam carregamento.
     Carregar sob demanda derrubaria a guarda de completude do
     recomputar() — a aba Contas renderizaria antes de `pessoas` chegar,
     que é a corrida que a Fatia 4 matou. E não há o que otimizar: são
     ~30 grupos e ~60 pessoas.

     O estado vive no hash: sobrevive ao reload e ao botão voltar, é
     compartilhável, e não guarda nada no aparelho de ninguém. */
  const TABS = ["overview", "guests", "shopping", "accounts", "settings"];
  const DEFAULT_TAB = "overview";

  function tabFromHash() {
    const h = (location.hash || "").replace(/^#/, "");
    return TABS.includes(h) ? h : DEFAULT_TAB;   // hash ausente ou desconhecido cai no padrão
  }

  function showTab(id) {
    for (const a of TABS) {
      $(`#panel-${a}`).hidden = a !== id;
      const botao = $(`#tab-${a}`);
      botao.classList.toggle("active", a === id);
      botao.setAttribute("aria-selected", String(a === id));
    }
    // o conteúdo da aba anterior pode ter deixado a página rolada
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  $$(".ad-tab-btn").forEach((b) => {
    b.addEventListener("click", () => {
      const id = b.dataset.tab;
      // replaceState e não hash direto: um toque em aba não merece uma
      // entrada no histórico, mas a URL precisa refletir onde você está
      history.replaceState(null, "", `#${id}`);
      showTab(id);
    });
  });
  // o voltar/avançar do navegador mexe no hash sem passar pelo clique
  window.addEventListener("hashchange", () => showTab(tabFromHash()));

  /* "atualizado às HH:MM" — a hora do último carregamento nesta sessão,
     que é o que responde "esse número na minha tela está velho?".
     No fuso da festa: o organizador pode estar viajando. */
  function stampRefresh() {
    $("#adUpdatedAt").textContent = "atualizado às " +
      new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(new Date());
  }

  // já logado?
  sb.auth.getSession().then(({ data }) => { if (data.session) showPanel(); });

  /* A trava é sobre REGISTRAR LISTENER, não sobre montar o painel.

     Na Fatia 14 eu tinha travado o mostrarPainel() inteiro, e isso criou
     um caso pior: com uma sessão morta em cache, o getSession() monta o
     painel, a trava fecha, e o login seguinte — bem-sucedido — não
     recarrega nada. O organizador fica olhando um painel vazio depois de
     entrar com a senha certa.

     O que precisava de trava era só o prepararUpload(), que duplicava os
     listeners e fazia um arquivo escolhido subir duas vezes. Recarregar
     dado é idempotente e pode acontecer de novo à vontade. */
  let uploadReady = false;

  async function showPanel() {
    $("#loginBox").hidden = true;
    $("#panel").hidden = false;
    showTab(tabFromHash());
    if (!uploadReady) { uploadReady = true; wireUpload(); }
    // A festa vem PRIMEIRO e sozinha: os nomes dos aniversariantes saem
    // dela, e quem renderiza rótulo (cadastro, seletor de pagador,
    // coluna "convidou") pegaria o fallback se rodasse em paralelo.
    await loadParty();
    loadSettings();
    loadCelebrants();
    loadRSVPs();
    loadPhotos();
    stampRefresh();
  }

  /* ================= CONVITE: o que o convidado vê =================
     Tabela `festa` — a única que o anon lê direto. Aqui só entra o que
     já aparece impresso no convite; preço e custo real seguem na
     `config`, fechada.

     Os nomes dos aniversariantes moram aqui, e a POSIÇÃO é o id usado
     em convidado_por e aniversariante_id. Em colunas nomeadas em vez de
     array, não dá para reordenar sem perceber.                      */

  let lastParty = null;

  const PARTY_FIELDS = ["title", "subtitle", "date_text", "venue", "map_url",
                        "celebrant_1_name", "celebrant_2_name", "celebrant_3_name"];

  // datetime-local <-> timestamptz, sempre em -03:00, mesma disciplina
  // do prazo: o dia sai do fuso de São Paulo, não do navegador.
  function dateToInput(iso) {
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

  const inputToDate = (v) => (v ? `${v}:00-03:00` : null);

  async function loadParty() {
    const { data, error } = await sb.from("party").select("*").eq("id", 1).single();
    if (error || !data) {
      console.error(error);
      return partyToast("Não consegui carregar o convite.", "err");
    }
    lastParty = data;
    for (const col of PARTY_FIELDS) $(`#party_${col}`).value = data[col] || "";
    $("#party_starts_at").value = dateToInput(data.starts_at);
    $("#inviteUpdatedAt").textContent = data.updated_at
      ? `Editado em ${fmtDateTime(data.updated_at)}`
      : "Ainda nos valores originais";
    recompute();
  }

  function partyToast(msg, classe) {
    const el = $("#inviteMsg");
    el.className = "msg-toast" + (classe ? " " + classe : "");
    el.textContent = msg;
  }

  $("#inviteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#btnSaveInvite");
    partyToast("");

    const txt = (id) => $(`#party_${id}`).value.trim();
    const required = [["title", "Título"], ["venue", "Local"],
                          ["celebrant_1_name", "1º aniversariante"],
                          ["celebrant_2_name", "2º aniversariante"],
                          ["celebrant_3_name", "3º aniversariante"]];
    for (const [col, label] of required) {
      if (!txt(col)) return partyFieldError(col, `Preencha "${label}".`);
    }
    if (!$("#party_starts_at").value) return partyFieldError("starts_at", "Escolha a data e a hora da festa.");

    // o link vai direto para o href do convite: um valor colado errado
    // viraria link quebrado na cara do convidado
    const mapUrl = txt("map_url");
    if (mapUrl && !/^https?:\/\//i.test(mapUrl)) {
      return partyFieldError("map_url", "O link do mapa precisa começar com http:// ou https://.");
    }

    const patch = {
      title: txt("title"),
      subtitle: txt("subtitle") || null,
      starts_at: inputToDate($("#party_starts_at").value),
      date_text: txt("date_text") || null,
      venue: txt("venue"),
      map_url: mapUrl || null,
      celebrant_1_name: txt("celebrant_1_name"),
      celebrant_2_name: txt("celebrant_2_name"),
      celebrant_3_name: txt("celebrant_3_name"),
      updated_at: new Date().toISOString(),
    };

    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "Salvando...";
    const { error } = await sb.from("party").update(patch).eq("id", 1);
    btn.disabled = false;
    btn.textContent = label;

    if (error) {
      console.error(error);
      return partyToast("Não consegui salvar o convite.", "err");
    }
    clearDirty("convite");
    partyToast("Convite salvo. ✅ O site já está mostrando isso.", "ok");
    // await antes dos dependentes: os rótulos dos blocos e a coluna
    // "convidou" saem dos nomes, e sem esperar pegariam os antigos.
    await loadParty();
    loadCelebrants();
    loadRSVPs();
  });

  function partyFieldError(col, msg) {
    partyToast(msg, "err");
    const el = $(`#party_${col}`);
    if (el) el.focus();
  }

  /* O rateio rotula as contas com `pessoas.nome`, que é o snapshot de
     quando o aniversariante foi cadastrado. Renomeando no Convite, a
     conta continuaria com o nome velho até alguém re-salvar o cadastro.
     A festa é a fonte única do nome — o snapshot serve só de reserva. */
  function celebrantName(id, reserva) {
    return celebrantNames()[id - 1] || reserva || `Aniversariante ${id}`;
  }

  // nomes dos 3, na ordem — a posição é o id
  function celebrantNames() {
    return lastParty
      ? [lastParty.celebrant_1_name, lastParty.celebrant_2_name, lastParty.celebrant_3_name]
      : ["Aniversariante 1", "Aniversariante 2", "Aniversariante 3"];
  }

  /* ================= CONFIG: preços, taxas e prazo =================
     A linha única de `config` (id=1). Só admin lê e grava — a RLS via
     is_admin() garante no banco; a tela fica atrás do login.        */

  // numeric(10,2) e numeric(6,3) no banco: estourar a faixa volta como
  // erro cru de tipo, então a trava é aqui.
  const MAX_PRICE = 99999999.99;
  const MAX_RATE = 999.999;

  const PRICE_FIELDS = [
    ["beer_price_per_liter", "Chopp (por litro)"],
    ["soda_price_per_liter", "Refrigerante (por litro)"],
    ["water_price_per_liter", "Água (por litro)"],
    ["adult_pizza_price", "Pizza — adulto (por pessoa)"],
    ["child_pizza_price", "Pizza — criança (por pessoa)"],
  ];
  const RATE_FIELDS = [
    ["beer_liters_per_adult", "Chopp por adulto"],
    ["soda_liters_per_person", "Refrigerante por pessoa"],
    ["water_liters_per_person", "Água por pessoa"],
  ];

  /* ---- parsing pt-BR ----
     NÃO reusa o paraCentavos do calc.js: aquele só troca a primeira
     vírgula e serve para valores vindos do banco ("18.00"). Em entrada
     digitada, "1.234,56" viraria 0 silenciosamente.
     Regra: se há vírgula, ela é o decimal e os pontos são milhar;
     sem vírgula, um ponto é decimal. Distingue vazio de inválido para
     a mensagem poder ser específica.                                */
  function parseNumberBR(txt) {
    const s = String(txt == null ? "" : txt).trim();
    if (s === "") return { empty: true, amount: null };
    const norm = s.indexOf(",") >= 0 ? s.replace(/\./g, "").replace(",", ".") : s;
    if (!/^-?\d+(\.\d+)?$/.test(norm)) return { invalido: true, amount: null };
    const n = Number(norm);
    if (!isFinite(n)) return { invalido: true, amount: null };
    return { amount: n };
  }

  function fmtNumberBR(n, minCasas, maxCasas) {
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
  function deadlineToInput(iso) {
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

  const inputToDeadline = (data) => (data ? `${data}T23:59:59-03:00` : null);

  /* ---- montagem dos campos ---- */
  function renderFields(destino, fields, hint) {
    $(destino).innerHTML = fields
      .map(([col, label]) => `
        <label class="config-field">
          <span>${esc(label)}</span>
          <input type="text" inputmode="decimal" id="cfg_${col}"
                 data-coluna="${col}" placeholder="${esc(hint)}" />
        </label>`)
      .join("");
  }

  async function loadSettings() {
    renderFields("#configPrices", PRICE_FIELDS, "0,00");
    renderFields("#configRates", RATE_FIELDS, "0,0");

    const { data, error } = await sb.from("settings").select("*").eq("id", 1).single();
    if (error) {
      console.error(error);
      toast("#pricesMsg", "Não consegui carregar a configuração.", "err");
      return;
    }
    lastSettings = data;   // estimativa e rateio usam a config SALVA, não os inputs
    renderClosingFields();
    fillClosing(data);
    recompute();
    for (const [col] of PRICE_FIELDS) $(`#cfg_${col}`).value = fmtNumberBR(data[col], 2, 2);
    for (const [col] of RATE_FIELDS) $(`#cfg_${col}`).value = fmtNumberBR(data[col], 0, 3);
    $("#cfgDeadline").value = deadlineToInput(data.rsvp_deadline);
  }

  /* ---- salvar ---- */
  /* Um formulário por grupo de colunas. Não é só layout: o `patch` fica
     pequeno porque o formulário é pequeno — em vez de disciplina, vira
     arquitetura. Nenhum patch é montado por varredura de inputs; cada um
     lista as colunas à mão, e `custo_real_*` / `pago_por_*` não aparecem
     em nenhum deles. */

  function readNumbers(fields, maximo, kind, botao, toast) {
    const patch = {};
    for (const [col, label] of fields) {
      const r = parseNumberBR($(`#cfg_${col}`).value);
      // vazio e inválido são erros diferentes e merecem mensagem diferente:
      // deixar vazio virar 0 em silêncio seria zerar preço sem avisar.
      if (r.empty) return { error: [col, `Preencha "${label}". Use 0 se for zero mesmo.`] };
      if (r.invalido) return { error: [col, `"${label}" não é um número válido.`] };
      if (r.amount < 0) return { error: [col, `"${label}" não pode ser negativo.`] };
      if (r.amount > maximo) {
        return { error: [col, `"${label}" passou do máximo aceito para ${kind} (${fmtNumberBR(maximo, 2, 3)}).`] };
      }
      patch[col] = r.amount;
    }
    return { patch };
  }

  async function saveSettings(patch, botao, toastEl, dirtyBlock) {
    patch.updated_at = new Date().toISOString();
    botao.disabled = true;
    const anterior = botao.textContent;
    botao.textContent = "Salvando...";
    const { error } = await sb.from("settings").update(patch).eq("id", 1);
    botao.disabled = false;
    botao.textContent = anterior;

    if (error) {
      console.error(error);
      toast(toastEl, "Não consegui salvar. Confira os valores e tente de novo.", "err");
      return false;
    }
    toast(toastEl, "Salvo. ✅", "ok");
    clearDirty(dirtyBlock);
    loadSettings();
    return true;
  }

  /* ================= "não salvo" =================
     Liga no `input` do usuário, NUNCA no preenchimento programático do
     carregarConfig()/carregarConvite() — senão o bloco nasce sujo. Por
     isso a marcação é por evento de digitação e a limpeza é explícita,
     depois de salvar.

     Trocar de aba não perde edição pendente: as abas são troca de
     visibilidade e o input segue no DOM com o valor digitado. O marcador
     existe para a recarga e o logout. */
  function markDirty(block) {
    const el = document.querySelector(`.aj-block[data-aj="${block}"] .aj-dirty`);
    if (el) el.hidden = false;
  }

  function clearDirty(block) {
    const el = document.querySelector(`.aj-block[data-aj="${block}"] .aj-dirty`);
    if (el) el.hidden = true;
  }

  $$(".aj-block[data-aj]").forEach((bl) => {
    const name = bl.dataset.aj;
    bl.addEventListener("input", () => markDirty(name));
  });

  $$("[data-aj-toggle]").forEach((b) => b.addEventListener("click", () => {
    const block = b.closest(".aj-block");
    const corpo = block.querySelector(".aj-body");
    const abrindo = corpo.hidden;
    corpo.hidden = !abrindo;
    b.setAttribute("aria-expanded", String(abrindo));
    block.querySelector(".aj-arrow").innerHTML = abrindo ? "&#9650;" : "&#9660;";
  }));

  function toast(sel, msg, classe) {
    const el = $(sel);
    if (!el) return;
    el.className = "msg-toast" + (classe ? " " + classe : "");
    el.textContent = msg;
  }

  $("#pricesForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    toast("#pricesMsg", "");
    const r = readNumbers(PRICE_FIELDS, MAX_PRICE, "preço");
    if (r.error) return fieldError("#pricesMsg", r.error[0], r.error[1]);
    await saveSettings(r.patch, $("#btnSavePrices"), "#pricesMsg", "precos");
  });

  $("#ratesForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    toast("#ratesMsg", "");
    const r = readNumbers(RATE_FIELDS, MAX_RATE, "taxa");
    if (r.error) return fieldError("#ratesMsg", r.error[0], r.error[1]);
    await saveSettings(r.patch, $("#btnSaveRates"), "#ratesMsg", "taxas");
  });

  $("#deadlineForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    toast("#deadlineMsg", "");
    // uma coluna só: o update mais estreito do painel
    await saveSettings({ rsvp_deadline: inputToDeadline($("#cfgDeadline").value) },
                       $("#btnSaveDeadline"), "#deadlineMsg", "prazo");
  });

  function fieldError(toastEl, col, msg) {
    toast(toastEl, msg, "err");
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

  const CELEBRANT_DRINKS = [
    ["wants_water", "Água"],
    ["wants_soda", "Refrigerante"],
    ["wants_beer", "Chopp"],
  ];

  // aniversariante_id -> id da linha em `pessoas` (ausente = ainda não cadastrado)
  const celebrantRowId = new Map();

  function renderCelebrantBlocks() {
    $("#celebrantBlocks").innerHTML = celebrantNames()
      .map((name, i) => {
        const k = i + 1;
        return `
        <fieldset class="config-block celebrant-block" data-aniv="${k}">
          <legend>${esc(name)} <small>(id ${k})</small></legend>
          <div class="person-prefs">
            <div class="pref-group">
              <span class="pref-title">🎂 Idade</span>
              <div class="pref-chips a-kind">
                <label class="chip checked">
                  <input type="radio" name="celebrant-kind-${k}" value="adult" checked /><span>Adulto</span>
                </label>
                <label class="chip">
                  <input type="radio" name="celebrant-kind-${k}" value="child" /><span>Criança</span>
                </label>
              </div>
            </div>
            <div class="pref-group">
              <span class="pref-title">🥤 Bebidas</span>
              <div class="pref-chips a-drinks">
                ${CELEBRANT_DRINKS.map(([col, label]) => `
                  <label class="chip${col === "wants_beer" ? " a-chip-beer" : ""}">
                    <input type="checkbox" data-col="${col}" /><span>${esc(label)}</span>
                  </label>`).join("")}
              </div>
              <small class="field-hint a-beer-warning" hidden>Chopp só para adultos.</small>
            </div>
            <div class="pref-group">
              <span class="pref-title">🍕 Comida</span>
              <div class="pref-chips a-food">
                <label class="chip"><input type="checkbox" data-col="wants_pizza" /><span>Pizza</span></label>
              </div>
            </div>
          </div>
        </fieldset>`;
      })
      .join("");

    $$(".celebrant-block").forEach((block) => {
      enableChips(block);
      enableCelebrantBeerRule(block);
    });
  }

  /* Espelho de UX da constraint chopp_nao_para_crianca. A fonte da
     verdade da regra é o banco; isto só evita o erro cru na tela. */
  function enableCelebrantBeerRule(block) {
    const beer = block.querySelector('[data-col="wants_beer"]');
    const chip = block.querySelector(".a-chip-chopp");
    const warning = block.querySelector(".a-beer-warning");
    function aplicar() {
      const isChild = block.querySelector('.a-kind input[value="child"]').checked;
      beer.disabled = isChild;
      chip.classList.toggle("disabled", isChild);
      warning.hidden = !isChild;
      if (isChild && beer.checked) {
        beer.checked = false;
        chip.classList.remove("checked");
      }
    }
    $$(".a-kind input", block).forEach((r) => r.addEventListener("change", aplicar));
    aplicar();
  }

  function setChip(input, ligado) {
    input.checked = ligado;
    input.closest(".chip").classList.toggle("checked", ligado);
  }

  async function loadCelebrants() {
    renderCelebrantBlocks();
    celebrantRowId.clear();

    const { data, error } = await sb.from("people").select("*").eq("role", "celebrant");
    if (error) {
      console.error(error);
      return celebrantToast("Não consegui carregar os aniversariantes.", "err");
    }

    for (const p of data || []) {
      if (!p.celebrant_id) continue;
      celebrantRowId.set(p.celebrant_id, p.id);
      const block = $(`.celebrant-block[data-aniv="${p.celebrant_id}"]`);
      if (!block) continue; // linha órfã: id sem nome correspondente no config.js

      const radio = block.querySelector(`.a-kind input[value="${p.age_group}"]`);
      if (radio) { radio.checked = true; $$(".a-kind .chip", block).forEach((c) => c.classList.remove("checked")); radio.closest(".chip").classList.add("checked"); }
      for (const [col] of CELEBRANT_DRINKS) setChip(block.querySelector(`[data-col="${col}"]`), !!p[col]);
      setChip(block.querySelector('[data-col="wants_pizza"]'), !!p.wants_pizza);
      enableCelebrantBeerRule(block); // reaplica: se veio criança, o chopp precisa travar
    }
  }

  function celebrantToast(msg, classe) {
    const el = $("#celebrantMsg");
    el.className = "msg-toast" + (classe ? " " + classe : "");
    el.textContent = msg;
  }

  $("#celebrantForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#btnSaveCelebrant");
    celebrantToast("");
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "Salvando...";

    let error = null;
    for (const block of $$(".celebrant-block")) {
      const k = Number(block.dataset.aniv);
      const ageGroup = block.querySelector('.a-kind input[value="child"]').checked ? "child" : "adult";
      const registro = {
        // `nome` fica de fora de propósito: a linha de aniversariante NÃO
        // guarda nome. A `festa` é a fonte única, e quem alimenta o
        // calc.js resolve pelo pessoasParaCalculo(). Gravar aqui
        // repopularia a coluna e a divergência voltaria pelo outro lado.
        age_group: ageGroup,
        role: "celebrant",
        celebrant_id: k,
        wants_pizza: block.querySelector('[data-col="wants_pizza"]').checked,
      };
      for (const [col] of CELEBRANT_DRINKS) registro[col] = block.querySelector(`[data-col="${col}"]`).checked;
      if (kind === "child") registro.wants_beer = false; // cinto e suspensório
      // rsvp_id fica de fora de propósito: aniversariante vive sem grupo
      // (constraint aniversariante_sem_grupo).

      const existente = celebrantRowId.get(k);
      const r = existente
        ? await sb.from("people").update(registro).eq("id", existente)
        : await sb.from("people").insert(registro);
      if (r.error) { error = r.error; break; }
    }

    btn.disabled = false;
    btn.textContent = label;

    if (error) {
      console.error(error);
      const m = String(error.message || "");
      if (/pessoas_aniversariante_id_unico|duplicate key/i.test(m)) {
        celebrantToast("Alguém acabou de cadastrar por outra tela. Recarregue e tente de novo.", "err");
      } else if (/chopp_nao_para_crianca/.test(m)) {
        celebrantToast("Chopp não é liberado para criança.", "err");
      } else {
        celebrantToast("Não consegui salvar. Tente de novo.", "err");
      }
      return;
    }

    clearDirty("aniversariantes");
    celebrantToast("Aniversariantes salvos. ✅", "ok");
    await loadCelebrants();
    loadRSVPs(); // a contagem "cadastrados: N/3" vive nas estatísticas
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

  let lastSettings = null;
  let lastPeople = null;
  let lastGroups = null;
  let lastOverview = null;

  const fmtLiters = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

  function cartao(amount, label) {
    return `<div class="stat"><b>${esc(String(amount))}</b><span>${esc(label)}</span></div>`;
  }

  // Guarda de completude única: os carregadores rodam em paralelo, e
  // tanto a estimativa quanto o rateio precisam do conjunto inteiro.
  // Quem chegar por último dispara os dois.
  function recompute() {
    // ultimaFesta entra na guarda: os nomes dos aniversariantes vêm
    // dela, e o rateio/acerto rotula as contas com esses nomes.
    if (!lastSettings || !lastPeople || !lastGroups || !lastParty) return;
    refreshEstimate();
    refreshSplit();
    // o Resumo é remontado aqui porque a barra do prazo só existe com a
    // config na mão, e o render() pode ter rodado antes dela chegar
    if (lastOverview) renderOverview(lastOverview.groups, lastOverview.todas, lastOverview.cont);
  }

  /* ================= ABA "COMPRAS" =================
     Só leitura, sobre a mesma Calculo.estimativa() de sempre. */

  function refreshEstimate() {
    if (!lastSettings || !lastPeople) return;
    const e = Calc.estimate(peopleForCalc(), lastSettings);
    const c = e.counts;

    // Litro é litro: NÃO arredondo para barril. Quantos barris comprar é
    // decisão do organizador com o fornecedor, e embutir isso aqui
    // esconderia uma regra de negócio dentro de um texto.
    const items = [
      ["Chopp", fmtLiters(e.beerLiters) + " L"],
      ["Refrigerante", fmtLiters(e.sodaLiters) + " L"],
      ["Água", fmtLiters(e.waterLiters) + " L"],
      ["Pizza (adulto)", String(e.adultPizzas)],
      ["Pizza (criança)", String(e.childPizzas)],
    ];

    $("#shoppingBase").textContent =
      `Calculada sobre ${c.totalPeople} ${c.totalPeople === 1 ? "confirmado" : "confirmados"}, ` +
      "aniversariantes incluídos.";
    $("#shoppingList").innerHTML = items.map(([name, amount]) => `
      <div class="shopping-row">
        <span>${esc(name)}</span>
        <b class="mono">${esc(amount)}</b>
      </div>`).join("");
    $("#shoppingCost").textContent = Calc.formatBRL(e.estimatedCost);

    // Com os preços ainda nas sementes (0), o custo sai zerado. Os
    // volumes seguem úteis; a tela avisa em vez de deixar o organizador
    // achar que a conta quebrou.
    const prices = ["beer_price_per_liter", "soda_price_per_liter", "water_price_per_liter",
                    "adult_pizza_price", "child_pizza_price"];
    const noPrices = prices.every((k) => Number(lastSettings[k]) === 0);
    const warning = $("#shoppingWarning");
    warning.hidden = !noPrices;
    warning.className = "msg-toast" + (noPrices ? " err" : "");
    warning.textContent = noPrices
      ? "Os preços ainda estão zerados em Ajustes — os volumes valem, o custo não."
      : "";

    $("#shoppingText").value = supplierText(items, c.totalPeople);
  }

  /* Texto para colar no WhatsApp do fornecedor. Sem preço: é lista, não
     orçamento. Com a data no cabeçalho, que é a primeira coisa que o
     fornecedor pergunta. */
  function supplierText(items, total) {
    const f = lastParty;
    return [
      `${(f && f.title) || "Party"}${partyWhen(f) ? " — " + partyWhen(f) : ""}`,
      "Lista de compra",
      "",
      ...items.map(([name, amount]) => `${name}: ${amount}`),
      "",
      `Base: ${total} ${total === 1 ? "confirmado" : "confirmados"}`,
    ].join("\n");
  }

  // "31/10/2026, sábado, 11h" — no fuso da festa, não no de quem clica
  function partyWhen(f) {
    if (!f || !f.starts_at) return "";
    const d = new Date(f.starts_at);
    if (isNaN(d)) return "";
    const partes = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", hour12: false,
      weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).formatToParts(d);
    const g = (t) => (partes.find((x) => x.type === t) || {}).value || "";
    const hour = g("minute") === "00" ? `${g("hour")}h` : `${g("hour")}h${g("minute")}`;
    return `${g("day")}/${g("month")}/${g("year")}, ${g("weekday")}, ${hour}`;
  }

  $("#btnCopyShopping").addEventListener("click", async () => {
    const text = $("#shoppingText").value;
    const msg = $("#shoppingCopyMsg");
    try {
      // exige contexto seguro e pode ser negada pelo usuário
      await navigator.clipboard.writeText(text);
      msg.textContent = "Copiado! ✅";
    } catch (e) {
      // sem saída melhor que mostrar erro: expõe o texto para copiar na mão
      console.warn("clipboard indisponível:", e);
      const area = $("#shoppingText");
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

  const COST_FIELDS = [
    ["actual_beer_cost", "Chopp"],
    ["actual_soda_cost", "Refrigerante"],
    ["actual_water_cost", "Água"],
  ];
  const ACTUAL_PIZZA_FIELDS = [
    ["actual_adult_pizza_price", "Pizza — adulto (por pessoa)"],
    ["actual_child_pizza_price", "Pizza — criança (por pessoa)"],
  ];

  function renderClosingFields() {
    const field = ([col, label]) => `
      <label class="config-field">
        <span>${esc(label)}</span>
        <input type="text" inputmode="decimal" id="fec_${col}" class="ct-unknown" placeholder="não sei" />
      </label>`;
    $("#closingCosts").innerHTML = COST_FIELDS.map(field).join("");
    $("#closingPizzas").innerHTML = ACTUAL_PIZZA_FIELDS.map(field).join("");
  }

  function fillClosing(cfg) {
    for (const [col] of [...COST_FIELDS, ...ACTUAL_PIZZA_FIELDS]) {
      const el = $(`#fec_${col}`);
      if (!el) continue;
      const empty = cfg[col] === null || cfg[col] === undefined;
      el.value = empty ? "" : fmtNumberBR(cfg[col], 2, 2);
      // borda âmbar enquanto é "ainda não sei": o field em branco aqui não
      // é erro nem zero, é uma pendência — e tem que parecer uma.
      el.classList.toggle("pending", empty);
    }
  }

  function closingToast(msg, classe) {
    const el = $("#closingMsg");
    el.className = "msg-toast" + (classe ? " " + classe : "");
    el.textContent = msg;
  }

  /* ---- salvar: update estreito, só os 5 campos de fechamento ----
     Vazio = NULL aqui, ao contrário da Fatia 2: lá vazio era
     esquecimento e se recusava; aqui significa "ainda não fechei". */
  $("#closingForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#btnSaveClosing");
    closingToast("");

    const patch = {};
    for (const [col, label] of [...COST_FIELDS, ...ACTUAL_PIZZA_FIELDS]) {
      const r = parseNumberBR($(`#fec_${col}`).value);
      if (r.empty) { patch[col] = null; continue; }
      if (r.invalido) return closingFieldError(col, `"${label}" não é um número válido.`);
      if (r.amount < 0) return closingFieldError(col, `"${label}" não pode ser negativo.`);
      if (r.amount > MAX_PRICE) {
        return closingFieldError(col, `"${label}" passou do máximo aceito (${fmtNumberBR(MAX_PRICE, 2, 2)}).`);
      }
      patch[col] = r.amount;
    }
    patch.updated_at = new Date().toISOString();

    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "Salvando...";
    const { error } = await sb.from("settings").update(patch).eq("id", 1);
    btn.disabled = false;
    btn.textContent = label;

    if (error) {
      console.error(error);
      return closingToast("Não consegui salvar. Confira os valores e tente de novo.", "err");
    }
    closingToast("Fechamento salvo. ✅", "ok");
    loadSettings(); // recarrega a config e recomputa o rateio
  });

  function closingFieldError(col, msg) {
    closingToast(msg, "err");
    const el = $(`#fec_${col}`);
    if (el) el.focus();
  }

  /* ---- o rateio (só leitura) ---- */
  const ACCOUNT_ITEMS = [["beer", "Chopp"], ["soda", "Refri"], ["water", "Água"], ["pizza", "Pizza"]];

  /* ================= O CONTRATO COM O calc.js =================
     O módulo é PURO: dado entra, número sai. Não é papel dele saber onde
     o nome do aniversariante mora — é papel de quem chama entregar o dado
     já resolvido.

     Por isso a linha de aniversariante em `pessoas` tem `nome` NULO: a
     `festa` é a fonte única. Este helper resolve o nome antes de o dado
     entrar na conta, e TODO ponto que alimenta o módulo passa por aqui —
     não há `.map()` inline espalhado.

     Sem isto, o resumoAcerto() montaria a frase do WhatsApp com
     "Aniversariante 1 → Aniversariante 3", porque ele lê o nome de dentro
     do que recebeu. Consertar depois, na tela, seria derivar número (ou
     texto) fora do módulo — que é justamente o que não se faz aqui. */
  function peopleForCalc() {
    return (lastPeople || []).map((p) =>
      p.role === "celebrant" && p.celebrant_id
        ? { ...p, name: celebrantName(p.celebrant_id, p.name) }
        : p);
  }

  function refreshSplit() {
    if (!lastSettings || !lastPeople || !lastGroups) return;
    const r = Calc.split(peopleForCalc(), lastSettings, lastGroups);

    $("#closingAccounts").innerHTML = r.perCelebrant.length
      ? r.perCelebrant.map((a) => {
          const items = ACCOUNT_ITEMS
            .filter(([k]) => a.breakdown[k] > 0)
            .map(([k, rot]) => `<span class="ct-item"><span>${esc(rot)}</span><b class="mono">${esc(Calc.formatBRL(a.breakdown[k]))}</b></span>`)
            .join("");
          return `<div class="ct-account">
            <div class="ct-account-top">
              <b>${esc(a.name)}</b>
              <b class="mono ct-account-total">${esc(Calc.formatBRL(a.total))}</b>
            </div>
            <div class="ct-items">${items || '<span class="ct-none">não consumiu nada</span>'}</div>
          </div>`;
        }).join("")
      : '<p class="empty">Nenhum aniversariante cadastrado ainda.</p>';

    // os dois números que têm de coincidir para o selo ficar azul
    $("#closingTotals").innerHTML = `
      <div class="ct-total-row"><span>Total gasto</span><b class="mono">${esc(Calc.formatBRL(r.actualCostTotal))}</b></div>
      <div class="ct-total-row"><span>Total rateado</span><b class="mono">${esc(Calc.formatBRL(r.splitTotal))}</b></div>`;

    renderPayers(r.costPerItem);
    fillPayers(lastSettings);
    refreshSettlement(r);
  }

  /* ================= ACERTO: quem deve a quem =================
     O rateio diz quanto cada aniversariante DEVE. Aqui se registra
     quanto cada um PAGOU — só o pagador de cada item; o valor vem do
     custo já calculado no fechamento.

     ⚠️ O acerto só fecha quando o rateio CONFERE. Se o fechamento tem
     custo órfão, Σ deve ≠ Σ pagou, os saldos não somam zero e as
     transferências não quitariam nada. Checar só "todo item tem pagador"
     produziria um acerto silenciosamente errado.                    */

  /* As 4 fases do selo. O gatilho e o TEXTO do impedimento vêm do
     módulo — a tela não reescreve motivo nenhum. */
  function settlementPhase(r, a) {
    if (!r.closingComplete) return "pending";
    if (!r.balances) return "nao-confere";
    if (a.missingPayer.length) return "falta-pagador";
    return "completo";
  }

  const BADGE = {
    "pending":      { icone: "○", classe: "pending" },
    "nao-confere":   { icone: "!", classe: "error" },
    "falta-pagador": { icone: "✓", classe: "ok" },
    "completo":      { icone: "✓", classe: "ok" },
  };

  function refreshSettlement(splitResult) {
    const paidBy = {};
    for (const [col, item] of PAID_BY_FIELDS) paidBy[item] = lastSettings[col];
    const a = Calc.settlement(splitResult, paidBy);
    const fase = settlementPhase(splitResult, a);

    const badge = $("#closingBadge");
    badge.hidden = false;
    badge.dataset.fase = fase;
    badge.className = "ct-badge " + BADGE[fase].classe;
    badge.innerHTML =
      `<span class="ct-badge-icon" aria-hidden="true">${BADGE[fase].icone}</span>` +
      `<span>${esc(fase === "completo"
        ? "As accounts fecham: a sum do que cada um paga bate com o gasto total, até o cents."
        : a.reason)}</span>`;

    $("#settlementBalances").innerHTML = a.balancesPerCelebrant.map((s) => {
      const label = s.balance > 0 ? "a pagar" : s.balance < 0 ? "a receber" : "quite";
      const classe = s.balance > 0 ? "to-pay" : s.balance < 0 ? "to-receive" : "";
      return `<div class="ct-account">
        <div class="ct-account-top">
          <b>${esc(s.name)}</b>
          <b class="mono ct-account-total ${classe}">${esc(Calc.formatBRL(Math.abs(s.balance)))} <small>${label}</small></b>
        </div>
        <div class="ct-items">
          <span class="ct-item"><span>deve</span><b class="mono">${esc(Calc.formatBRL(s.owes))}</b></span>
          <span class="ct-item"><span>pagou</span><b class="mono">${esc(Calc.formatBRL(s.paid))}</b></span>
        </div>
      </div>`;
    }).join("");

    const list = $("#settlementTransferencias");

    // Antes do return: se ficasse depois, o acerto voltando a incompleto
    // deixaria o botão de compartilhar na tela com o texto anterior —
    // pronto para mandar no grupo um acerto que não vale mais.
    prepareShare(a);

    if (a.status !== "completo") { list.innerHTML = ""; return; }
    list.innerHTML = a.transfers.length
      ? `<ul class="ct-transfers">${a.transfers.map((t) =>
          `<li><b>${esc(t.fromName)}</b> → <b>${esc(t.toName)}</b><b class="mono">${esc(Calc.formatBRL(t.amount))}</b></li>`
        ).join("")}</ul>`
      : '<p class="res-note">Ninguém deve nada a ninguém — cada um pagou exatamente a própria parte. 🎉</p>';
  }

  const PAID_BY_FIELDS = [
    ["beer_paid_by", "beer", "Chopp"],
    ["soda_paid_by", "soda", "Refrigerante"],
    ["water_paid_by", "water", "Água"],
    ["pizza_paid_by", "pizza", "Pizza"],
  ];

  function renderPayers(costPerItem) {
    const names = celebrantNames();
    $("#settlementPayers").innerHTML = PAID_BY_FIELDS
      .map(([col, item, label]) => {
        // o valor ao lado vem do módulo (custosPorItem); ninguém digita
        const amount = costPerItem ? Calc.formatBRL(costPerItem[item] || 0) : "";
        const options = names.map((name, i) =>
          `<button type="button" class="ct-option" data-col="${col}" data-id="${i + 1}">${esc(name)}</button>`
        ).join("");
        return `<div class="ct-payer">
          <div class="ct-payer-top">
            <b>${esc(label)}</b>
            <span class="mono ct-payer-amount">${esc(amount)}</span>
          </div>
          <div class="ct-options" data-grupo="${col}">${options}</div>
        </div>`;
      })
      .join("");

    // clicar de novo no escolhido volta para "ninguém": sem isso não há
    // como desfazer uma escolha errada sem recarregar
    $$(".ct-option").forEach((b) => b.addEventListener("click", () => {
      const group = b.closest(".ct-options");
      const jaEra = b.classList.contains("chosen");
      $$(".ct-option", group).forEach((o) => o.classList.remove("chosen"));
      if (!jaEra) b.classList.add("chosen");
    }));
  }

  function fillPayers(cfg) {
    for (const [col] of PAID_BY_FIELDS) {
      const group = document.querySelector(`.ct-options[data-grupo="${col}"]`);
      if (!group) continue;
      const amount = cfg[col] === null || cfg[col] === undefined ? "" : String(cfg[col]);
      $$(".ct-option", group).forEach((b) => b.classList.toggle("chosen", b.dataset.id === amount));
    }
  }

  // lê os botões em vez do <select> que saiu
  function chosenPayer(col) {
    const b = document.querySelector(`.ct-options[data-grupo="${col}"] .ct-option.chosen`);
    return b ? Number(b.dataset.id) : null;
  }

  function settlementToast(msg, classe) {
    const el = $("#settlementMsg");
    el.className = "msg-toast" + (classe ? " " + classe : "");
    el.textContent = msg;
  }

  $("#settlementForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#btnSaveSettlement");
    settlementToast("");

    // update estreito: só os 4 pago_por. Nunca encosta em custo_real_*
    // (Fatia 5) nem nos campos da Fatia 2.
    const patch = { updated_at: new Date().toISOString() };
    for (const [col] of PAID_BY_FIELDS) {
      patch[col] = chosenPayer(col);   // null = ninguém escolhido ainda
    }

    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "Salvando...";
    const { error } = await sb.from("settings").update(patch).eq("id", 1);
    btn.disabled = false;
    btn.textContent = label;

    if (error) {
      console.error(error);
      return settlementToast("Não consegui salvar quem pagou.", "err");
    }
    settlementToast("Pagadores salvos. ✅", "ok");
    loadSettings();
  });

  /* ---- compartilhar o acerto ----
     Só aparece com o acerto completo: sem acerto fechado não há o que
     mandar no grupo. O texto sai do resumoAcerto (puro e testado), não
     é montado aqui. */
  function prepareShare(a) {
    const caixa = $("#settlementShare");
    const text = Calc.settlementSummary(a, `${(lastParty && lastParty.title) || "A party"} 🎉`);
    caixa.hidden = !text;
    $("#settlementText").hidden = true;
    $("#settlementCopyMsg").textContent = "";
    if (!text) return;

    $("#settlementText").value = text;
    // wa.me sem número: o organizador escolhe o contato ou o grupo
    $("#btnWhatsSettlement").href = "https://wa.me/?text=" + encodeURIComponent(text);
  }

  $("#btnCopySettlement").addEventListener("click", async () => {
    const text = $("#settlementText").value;
    const msg = $("#settlementCopyMsg");
    try {
      // exige contexto seguro e pode ser negada pelo usuário
      await navigator.clipboard.writeText(text);
      msg.textContent = "Copiado! ✅";
    } catch (e) {
      // sem saída melhor que mostrar erro: expõe o texto para copiar na mão
      console.warn("clipboard indisponível:", e);
      const area = $("#settlementText");
      area.hidden = false;
      area.select();
      msg.textContent = "Não consegui copiar sozinho — o texto está aí embaixo, selecionado.";
    }
  });

  /* ================= CONFIRMAÇÕES =================
     Lê o schema novo: rsvps + pessoas por FK. As telas de config,
     aniversariantes, estimativa e fechamento são as Fatias 2 a 5 —
     aqui só a lista e as contagens.                                */
  async function loadRSVPs() {
    const [g, p] = await Promise.all([
      sb.from("rsvps").select("*").order("created_at", { ascending: false }),
      sb.from("people").select("*").order("sort_order", { ascending: true }),
    ]);
    if (g.error || p.error) { console.error(g.error || p.error); return; }

    const byGroup = new Map();
    const celebrants = [];
    for (const person of p.data || []) {
      if (person.role === "celebrant") { celebrants.push(person); continue; }
      if (!byGroup.has(person.rsvp_id)) byGroup.set(person.rsvp_id, []);
      byGroup.get(person.rsvp_id).push(person);
    }
    lastPeople = p.data || [];   // TODAS: as de grupo e as 3 de aniversariante
    lastGroups = g.data || [];    // o elo convidado -> pagante (convidado_por)
    recompute();
    render(g.data || [], byGroup, celebrants);
  }

  /* ================= ABA RESUMO =================
     Só leitura, e tudo sai do que o render() já calculou — nenhuma
     consulta nova. */

  const CONSUMO_CORES = {
    "Água": "var(--ad-azul)", "Refri": "#7c5a1e", "Chopp": "#14110d", "Pizza": "var(--ad-vermelho)",
  };

  function renderOverview(groups, todas, cont) {
    $("#resConfirmed").textContent = todas.length;
    $("#resBreakdown").textContent =
      `${cont.adults} ${cont.adults === 1 ? "adulto" : "adultos"} · ` +
      `${cont.children} ${cont.children === 1 ? "criança" : "crianças"}`;
    $("#resGroups").textContent = groups.length;

    renderDeadlineBar(groups);

    // barra proporcional ao total de pessoas; 0 pessoas não divide por zero
    const base = todas.length || 1;
    const items = [["Água", cont.water], ["Refri", cont.soda], ["Chopp", cont.beer], ["Pizza", cont.pizza]];
    $("#resConsumption").innerHTML = items.map(([name, n]) => `
      <div class="res-row">
        <span class="res-row-name">${esc(name)}</span>
        <div class="res-bar">
          <div class="res-bar-fill" style="width:${Math.round((n / base) * 100)}%;background:${CONSUMO_CORES[name]}"></div>
        </div>
        <span class="mono res-row-n">${n}</span>
      </div>`).join("");

    renderNotes(groups);
  }

  /* A régua da barra: da PRIMEIRA confirmação recebida até o prazo. Não
     existe "data de abertura" no schema, e essa é a origem que responde
     "quanto do período já passou" com dado real. Sem confirmação ainda,
     a barra não aparece — só a data e o "faltam N dias". */
  function renderDeadlineBar(groups) {
    const block = $("#resDeadlineBlock");
    const deadline = lastSettings && lastSettings.rsvp_deadline
      ? new Date(lastSettings.rsvp_deadline) : null;
    if (!deadline || isNaN(deadline)) { block.hidden = true; return; }
    block.hidden = false;

    $("#resDeadlineDate").textContent = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
    }).format(deadline);

    const agora = Date.now();
    const restaMs = deadline.getTime() - agora;
    const days = Math.ceil(restaMs / 864e5);
    const vencido = restaMs <= 0;

    const primeira = groups.reduce((min, g) => {
      const t = new Date(g.created_at).getTime();
      return isNaN(t) ? min : Math.min(min, t);
    }, Infinity);

    const wrap = $("#resDeadlineBarWrap");
    if (primeira === Infinity) {
      wrap.hidden = true;                       // ninguém confirmou: não há régua
    } else {
      wrap.hidden = false;
      const total = deadline.getTime() - primeira;
      // vencido trava em 100%: a barra não passa do fim
      const pct = vencido || total <= 0 ? 100
        : Math.max(0, Math.min(100, ((agora - primeira) / total) * 100));
      $("#resDeadlineBar").style.width = pct.toFixed(1) + "%";
      $("#resDeadlineBar").classList.toggle("full", vencido);
    }

    // e nada de "faltam -3 dias"
    $("#resDeadlineNote").innerHTML = vencido
      ? "As confirmações estão <b>encerradas</b>."
      : `Faltam <b>${days} ${days === 1 ? "dia" : "dias"}</b> para fechar as confirmações.`;
  }

  // O que separa restrição de recado é o que muda a compra.
  const RESTRICAO = /alergi|intoler|restri|cel[ií]ac|vegetarian|vegan|di?abet|lactose|gl[úu]ten/i;

  function renderNotes(groups) {
    const comRecado = groups.filter((g) => g.notes && g.notes.trim());
    $("#resNotesNote").textContent = comRecado.length
      ? `${comRecado.length} ${comRecado.length === 1 ? "person escreveu" : "people escreveram"} algo.`
      : "Ninguém escreveu nada ainda.";
    // esc() em tudo: é texto que o convidado escreveu
    $("#resNotes").innerHTML = comRecado.map((g) => `
      <div class="res-note${RESTRICAO.test(g.notes) ? " restriction" : ""}">
        <span class="res-note-who">${esc(g.lead_name)}</span>
        <span class="res-note-txt">${esc(g.notes)}</span>
      </div>`).join("");
  }

  const DRINK_NAMES = { wants_water: "Água", wants_soda: "Refri", wants_beer: "Chopp" };

  function preferences(person) {
    const t = Object.keys(DRINK_NAMES).filter((k) => person[k]).map((k) => DRINK_NAMES[k]);
    if (person.wants_pizza) t.push("Pizza");
    return t;
  }

  function render(groups, byGroup, celebrants) {
    // contagens sobre TODAS as pessoas confirmadas, aniversariantes incluídos
    const todas = [...celebrants];
    for (const list of byGroup.values()) todas.push(...list);

    const cont = { water: 0, soda: 0, beer: 0, pizza: 0, adults: 0, children: 0 };
    for (const p of todas) {
      if (p.age_group === "adult") cont.adults++; else cont.children++;
      if (p.wants_water) cont.water++;
      if (p.wants_soda) cont.soda++;
      if (p.wants_beer && p.age_group === "adult") cont.beer++;
      if (p.wants_pizza) cont.pizza++;
    }

    // guardado para o recomputar(): a barra do prazo depende de
    // `ultimaConfig`, que pode chegar DEPOIS de render() — é a guarda de
    // completude em miniatura, e a solução é a mesma, não calcular com
    // metade do estado.
    lastOverview = { groups, todas, cont };
    renderOverview(groups, todas, cont);

    // busca e filtro NÃO são remontados aqui: moram em variáveis, então
    // sobrevivem à recarga que o excluir dispara. Perder a busca no meio
    // de uma limpeza seria irritante justamente na pior hora.
    lastList = { groups, byGroup };
    renderFilters();
    renderList();
  }

  /* ================= ABA "QUEM VEM" =================
     Um card por grupo, expansível. A tabela de 7 colunas saiu: no
     celular — que é onde o painel é usado — ela era ilegível. */

  let activeFilter = "all";             // "all" | "children" | "1" | "2" | "3"
  const openCards = new Set();           // ids dos cards expandidos
  let lastList = null;              // { grupos, porGrupo } do último carregamento

  function renderFilters() {
    const names = celebrantNames();
    const defs = [["all", "Todos"], ["children", "Com crianças"],
                  ["1", names[0]], ["2", names[1]], ["3", names[2]]];
    $("#filtersGroups").innerHTML = defs.map(([id, name]) =>
      `<button type="button" class="ad-filter${id === activeFilter ? " active" : ""}" data-filter="${id}">${esc(name)}</button>`
    ).join("");
    $$("#filtersGroups .ad-filter").forEach((b) => b.addEventListener("click", () => {
      activeFilter = b.dataset.filter;
      renderFilters();
      renderList();
    }));
  }

  // "Acompanhante N" quando não tem nome: a pessoa existe no rateio mesmo
  // sem nome, e sumir com ela já foi bug uma vez.
  const personName = (p, i) => p.name || `Acompanhante ${i}`;

  function matchesSearch(g, people, term) {
    if (!term) return true;
    // varre também o nome dos acompanhantes: "o Léo vem?" é pergunta natural
    const targetTime = [g.lead_name, g.contact,
                  ...people.map((p, i) => personName(p, i))].join(" ").toLowerCase();
    return targetTime.includes(term);
  }

  function matchesFilter(g, people) {
    if (activeFilter === "all") return true;
    if (activeFilter === "children") return people.some((p) => p.age_group === "child");
    // O filtro é LENTE, não contabilidade: um grupo com convidado_por
    // [1,3] aparece nos dois. Quem paga o quê está em Contas, onde o
    // mesmo convidado vale meia unidade para cada anfitrião — por isso
    // esta aba não mostra total nenhum por aniversariante.
    return (g.invited_by || []).map(String).includes(activeFilter);
  }

  function renderList() {
    if (!lastList) return;
    const { groups, byGroup } = lastList;
    const term = $("#searchGroups").value.trim().toLowerCase();

    const visiveis = groups.filter((g) => {
      const people = byGroup.get(g.id) || [];
      return matchesFilter(g, people) && matchesSearch(g, people, term);
    });

    const filtering = !!term || activeFilter !== "all";
    $("#listEmpty").hidden = groups.length > 0;
    $("#listNoResult").hidden = !(groups.length > 0 && visiveis.length === 0 && filtering);

    $("#listGroups").innerHTML = visiveis.map((g) => groupCard(g, byGroup.get(g.id) || [])).join("");
    wireCards();
  }

  function groupCard(g, people) {
    const aberto = openCards.has(g.id);
    const hosts = (g.invited_by || [])
      .map((id) => celebrantName(id, "?" + id)).join(", ");
    const rows = people.map((p, i) => {
      const items = preferences(p);
      return `<div class="person-row">
        <span class="person-row-name">${esc(personName(p, i))}</span>
        <span class="mono person-row-kind${p.age_group === "child" ? " child" : ""}">${p.age_group === "child" ? "criança" : "adulto"}</span>
        <span class="mono person-row-items">${items.length ? esc(items.join(" · ").toLowerCase()) : "—"}</span>
      </div>`;
    }).join("");

    return `<div class="group-card">
      <button type="button" class="group-top" data-toggle="${esc(g.id)}" aria-expanded="${aberto}">
        <span class="group-who">
          <b>${esc(g.lead_name)}</b>
          <span class="mono group-meta">${esc(g.contact)}${hosts ? " · convidado por " + esc(hosts) : ""}</span>
        </span>
        <span class="mono group-count">${people.length}</span>
        <span class="group-arrow" aria-hidden="true">${aberto ? "▲" : "▼"}</span>
      </button>
      ${aberto ? `<div class="group-body">
        ${rows}
        ${g.notes ? `<p class="group-note">${esc(g.notes)}</p>` : ""}
        <p class="mono group-when">chegou em ${esc(fmtDateTime(g.created_at))}</p>
        <div class="group-actions">
          ${contactLink(g)}
          <button type="button" class="group-excluir" data-excluir="${esc(g.id)}">Excluir</button>
        </div>
      </div>` : ""}
    </div>`;
  }

  /* ---- contato -> link ----
     `contact` é o que o convidado digitou. Um wa.me com os dígitos crus
     manda para o país errado: a Rosaura está como 51995509956, e +51 é
     o Peru.

     ⚠️ A decisão é por COMPRIMENTO antes de prefixo, e isso não é
     detalhe: 55 é o DDI do Brasil E o DDD de Santa Maria/RS. Um número
     de lá (55987654321, 11 dígitos) tem que virar 5555987654321. Uma
     regra do tipo "começa com 55, logo já tem DDI" mandaria a mensagem
     para outra pessoa — e Porto Alegre convive com 51, 54 e 55.

     Comprimento desconhecido não vira link: melhor não ter botão do que
     ter botão que abre conversa com desconhecido. */
  function whatsNumber(contact) {
    const bruto = String(contact || "").trim();
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

  function contactLink(g) {
    const contact = String(g.contact || "");
    if (contact.includes("@")) {
      return `<a class="group-acao" href="mailto:${encodeURIComponent(contact)}">Enviar e-mail</a>`;
    }
    const num = whatsNumber(contact);
    if (!num) return `<span class="group-acao group-acao-dead">Contato: ${esc(contact)}</span>`;
    return `<a class="group-acao" href="https://wa.me/${encodeURIComponent(num)}" target="_blank" rel="noopener">Chamar no WhatsApp</a>`;
  }

  function wireCards() {
    $$("[data-toggle]").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.toggle;
      if (openCards.has(id)) openCards.delete(id); else openCards.add(id);
      renderList();
    }));
    $$("[data-excluir]").forEach((b) => b.addEventListener("click", () => deleteGroup(b.dataset.excluir)));
  }

  async function deleteGroup(id) {
    const { groups, byGroup } = lastList;
    const g = groups.find((x) => x.id === id);
    if (!g) return;
    const people = byGroup.get(id) || [];

    // Nomear quem vai sumir, e a consequência. "Tem certeza?" genérico
    // não diz o que se perde.
    const quantas = people.length === 1 ? "a 1 pessoa" : `as ${people.length} pessoas`;
    const frase = `Apagar a confirmação de ${g.lead_name} e ${quantas} do grupo? ` +
      "Isso não tem como desfazer.";
    if (!confirm(frase)) return;

    // O conteúdo apagado, em texto, montado ANTES de sumir: não é
    // desfazer, mas é o que permite refazer à mão se foi engano.
    const copy = [
      `${g.lead_name} · ${g.contact}`,
      `convidado por: ${(g.invited_by || []).map((i) => celebrantName(i, "?" + i)).join(", ") || "—"}`,
      ...people.map((p, i) => `- ${personName(p, i)} (${p.age_group}): ${preferences(p).join(", ") || "nada"}`),
      g.notes ? `recado: ${g.notes}` : null,
    ].filter(Boolean).join("\n");

    const { error } = await sb.from("rsvps").delete().eq("id", id);
    if (error) { console.error(error); return listToast("Não consegui apagar.", "err"); }

    openCards.delete(id);
    listToast("Apagado. O que sumiu:\n" + copy, "ok");
    // Recarrega em vez de remendar os arrays: é o que garante que Resumo,
    // Compras e Contas mudem junto. Busca e filtro sobrevivem porque
    // moram em variáveis, não no HTML.
    await loadRSVPs();
  }

  function listToast(msg, classe) {
    const el = $("#listMsg");
    el.className = "msg-toast" + (classe ? " " + classe : "");
    el.textContent = msg;
  }

  $("#searchGroups").addEventListener("input", renderList);
  $("#btnClearSearch").addEventListener("click", () => {
    $("#searchGroups").value = "";
    activeFilter = "all";
    renderFilters();
    renderList();
  });

  /* ================= FOTOS ================= */
  async function loadPhotos() {
    const grid = $("#photosGrid");
    const { data, error } = await sb.storage.from(C.supabase.photosBucket).list("", { limit: 100, sortBy: { column: "name", order: "asc" } });
    if (error) { console.error(error); return; }
    const photos = (data || []).filter((f) => f.name && !f.name.startsWith(".") && /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name));
    if (!photos.length) { grid.innerHTML = '<p class="empty">Nenhuma foto ainda.</p>'; return; }
    grid.innerHTML = photos.map((f) => {
      const url = sb.storage.from(C.supabase.photosBucket).getPublicUrl(f.name).data.publicUrl;
      return `<div class="photo-item"><img src="${esc(url)}" alt=""><button data-nome="${esc(f.name)}" title="Apagar">✕</button></div>`;
    }).join("");
    $$(".photo-item button", grid).forEach((b) => b.addEventListener("click", async () => {
      const name = b.dataset.name;
      // Nomeia o arquivo e diz ONDE ele aparece — igual ao combinado para
      // os RSVPs. Aqui não dá para ecoar o conteúdo apagado (é imagem);
      // o nome do arquivo é a pista para reenviar o original.
      if (!confirm(`Apagar a foto ${name}? Ela sai do carrossel do convite e isso não tem como desfazer.`)) return;
      const { error } = await sb.storage.from(C.supabase.photosBucket).remove([name]);
      if (error) {
        console.error(error);
        return toast("#photoMsg", "Não consegui apagar a foto.", "err");
      }
      toast("#photoMsg", `Apagada: ${name}`, "ok");
      loadPhotos();
    }));
  }

  function wireUpload() {
    const drop = $("#uploadDrop");
    const input = $("#fileInput");
    input.addEventListener("change", () => uploadPhotos(input.files));
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("drag"); }));
    drop.addEventListener("drop", (e) => uploadPhotos(e.dataTransfer.files));
  }

  async function uploadPhotos(files) {
    const msg = $("#photoMsg");
    const arr = [...files].filter((f) => f.type.startsWith("image/"));
    if (!arr.length) return;
    msg.className = "msg-toast"; msg.textContent = `Enviando ${arr.length} foto(s)...`;
    let ok = 0;
    for (const file of arr) {
      const name = `${Date.now()}_${sanitizeName(file.name)}`;
      const { error } = await sb.storage.from(C.supabase.photosBucket).upload(name, file, { cacheControl: "3600", upsert: false });
      if (error) console.error(error); else ok++;
    }
    msg.className = "msg-toast ok"; msg.textContent = `${ok} foto(s) enviada(s)!`;
    $("#fileInput").value = "";
    loadPhotos();
  }

  /* ================= HELPERS ================= */
  // Espelha o comportamento visual dos chips do convite. Vive aqui e no
  // main.js: são dois IIFEs sem módulo compartilhado, e a alternativa
  // seria um quarto arquivo só para isto.
  function enableChips(root) {
    $$(".chip input", root).forEach((inp) => {
      inp.addEventListener("change", () => {
        if (inp.type === "radio" && inp.name) {
          $$(`input[name="${inp.name}"]`, document).forEach((outro) => {
            const chip = outro.closest(".chip");
            if (chip) chip.classList.toggle("checked", outro.checked);
          });
          return;
        }
        inp.closest(".chip").classList.toggle("checked", inp.checked);
      });
    });
  }

  function sanitizeName(n) {
    return n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  }
  // "quando chegou" no fuso da FESTA, não no de quem abre o painel: são 5
  // organizadores e a resposta tem que ser a mesma para todos.
  function fmtDateTime(iso) {
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
