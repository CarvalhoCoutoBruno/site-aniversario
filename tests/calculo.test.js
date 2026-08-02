/* =============================================================
   TESTE DO ARREDONDAMENTO — prova que as contas fecham
   =============================================================
   Sem framework e sem dependência — o projeto não tem build, então o
   teste também não tem. Roda em qualquer um dos três:

       node tests/calculo.test.js
       jsc  js/calculo.js tests/calculo.test.js     (macOS, sem Node)
       abrir tests/calculo.test.html no navegador

   (jsc fica em /System/Library/Frameworks/JavaScriptCore.framework/
    Versions/A/Helpers/jsc — já vem no macOS.)

   O que prova: para milhares de cenários aleatórios (número de
   pessoas, quem bebe o quê, custos reais quebrados), a soma de todas
   as contas individuais é EXATAMENTE o custo real gasto, em centavos.
   Sem isso, o selo "confere" do painel de fechamento seria mentira.
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

/* ---------- gerador determinístico (mulberry32) ----------
   Semente fixa: um teste que falha falha de novo igual, dá para depurar. */
function rng(semente) {
  let a = semente >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gerarPessoas(rand, qtd) {
  const pessoas = [];
  for (let i = 0; i < qtd; i++) {
    const tipo = rand() < 0.25 ? "crianca" : "adulto";
    pessoas.push({
      // ids fora de ordem de propósito: o rateio precisa ordenar sozinho
      id: `p-${String(Math.floor(rand() * 1e9)).padStart(10, "0")}-${i}`,
      rsvp_id: rand() < 0.2 ? null : `g-${Math.floor(rand() * 5)}`,
      nome: `Pessoa ${i}`,
      tipo,
      bebe_agua: rand() < 0.6,
      bebe_refri: rand() < 0.5,
      // criança nunca bebe chopp — mesma regra da constraint do banco
      bebe_chopp: tipo === "adulto" && rand() < 0.5,
      come_pizza: rand() < 0.8,
      papel: "acompanhante",
    });
  }
  return pessoas;
}

/* =============================================================
   1) ratearCentavos — a primitiva
   ============================================================= */
secao("ratearCentavos");

{
  const r = C.ratearCentavos(1000, ["a", "b", "c"]);
  const soma = [...r.values()].reduce((s, v) => s + v, 0);
  ok(soma === 1000, "1000 centavos entre 3 soma 1000", `soma=${soma}`);
  ok(
    [...r.values()].every((v) => v === 333 || v === 334),
    "partes ficam em 333/334",
    JSON.stringify([...r.values()])
  );
}

{
  ok(C.ratearCentavos(500, []).size === 0, "ninguém consumindo devolve vazio");
  const um = C.ratearCentavos(777, ["x"]);
  ok(um.get("x") === 777, "uma pessoa só paga tudo");
}

{
  // determinismo: mesma entrada em outra ordem dá o mesmo resultado
  const a = C.ratearCentavos(1000, ["c", "a", "b"]);
  const b = C.ratearCentavos(1000, ["a", "b", "c"]);
  ok(
    [...b.keys()].every((k) => a.get(k) === b.get(k)),
    "resultado independe da ordem de entrada"
  );
}

{
  const rand = rng(7);
  let todosFecham = true;
  let pior = null;
  for (let i = 0; i < 20000; i++) {
    const n = 1 + Math.floor(rand() * 60);
    const total = Math.floor(rand() * 5_000_00);
    const ids = Array.from({ length: n }, (_, k) => `id-${k}`);
    const partes = C.ratearCentavos(total, ids);
    const soma = [...partes.values()].reduce((s, v) => s + v, 0);
    if (soma !== total) { todosFecham = false; pior = { n, total, soma }; break; }
  }
  ok(todosFecham, "20.000 divisões aleatórias fecham no centavo", JSON.stringify(pior));
}

/* =============================================================
   2) rateio completo — Σ contas === custo real
   ============================================================= */
secao("rateio (Σ contas === custo real)");

{
  const rand = rng(42);
  let falhas = 0;
  let exemplo = null;

  for (let caso = 0; caso < 3000; caso++) {
    const pessoas = gerarPessoas(rand, 1 + Math.floor(rand() * 40));
    const c = C.contagens(pessoas);

    // Só lança custo de bebida que tem consumidor. Bebida sem ninguém
    // é caso de erro de digitação, testado à parte — misturar aqui
    // mascararia uma falha real de arredondamento.
    const custo = (n, teto) => (n > 0 ? (rand() * teto).toFixed(2) : "0");
    const config = {
      // valores quebrados de propósito (dízima garantida)
      custo_real_chopp: custo(c.chopp, 1500),
      custo_real_refri: custo(c.refri, 400),
      custo_real_agua: custo(c.agua, 200),
      preco_pizza_adulto: "45.90",
      preco_pizza_crianca: "24.50",
      preco_real_pizza_adulto: rand() < 0.5 ? "47.33" : null,
      preco_real_pizza_crianca: null,
    };

    const r = C.rateio(pessoas, config, []);
    const somaPessoas = [...r.porPessoa.values()].reduce((s, v) => s + v, 0);
    const somaGrupos = r.porGrupo.reduce((s, g) => s + g.total, 0);

    // toda bebida com custo tem pelo menos um consumidor nestes cenários
    // (o caso sem consumidor é testado à parte, em "regras de negócio")
    const fecha =
      somaPessoas === r.totalRateado &&
      somaGrupos === r.totalRateado &&
      r.totalRateado === r.custoRealTotal;

    if (!fecha) {
      falhas++;
      if (!exemplo) {
        exemplo = {
          pessoas: pessoas.length,
          totalRateado: r.totalRateado,
          custoRealTotal: r.custoRealTotal,
          somaGrupos,
        };
      }
    }
  }

  ok(falhas === 0, "3.000 cenários aleatórios fecham no centavo",
    falhas ? `${falhas} falhas, ex.: ${JSON.stringify(exemplo)}` : null);
}

/* =============================================================
   3) regras de negócio
   ============================================================= */
secao("regras de negócio");

{
  const pessoas = [
    { id: "1", rsvp_id: "g1", nome: "Adulto", tipo: "adulto", bebe_chopp: true, bebe_refri: false, bebe_agua: false, come_pizza: true },
    // criança marcada com chopp: o cálculo ignora, como a constraint do banco
    { id: "2", rsvp_id: "g1", nome: "Criança", tipo: "crianca", bebe_chopp: true, bebe_refri: false, bebe_agua: false, come_pizza: true },
  ];
  const c = C.contagens(pessoas);
  ok(c.chopp === 1, "criança não entra na contagem de chopp", `chopp=${c.chopp}`);
  ok(c.pizzaAdultos === 1 && c.pizzaCriancas === 1, "pizza separada por tipo");

  const r = C.rateio(pessoas, { custo_real_chopp: "100.00", custo_real_refri: "0", custo_real_agua: "0", preco_pizza_adulto: "40.00", preco_pizza_crianca: "20.00" }, []);
  ok(r.porPessoa.get("1") === 100_00 + 40_00, "adulto paga chopp inteiro + pizza",
    `pagou ${r.porPessoa.get("1")}`);
  ok(r.porPessoa.get("2") === 20_00, "criança paga só a pizza dela",
    `pagou ${r.porPessoa.get("2")}`);
}

{
  // quem confirmou paga, tenha ido ou não: a lista de confirmados é a
  // única população. Duas pessoas iguais dividem o barril meio a meio.
  const pessoas = [
    { id: "1", rsvp_id: "g1", tipo: "adulto", bebe_chopp: true, come_pizza: true },
    { id: "2", rsvp_id: "g1", tipo: "adulto", bebe_chopp: true, come_pizza: true },
  ];
  const cfg = { custo_real_chopp: "100.00", custo_real_refri: "0", custo_real_agua: "0", preco_pizza_adulto: "40.00", preco_pizza_crianca: "0" };
  const r = C.rateio(pessoas, cfg, []);
  ok(r.porPessoa.size === 2, "todo confirmado entra no rateio");
  ok(r.porPessoa.get("1") === 90_00 && r.porPessoa.get("2") === 90_00,
    "confirmados dividem o barril igualmente",
    `${r.porPessoa.get("1")} / ${r.porPessoa.get("2")}`);
}

{
  // aniversariante: rsvp_id null vira grupo próprio e paga a própria parte
  const pessoas = [
    { id: "a", rsvp_id: null, nome: "Bruno", tipo: "adulto", bebe_chopp: true, come_pizza: false },
    { id: "b", rsvp_id: "g1", nome: "Convidado", tipo: "adulto", bebe_chopp: true, come_pizza: false },
  ];
  const r = C.rateio(pessoas, { custo_real_chopp: "100.00", custo_real_refri: "0", custo_real_agua: "0" }, [
    { id: "g1", nome_principal: "Convidado", contato: "51999999999" },
  ]);
  ok(r.porGrupo.length === 2, "aniversariante forma grupo próprio");
  const aniv = r.porGrupo.find((g) => g.ehAniversariante);
  ok(aniv && aniv.total === 50_00, "aniversariante paga a própria parte",
    `total=${aniv && aniv.total}`);
}

{
  // custo lançado para bebida que ninguém marcou: pula, sem dividir por
  // zero. O custo continua no total, então o selo cai sozinho.
  const pessoas = [
    { id: "1", rsvp_id: "g1", tipo: "adulto", bebe_chopp: false, bebe_refri: false, bebe_agua: true, come_pizza: false },
  ];
  const r = C.rateio(pessoas, { custo_real_chopp: "300.00", custo_real_refri: "0", custo_real_agua: "10.00" }, []);
  ok(r.porPessoa.get("1") === 10_00, "só a água é rateada; chopp é pulado",
    `pagou ${r.porPessoa.get("1")}`);
  ok(isFinite(r.totalRateado), "não gera NaN/Infinity ao pular a bebida");
  ok(r.totalRateado === 10_00 && r.custoRealTotal === 310_00,
    "o custo da bebida sem consumidor continua no total gasto");
  ok(r.confere === false, "selo cai sozinho quando Σ contas ≠ total gasto");
}

{
  // fechamento incompleto: selo cinza mesmo com as contas batendo
  const pessoas = [{ id: "1", rsvp_id: "g1", tipo: "adulto", bebe_agua: true }];
  const r = C.rateio(pessoas, { custo_real_agua: "10.00" }, []);
  ok(r.fechamentoCompleto === false, "fechamento incompleto é detectado");
  ok(r.confere === false, "selo não fica verde sem todos os custos lançados");
}

/* =============================================================
   4) estimativa
   ============================================================= */
secao("estimativa");

{
  const pessoas = [
    { id: "1", tipo: "adulto", bebe_chopp: true, bebe_refri: true, bebe_agua: true, come_pizza: true },
    { id: "2", tipo: "adulto", bebe_chopp: true, bebe_refri: false, bebe_agua: true, come_pizza: false },
    { id: "3", tipo: "crianca", bebe_chopp: false, bebe_refri: true, bebe_agua: true, come_pizza: true },
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
  // estimativa e fechamento veem a MESMA população: todos os confirmados
  const pessoas = [
    { id: "1", rsvp_id: "g1", tipo: "adulto", bebe_chopp: true, come_pizza: false },
    { id: "2", rsvp_id: null, nome: "Bruno", tipo: "adulto", bebe_chopp: true, come_pizza: false },
  ];
  const e = C.estimativa(pessoas, {});
  const r = C.rateio(pessoas, { custo_real_chopp: "50.00", custo_real_refri: "0", custo_real_agua: "0" }, []);
  ok(e.contagens.chopp === 2 && r.porPessoa.size === 2,
    "estimativa e rateio contam as mesmas pessoas");
}

/* ---------- resultado ---------- */
escrever(`\n${falhou === 0 ? "✓" : "✗"} ${passou} passaram, ${falhou} falharam`);

// saída não-zero quando falha, para servir de gate em qualquer runner
if (falhou > 0) {
  if (typeof process !== "undefined" && process.exit) process.exit(1);
  throw new Error(`${falhou} teste(s) falharam`);
}
