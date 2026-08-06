/* =============================================================
   TESTE DO RATEIO — prova que as 3 contas fecham
   =============================================================
   Sem framework e sem dependência — o projeto não tem build, então o
   teste também não tem. Roda em qualquer um dos três:

       node tests/calc.test.js
       jsc  js/calc.js tests/calc.test.js     (macOS, sem Node)
       abrir tests/calc.test.html no navegador

   (jsc fica em /System/Library/Frameworks/JavaScriptCore.framework/
    Versions/A/Helpers/jsc — já vem no macOS.)

   Modelo: quem paga são os 3 aniversariantes. O consumo de cada
   convidado é bancado por quem o convidou, dividido igualmente quando
   há mais de um. A asserção forte: Σ das 3 contas === custo real, em
   centavos, para milhares de cenários aleatórios.
   ============================================================= */

// ---- adaptação de runtime (node / jsc / navegador) ----
const C = typeof require === "function"
  ? require("../js/calc.js")
  : globalThis.Calc;

const write = typeof console !== "undefined" && console.log
  ? function (m) { console.log(m); }
  : function (m) { print(m); }; // jsc não tem console

if (!C) {
  write("Calc não encontrado — carregue js/calc.js antes do teste.");
  throw new Error("dependência ausente");
}

let passou = 0;
let falhou = 0;

function ok(condicao, title, breakdown) {
  if (condicao) { passou++; return; }
  falhou++;
  write(`  ✗ ${title}`);
  if (breakdown) write(`    ${breakdown}`);
}

function section(name) {
  write(`\n${name}`);
}

/* ---------- atalhos de construção ---------- */

let _seq = 0;
const uid = () => `p${String(_seq++).padStart(4, "0")}`;

function celebrant(id, name, consumo) {
  return Object.assign(
    { id: uid(), rsvp_id: null, name, age_group: "adult", role: "celebrant", celebrant_id: id },
    consumo || {}
  );
}

function guest(rsvpId, consumo, age_group) {
  return Object.assign(
    { id: uid(), rsvp_id: rsvpId, name: null, age_group: age_group || "adult", role: "companion", celebrant_id: null },
    consumo || {}
  );
}

const group = (id, invitedBy) => ({ id, invited_by: invitedBy, lead_name: id, contact: id });

const BEER = { wants_beer: true };
const PIZZA = { wants_pizza: true };

const accountOf = (r, id) => {
  const a = r.perCelebrant.find((x) => x.celebrantId === id);
  return a ? a.total : 0;
};

/* ---------- gerador determinístico (mulberry32) ----------
   Semente fixa: um teste que falha falha de novo igual. */
function rng(semente) {
  let a = semente >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* =============================================================
   1) ratearCentavos — a primitiva, agora com PESOS
   ============================================================= */
section("ratearCentavos (com pesos)");

{
  // pesos iguais continuam funcionando como antes
  const r = C.splitCents(1000, [{ id: 1, weight: 6 }, { id: 2, weight: 6 }, { id: 3, weight: 6 }]);
  const sum = [...r.values()].reduce((s, v) => s + v, 0);
  ok(sum === 1000, "pesos iguais: soma bate", `soma=${sum}`);
  ok([...r.values()].every((v) => v === 333 || v === 334), "partes em 333/334");
}

{
  // o caso do exemplo: 39 sextos contra 3 sextos (6,5 contra 0,5 pessoa)
  const r = C.splitCents(70000, [{ id: 1, weight: 39 }, { id: 2, weight: 3 }]);
  ok(r.get(1) === 65000 && r.get(2) === 5000,
    "peso 39:3 divide 700,00 em 650,00 / 50,00",
    `${r.get(1)} / ${r.get(2)}`);
}

{
  ok(C.splitCents(500, []).size === 0, "sem itens devolve vazio");
  ok(C.splitCents(500, [{ id: 1, weight: 0 }]).size === 0, "peso zero é ignorado");
  ok(C.splitCents(0, [{ id: 1, weight: 6 }]).size === 0, "custo zero devolve vazio");
}

{
  // determinismo: ordem de entrada não muda o resultado
  const a = C.splitCents(1000, [{ id: 3, weight: 2 }, { id: 1, weight: 2 }, { id: 2, weight: 2 }]);
  const b = C.splitCents(1000, [{ id: 1, weight: 2 }, { id: 2, weight: 2 }, { id: 3, weight: 2 }]);
  ok([...b.keys()].every((k) => a.get(k) === b.get(k)), "resultado independe da ordem de entrada");
}

