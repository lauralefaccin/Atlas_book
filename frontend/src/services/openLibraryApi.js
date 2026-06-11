/**
 * openLibraryApi.js
 *
 * O que a Open Library realmente fornece:
 *
 * SINOPSE → NÃO vem no search.json. Precisa buscar /works/{key}.json
 *            separadamente, só quando o usuário SELECIONA um livro.
 *            Campo: description (string ou {type, value}).
 *
 * NACIONALIDADE → Não existe como campo direto na API.
 *   Estratégia em camadas (da mais para a menos precisa):
 *   1. /authors/{author_key}.json → campo "bio" (texto livre, às vezes
 *      menciona o país — ex: "American novelist born in...")
 *   2. Fallback: idioma do livro → tabela idioma→nacionalidade
 *      (impreciso, mas melhor que vazio)
 */

const OL_BASE = "https://openlibrary.org";
const MM_BASE = "https://api.mymemory.translated.net/get";

const cacheTraducao = new Map();

// ── Tabela idioma → nacionalidade (fallback) ────────────────
const IDIOMA_NACIONALIDADE = {
  por: "Brasileira", pt: "Brasileira",
  eng: "Britânica",  en: "Britânica",
  spa: "Espanhola",  es: "Espanhola",
  fre: "Francesa",   fra: "Francesa", fr: "Francesa",
  ger: "Alemã",      deu: "Alemã",    de: "Alemã",
  ita: "Italiana",   it: "Italiana",
  rus: "Russa",      ru: "Russa",
  jpn: "Japonesa",   ja: "Japonesa",
  chi: "Chinesa",    zho: "Chinesa",  zh: "Chinesa",
  ara: "Árabe",      ar: "Árabe",
  swe: "Sueca",      nor: "Norueguesa",
  dan: "Dinamarquesa", nld: "Holandesa",
  pol: "Polonesa",   ces: "Tcheca",
  hun: "Húngara",    fin: "Finlandesa",
  tur: "Turca",      gre: "Grega",
  heb: "Israelense", kor: "Coreana",
  hin: "Indiana",
};

// Palavras-chave usadas em bios de autores para extrair nacionalidade
// Formato: [regex, nacionalidade]
const BIO_NACIONALIDADE = [
  [/\b(american|norte.american)\b/i,   "Americana"],
  [/\b(british|english|welsh|scottish|irish)\b/i, "Britânica"],
  [/\b(brazilian|brasileir)/i,          "Brasileira"],
  [/\b(portuguese|portugu[eê]s)\b/i,    "Portuguesa"],
  [/\b(spanish|espanhol|españ)\b/i,     "Espanhola"],
  [/\b(french|franc[eê]s)\b/i,          "Francesa"],
  [/\b(german|alemã|alemão)\b/i,        "Alemã"],
  [/\b(italian|italian[ao])\b/i,        "Italiana"],
  [/\b(russian|russ[ao])\b/i,           "Russa"],
  [/\b(japanese|japonês|japonesa)\b/i,  "Japonesa"],
  [/\b(chinese|chinês|chinesa)\b/i,     "Chinesa"],
  [/\b(arabic|arab|árabe)\b/i,          "Árabe"],
  [/\b(swedish|suec[ao])\b/i,           "Sueca"],
  [/\b(norwegian|noruegu[eê]s)\b/i,     "Norueguesa"],
  [/\b(danish|dinamarqu[eê]s)\b/i,      "Dinamarquesa"],
  [/\b(dutch|holand[eê]s)\b/i,          "Holandesa"],
  [/\b(polish|polon[eê]s)\b/i,          "Polonesa"],
  [/\b(czech|tchec[ao])\b/i,            "Tcheca"],
  [/\b(hungarian|húngar[ao])\b/i,       "Húngara"],
  [/\b(finnish|finland[eê]s)\b/i,       "Finlandesa"],
  [/\b(turkish|turc[ao])\b/i,           "Turca"],
  [/\b(greek|greg[ao])\b/i,             "Grega"],
  [/\b(korean|corean[ao])\b/i,          "Coreana"],
  [/\b(indian|indian[ao]|hindi)\b/i,    "Indiana"],
  [/\b(argentin[ao])\b/i,               "Argentina"],
  [/\b(mexican|mexican[ao])\b/i,        "Mexicana"],
  [/\b(colombian|colombian[ao])\b/i,    "Colombiana"],
  [/\b(chilean|chilen[ao])\b/i,         "Chilena"],
];

