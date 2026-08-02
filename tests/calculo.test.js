/* =============================================================
   TESTE DO RATEIO — prova que as 3 contas fecham
   =============================================================
   Sem framework e sem dependência — o projeto não tem build, então o
   teste também não tem. Roda em qualquer um dos três:

       node tests/calculo.test.js
       jsc  js/calculo.js tests/calculo.test.js     (macOS, sem Node)
       abrir tests/calculo.test.html no navegador

   (jsc fica em /System/Library/Frameworks/JavaScriptCore.framework/
    Versions/A/Helpers/jsc — já vem no macOS.)

   Modelo: quem paga são os 3 aniversariantes. O consumo de cada
   convidado é bancado por quem o convidou, dividido igualmente quando
   há mais de um. A asserção forte: Σ das 3 contas === custo real, em
   centavos, para milhares de cenários aleatórios.
   ============================================================= */

// ---- adaptação de runtime (node / jsc / navegador) ----
const C = typeof require === "function"
  ? require("../js/calculo.js")
  : globalThis.Calculo;

const escrever = typeof console !== "undefined" && console.log
  ? function (m) { console.log(m); }
  : function (m) { print(m); }; // jsc não tem console

if (!C) {
  escrever("Calculo não encontrado — carregue js/calculo.js antes do teste.");
  throw new Error("dependência ausente");
}

let passou = 0;
let falhou = 0;

function ok(condicao, titulo, detalhe) {
  if (condicao) { passou++; return; }
  falhou++;
  escrever(`  ✗ ${titulo}`);
  if (detalhe) escrever(`    ${detalhe}`);
}

function secao(nome) {
  escrever(`\n${nome}`);
}

/* ---------- atalhos de construção ---------- */

let _seq = 0;
const uid = () => `p${String(_seq++).padStart(4, "0")}`;

function aniv(id, nome, consumo) {
  return Object.assign(
    { id: uid(), rsvp_id: null, nome, tipo: "adulto", papel: "aniversariante", aniversariante_id: id },
    consumo || {}
  );
}

function convidado(rsvpId, consumo, tipo) {
  return Object.assign(
    { id: uid(), rsvp_id: rsvpId, nome: null, tipo: tipo || "adulto", papel: "acompanhante", aniversariante_id: null },
    consumo || {}
  );
}

const grupo = (id, convidadoPor) => ({ id, convidado_por: convidadoPor, nome_principal: id, contato: id });

const CHOPP = { bebe_chopp: true };
const PIZZA = { come_pizza: true };

const contaDe = (r, id) => {
  const a = r.porAniversariante.find((x) => x.aniversarianteId === id);
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
secao("ratearCentavos (com pesos)");

{
  // pesos iguais continuam funcionando como antes
  const r = C.ratearCentavos(1000, [{ id: 1, peso: 6 }, { id: 2, peso: 6 }, { id: 3, peso: 6 }]);
  const soma = [...r.values()].reduce((s, v) => s + v, 0);
  ok(soma === 1000, "pesos iguais: soma bate", `soma=${soma}`);
  ok([...r.values()].every((v) => v === 333 || v === 334), "partes em 333/334");
}

{
  // o caso do exemplo: 39 sextos contra 3 sextos (6,5 contra 0,5 pessoa)
  const r = C.ratearCentavos(70000, [{ id: 1, peso: 39 }, { id: 2, peso: 3 }]);
  ok(r.get(1) === 65000 && r.get(2) === 5000,
    "peso 39:3 divide 700,00 em 650,00 / 50,00",
    `${r.get(1)} / ${r.get(2)}`);
}

{
  ok(C.ratearCentavos(500, []).size === 0, "sem itens devolve vazio");
  ok(C.ratearCentavos(500, [{ id: 1, peso: 0 }]).size === 0, "peso zero é ignorado");
  ok(C.ratearCentavos(0, [{ id: 1, peso: 6 }]).size === 0, "custo zero devolve vazio");
}

{
  // determinismo: ordem de entrada não muda o resultado
  const a = C.ratearCentavos(1000, [{ id: 3, peso: 2 }, { id: 1, peso: 2 }, { id: 2, peso: 2 }]);
  const b = C.ratearCentavos(1000, [{ id: 1, peso: 2 }, { id: 2, peso: 2 }, { id: 3, peso: 2 }]);
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
    const itens = Array.from({ length: n }, (_, k) => ({
      id: k + 1,
      peso: [2, 3, 6][Math.floor(rand() * 3)] * (1 + Math.floor(rand() * 20)),
    }));
    const partes = C.ratearCentavos(total, itens);
    const soma = [...partes.values()].reduce((s, v) => s + v, 0);
    if (soma !== total) { todosFecham = false; pior = { total, soma, itens }; break; }
  }
  ok(todosFecham, "20.000 divisões ponderadas fecham no centavo", JSON.stringify(pior));
}