{
  const rand = rng(7);
  let todosFecham = true;
  let pior = null;
  for (let i = 0; i < 20000; i++) {
    const n = 1 + Math.floor(rand() * 3);
    const total = Math.floor(rand() * 5_000_00);
    // pesos como os reais: múltiplos de 2, 3 ou 6 sextos
    const items = Array.from({ length: n }, (_, k) => ({
      id: k + 1,
      weight: [2, 3, 6][Math.floor(rand() * 3)] * (1 + Math.floor(rand() * 20)),
    }));
    const partes = C.splitCents(total, items);
    const sum = [...partes.values()].reduce((s, v) => s + v, 0);
    if (sum !== total) { todosFecham = false; pior = { total, sum, items }; break; }
  }
  ok(todosFecham, "20.000 divisões ponderadas fecham no centavo", JSON.stringify(pior));
}

/* =============================================================
   2) atribuição — quem banca o consumo de quem
   ============================================================= */
section("atribuição de peso");

{
  const groups = new Map([["g1", group("g1", [1])], ["g2", group("g2", [1, 3])], ["g3", group("g3", [1, 2, 3])]]);
  const sum = (ps) => ps.reduce((s, x) => s + x.weight, 0);

  ok(sum(C.weightsForPerson(celebrant(1, "Bruno"), groups)) === 6, "aniversariante vale 1 pessoa inteira");
  ok(sum(C.weightsForPerson(guest("g1"), groups)) === 6, "convidado de 1 anfitrião vale 1 pessoa");

  const dois = C.weightsForPerson(guest("g2"), groups);
  ok(dois.length === 2 && dois.every((x) => x.weight === 3), "convidado de 2 divide 50/50");

  const tres = C.weightsForPerson(guest("g3"), groups);
  ok(tres.length === 3 && tres.every((x) => x.weight === 2), "convidado de 3 divide em três");

  const orfao = C.weightsForPerson(guest("inexistente"), groups);
  ok(orfao.length === 1 && orfao[0].id === null, "convidado sem grupo fica sem dono");
}

/* =============================================================
   3) o cenário do exemplo — Bruno com 6,5 unidades
   ============================================================= */
section("cenário do exemplo (×6,5)");

{
  const groups = [group("g1", [1]), group("g2", [1]), group("g3", [1]),
                  group("g4", [1]), group("g5", [1]), group("gc", [1, 2])];
  const people = [
    celebrant(1, "Bruno", BEER),
    celebrant(2, "Braz"),
    celebrant(3, "Bocão"),
    guest("g1", BEER), guest("g2", BEER), guest("g3", BEER),
    guest("g4", BEER), guest("g5", BEER),
    guest("gc", BEER), // dividido entre Bruno e Braz
  ];
  const cfg = { actual_beer_cost: "700.00", actual_soda_cost: "0", actual_water_cost: "0" };
  const r = C.split(people, cfg, groups);

  // 7 consumidores -> C = 100,00. Bruno = 6,5 × 100 = 650,00; Braz = 0,5 × 100 = 50,00
  ok(accountOf(r, 1) === 650_00, "Bruno paga 6,5 unidades", `${accountOf(r, 1)}`);
  ok(accountOf(r, 2) === 50_00, "Braz paga a meia unidade do convidado compartilhado", `${accountOf(r, 2)}`);
  ok(accountOf(r, 3) === 0, "Bocão não paga nada", `${accountOf(r, 3)}`);
  ok(r.splitTotal === 700_00 && r.balances === true, "as 3 contas somam o custo real");
}

/* =============================================================
   4) regras do modelo
   ============================================================= */
section("regras do modelo");

{
  // convidado compartilhado entre 2: metade para cada
  const groups = [group("g1", [1, 2])];
  const people = [celebrant(1, "Bruno"), celebrant(2, "Braz"), guest("g1", BEER)];
  const r = C.split(people, { actual_beer_cost: "100.00", actual_soda_cost: "0", actual_water_cost: "0" }, groups);
  ok(accountOf(r, 1) === 50_00 && accountOf(r, 2) === 50_00,
    "convidado de [1,2] divide 50/50", `${accountOf(r, 1)} / ${accountOf(r, 2)}`);
}

