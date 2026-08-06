// =============================================================
//  CONFIGURAÇÃO DO SITE
// =============================================================
//
//  Só as chaves do Supabase moram aqui. Tudo o mais é editável pelo
//  painel, sem precisar de `git push`:
//
//   • título, data, local, mapa e os nomes  → seção "Convite"
//   • preços, taxas e prazo                 → seção "Preços, taxas e prazo"
//
//  A chave abaixo é a "publishable"/anon, pública por natureza: a
//  segurança está nas regras de acesso (RLS) do banco, não nela.
//
// -------------------------------------------------------------

window.CONFIG = {
  supabase: {
    url: "https://mbzuxkvrrtvbgkikrivh.supabase.co",
    anonKey: "sb_publishable_K86bohNhtKvfzytzszn_YA_UlNN2iDL",
    // O bucket se chama "fotos" e é LEGADO de propósito: renomear bucket
    // no Supabase não é rename, é criar outro e mover objeto a objeto, e
    // há foto de verdade lá dentro. Ganho cosmético, risco de perder
    // imagem — fica assim. Não é esquecimento.
    photosBucket: "fotos",
  },
};
