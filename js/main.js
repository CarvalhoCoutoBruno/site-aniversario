/* =============================================================
   SITE DE ANIVERSÁRIO — lógica da página do convidado
   ============================================================= */
(function () {
  const C = window.CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Precisa ficar AQUI, no topo: uid() é chamado durante a montagem do
  // primeiro card, que roda antes do fim do arquivo. Declarado lá
  // embaixo com `let`, cai na zona morta temporal e derruba o script.
  let _n = 0;
  const uid = (p) => p + _n++;

  // ---- Supabase (opcional: site funciona mesmo sem chaves) ----
  let sb = null;
  const hasSupabase = C.supabase.url && !C.supabase.url.includes("COLE_");
  if (hasSupabase && window.supabase) {
    sb = window.supabase.createClient(C.supabase.url, C.supabase.anonKey);
  }

  /* ================= DADOS DO CONVITE =================
     Vêm da tabela `party` (leitura pública), não mais do config.js.

     ⚠️ Isto passou a ser ASSÍNCRONO. Os chips de "quem te convidou"
     nascem vazios no HTML e são montados aqui; se a festa não carregar,
     eles ficam vazios e o envio é barrado por um field que o convidado
     não vê na tela — ele preencheria tudo e não conseguiria enviar.
     Por isso a falha esconde o convite inteiro e mostra um aviso, em
     vez de deixar meia tela funcionando.                            */

  let targetTime = NaN;          // instante da festa; só existe depois do load
  let timer = null;
  let inviteFailed = false;
  let rsvpClosedFlag = false;
  let party = null;        // a linha da tabela `party`, para quem precisa dela depois

  async function loadParty() {
    if (!sb) return failInvite();
    try {
      const { data, error } = await sb.from("party").select("*").eq("id", 1).single();
      if (error || !data) {
        console.error("party:", error);
        return failInvite();
      }
      renderInvite(data);
    } catch (e) {
      console.error("party:", e);
      failInvite();
    }
  }

  /* As idades não existem em dado nenhum — nem no config.js antigo, nem
     na tabela party. Ficam aqui porque esta festa é esta festa; virar
     schema seria fatia à parte.

     ⚠️ A posição amarra idade e nome: IDADES[i] é a idade de
     nomes[i]. Renomear no painel é seguro; REORDENAR desalinha — o
     mesmo risco que a ordem já carrega para o rateio, agora visível no
     convite.

     O total do hero é a SOMA, não um literal: dois números escritos à
     mão podem discordar; uma soma não. */
  const AGES = [40, 50, 70];

  function renderInvite(f) {
    party = f;

    // A última palavra do título sai em vermelho. Feito por script e não
    // com <br> fixo porque o título vem do banco e é editável — um corte
    // escrito à mão no HTML quebraria no primeiro título diferente.
    const title = String(f.title || "");
    const corte = title.lastIndexOf(" ");
    $("#partyTitle").innerHTML = corte > 0
      ? `${esc(title.slice(0, corte))} <span class="end">${esc(title.slice(corte + 1))}</span>`
      : esc(title);
    document.title = f.title;   // melhora o preview do link no WhatsApp

    const sub = $("#partySubtitle");
    sub.textContent = f.subtitle || "";
    sub.hidden = !f.subtitle;

    // data_texto em branco: gera a partir da data, no fuso de São Paulo
    const dateText = f.date_text || dateAsText(f.starts_at);
    $("#partyDate").textContent = dateText;

    // a data NÃO é repetida aqui: ela vive no pill do hero
    $("#cardVenue").textContent = f.venue;

    const localEl = $("#partyVenue");
    if (f.map_url) {
      localEl.href = f.map_url;
      localEl.hidden = false;
    } else {
      localEl.removeAttribute("href");
      localEl.hidden = true;   // sem link, o botão do mapa não aparece
    }
    $("#whereSection").hidden = false;

    const names = [f.celebrant_1_name, f.celebrant_2_name, f.celebrant_3_name];
    const total = AGES.reduce((a, b) => a + b, 0);
    $("#heroNames").innerHTML =
      names.map((n, i) => `
        <div class="eq-item">
          <b class="eq-num">${AGES[i]}</b>
          <span class="eq-name">${esc(n)}</span>
        </div>`).join('<span class="eq-op" aria-hidden="true">+</span>') +
      `<span class="eq-op eq-igual" aria-hidden="true">=</span>
       <div class="eq-item eq-total">
         <b class="eq-num">${total}</b>
         <span class="eq-name">de festa</span>
       </div>`;

    $("#footerParty").textContent =
      `${f.title} · ${names.join(", ")} · ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(f.starts_at))}`;

    // O value é o ID (posição), nunca o nome: é o que o banco grava em
    // invited_by e o que liga o convidado ao aniversariante que
    // banca o consumo dele. Renomear não quebra registro nenhum.
    $("#chipsCelebrants").innerHTML = names
      .map((name, i) => `<label class="chip">
          <input type="checkbox" class="celebrant-check" value="${i + 1}" />
          <span>${esc(name)}</span>
        </label>`)
      .join("");
    enableChips($("#chipsCelebrants"));

    targetTime = new Date(f.starts_at).getTime();
    $("#inviteLoading").hidden = true;
    $("#hero-content").hidden = false;
    tick();
    timer = setInterval(tick, 1000);
  }

  // Um estado só para o convite inteiro: sem hero pela metade ao lado
  // de um formulário escondido.
  function failInvite() {
    inviteFailed = true;
    $("#inviteLoading").hidden = true;
    $("#hero-content").hidden = true;
    // Esconde as SEÇÕES inteiras, não só o conteúdo: com o layout novo
    // cada uma tem título próprio ("Momentos", "Confirmar presença"),
    // que apareceriam sobre o vazio — a mesma incoerência que o
    // fail-loud existe para evitar.
    $("#whereSection").hidden = true;
    $("#photosSection").hidden = true;
    $("#rsvpSection").hidden = true;
    $("#carousel").style.display = "none";
    $("#carouselEmpty").hidden = true;
    $("#rsvpForm").hidden = true;
    $("#rsvpClosed").hidden = true;
    // o aviso de prazo pode ter chegado ANTES desta falha: a flag cobre
    // quem resolve depois, e esta limpeza cobre quem já resolveu.
    $("#deadlineNotice").hidden = true;
    $("#inviteError").hidden = false;
  }

  function dateAsText(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const f = (o) => new Intl.DateTimeFormat("pt-BR",
      Object.assign({ timeZone: "America/Sao_Paulo" }, o)).format(d);
    const hour = f({ hour: "2-digit", minute: "2-digit", hour12: false })
      .replace(":00", "h").replace(":", "h");
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    return `${cap(f({ weekday: "long" }))}, ${f({ day: "numeric" })} de ${f({ month: "long" })} de ${f({ year: "numeric" })}, às ${hour}`;
  }

  /* ================= COUNTDOWN =================
     Três estados, decididos pela DATA em São Paulo — nunca pelo sinal
     do diff. A festa tem hora marcada: depois dela, e ainda no mesmo
     dia, o diff já é negativo, e um "diff <= 0 => acabou" diria que a
     festa passou com ela acontecendo.

     O dia sai do fuso de São Paulo, não do navegador: o convidado pode
     estar viajando.                                                */
  function dayInSaoPaulo(ms) {
    const partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date(ms));
    const parte = (t) => partes.find((x) => x.type === t).value;
    return `${parte("year")}-${parte("month")}-${parte("day")}`;
  }

  // "contagem" | "e-hoje" | "passou"
  function partyState(agora) {
    const today = dayInSaoPaulo(agora);
    const day = dayInSaoPaulo(targetTime);
    return today < day ? "contagem" : today === day ? "e-hoje" : "passou";
  }

  // "11h, Salão Grande. Corre." — hora e local saem do banco, não do
  // texto do mockup: os dois são editáveis pelo painel.
  function todayCallout() {
    if (!party) return "Corre!";
    const hour = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date(party.starts_at)).replace(":00", "h").replace(":", "h");
    // Só o nome do salão, não o endereço inteiro: `local` guarda a linha
    // completa ("Salão X — Rua Y, 000, Bairro, Cidade/UF") e ela não cabe
    // numa chamada de urgência. O endereço completo segue na ficha acima.
    const salao = party.venue ? party.venue.split(/[—,]/)[0].trim() : "";
    return salao ? `${hour}, ${salao}. Corre.` : `${hour}. Corre.`;
  }

  function tick() {
    const cd = $("#countdown");
    if (isNaN(targetTime)) { cd.hidden = true; return; }

    const state = partyState(Date.now());
    cd.dataset.state = state;

    if (state !== "contagem") {
      clearInterval(timer);
      cd.hidden = true;
      const warning = $("#partyState");
      warning.hidden = false;

      if (state === "e-hoje") {
        warning.dataset.kind = "hoje";
        warning.innerHTML = `<b>É hoje!</b><p>${esc(todayCallout())}</p>`;
      } else {
        warning.dataset.kind = "passou";
        warning.innerHTML = `<b>Acabou 🍕</b>
          <p>A festa já rolou e foi boa demais. Em breve as fotos reais entram
             aqui no lugar das inventadas.</p>`;
        // Com a festa passada o CTA "Tô dentro" não leva a lugar nenhum,
        // e confirmar presença para um sábado que já foi também não.
        $("#ctaTop").hidden = true;
        closeForm("A festa<br>já rolou",
          "Não dá mais para confirmar — mas em breve as fotos reais entram no lugar das inventadas.");
      }
      return;
    }

    const d = targetTime - Date.now();
    $("#cdDays").textContent = Math.floor(d / 864e5);
    $("#cdHours").textContent = Math.floor((d % 864e5) / 36e5);
    $("#cdMin").textContent = Math.floor((d % 36e5) / 6e4);
    $("#cdSec").textContent = Math.floor((d % 6e4) / 1e3);
  }

  loadParty();

  /* ================= CARROSSEL ================= */
  const track = $("#carouselTrack");
  const dotsWrap = $("#carDots");
  let slides = [];
  let idx = 0;
  let auto = null;

  async function loadPhotos() {
    let urls = [];
    if (sb) {
      try {
        const { data, error } = await sb.storage.from(C.supabase.photosBucket).list("", {
          limit: 100, sortBy: { column: "name", order: "asc" },
        });
        if (!error && data) {
          urls = data
            .filter((f) => f.name && !f.name.startsWith(".") && /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name))
            .map((f) => sb.storage.from(C.supabase.photosBucket).getPublicUrl(f.name).data.publicUrl);
        }
      } catch (e) { console.warn("Falha ao carregar fotos:", e); }
    }
    renderCarousel(urls);
  }

  function renderCarousel(urls) {
    // O load das fotos resolve depois do da festa. Sem esta guarda ele
    // reexibiria o carrossel por cima do estado de erro, deixando o
    // convite meio quebrado — que é o que a falha existe para evitar.
    if (inviteFailed) return;
    $("#photosSection").hidden = false;
    if (!urls.length) {
      $("#carousel").style.display = "none";
      $("#carouselEmpty").hidden = false;
      return;
    }
    $("#carousel").style.display = "";
    $("#carouselEmpty").hidden = true;
    track.innerHTML = urls.map((u) => `<div class="slide"><img src="${esc(u)}" alt="Foto da festa" loading="lazy"></div>`).join("");
    dotsWrap.innerHTML = urls.map((_, i) => `<button aria-label="Foto ${i + 1}"></button>`).join("");
    slides = $$(".slide", track);
    idx = 0;
    refresh();
    $$("button", dotsWrap).forEach((b, i) => b.addEventListener("click", () => { ir(i); reiniciarAuto(); }));
    reiniciarAuto();
  }

  function refresh() {
    track.style.transform = `translateX(-${idx * 100}%)`;
    $$("button", dotsWrap).forEach((b, i) => b.classList.toggle("active", i === idx));
  }
  function ir(i) { idx = (i + slides.length) % slides.length; refresh(); }
  function reiniciarAuto() {
    clearInterval(auto);
    if (slides.length > 1) auto = setInterval(() => ir(idx + 1), 5000);
  }

  /* As setas laterais saíram com a pele nova, então os dots são a única
     navegação por clique. O arrasto cobre o gesto que o dedo já espera
     numa faixa de foto. 40px de limiar para não confundir com a rolagem
     vertical da página. */
  (function enableSwipe() {
    const carouselEl = $("#carousel");
    let x0 = null;
    carouselEl.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    carouselEl.addEventListener("touchend", (e) => {
      if (x0 === null || slides.length < 2) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) < 40) return;
      ir(dx < 0 ? idx + 1 : idx - 1);
      reiniciarAuto();
    }, { passive: true });
  })();

  loadPhotos();

  /* ================= PRAZO DE CONFIRMAÇÃO =================
     rsvp_status() é a única leitura que o visitante anônimo tem.
     Se der erro de rede, deixa o formulário aberto: o RPC rejeita de
     qualquer jeito, e é melhor errar para o lado de deixar tentar. */
  async function checkDeadline() {
    if (!sb) return;
    try {
      const { data, error } = await sb.rpc("rsvp_status");
      if (error) return console.warn("rsvp_status:", error);
      const st = Array.isArray(data) ? data[0] : data;
      if (!st) return;
      if (inviteFailed) return; // não mexer na tela de erro
      if (st.is_open === false) closeForm("Prazo<br>encerrado", deadlineText(st.deadline));
      else if (st.deadline) showDeadline(st.deadline);
    } catch (e) {
      console.warn("Falha ao checar o prazo:", e);
    }
  }

  // Aberto mas com data marcada: sem isto o convidado não vê prazo
  // nenhum, e o prazo perde justamente a urgência que o justifica.
  function showDeadline(deadline) {
    if (rsvpClosedFlag) return;   // a festa pode já ter passado antes desta resposta chegar
    const d = new Date(deadline);
    if (isNaN(d)) return;
    const el = $("#deadlineNotice");
    el.textContent = `Confirme até ${shortDate(d)}`;
    el.hidden = false;
  }

  /* Duas coisas fecham o formulário: o prazo e a festa já ter acontecido.
     O primeiro a fechar escreve o texto — e como o tick() roda síncrono
     e o rsvp_status() é assíncrono, "a festa já rolou" ganha do prazo,
     que é a precedência certa: não adianta falar de prazo depois da
     festa. */
  function closeForm(title, text) {
    if (rsvpClosedFlag) return;
    rsvpClosedFlag = true;
    $("#rsvpForm").hidden = true;
    $("#rsvpClosed").querySelector("h3").innerHTML = title;
    $("#rsvpClosedText").textContent = text;
    $("#rsvpClosed").hidden = false;
    $("#deadlineNotice").hidden = true;
  }

  /* O prazo é gravado como 23:59:59-03:00, então em qualquer fuso a
     LESTE de São Paulo o instante já caiu no dia seguinte. Sem fixar o
     fuso, um convidado em Lisboa lê "confirme até 02/10" para um prazo
     que fecha dia 01 — a mesma armadilha que já nos custou um dia de
     diferença na Fatia 7, aqui na formatação em vez de no cálculo. */
  function shortDate(d) {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(d);
  }

  function deadlineText(deadline) {
    const d = new Date(deadline);
    return isNaN(d)
      ? "O prazo para confirmar presença já passou."
      : `As confirmações fecharam em ${shortDate(d)} — a pizza já foi encomendada.`;
  }
  checkDeadline();

  /* ================= PESSOAS (responsável + acompanhantes) ================= */
  const MAX_COMPANIONS = 5;
  const list = $("#peopleList");
  const tpl = $("#tplPerson");

  function newCard(isLead) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.role = isLead ? "lead" : "companion";

    if (isLead) {
      node.classList.add("lead");
      // O responsável não digita o nome duas vezes: o field de cima já é
      // o que o envio usa. E ele é sempre adulto — o convite não é
      // mandado para criança —, então o tipo vira rótulo fixo em vez de
      // escolha. O payload continua saindo com tipo "adulto".
      node.querySelector(".p-name").remove();
      node.querySelector(".p-grupo-tipo").remove();
      node.querySelector(".p-remove").remove();
    } else {
      node.querySelector(".person-tag").remove();
      // rádios de tipo precisam de name único por card, senão viram um
      // grupo só e marcar "criança" num card desmarca o outro
      const group = uid("tipo");
      $$(".p-kind input", node).forEach((r) => (r.name = group));
    }

    enableChips(node);
    enableBeerRule(node);

    const rem = node.querySelector(".p-remove");
    if (rem) rem.addEventListener("click", () => { node.remove(); refreshAddButton(); });
    return node;
  }

  /* Chopp é bloqueado para criança — mesma regra da constraint do
     banco. A tela desmarca e desabilita na hora, para o convidado
     entender antes de enviar em vez de tomar erro do servidor. */
  function enableBeerRule(card) {
    const beer = card.querySelector('[data-drink="wants_beer"]');
    const beerChip = card.querySelector(".p-chip-beer");
    const warning = card.querySelector(".p-beer-warning");
    const childRadio = card.querySelector('.p-kind input[value="child"]');

    // O card do responsável não tem escolha de tipo: ele é sempre adulto,
    // e o chopp está liberado. Sem esta saída, o querySelector nulo
    // derrubaria a IIFE inteira na construção do primeiro card.
    if (!childRadio) return;

    function aplicar() {
      const isChild = childRadio.checked;
      beer.disabled = isChild;
      beerChip.classList.toggle("disabled", isChild);
      warning.hidden = !isChild;
      if (isChild && beer.checked) {
        beer.checked = false;
        beerChip.classList.remove("checked");
      }
    }
    $$(".p-kind input", card).forEach((r) => r.addEventListener("change", aplicar));
    aplicar();
  }

  function countCompanions() {
    return $$(".person-card", list).length - 1;
  }

  // Numera os cards para quem adiciona 4 ou 5 pessoas se localizar.
  // Roda de novo a cada remoção, senão sobra buraco na sequência.
  function renumberCards() {
    $$(".person-card", list).forEach((card, i) => {
      card.querySelector(".person-label").textContent =
        i === 0 ? "Você" : `Acompanhante ${i}`;
    });
  }

  // Quem adiciona quatro pessoas perde a conta de quantas somou.
  function refreshTotal() {
    const n = $$(".person-card", list).length;
    $("#totalPeople").textContent = n === 1 ? "1 pessoa" : `${n} pessoas`;
  }

  function refreshAddButton() {
    const cheio = countCompanions() >= MAX_COMPANIONS;
    $("#addPerson").hidden = cheio;
    $("#limitCompanions").hidden = !cheio;
    renumberCards();
    refreshTotal();
  }

  // primeiro card = responsável. O nome dele não é digitado aqui: vem do
  // field de cima, que é o que o envio já usava.
  list.appendChild(newCard(true));

  $("#addPerson").addEventListener("click", () => {
    if (countCompanions() >= MAX_COMPANIONS) return;
    list.appendChild(newCard(false));
    refreshAddButton();
  });
  refreshAddButton();

  /* ================= LIMITE DO RECADO =================
     A tabela tem CHECK (observacoes <= 500). Sem limite no cliente, o
     convidado só descobre ao enviar, e o erro chega como violação de
     constraint — que o mensagemDeErro degrada para o genérico. */
  const MAX_NOTES = 500;
  const AVISA_OBS = 450;
  const messageField = $("#message");
  const counter = $("#counterMessage");

  messageField.addEventListener("input", () => {
    const n = messageField.value.length;
    counter.hidden = n < AVISA_OBS;
    counter.textContent = `${n}/${MAX_NOTES} caracteres`;
    counter.classList.toggle("no-limit", n >= MAX_NOTES);
  });

  /* ================= ENVIO ================= */
  function readPerson(card, indice) {
    const nameField = card.querySelector(".p-name");
    const name = nameField ? nameField.value.trim() : "";
    const isLead = card.dataset.role === "lead";
    // O card do responsável não tem rádio de tipo: ele é sempre adulto.
    const childRadio = card.querySelector('.p-kind input[value="child"]');
    const p = {
      // Nome de acompanhante é OPCIONAL e a pessoa entra mesmo sem ele.
      // Descartar quem não tem nome (como o formulário antigo fazia)
      // some com um consumidor e desequilibra o rateio.
      name: name || (isLead ? "" : null),
      age_group: childRadio && childRadio.checked ? "child" : "adult",
      role: isLead ? "lead" : "companion",
      wants_water: false, wants_soda: false, wants_beer: false, wants_pizza: false,
    };
    // Bebida e comida moram no mesmo contêiner agora; a leitura passou a
    // ser pelos data-*, que não mudaram, e não pelo grupo em que estavam.
    $$("[data-drink]:checked", card).forEach((i) => { p[i.dataset.drink] = true; });
    $$("[data-food]:checked", card).forEach((i) => { p[i.dataset.food] = true; });
    if (p.age_group === "child") p.wants_beer = false; // cinto e suspensório
    return p;
  }

  $("#rsvpForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("#formStatus");
    const btn = $("#btnSubmit");
    status.className = "form-status";
    status.textContent = "";

    const lead = $("#lead").value.trim();
    const contact = $("#contact").value.trim();
    const message = $("#message").value.trim();
    const invitedBy = $$(".celebrant-check:checked", $("#chipsCelebrants"))
      .map((i) => Number(i.value));

    if (!lead) return fail(status, "Por favor, coloque seu nome.");
    if (!contact) return fail(status, "Precisamos de um WhatsApp ou e-mail para falar com você.");
    if (!invitedBy.length) return fail(status, "Escolha quem te convidou.");
    // o maxlength do textarea não impede colar por script
    if (message.length > MAX_NOTES) {
      return fail(status, `O recado passou de ${MAX_NOTES} caracteres (tem ${message.length}). Encurte um pouco.`);
    }

    const cards = $$(".person-card", list);
    const people = cards.map(readPerson);
    people[0].name = lead; // o principal sempre leva o nome de cima

    if (!sb) {
      console.log("RSVP (sem Supabase configurado):", { lead, contact, invitedBy, people, message });
      return fail(status, "O site ainda não está conectado ao banco. Avise o organizador.");
    }

    btn.disabled = true;
    btn.textContent = "Enviando...";

    const { error } = await sb.rpc("create_rsvp", {
      p_lead_name: lead,
      p_contact: contact,
      p_invited_by: invitedBy,
      p_notes: message || null,
      p_people: people,
    });

    if (error) {
      // Erro de verdade: o formulário antigo fingia sucesso, e o
      // convidado ia embora achando que tinha confirmado.
      console.error(error);
      btn.disabled = false;
      btn.textContent = "Confirmar";
      return fail(status, errorMessage(error));
    }

    // sucesso: o botão NÃO volta a habilitar
    btn.textContent = "Confirmado!";
    onSuccess(people);
  });

  // As exceptions do create_rsvp já são escritas para o convidado ler.
  function errorMessage(error) {
    const m = (error && (error.message || error.hint)) || "";
    if (/confirma[çc][õo]es foram encerradas/i.test(m)) return m;
    if (/Informe|Escolha|O grupo precisa/i.test(m)) return m;
    if (/chopp_nao_para_crianca/.test(m)) return "Chopp não é liberado para criança.";
    if (/violates|constraint/i.test(m)) return "Alguma informação ficou inválida. Confira e tente de novo.";
    return "Não conseguimos salvar sua confirmação. Tente de novo em instantes.";
  }

  /* A tela de sucesso substitui o convite, mas o formulário continua no
     DOM: "mudar minha confirmação" precisa dele de volta com tudo que
     foi preenchido. Por isso escondemos as seções em vez de trocar o
     innerHTML — o que a versão anterior fazia e tornava a volta
     impossível. */
  function onSuccess(people) {
    const names = people.map((p, i) => ({
      role: i === 0 ? "Você" : "Acompanhante",
      name: p.name || "sem nome",
      kind: p.age_group === "child" ? "criança" : "adulto",
    }));

    const day = party && party.starts_at
      ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric" })
          .format(new Date(party.starts_at))
      : null;
    const quantos = people.length === 1 ? "1 lugar" : `${people.length} lugares`;
    $("#successSummary").innerHTML =
      `Guardamos <b>${esc(quantos)}</b>${day ? ` no dia ${esc(day)}` : ""}. Já estamos contando as pizzas.`;

    $("#successList").innerHTML = names.map((n) => `
      <div class="row-ok">
        <span>${esc(n.role)}</span>
        <b>${esc(n.name)} · ${esc(n.kind)}</b>
      </div>`).join("");

    prepareCalendar();

    $(".hero").hidden = true;
    $("#photosSection").hidden = true;
    $("#rsvpSection").hidden = true;
    $("#rsvpSuccess").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    fireConfetti();
  }

  $("#btnChange").addEventListener("click", () => {
    $("#rsvpSuccess").hidden = true;
    $(".hero").hidden = false;
    $("#photosSection").hidden = false;
    $("#rsvpSection").hidden = false;
    // o envio anterior desabilitou o botão de propósito; reabrindo, ele volta
    const btn = $("#btnSubmit");
    btn.disabled = false;
    btn.textContent = "Confirmar";
    $("#formStatus").textContent = "";
    $("#rsvpSection").scrollIntoView({ behavior: "smooth" });
  });

  /* .ics gerado na hora. Dois cuidados que o review pediu:
     - o carimbo sai em UTC com o sufixo Z, então o horário é inequívoco
       e não depende do fuso de quem abre o arquivo. Esta é a mesma
       armadilha que já nos custou um dia inteiro de diferença no prazo;
     - Blob URL em vez de data: URI, que o Safari do iPhone trata mal. */
  function prepareCalendar() {
    const botao = $("#btnCalendar");
    if (!party || !party.starts_at) return;
    const ini = new Date(party.starts_at);
    if (isNaN(ini)) return;

    const end = new Date(ini.getTime() + 4 * 3600e3);   // 4h é o palpite; o convidado ajusta
    const carimbo = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const escapa = (s) => String(s).replace(/([,;\\])/g, "\\$1").replace(/\r?\n/g, "\\n");

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//site-aniversario//PT-BR",
      "BEGIN:VEVENT",
      `UID:festa-${ini.getTime()}@site-aniversario`,
      `DTSTAMP:${carimbo(new Date())}`,
      `DTSTART:${carimbo(ini)}`,
      `DTEND:${carimbo(end)}`,
      `SUMMARY:${escapa(party.title || "Party")}`,
      party.venue ? `LOCATION:${escapa(party.venue)}` : null,
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n") + "\r\n";

    botao.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    botao.hidden = false;
  }

  /* ================= HELPERS ================= */
  function enableChips(root) {
    $$(".chip input", root).forEach((inp) => {
      inp.addEventListener("change", () => {
        // rádio: marcar um desmarca os irmãos do mesmo grupo
        if (inp.type === "radio" && inp.name) {
          $$(`input[name="${inp.name}"]`, root.ownerDocument || document).forEach((outro) => {
            const chip = outro.closest(".chip");
            if (chip) chip.classList.toggle("checked", outro.checked);
          });
          return;
        }
        inp.closest(".chip").classList.toggle("checked", inp.checked);
      });
    });
  }
  function fail(el, msg) { el.className = "form-status err"; el.textContent = msg; el.scrollIntoView({ behavior: "smooth", block: "center" }); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fireConfetti() {
    const wrap = $("#confetti");
    const cores = ["#d8352a", "#1d4ed8", "#e8a33d", "#14110d"];
    for (let i = 0; i < 90; i++) {
      const c = document.createElement("i");
      c.style.left = Math.random() * 100 + "vw";
      c.style.background = cores[i % cores.length];
      c.style.animationDuration = 2 + Math.random() * 2 + "s";
      c.style.animationDelay = Math.random() * 0.5 + "s";
      c.style.transform = `rotate(${Math.random() * 360}deg)`;
      if (Math.random() > 0.5) c.style.borderRadius = "50%";
      wrap.appendChild(c);
      setTimeout(() => c.remove(), 4500);
    }
  }
})();