{
  // convidado nunca paga: não existe conta fora dos aniversariantes
  const groups = [group("g1", [1])];
  const people = [celebrant(1, "Bruno"), guest("g1", BEER)];
  const r = C.split(people, { actual_beer_cost: "80.00", actual_soda_cost: "0", actual_water_cost: "0" }, groups);
  ok(r.perCelebrant.length === 1, "só existem contas de aniversariante");
  ok(r.perCelebrant.every((a) => a.celebrantId >= 1 && a.celebrantId <= 3),
    "toda conta pertence a um dos 3");
  ok(accountOf(r, 1) === 80_00, "o anfitrião banca o convidado inteiro", `${accountOf(r, 1)}`);
}

{
  // aniversariante paga 100% do próprio consumo
  const people = [celebrant(1, "Bruno", BEER), celebrant(2, "Braz", BEER)];
  const r = C.split(people, { actual_beer_cost: "100.00", actual_soda_cost: "0", actual_water_cost: "0" }, []);
  ok(accountOf(r, 1) === 50_00 && accountOf(r, 2) === 50_00,
    "dois aniversariantes bebendo dividem meio a meio");
}

{
  // pizza é por cabeça, atribuída com o mesmo peso
  const groups = [group("g1", [1]), group("g2", [2, 3])];
  const people = [
    celebrant(1, "Bruno", PIZZA),
    guest("g1", PIZZA),
    guest("g2", PIZZA),
    guest("g2", PIZZA, "child"),
  ];
  const cfg = { actual_beer_cost: "0", actual_soda_cost: "0", actual_water_cost: "0",
                adult_pizza_price: "50.00", child_pizza_price: "30.00" };
  const r = C.split(people, cfg, groups);
  ok(accountOf(r, 1) === 100_00, "Bruno paga a própria pizza + a do convidado dele", `${accountOf(r, 1)}`);
  ok(accountOf(r, 2) === 40_00 && accountOf(r, 3) === 40_00,
    "pizza de convidado compartilhado divide (50+30)/2", `${accountOf(r, 2)} / ${accountOf(r, 3)}`);
  ok(r.balances === true, "pizza fecha com o total");
}

{
  // criança não conta para chopp, nem no rateio
  const groups = [group("g1", [1])];
  const people = [celebrant(1, "Bruno", BEER), Object.assign(guest("g1", BEER, "child"))];
  const r = C.split(people, { actual_beer_cost: "100.00", actual_soda_cost: "0", actual_water_cost: "0" }, groups);
  ok(accountOf(r, 1) === 100_00, "chopp de criança é ignorado, Bruno é o único consumidor",
    `${accountOf(r, 1)}`);
}

{
  // item com custo e sem nenhum consumidor: pulado, selo cai sozinho
  const groups = [group("g1", [1])];
  const people = [celebrant(1, "Bruno", { wants_water: true }), guest("g1", { wants_water: true })];
  const r = C.split(people, { actual_beer_cost: "300.00", actual_soda_cost: "0", actual_water_cost: "10.00" }, groups);
  ok(accountOf(r, 1) === 10_00, "só a água é rateada; chopp é pulado", `${accountOf(r, 1)}`);
  ok(isFinite(r.splitTotal), "não gera NaN/Infinity ao pular o item");
  ok(r.splitTotal === 10_00 && r.actualCostTotal === 310_00, "o custo sem consumidor continua no total");
  ok(r.balances === false, "selo cai sozinho quando Σ ≠ total gasto");
}

{
  // consumo sem dono não pode ser redistribuído silenciosamente
  const people = [celebrant(1, "Bruno", BEER), guest("sem-grupo", BEER)];
  const r = C.split(people, { actual_beer_cost: "100.00", actual_soda_cost: "0", actual_water_cost: "0" }, []);
  ok(accountOf(r, 1) === 50_00, "Bruno paga só a parte dele", `${accountOf(r, 1)}`);
  ok(r.splitTotal === 50_00 && r.balances === false,
    "a metade sem dono some do rateio e derruba o selo", `${r.splitTotal}`);
}

{
  // fechamento incompleto: selo cinza mesmo com as contas batendo
  const people = [celebrant(1, "Bruno", { wants_water: true })];
  const r = C.split(people, { actual_water_cost: "10.00" }, []);
  ok(r.closingComplete === false, "fechamento incompleto é detectado");
  ok(r.balances === false, "selo não fica verde sem todos os custos lançados");
}

