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
  $("#btnAtualizar").addEventListener("click", () => { carregarConfig(); carregarRSVPs(); carregarFotos(); });

  // já logado?
  sb.auth.getSession().then(({ data }) => { if (data.session) mostrarPainel(); });

  function mostrarPainel() {
    $("#loginBox").hidden = true;
    $("#painel").hidden = false;
    carregarConfig();
    carregarRSVPs();
    carregarFotos();
    prepararUpload();
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
    render(g.data || [], porGrupo, aniversariantes);
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

    const stats = [
      { n: grupos.length, l: "Confirmações" },
      { n: todas.length, l: "Total de pessoas" },
      { n: cont.adultos, l: "Adultos" },
      { n: cont.criancas, l: "Crianças" },
      { n: cont.chopp, l: "Chopp" },
      { n: cont.refri, l: "Refrigerante" },
      { n: cont.agua, l: "Água" },
      { n: cont.pizza, l: "Pizza" },
      { n: aniversariantes.length + "/3", l: "Aniversariantes cadastrados" },
    ];
    $("#stats").innerHTML = stats
      .map((s) => `<div class="stat"><b>${s.n}</b><span>${esc(s.l)}</span></div>`)
      .join("");

    const body = $("#tabelaBody");
    $("#tabelaVazia").hidden = grupos.length > 0;
    body.innerHTML = grupos.map((r) => {
      const pessoas = porGrupo.get(r.id) || [];
      const pessoasHTML = pessoas.map((p, i) => {
        const nome = p.nome || `Acompanhante ${i}`;
        const tipo = p.tipo === "crianca" ? " <small>(criança)</small>" : "";
        return `<div><b>${esc(nome)}</b>${tipo}</div>`;
      }).join("");
      const prefsHTML = pessoas.map((p, i) => {
        const nome = p.nome || `Acompanhante ${i}`;
        const t = preferencias(p);
        return `<div>${esc(nome)}: ${t.length ? t.map((x) => `<span class="pill">${esc(x)}</span>`).join("") : "<small>—</small>"}</div>`;
      }).join("");
      // convidado_por guarda o ID; o nome vem do config.js pelo índice
      const anivHTML = (r.convidado_por || [])
        .map((id) => `<span class="pill">${esc(C.aniversariantes[id - 1] || "?" + id)}</span>`)
        .join("");
      return `<tr>
        <td>${fmtData(r.criado_em)}</td>
        <td><b>${esc(r.nome_principal)}</b><br><small>${esc(r.contato)}</small></td>
        <td>${anivHTML}</td>
        <td>${pessoasHTML}</td>
        <td>${prefsHTML}</td>
        <td>${r.observacoes ? esc(r.observacoes) : "<small>—</small>"}</td>
        <td><button class="p-remover" data-id="${r.id}" title="Apagar">✕</button></td>
      </tr>`;
    }).join("");

    $$(".p-remover", body).forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Apagar esta confirmação?")) return;
      const { error } = await sb.from("rsvps").delete().eq("id", b.dataset.id);
      if (error) alert("Erro ao apagar."); else carregarRSVPs();
    }));
  }

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
  function limparNome(n) {
    return n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  }
  function fmtData(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " +
             d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
