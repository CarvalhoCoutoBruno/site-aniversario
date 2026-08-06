/* =============================================================
   CÁLCULOS — estimativa de compra e rateio de custo
   =============================================================
   Módulo PURO: não toca no DOM, não fala com o Supabase, não lê
   window.CONFIG. Recebe dados, devolve números. É o que permite
   testá-lo sem navegador e sem banco (ver tests/calc.test.js).

   QUEM PAGA: só os 3 aniversariantes. Convidado não paga nada — o
   consumo dele é bancado por quem o convidou (invited_by do grupo),
   dividido igualmente quando há mais de um. Cada aniversariante paga
   100% do próprio consumo. No fim existem só 3 contas.

   ⚠️ DINHEIRO SEMPRE EM CENTAVOS (inteiro).
   Divisão de custo gera dízima; em float as contas não fecham com o
   gasto real. Aqui tudo é inteiro e a sobra é distribuída pelo método
   do maior resto (ver ratearCentavos).

   ⚠️ CONTRATO DO NOME: este módulo lê `nome` das linhas de
   aniversariante para rotular contas, saldos e o texto do acerto. Ele
   NÃO sabe onde o nome mora — quem chama é que entrega o dado resolvido.
   No painel a linha de aniversariante tem `nome` NULO (a fonte única é a
   tabela `party`), e o `pessoasParaCalculo()` do admin.js resolve antes
   de chamar. Um chamador que passar as linhas cruas recebe
   "Aniversariante 1" — e estará certo, porque não entregou o nome.

   Entradas:
     people[] — { id, rsvp_id, name, age_group, wants_water, wants_soda,
                   wants_beer, wants_pizza, role, celebrant_id }
     groups[]  — { id, invited_by: [1..3], lead_name, contact }
     settings  — mesma forma da tabela `settings` (reais, não centavos)
   ============================================================= */