/* =============================================================
   2) atribuição — quem banca o consumo de quem
   ============================================================= */
secao("atribuição de peso");

{
  const grupos = new Map([["g1", grupo("g1", [1])], ["g2", grupo("g2", [1, 3])], ["g3", grupo("g3", [1, 2, 3])]]);
  const soma = (ps) => ps.reduce((s, x) => s + x.peso, 0);

  ok(soma(C.pesosDaPessoa(aniv(1, "Bruno"), grupos)) === 6, "aniversariante vale 1 pessoa inteira");
  ok(soma(C.pesosDaPessoa(convidado("g1"), grupos)) === 6, "convidado de 1 anfitrião vale 1 pessoa");

  const dois = C.pesosDaPessoa(convidado("g2"), grupos);
  ok(dois.length === 2 && dois.every((x) => x.peso === 3), "convidado de 2 divide 50/50");

  const tres = C.pesosDaPessoa(convidado("g3"), grupos);
  ok(tres.length === 3 && tres.every((x) => x.peso === 2), "convidado de 3 divide em três");

  const orfao = C.pesosDaPessoa(convidado("inexistente"), grupos);
  ok(orfao.length === 1 && orfao[0].id === null, "convidado sem grupo fica sem dono");
}

/* =============================================================
   3) o cenário do exemplo — Bruno com 6,5 unidades
   ============================================================= */
secao("cenário do exemplo (×6,5)");

{
  const grupos = [grupo("g1", [1]), grupo("g2", [1]), grupo("g3", [1]),
                  grupo("g4", [1]), grupo("g5", [1]), grupo("gc", [1, 2])];
  const pessoas = [
    aniv(1, "Bruno", CHOPP),
    aniv(2, "Braz"),
    aniv(3, "Bocão"),
    convidado("g1", CHOPP), convidado("g2", CHOPP), convidado("g3", CHOPP),
    convidado("g4", CHOPP), convidado("g5", CHOPP),
    convidado("gc", CHOPP), // dividido entre Bruno e Braz
  ];
  const cfg = { custo_real_chopp: "700.00", custo_real_refri: "0", custo_real_agua: "0" };
  const r = C.rateio(pessoas, cfg, grupos);

  // 7 consumidores -> C = 100,00. Bruno = 6,5 × 100 = 650,00; Braz = 0,5 × 100 = 50,00
  ok(contaDe(r, 1) === 650_00, "Bruno paga 6,5 unidades", `${contaDe(r, 1)}`);
  ok(contaDe(r, 2) === 50_00, "Braz paga a meia unidade do convidado compartilhado", `${contaDe(r, 2)}`);
  ok(contaDe(r, 3) === 0, "Bocão não paga nada", `${contaDe(r, 3)}`);
  ok(r.totalRateado === 700_00 && r.confere === true, "as 3 contas somam o custo real");
}

/* =============================================================
   4) regras do modelo
   ============================================================= */
secao("regras do modelo");

{
  // convidado compartilhado entre 2: metade para cada
  const grupos = [grupo("g1", [1, 2])];
  const pessoas = [aniv(1, "Bruno"), aniv(2, "Braz"), convidado("g1", CHOPP)];
  const r = C.rateio(pessoas, { custo_real_chopp: "100.00", custo_real_refri: "0", custo_real_agua: "0" }, grupos);
  ok(contaDe(r, 1) === 50_00 && contaDe(r, 2) === 50_00,
    "convidado de [1,2] divide 50/50", `${contaDe(r, 1)} / ${contaDe(r, 2)}`);
}

{
  // convidado nunca paga: não existe conta fora dos aniversariantes
  const grupos = [grupo("g1", [1])];
  const pessoas = [aniv(1, "Bruno"), convidado("g1", CHOPP)];
  const r = C.rateio(pessoas, { custo_real_chopp: "80.00", custo_real_refri: "0", custo_real_agua: "0" }, grupos);
  ok(r.porAniversariante.length === 1, "só existem contas de aniversariante");
  ok(r.porAniversariante.every((a) => a.aniversarianteId >= 1 && a.aniversarianteId <= 3),
    "toda conta pertence a um dos 3");
  ok(contaDe(r, 1) === 80_00, "o anfitrião banca o convidado inteiro", `${contaDe(r, 1)}`);
}

{
  // aniversariante paga 100% do próprio consumo
  const pessoas = [aniv(1, "Bruno", CHOPP), aniv(2, "Braz", CHOPP)];
  const r = C.rateio(pessoas, { custo_real_chopp: "100.00", custo_real_refri: "0", custo_real_agua: "0" }, []);
  ok(contaDe(r, 1) === 50_00 && contaDe(r, 2) === 50_00,
    "dois aniversariantes bebendo dividem meio a meio");
}