/* =============================================================
   5) asserção forte — Σ das 3 contas === custo real
   ============================================================= */
section("rateio aleatório (Σ 3 contas === custo real)");

{
  const rand = rng(42);
  let falhas = 0;
  let exemplo = null;

  const subconjunto = () => {
    const s = [1, 2, 3].filter(() => rand() < 0.5);
    return s.length ? s : [1 + Math.floor(rand() * 3)];
  };

  for (let caso = 0; caso < 3000; caso++) {
    const groups = [];
    const people = [];

    // os 3 aniversariantes, com consumo próprio aleatório
    for (let k = 1; k <= 3; k++) {
      people.push(celebrant(k, `A${k}`, {
        wants_water: rand() < 0.6, wants_soda: rand() < 0.5,
        wants_beer: rand() < 0.5, wants_pizza: rand() < 0.8,
      }));
    }

    const groupCount = 1 + Math.floor(rand() * 12);
    for (let g = 0; g < groupCount; g++) {
      const gid = `g${g}`;
      groups.push(group(gid, subconjunto()));
      const n = 1 + Math.floor(rand() * 6);
      for (let i = 0; i < n; i++) {
        const age_group = rand() < 0.25 ? "child" : "adult";
        people.push(guest(gid, {
          wants_water: rand() < 0.6, wants_soda: rand() < 0.5,
          wants_beer: age_group === "adult" && rand() < 0.5,
          wants_pizza: rand() < 0.8,
        }, age_group));
      }
    }

    // só lança custo de bebida que tem consumidor — o caso sem
    // consumidor é testado à parte, e misturar mascararia uma falha
    // real de arredondamento atrás de uma diferença esperada
    const c = C.counts(people);
    const cost = (n, teto) => (n > 0 ? (rand() * teto).toFixed(2) : "0");
    const settings = {
      actual_beer_cost: cost(c.beer, 1500),
      actual_soda_cost: cost(c.soda, 400),
      actual_water_cost: cost(c.water, 200),
      adult_pizza_price: "45.90",
      child_pizza_price: "24.50",
      actual_adult_pizza_price: rand() < 0.5 ? "47.33" : null,
      actual_child_pizza_price: null,
    };

    const r = C.split(people, settings, groups);
    const accountsSum = r.perCelebrant.reduce((s, a) => s + a.total, 0);
    const breakdownSum = r.perCelebrant.reduce(
      (s, a) => s + a.breakdown.beer + a.breakdown.soda + a.breakdown.water + a.breakdown.pizza, 0);

    const fecha =
      accountsSum === r.splitTotal &&
      breakdownSum === r.splitTotal &&
      r.splitTotal === r.actualCostTotal &&
      r.balances === true &&
      r.perCelebrant.length <= 3;

    if (!fecha) {
      falhas++;
      if (!exemplo) {
        exemplo = {
          groups: groups.length, people: people.length,
          splitTotal: r.splitTotal, actualCostTotal: r.actualCostTotal,
          balances: r.balances, accounts: r.perCelebrant.length,
        };
      }
    }
  }

  ok(falhas === 0, "3.000 cenários aleatórios fecham no centavo",
    falhas ? `${falhas} falhas, ex.: ${JSON.stringify(exemplo)}` : null);
}

/* =============================================================
   6) acerto — quem transfere quanto para quem
   ============================================================= */
section("acerto");

// monta um resultado de rateio no formato que o acerto consome
function fakeSplit(owes, costs, options) {
  const o = options || {};
  const total = costs.beer + costs.soda + costs.water + costs.pizza;
  return {
    perCelebrant: owes.map(([id, name, t]) => ({ celebrantId: id, name, total: t, breakdown: {} })),
    splitTotal: owes.reduce((a, d) => a + d[2], 0),
    actualCostTotal: total,
    costPerItem: costs,
    closingComplete: o.closingComplete !== false,
    balances: o.balances !== false,
  };
}

