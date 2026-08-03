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
  $("#btnAtualizar").addEventListener("click", () => { carregarConfig(); carregarAniversariantes(); carregarRSVPs(); carregarFotos(); });

  // já logado?
  sb.auth.getSession().then(({ data }) => { if (data.session) mostrarPainel(); });

  function mostrarPainel() {
    $("#loginBox").hidden = true;
    $("#painel").hidden = false;
    carregarConfig();
    carregarAniversariantes();
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
    $("#anivBlocos").innerHTML = C.aniversariantes
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
        nome: C.aniversariantes[k - 1],
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

  const fmtLitros = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

  function cartao(valor, rotulo) {
    return `<div class="stat"><b>${esc(String(valor))}</b><span>${esc(rotulo)}</span></div>`;
  }

  // Guarda de completude única: os carregadores rodam em paralelo, e
  // tanto a estimativa quanto o rateio precisam do conjunto inteiro.
  // Quem chegar por último dispara os dois.
  function recomputar() {
    if (!ultimaConfig || !ultimasPessoas || !ultimosGrupos) return;
    atualizarEstimativa();
    atualizarRateio();
  }

  function atualizarEstimativa() {
    if (!ultimaConfig || !ultimasPessoas) return;
    const e = Calculo.estimativa(ultimasPessoas, ultimaConfig);
    const c = e.contagens;

    $("#estVolumes").innerHTML = [
      cartao(fmtLitros(e.litrosChopp) + " L", "Chopp"),
      cartao(fmtLitros(e.litrosRefri) + " L", "Refrigerante"),
      cartao(fmtLitros(e.litrosAgua) + " L", "Água"),
    ].join("");

    $("#estPizzas").innerHTML = [
      cartao(e.pizzaAdultos, "Pizzas de adulto"),
      cartao(e.pizzaCriancas, "Pizzas de criança"),
    ].join("");

    $("#estCusto").innerHTML = cartao(Calculo.formatarBRL(e.custoEstimado), "Custo aproximado");

    $("#estContagens").innerHTML = [
      cartao(c.totalPessoas, "Pessoas"),
      cartao(c.adultos, "Adultos"),
      cartao(c.criancas, "Crianças"),
      cartao(c.chopp, "Bebem chopp"),
      cartao(c.refri, "Bebem refri"),
      cartao(c.agua, "Bebem água"),
    ].join("");

    // Com os preços ainda nas sementes (0), o custo sai zerado. Os
    // volumes seguem úteis; a tela avisa em vez de deixar o organizador
    // achar que a conta quebrou.
    const precos = ["preco_litro_chopp", "preco_litro_refri", "preco_litro_agua",
                    "preco_pizza_adulto", "preco_pizza_crianca"];
    const semPreco = precos.every((k) => Number(ultimaConfig[k]) === 0);
    const avisoPrecos = $("#estAvisoPrecos");
    avisoPrecos.hidden = !semPreco;
    if (semPreco) {
      avisoPrecos.textContent =
        "Os preços de referência ainda estão zerados na configuração — por isso o custo dá R$ 0,00. Os volumes acima já valem.";
    }

    // Aniversariante não cadastrado não consome nada no cálculo, e o
    // resultado fica plausível e errado. Conto na própria lista para não
    // depender de outro carregador (mesma corrida).
    const cadastrados = ultimasPessoas.filter((p) => p.papel === "aniversariante").length;
    const aviso = $("#estAvisoAniv");
    aviso.hidden = cadastrados >= 3;
    if (cadastrados < 3) {
      const faltam = 3 - cadastrados;
      aviso.textContent =
        `Só ${cadastrados} de 3 aniversariantes cadastrados — falta o consumo de ` +
        `${faltam === 1 ? "1 deles" : faltam + " deles"} nesta conta.`;
    }
  }

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
              <b>${esc(a.nome)}</b>
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
    ultimasPessoas = p.data || [];   // TODAS: as de grupo e as 3 de aniversariante
    ultimosGrupos = g.data || [];    // o elo convidado -> pagante (convidado_por)
    recomputar();
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