{
  // pizza é por cabeça, atribuída com o mesmo peso
  const grupos = [grupo("g1", [1]), grupo("g2", [2, 3])];
  const pessoas = [
    aniv(1, "Bruno", PIZZA),
    convidado("g1", PIZZA),
    convidado("g2", PIZZA),
    convidado("g2", PIZZA, "crianca"),
  ];
  const cfg = { custo_real_chopp: "0", custo_real_refri: "0", custo_real_agua: "0",
                preco_pizza_adulto: "50.00", preco_pizza_crianca: "30.00" };
  const r = C.rateio(pessoas, cfg, grupos);
  ok(contaDe(r, 1) === 100_00, "Bruno paga a própria pizza + a do convidado dele", `${contaDe(r, 1)}`);
  ok(contaDe(r, 2) === 40_00 && contaDe(r, 3) === 40_00,
    "pizza de convidado compartilhado divide (50+30)/2", `${contaDe(r, 2)} / ${contaDe(r, 3)}`);
  ok(r.confere === true, "pizza fecha com o total");
}

{
  // criança não conta para chopp, nem no rateio
  const grupos = [grupo("g1", [1])];
  const pessoas = [aniv(1, "Bruno", CHOPP), Object.assign(convidado("g1", CHOPP, "crianca"))];
  const r = C.rateio(pessoas, { custo_real_chopp: "100.00", custo_real_refri: "0", custo_real_agua: "0" }, grupos);
  ok(contaDe(r, 1) === 100_00, "chopp de criança é ignorado, Bruno é o único consumidor",
    `${contaDe(r, 1)}`);
}

{
  // item com custo e sem nenhum consumidor: pulado, selo cai sozinho
  const grupos = [grupo("g1", [1])];
  const pessoas = [aniv(1, "Bruno", { bebe_agua: true }), convidado("g1", { bebe_agua: true })];
  const r = C.rateio(pessoas, { custo_real_chopp: "300.00", custo_real_refri: "0", custo_real_agua: "10.00" }, grupos);
  ok(contaDe(r, 1) === 10_00, "só a água é rateada; chopp é pulado", `${contaDe(r, 1)}`);
  ok(isFinite(r.totalRateado), "não gera NaN/Infinity ao pular o item");
  ok(r.totalRateado === 10_00 && r.custoRealTotal === 310_00, "o custo sem consumidor continua no total");
  ok(r.confere === false, "selo cai sozinho quando Σ ≠ total gasto");
}

{
  // consumo sem dono não pode ser redistribuído silenciosamente
  const pessoas = [aniv(1, "Bruno", CHOPP), convidado("sem-grupo", CHOPP)];
  const r = C.rateio(pessoas, { custo_real_chopp: "100.00", custo_real_refri: "0", custo_real_agua: "0" }, []);
  ok(contaDe(r, 1) === 50_00, "Bruno paga só a parte dele", `${contaDe(r, 1)}`);
  ok(r.totalRateado === 50_00 && r.confere === false,
    "a metade sem dono some do rateio e derruba o selo", `${r.totalRateado}`);
}

{
  // fechamento incompleto: selo cinza mesmo com as contas batendo
  const pessoas = [aniv(1, "Bruno", { bebe_agua: true })];
  const r = C.rateio(pessoas, { custo_real_agua: "10.00" }, []);
  ok(r.fechamentoCompleto === false, "fechamento incompleto é detectado");
  ok(r.confere === false, "selo não fica verde sem todos os custos lançados");
}

/* =============================================================
   5) asserção forte — Σ das 3 contas === custo real
   ============================================================= */
secao("rateio aleatório (Σ 3 contas === custo real)");