{
  // o caso do ×6,5: Bruno deve 650 e pagou o chopp de 700
  const r = fakeSplit([[1, "Bruno", 65000], [2, "Braz", 5000], [3, "Bocão", 0]],
                        { beer: 70000, soda: 0, water: 0, pizza: 0 });
  const a = C.settlement(r, { beer: 1 });
  const s = (k) => a.balancesPerCelebrant.find((x) => x.celebrantId === k);

  ok(a.status === "completo", "status completo", a.reason);
  ok(s(1).paid === 70000 && s(1).balance === -5000, "Bruno pagou 700 e tem 50 a receber",
    JSON.stringify(s(1)));
  ok(s(2).balance === 5000, "Braz tem 50 a pagar", JSON.stringify(s(2)));
  ok(s(3).balance === 0, "Bocão não deve nem recebe");
  ok(a.transfers.length === 1, "uma única transferência");
  const t = a.transfers[0];
  ok(t.from === 2 && t.to === 1 && t.amount === 5000,
    "Braz → Bruno R$ 50,00", JSON.stringify(t));
}

{
  // item sem custo não precisa de pagador; item COM custo precisa
  const r = fakeSplit([[1, "Bruno", 5000], [2, "Braz", 5000], [3, "Bocão", 0]],
                        { beer: 10000, soda: 0, water: 0, pizza: 0 });
  ok(C.settlement(r, { beer: 1 }).status === "completo", "item de custo zero dispensa pagador");
  const ownerless = C.settlement(r, {});
  ok(ownerless.status === "incompleto", "item com custo e sem pagador barra");
  ok(/chopp/.test(ownerless.reason), "o motivo nomeia o item", ownerless.reason);
  ok(ownerless.transfers.length === 0, "sem acerto falso quando falta pagador");
}

{
  // o catch: rateio que não confere (órfão) não pode gerar acerto,
  // mesmo com todos os pagadores marcados
  const r = fakeSplit([[1, "Bruno", 10000], [2, "Braz", 0], [3, "Bocão", 0]],
                        { beer: 10000, soda: 8000, water: 0, pizza: 0 }, { balances: false });
  const a = C.settlement(r, { beer: 1, soda: 2 });
  ok(a.status === "incompleto", "rateio que não confere barra o acerto");
  ok(a.transfers.length === 0, "e não gera transferência que não quitaria nada");
}

{
  const r = fakeSplit([[1, "Bruno", 0], [2, "Braz", 0], [3, "Bocão", 0]],
                        { beer: 0, soda: 0, water: 0, pizza: 0 }, { closingComplete: false });
  const a = C.settlement(r, {});
  ok(a.status === "incompleto" && /custo real/i.test(a.reason),
    "fechamento incompleto adia o acerto", a.reason);
}

{
  // quem pagou mas não tem linha no rateio não pode sumir com o dinheiro
  const r = fakeSplit([[1, "Bruno", 10000]], { beer: 10000, soda: 0, water: 0, pizza: 0 });
  const a = C.settlement(r, { beer: 2 });
  const braz = a.balancesPerCelebrant.find((x) => x.celebrantId === 2);
  ok(braz && braz.paid === 10000 && braz.balance === -10000,
    "pagador sem linha no rateio entra como credor", JSON.stringify(braz));
}

{
  // asserção forte: Σ saldo = 0 e as transferências zeram tudo
  const rand = rng(99);
  let falhas = 0, maxT = 0, exemplo = null;

  for (let caso = 0; caso < 20000; caso++) {
    const costs = {
      beer: Math.floor(rand() * 200000), soda: Math.floor(rand() * 50000),
      water: Math.floor(rand() * 20000), pizza: Math.floor(rand() * 80000),
    };
    const total = costs.beer + costs.soda + costs.water + costs.pizza;
    // reparte o total entre os 3 (o rateio real garante que Σ deve = total)
    const d1 = Math.floor(rand() * (total + 1));
    const d2 = Math.floor(rand() * (total - d1 + 1));
    const r = fakeSplit([[1, "A", d1], [2, "B", d2], [3, "C", total - d1 - d2]], costs);
    const pp = {};
    for (const i of ["beer", "soda", "water", "pizza"]) pp[i] = 1 + Math.floor(rand() * 3);

    const a = C.settlement(r, pp);
    const sum = a.balancesPerCelebrant.reduce((x, s) => x + s.balance, 0);

    // aplica as transferências e confere que todo mundo zera
    const fim = new Map(a.balancesPerCelebrant.map((s) => [s.celebrantId, s.balance]));
    for (const t of a.transfers) {
      fim.set(t.from, fim.get(t.from) - t.amount);
      fim.set(t.to, fim.get(t.to) + t.amount);
    }
    const zerou = [...fim.values()].every((v) => v === 0);
    maxT = Math.max(maxT, a.transfers.length);

    if (sum !== 0 || !zerou) {
      falhas++;
      if (!exemplo) exemplo = { costs, balancesPerCelebrant: a.balancesPerCelebrant, transfers: a.transfers };
    }
  }

  ok(falhas === 0, "20.000 acertos aleatórios: Σ saldo = 0 e as transferências zeram tudo",
    falhas ? `${falhas} falhas, ex.: ${JSON.stringify(exemplo)}` : null);
  ok(maxT <= 2, "nunca mais de 2 transferências entre 3 pessoas", `máximo observado: ${maxT}`);
}