(function (root) {
  "use strict";

  // Peso interno em SEXTOS de pessoa. |invited_by| ∈ {1,2,3}, então
  // 6/n é sempre inteiro (6, 3 ou 2) — o rateio roda em aritmética
  // inteira do começo ao fim, sem erro de ponto flutuante.
  const SIXTHS = 6;

  /* ---------- conversão reais <-> centavos ---------- */

  // "12,50" | "12.50" | 12.5 | null  ->  1250 | 0
  function toCents(amount) {
    if (amount === null || amount === undefined || amount === "") return 0;
    const n = typeof amount === "number" ? amount : Number(String(amount).replace(",", "."));
    if (!isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  function toReais(centavos) {
    return (centavos || 0) / 100;
  }

  function formatBRL(centavos) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
      .format(toReais(centavos));
  }

  /* ---------- predicados ---------- */

  const confirmedPeople = (people) => (people || []).filter(Boolean);

  const isAdult = (p) => p.age_group === "adult";
  const isCelebrant = (p) => p.role === "celebrant";
  const wantsBeer = (p) => !!p.wants_beer && isAdult(p); // criança nunca conta
  const wantsSoda = (p) => !!p.wants_soda;
  const wantsWater = (p) => !!p.wants_water;
  const wantsPizza = (p) => !!p.wants_pizza;

  const CONSUMES = { beer: wantsBeer, soda: wantsSoda, water: wantsWater };

  /* ---------- contagens ---------- */

  function counts(people) {
    const list = confirmedPeople(people);
    const c = {
      totalPeople: list.length,
      adults: 0,
      children: 0,
      beer: 0,
      soda: 0,
      water: 0,
      adultPizzas: 0,
      childPizzas: 0,
    };
    for (const p of list) {
      if (isAdult(p)) c.adults++; else c.children++;
      if (wantsBeer(p)) c.beer++;
      if (wantsSoda(p)) c.soda++;
      if (wantsWater(p)) c.water++;
      if (wantsPizza(p)) { if (isAdult(p)) c.adultPizzas++; else c.childPizzas++; }
    }
    return c;
  }

  /* ---------- estimativa (pré-festa) ----------
     NÃO muda com o modelo de rateio: conta todas as pessoas
     confirmadas, aniversariantes inclusive. Serve para saber quanto
     comprar, não quem paga. */

  function estimate(people, settings) {
    const c = counts(people);
    const cfg = settings || {};
    const taxa = (v, padrao) => (v === null || v === undefined ? padrao : Number(v));

    const beerLiters = c.beer * taxa(cfg.beer_liters_per_adult, 2.0);
    const sodaLiters = c.soda * taxa(cfg.soda_liters_per_person, 0.6);
    const waterLiters = c.water * taxa(cfg.water_liters_per_person, 0.5);

    // volume × preço/litro: arredonda só no fim, uma vez por bebida
    const estimatedCost =
      Math.round(beerLiters * toCents(cfg.beer_price_per_liter)) +
      Math.round(sodaLiters * toCents(cfg.soda_price_per_liter)) +
      Math.round(waterLiters * toCents(cfg.water_price_per_liter)) +
      c.adultPizzas * toCents(cfg.adult_pizza_price) +
      c.childPizzas * toCents(cfg.child_pizza_price);

    return {
      counts: c,
      beerLiters: round3(beerLiters),
      sodaLiters: round3(sodaLiters),
      waterLiters: round3(waterLiters),
      adultPizzas: c.adultPizzas,
      childPizzas: c.childPizzas,
      estimatedCost,
    };
  }

  function round3(n) {
    return Math.round(n * 1000) / 1000;
  }

  /* ---------- rateio ponderado: o coração do arredondamento ----------
     Divide `totalCentavos` entre itens com PESOS (inteiros), de forma
     que a soma das partes seja EXATAMENTE o total. Maior resto:
       exato_i = total × peso_i / somaPesos
       base_i  = piso(exato_i)
       sobra   = total - Σ base_i
       os `sobra` itens com maior resto fracionário pagam 1 centavo a mais
     Empate e ordenação resolvidos por `id` crescente, então o resultado
     é determinístico: recarregar a tela não muda quem levou o centavo.

     Tudo em inteiros: `num` cabe folgado em Number (total ≤ ~1e8
     centavos × peso ≤ ~1e5 = 1e13 < 2^53), então piso e resto são
     exatos, sem depender de tolerância de float.
  --------------------------------------------------------- */
  function splitCents(totalInCents, items) {
    const out = new Map();
    const list = (items || []).filter((i) => i.weight > 0);
    const weightSum = list.reduce((s, i) => s + i.weight, 0);
    if (weightSum <= 0 || totalInCents === 0) return out;

    const calc = list.map((i) => {
      const num = totalInCents * i.weight;
      let base = Math.floor(num / weightSum);
      // correção de borda: garante piso exato mesmo se a divisão em
      // ponto flutuante cair do lado errado de um inteiro
      while (base * weightSum > num) base--;
      while ((base + 1) * weightSum <= num) base++;
      return { id: i.id, base, rest: num - base * weightSum };
    });

    let remainder = totalInCents - calc.reduce((s, x) => s + x.base, 0);

    // maior resto primeiro; empate pelo id, para ser determinístico
    const sort_order = [...calc].sort(
      (a, b) => b.rest - a.rest || String(a.id).localeCompare(String(b.id))
    );
    for (let i = 0; i < sort_order.length; i++) {
      out.set(sort_order[i].id, sort_order[i].base + (i < remainder ? 1 : 0));
    }
    return out;
  }

  /* ---------- atribuição: quem banca o consumo de quem ---------- */

  // Devolve [{ id: celebrant_id, peso }] em sextos de pessoa.
  // Aniversariante: 6 sextos (1 pessoa inteira) para si mesmo.
  // Convidado/acompanhante: 6/n para cada um dos n do invited_by.
  // A chave `null` acumula consumo sem dono (grupo sem invited_by
  // válido) — não deveria existir, mas se existir é preciso que o
  // dinheiro NÃO seja redistribuído: ele some do rateio e derruba o selo.
  function weightsForPerson(p, groups) {
    if (isCelebrant(p)) {
      return p.celebrant_id ? [{ id: p.celebrant_id, weight: SIXTHS }] : [{ id: null, weight: SIXTHS }];
    }
    const g = groups.get(p.rsvp_id);
    const owners = g && Array.isArray(g.invited_by) ? g.invited_by : [];
    if (!owners.length) return [{ id: null, weight: SIXTHS }];
    const share = SIXTHS / owners.length; // 6, 3 ou 2 — sempre inteiro
    return owners.map((k) => ({ id: k, weight: share }));
  }

  function accumulate(map, weights) {
    for (const { id, weight } of weights) {
      const chave = id === null ? "__sem_dono__" : id;
      map.set(chave, (map.get(chave) || 0) + weight);
    }
  }

  /* ---------- fechamento / rateio ---------- */

  function pizzaPrice(settings, age_group) {
    const cfg = settings || {};
    // preço real manda quando preenchido; senão cai no estimado
    const real = age_group === "adult" ? cfg.actual_adult_pizza_price : cfg.actual_child_pizza_price;
    const est = age_group === "adult" ? cfg.adult_pizza_price : cfg.child_pizza_price;
    return toCents(real === null || real === undefined ? est : real);
  }

  function split(people, settings, groups) {
    const cfg = settings || {};
    const list = confirmedPeople(people);
    const groupsById = new Map((groups || []).map((g) => [g.id, g]));

    const costs = {
      beer: toCents(cfg.actual_beer_cost),
      soda: toCents(cfg.actual_soda_cost),
      water: toCents(cfg.actual_water_cost),
    };
    const preenchido = (v) => v !== null && v !== undefined && v !== "";
    const closingComplete =
      preenchido(cfg.actual_beer_cost) &&
      preenchido(cfg.actual_soda_cost) &&
      preenchido(cfg.actual_water_cost);

    // conta de cada aniversariante, por item
    const accounts = new Map(); // celebrant_id -> { chopp, refri, agua, pizza }
    const ensureAccount = (k) => {
      if (!accounts.has(k)) accounts.set(k, { beer: 0, soda: 0, water: 0, pizza: 0 });
      return accounts.get(k);
    };
    for (const p of list) if (isCelebrant(p) && p.celebrant_id) ensureAccount(p.celebrant_id);

    /* --- bebidas: custo real do item distribuído por unidades --- */
    for (const item of ["beer", "soda", "water"]) {
      const consumers = list.filter(CONSUMES[item]);
      // Item com custo lançado e nenhum consumidor: pulado, sem dividir
      // por zero. O custo segue em custoRealTotal, então Σ ≠ total e o
      // selo `confere` acusa o erro de lançamento sozinho.
      if (!consumers.length) continue;

      const weights = new Map();
      for (const p of consumers) accumulate(weights, weightsForPerson(p, groupsById));

      const partes = splitCents(
        costs[item],
        [...weights.entries()].map(([id, weight]) => ({ id, weight }))
      );
      for (const [id, centavos] of partes) {
        if (id === "__sem_dono__") continue; // dinheiro sem pagante: some
        ensureAccount(id)[item] += centavos;
      }
    }

    /* --- pizza: preço por cabeça, atribuído com o mesmo peso --- */
    for (const p of list) {
      if (!wantsPizza(p)) continue;
      const price = pizzaPrice(cfg, p.age_group);
      if (!price) continue;
      const partes = splitCents(price, weightsForPerson(p, groupsById));
      for (const [id, centavos] of partes) {
        if (id === "__sem_dono__" || id === null) continue;
        ensureAccount(id).pizza += centavos;
      }
    }

    /* --- monta o resultado --- */
    const names = new Map();
    for (const p of list) {
      if (isCelebrant(p) && p.celebrant_id) names.set(p.celebrant_id, p.name || null);
    }

    const perCelebrant = [...accounts.entries()]
      .map(([id, det]) => ({
        celebrantId: id,
        name: names.get(id) || `Aniversariante ${id}`,
        breakdown: det,
        total: det.beer + det.soda + det.water + det.pizza,
      }))
      .sort((a, b) => a.celebrantId - b.celebrantId);

    const splitTotal = perCelebrant.reduce((s, a) => s + a.total, 0);

    // total gasto: bebidas pelo custo real + pizzas pelo preço por cabeça
    let pizzaTotal = 0;
    for (const p of list) if (wantsPizza(p)) pizzaTotal += pizzaPrice(cfg, p.age_group);
    const actualCostTotal = costs.beer + costs.soda + costs.water + pizzaTotal;

    return {
      perCelebrant,
      splitTotal,
      actualCostTotal,
      // O acerto precisa de quanto custou CADA item para saber o que
      // quem pagou aquele item desembolsou. Expor daqui em vez de
      // recalcular lá evita que os dois lados divirjam sobre o mesmo
      // número.
      costPerItem: { beer: costs.beer, soda: costs.soda, water: costs.water, pizza: pizzaTotal },
      closingComplete,
      // verde só com os três custos lançados e as contas fechando
      balances: closingComplete && splitTotal === actualCostTotal,
    };
  }

  /* ---------- acerto: quem transfere quanto para quem ----------
     O rateio diz quanto cada aniversariante DEVE. Aqui entra quanto
     cada um PAGOU: cada item (chopp/refri/água/pizza) tem um pagador, e
     o valor do item é o custo já calculado no fechamento — ninguém
     digita valor, só marca quem pagou.

       saldo = deve - pagou     (positivo = tem a pagar; negativo = a receber)

     Como Σ deve = Σ pagou = custoRealTotal, então Σ saldo = 0 e o acerto
     sempre fecha. As transferências saem do guloso (maior devedor com
     maior credor), que para 3 pessoas é ótimo: no máximo 2.
  ------------------------------------------------------------- */
  const ITEMS = ["beer", "soda", "water", "pizza"];
  const ITEM_NAME = { beer: "chopp", soda: "refrigerante", water: "água", pizza: "pizza" };

  function settlement(splitResult, paidBy) {
    const r = splitResult || {};
    const costs = r.costPerItem || { beer: 0, soda: 0, water: 0, pizza: 0 };
    const pp = paidBy || {};

    const paid = new Map();
    const missingPayer = [];
    for (const item of ITEMS) {
      const amount = costs[item] || 0;
      if (amount <= 0) continue; // item sem custo dispensa pagador
      const k = Number(pp[item]) || null;
      if (!k) { missingPayer.push(item); continue; }
      paid.set(k, (paid.get(k) || 0) + amount);
    }

    // todo aniversariante do rateio entra, mesmo com saldo zero
    const balancesPerCelebrant = (r.perCelebrant || []).map((a) => {
      const p = paid.get(a.celebrantId) || 0;
      return {
        celebrantId: a.celebrantId,
        name: a.name,
        owes: a.total,
        paid: p,
        balance: a.total - p,
      };
    });

    // quem pagou item mas não tem linha no rateio (aniversariante sem
    // cadastro): não pode sumir com o dinheiro dele
    for (const [k, p] of paid) {
      if (!balancesPerCelebrant.some((s) => s.celebrantId === k)) {
        balancesPerCelebrant.push({ celebrantId: k, name: `Aniversariante ${k}`, owes: 0, paid: p, balance: -p });
      }
    }
    balancesPerCelebrant.sort((a, b) => a.celebrantId - b.celebrantId);

    /* status: exige as DUAS condições. Só checar "todo item tem
       pagador" deixaria passar o caso órfão — onde o rateio não confere,
       Σ deve ≠ Σ pagou, Σ saldo ≠ 0 e as transferências não quitam nada.
       O acerto sairia silenciosamente errado. */
    let status = "completo";
    let reason = "";
    if (!r.closingComplete) {
      status = "incompleto";
      reason = "Feche o custo real primeiro: falta lançar o gasto de chopp, refrigerante ou água.";
    } else if (!r.balances) {
      status = "incompleto";
      reason = "As contas do rateio não fecham — resolva isso antes de acertar entre vocês.";
    } else if (missingPayer.length) {
      status = "incompleto";
      reason = "Indique quem pagou: " + missingPayer.map((i) => ITEM_NAME[i]).join(", ") + ".";
    }

    const transfers = status === "completo" ? minimizeTransfers(balancesPerCelebrant) : [];
    return { balancesPerCelebrant, transfers, status, reason, missingPayer };
  }

  // Guloso: casa o maior devedor com o maior credor. Com soma zero e 3
  // pessoas, gera no máximo 2 transferências — que é o mínimo possível.
  function minimizeTransfers(balancesPerCelebrant) {
    const debtors = balancesPerCelebrant.filter((s) => s.balance > 0)
      .map((s) => ({ id: s.celebrantId, name: s.name, left: s.balance }))
      .sort((a, b) => b.left - a.left || a.id - b.id);
    const creditors = balancesPerCelebrant.filter((s) => s.balance < 0)
      .map((s) => ({ id: s.celebrantId, name: s.name, left: -s.balance }))
      .sort((a, b) => b.left - a.left || a.id - b.id);

    const out = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(debtors[i].left, creditors[j].left);
      if (amount > 0) {
        out.push({ from: debtors[i].id, fromName: debtors[i].name,
                   to: creditors[j].id, toName: creditors[j].name, amount });
      }
      debtors[i].left -= amount;
      creditors[j].left -= amount;
      if (debtors[i].left === 0) i++;
      if (creditors[j].left === 0) j++;
    }
    return out;
  }

  /* ---------- resumo do acerto, para compartilhar ----------
     Texto puro (dados -> string), sem DOM e sem rede — como o
     formatarBRL. Fica aqui para entrar no verify e ganhar teste.
     Devolve "" quando o acerto não está completo: sem acerto fechado
     não há o que compartilhar.                                     */
  function settlementSummary(settlementResult, title) {
    const a = settlementResult || {};
    if (a.status !== "completo") return "";

    const header = title ? `${title}\n\n` : "";
    if (!a.transfers || !a.transfers.length) {
      return header + "Ninguém deve nada a ninguém — cada um pagou exatamente a própria parte. 🎉";
    }
    const lines = a.transfers
      .map((t) => `• ${t.fromName} → ${t.toName}: ${formatBRL(t.amount)}`)
      .join("\n");
    return header + "Acerto das contas:\n" + lines;
  }

  /* ---------- export (browser + node) ---------- */
  const API = {
    toCents, toReais, formatBRL,
    confirmedPeople, counts, estimate,
    splitCents, weightsForPerson, pizzaPrice, split,
    settlement, minimizeTransfers, settlementSummary,
    SIXTHS,
  };

  if (typeof module === "object" && module.exports) module.exports = API;
  else root.Calc = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