{
  const rand = rng(42);
  let falhas = 0;
  let exemplo = null;

  const subconjunto = () => {
    const s = [1, 2, 3].filter(() => rand() < 0.5);
    return s.length ? s : [1 + Math.floor(rand() * 3)];
  };

  for (let caso = 0; caso < 3000; caso++) {
    const grupos = [];
    const pessoas = [];

    // os 3 aniversariantes, com consumo próprio aleatório
    for (let k = 1; k <= 3; k++) {
      pessoas.push(aniv(k, `A${k}`, {
        bebe_agua: rand() < 0.6, bebe_refri: rand() < 0.5,
        bebe_chopp: rand() < 0.5, come_pizza: rand() < 0.8,
      }));
    }

    const nGrupos = 1 + Math.floor(rand() * 12);
    for (let g = 0; g < nGrupos; g++) {
      const gid = `g${g}`;
      grupos.push(grupo(gid, subconjunto()));
      const n = 1 + Math.floor(rand() * 6);
      for (let i = 0; i < n; i++) {
        const tipo = rand() < 0.25 ? "crianca" : "adulto";
        pessoas.push(convidado(gid, {
          bebe_agua: rand() < 0.6, bebe_refri: rand() < 0.5,
          bebe_chopp: tipo === "adulto" && rand() < 0.5,
          come_pizza: rand() < 0.8,
        }, tipo));
      }
    }

    // só lança custo de bebida que tem consumidor — o caso sem
    // consumidor é testado à parte, e misturar mascararia uma falha
    // real de arredondamento atrás de uma diferença esperada
    const c = C.contagens(pessoas);
    const custo = (n, teto) => (n > 0 ? (rand() * teto).toFixed(2) : "0");
    const config = {
      custo_real_chopp: custo(c.chopp, 1500),
      custo_real_refri: custo(c.refri, 400),
      custo_real_agua: custo(c.agua, 200),
      preco_pizza_adulto: "45.90",
      preco_pizza_crianca: "24.50",
      preco_real_pizza_adulto: rand() < 0.5 ? "47.33" : null,
      preco_real_pizza_crianca: null,
    };

    const r = C.rateio(pessoas, config, grupos);
    const somaContas = r.porAniversariante.reduce((s, a) => s + a.total, 0);
    const somaDetalhe = r.porAniversariante.reduce(
      (s, a) => s + a.detalhe.chopp + a.detalhe.refri + a.detalhe.agua + a.detalhe.pizza, 0);

    const fecha =
      somaContas === r.totalRateado &&
      somaDetalhe === r.totalRateado &&
      r.totalRateado === r.custoRealTotal &&
      r.confere === true &&
      r.porAniversariante.length <= 3;

    if (!fecha) {
      falhas++;
      if (!exemplo) {
        exemplo = {
          grupos: grupos.length, pessoas: pessoas.length,
          totalRateado: r.totalRateado, custoRealTotal: r.custoRealTotal,
          confere: r.confere, contas: r.porAniversariante.length,
        };
      }
    }
  }

  ok(falhas === 0, "3.000 cenários aleatórios fecham no centavo",
    falhas ? `${falhas} falhas, ex.: ${JSON.stringify(exemplo)}` : null);
}

/* =============================================================
   6) estimativa — NÃO muda com o modelo de rateio
   ============================================================= */
secao("estimativa");

{
  const pessoas = [
    aniv(1, "Bruno", { bebe_chopp: true, bebe_refri: true, bebe_agua: true, come_pizza: true }),
    convidado("g1", { bebe_chopp: true, bebe_agua: true }),
    convidado("g1", { bebe_refri: true, bebe_agua: true, come_pizza: true }, "crianca"),
  ];
  const e = C.estimativa(pessoas, {
    litros_chopp_por_adulto: 2.0,
    litros_refri_por_pessoa: 0.6,
    litros_agua_por_pessoa: 0.5,
    preco_litro_chopp: "18.00",
    preco_litro_refri: "6.00",
    preco_litro_agua: "3.00",
    preco_pizza_adulto: "45.00",
    preco_pizza_crianca: "25.00",
  });

  ok(e.litrosChopp === 4, "2 adultos com chopp × 2,0 = 4 L", `${e.litrosChopp}`);
  ok(e.litrosRefri === 1.2, "2 pessoas com refri × 0,6 = 1,2 L", `${e.litrosRefri}`);
  ok(e.litrosAgua === 1.5, "3 pessoas com água × 0,5 = 1,5 L", `${e.litrosAgua}`);
  ok(e.pizzaAdultos === 1 && e.pizzaCriancas === 1, "pizzas por tipo");
  // 4×18 + 1,2×6 + 1,5×3 + 45 + 25 = 72 + 7,20 + 4,50 + 70 = 153,70
  ok(e.custoEstimado === 153_70, "custo estimado bate", `${e.custoEstimado}`);
}

{
  // a estimativa conta o aniversariante como qualquer pessoa
  const pessoas = [aniv(1, "Bruno", { bebe_chopp: true }), convidado("g1", { bebe_chopp: true })];
  const e = C.estimativa(pessoas, {});
  ok(e.contagens.chopp === 2 && e.litrosChopp === 4,
    "aniversariante entra no volume a comprar", `${e.litrosChopp}`);
}

/* ---------- resultado ---------- */
escrever(`\n${falhou === 0 ? "✓" : "✗"} ${passou} passaram, ${falhou} falharam`);

// saída não-zero quando falha, para servir de gate em qualquer runner
if (falhou > 0) {
  if (typeof process !== "undefined" && process.exit) process.exit(1);
  throw new Error(`${falhou} teste(s) falharam`);
}