{
  // resumo compartilhável
  const r = fakeSplit([[1, "Bruno", 65000], [2, "Braz", 5000], [3, "Bocão", 0]],
                        { beer: 70000, soda: 0, water: 0, pizza: 0 });
  const a = C.settlement(r, { beer: 1 });

  const txt = C.settlementSummary(a, "Festa dos 160 anos 🎉");
  ok(/Festa dos 160 anos/.test(txt), "o resumo abre com o título", txt);
  ok(/Braz → Bruno: R\$\s*50,00/.test(txt), "lista a transferência com valor", txt);
  ok(txt.split("\n").filter((l) => l.startsWith("•")).length === 1,
    "uma linha por transferência");

  // acerto incompleto não tem o que compartilhar
  const incompleto = C.settlement(fakeSplit([[1, "Bruno", 100]], { beer: 100, soda: 0, water: 0, pizza: 0 }), {});
  ok(C.settlementSummary(incompleto, "x") === "", "acerto incompleto devolve string vazia");

  // completo SEM transferências: cada um pagou a própria parte
  const quites = C.settlement(fakeSplit([[1, "Bruno", 10000], [2, "Braz", 0], [3, "Bocão", 0]],
                                      { beer: 10000, soda: 0, water: 0, pizza: 0 }), { beer: 1 });
  const txtQuites = C.settlementSummary(quites, "T");
  ok(quites.transfers.length === 0, "ninguém deve nada nesse cenário");
  ok(/Ninguém deve nada/.test(txtQuites), "texto próprio em vez de lista vazia", txtQuites);
}

/* =============================================================
   7) estimativa — NÃO muda com o modelo de rateio
   ============================================================= */
section("estimativa");

{
  const people = [
    celebrant(1, "Bruno", { wants_beer: true, wants_soda: true, wants_water: true, wants_pizza: true }),
    guest("g1", { wants_beer: true, wants_water: true }),
    guest("g1", { wants_soda: true, wants_water: true, wants_pizza: true }, "child"),
  ];
  const e = C.estimate(people, {
    beer_liters_per_adult: 2.0,
    soda_liters_per_person: 0.6,
    water_liters_per_person: 0.5,
    beer_price_per_liter: "18.00",
    soda_price_per_liter: "6.00",
    water_price_per_liter: "3.00",
    adult_pizza_price: "45.00",
    child_pizza_price: "25.00",
  });

  ok(e.beerLiters === 4, "2 adultos com chopp × 2,0 = 4 L", `${e.beerLiters}`);
  ok(e.sodaLiters === 1.2, "2 pessoas com refri × 0,6 = 1,2 L", `${e.sodaLiters}`);
  ok(e.waterLiters === 1.5, "3 pessoas com água × 0,5 = 1,5 L", `${e.waterLiters}`);
  ok(e.adultPizzas === 1 && e.childPizzas === 1, "pizzas por tipo");
  // 4×18 + 1,2×6 + 1,5×3 + 45 + 25 = 72 + 7,20 + 4,50 + 70 = 153,70
  ok(e.estimatedCost === 153_70, "custo estimado bate", `${e.estimatedCost}`);
}

{
  // a estimativa conta o aniversariante como qualquer pessoa
  const people = [celebrant(1, "Bruno", { wants_beer: true }), guest("g1", { wants_beer: true })];
  const e = C.estimate(people, {});
  ok(e.counts.beer === 2 && e.beerLiters === 4,
    "aniversariante entra no volume a comprar", `${e.beerLiters}`);
}

/* ---------- resultado ---------- */
write(`\n${falhou === 0 ? "✓" : "✗"} ${passou} passaram, ${falhou} falharam`);

// saída não-zero quando falha, para servir de gate em qualquer runner
if (falhou > 0) {
  if (typeof process !== "undefined" && process.exit) process.exit(1);
  throw new Error(`${falhou} teste(s) falharam`);
}