function extrairNacionalidadeDaBio(bio) {
  if (!bio) return "";
  for (const [regex, nac] of BIO_NACIONALIDADE) {
    if (regex.test(bio)) return nac;
  }
  return "";
}

function nacionalidadePorIdioma(idioma) {
  return IDIOMA_NACIONALIDADE[(idioma || "").toLowerCase()] || "";
}

// ── Detecção de idioma ──────────────────────────────────────

const PALAVRAS_PT = [
  "de","do","da","dos","das","em","no","na","nos","nas",
  "um","uma","uns","umas","o","a","os","as","e","é",
  "que","com","por","para","como","ao","à","ou","se",
  "sua","seu","ele","ela","não","mais",
];

function parecePT(texto) {
  const tokens = texto.toLowerCase().split(/\s+/);
  const hits = tokens.filter((t) => PALAVRAS_PT.includes(t));
  return hits.length / tokens.length > 0.25;
}

async function detectarIdioma(texto) {
  if (!texto || texto.trim().length < 4) return "pt";
  if (parecePT(texto)) return "pt";
  try {
    const url = `${MM_BASE}?q=${encodeURIComponent(texto.trim())}&langpair=pt-BR|en-US`;
    const res = await fetch(url);
    if (!res.ok) return "pt";
    const data = await res.json();
    const detectedLang = data?.responseData?.detectedLanguage || "";
    if (detectedLang) return detectedLang.toLowerCase().split("-")[0];
    return "pt";
  } catch {
    return "pt";
  }
}

// ── Tradução ────────────────────────────────────────────────

async function traduzir(texto, par) {
  if (!texto || !texto.trim()) return texto;
  const chave = `${par}::${texto.trim()}`;
  if (cacheTraducao.has(chave)) return cacheTraducao.get(chave);
  try {
    const url = `${MM_BASE}?q=${encodeURIComponent(texto.trim())}&langpair=${par}`;
    const res = await fetch(url);
    if (!res.ok) return texto;
    const data = await res.json();
    const raw = data?.responseData?.translatedText || texto;
    const resultado =
      raw.toUpperCase() === raw && texto.toUpperCase() !== texto ? texto : raw;
    cacheTraducao.set(chave, resultado);
    return resultado;
  } catch {
    return texto;
  }
}

async function traduzirSeIngles(texto) {
  if (!texto || !texto.trim()) return texto;
  const temAcentos = /[àáâãäåæçèéêëìíîïðñòóôõöùúûüýþÿ]/i.test(texto);
  if (temAcentos) return texto;
  if (parecePT(texto)) return texto;
  const idioma = await detectarIdioma(texto);
  if (idioma !== "en") return texto;
  return traduzir(texto, "en-US|pt-BR");
}

async function traduzirSeInglesLote(lista) {
  return Promise.all(lista.map((item) => traduzirSeIngles(item)));
}

// ── Ordenação por idioma ────────────────────────────────────

const PRIORIDADE_IDIOMA = { por: 0, pt: 0, eng: 1, en: 1, spa: 2, es: 2 };

function prioridadeIdioma(idioma) {
  return PRIORIDADE_IDIOMA[(idioma || "").toLowerCase()] ?? 3;
}

// ── Busca detalhes extras ao selecionar (sinopse + autor) ───

/**
 * Busca a sinopse em /works/{key}.json
 * Retorna string ou "" se não houver.
 */
async function buscarSinopse(olKey) {
  if (!olKey) return "";
  try {
    const res = await fetch(`${OL_BASE}${olKey}.json`);
    if (!res.ok) return "";
    const data = await res.json();
    const desc = data.description;
    if (!desc) return "";
    // description pode ser string ou { type, value }
    const texto = typeof desc === "string" ? desc : (desc.value || "");
    // Traduz se estiver em inglês
    return traduzirSeIngles(texto.substring(0, 3000));
  } catch {
    return "";
  }
}

/**
 * Busca bio do autor em /authors/{key}.json para extrair nacionalidade.
 * Retorna string ou "".
 */
async function buscarNacionalidadeAutor(authorKey) {
  if (!authorKey) return "";
  try {
    const res = await fetch(`${OL_BASE}${authorKey}.json`);
    if (!res.ok) return "";
    const data = await res.json();
    const bio = typeof data.bio === "string"
      ? data.bio
      : (data.bio?.value || "");
    return extrairNacionalidadeDaBio(bio);
  } catch {
    return "";
  }
}

/**
 * Busca sinopse + nacionalidade ao mesmo tempo (chamado ao selecionar).
 * authorKeys vem do search.json como array de "/authors/OL...".
 */
export async function buscarDetalhesLivro(olKey, authorKeys = [], idiomaFallback = "") {
  const [sinopse, nacAutor] = await Promise.all([
    buscarSinopse(olKey),
    buscarNacionalidadeAutor(authorKeys[0] || ""),
  ]);

  const nacionalidade = nacAutor || nacionalidadePorIdioma(idiomaFallback);

  return { sinopse, nacionalidade };
}

// ── API principal de busca ──────────────────────────────────

/**
 * Busca livros em qualquer idioma.
 * Retorna resultados ordenados PT → EN → ES → outros.
 * Sinopse e nacionalidade NÃO vêm aqui — são buscadas em buscarDetalhesLivro()
 * para não sobrecarregar com requisições extras durante a digitação.
 */
export async function buscarLivrosOpenLibrary(query, limit = 10) {
  if (!query || !query.trim()) return [];

  const idiomaQuery = await detectarIdioma(query.trim());

  let queryBusca = query.trim();
  if (idiomaQuery === "pt") {
    queryBusca = await traduzir(query.trim(), "pt-BR|en-US");
  }

  const url =
    `${OL_BASE}/search.json?q=${encodeURIComponent(queryBusca)}` +
    `&limit=${limit * 2}` +
    `&fields=key,title,author_name,author_key,first_publish_year,publisher,isbn,subject,language`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao buscar na Open Library");

  const data = await res.json();
  const docs = data.docs || [];
  const brutos = docs.map(normalizarLivro);

  const ordenados = [...brutos].sort(
    (a, b) => prioridadeIdioma(a.idioma) - prioridadeIdioma(b.idioma)
  );
  const cortados = ordenados.slice(0, limit);

  const titulos  = await traduzirSeInglesLote(cortados.map((l) => l.titulo));
  const editoras = await traduzirSeInglesLote(cortados.map((l) => l.editora));

  return cortados.map((livro, i) => ({
    ...livro,
    titulo:  titulos[i]  || livro.titulo,
    editora: editoras[i] || livro.editora,
  }));
}

export async function buscarPorISBN(isbn) {
  const limpo = isbn.replace(/[^0-9X]/gi, "");
  if (!limpo) return null;
  const url = `${OL_BASE}/api/books?bibkeys=ISBN:${limpo}&format=json&jscmd=data`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao buscar ISBN na Open Library");
  const data = await res.json();
  const chave = `ISBN:${limpo}`;
  if (!data[chave]) return null;
  return normalizarLivroISBN(data[chave], limpo);
}

export function getCoverUrl(isbn, tamanho = "M") {
  if (!isbn) return null;
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${tamanho}.jpg`;
}

// ── Normalizadores ──────────────────────────────────────────

function normalizarLivro(doc) {
  return {
    olKey:      doc.key || "",
    authorKeys: doc.author_key || [],   // necessário para buscarDetalhesLivro
    titulo:     doc.title || "",
    autor:      (doc.author_name || []).join(", "),
    ano:        doc.first_publish_year || null,
    editora:    (doc.publisher || [])[0] || "",
    isbn:       (doc.isbn || [])[0] || "",
    generos:    (doc.subject || []).slice(0, 5),
    idioma:     (doc.language || [])[0] || "",
  };
}

function normalizarLivroISBN(book, isbn) {
  return {
    olKey:      book.key || "",
    authorKeys: [],
    titulo:     book.title || "",
    autor:      (book.authors || []).map((a) => a.name).join(", "),
    ano:        book.publish_date
      ? parseInt(book.publish_date.match(/\d{4}/)?.[0] || "0", 10) || null
      : null,
    editora:    (book.publishers || []).map((p) => p.name).join(", "),
    isbn,
    generos:    (book.subjects || []).map((s) => s.name).slice(0, 5),
    sinopse:    "",
    idioma:     "",
  };
}