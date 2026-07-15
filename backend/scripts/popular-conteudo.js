// scripts/sincronizar-conteudo.js
//
// Varre a tabela `livros` inteira, acha os que ainda não têm `conteudo`
// (isso inclui os que você acabou de cadastrar via Open Library no site),
// procura cada um na API pública do Gutendex (busca sobre o catálogo do
// Project Gutenberg) e baixa o texto dos que forem realmente domínio
// público.
//
// MODO SEGURO (padrão): só MOSTRA o que encontraria, não grava nada.
//   node scripts/sincronizar-conteudo.js
//
// MODO APLICAR: baixa e grava de verdade no banco.
//   node scripts/sincronizar-conteudo.js --aplicar
//
// Requisitos: Node 18+, acesso à internet (gutendex.com e gutenberg.org).

import pool from "../src/db/pool.js";

const CONTEUDO_MAX_LENGTH = 3000000;
const APLICAR = process.argv.includes("--aplicar");

// Similaridade simples de texto (0 a 1) baseada em palavras em comum.
// Não precisa de biblioteca externa, só compara os "tokens" dos títulos.
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function similaridade(a, b) {
  const tokensA = new Set(normalizar(a).split(/\s+/).filter(Boolean));
  const tokensB = new Set(normalizar(b).split(/\s+/).filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let comuns = 0;
  for (const t of tokensA) if (tokensB.has(t)) comuns++;
  return comuns / Math.max(tokensA.size, tokensB.size);
}

async function buscarNoGutendex(titulo, autor) {
  const query = encodeURIComponent(`${titulo} ${autor || ""}`.trim());
  const resp = await fetch(`https://gutendex.com/books?search=${query}`);
  if (!resp.ok) throw new Error(`Gutendex respondeu ${resp.status}`);
  const data = await resp.json();
  return data.results || [];
}

// Escolhe o melhor resultado entre os candidatos retornados pelo Gutendex.
function melhorCandidato(livroDb, resultados) {
  const candidatos = resultados
    // Só aceita livros que o próprio Gutenberg marca como sem direitos
    // autorais vigentes. copyright pode ser true, false ou null
    // (null = "não verificado" — por segurança, também descartamos).
    .filter((r) => r.copyright === false)
    .map((r) => {
      const simTitulo = similaridade(livroDb.titulo, r.title);
      const simAutor = livroDb.autor && r.authors?.[0]?.name
        ? similaridade(livroDb.autor, r.authors[0].name)
        : 0;
      const temPortugues = r.languages?.includes("pt");
      // Nome de autor é muito mais estável entre idiomas do que título
      // (ex: "Dom Quixote" x "El ingenioso hidalgo don Quijote de la
      // Mancha" não têm nenhuma palavra em comum, mas "Miguel de
      // Cervantes" bate nos dois catálogos). Por isso o autor pesa mais.
      const score = simAutor * 0.65 + simTitulo * 0.35 + (temPortugues ? 0.15 : 0);
      return { r, simTitulo, simAutor, temPortugues, score };
    })
    // Aceita se o autor bate razoavelmente OU o título bate bem —
    // não exige mais as duas coisas ao mesmo tempo.
    .filter((c) => c.simAutor >= 0.5 || c.simTitulo >= 0.5)
    .sort((a, b) => b.score - a.score);

  return candidatos[0] || null;
}

function urlTextoPlano(formats) {
  // Procura primeiro um .txt em português (se listado separadamente),
  // depois qualquer text/plain.
  const chaves = Object.keys(formats || {});
  const chaveTexto = chaves.find((k) => k.startsWith("text/plain"));
  return chaveTexto ? formats[chaveTexto] : null;
}

function limparTextoGutenberg(texto) {
  let corpo = texto;
  const inicio = corpo.match(/\*\*\* START OF (THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i);
  if (inicio) corpo = corpo.slice(inicio.index + inicio[0].length);
  const fim = corpo.match(/\*\*\* END OF (THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i);
  if (fim) corpo = corpo.slice(0, fim.index);
  return corpo.trim();
}

async function main() {
  console.log(
    APLICAR
      ? "📚 Sincronizando (MODO APLICAR — vai gravar no banco)...\n"
      : "🔍 Sincronizando (MODO SEGURO — só mostrando o que encontraria)...\n"
  );

  const { rows: livrosSemConteudo } = await pool.query(
    "SELECT id, titulo, autor FROM livros WHERE conteudo IS NULL OR conteudo = ''"
  );

  if (livrosSemConteudo.length === 0) {
    console.log("Nenhum livro pendente — todos já têm conteúdo (ou o banco está vazio).");
    await pool.end();
    return;
  }

  console.log(`Encontrados ${livrosSemConteudo.length} livro(s) sem conteúdo. Verificando cada um...\n`);

  for (const livro of livrosSemConteudo) {
    try {
      console.log(`🔎 "${livro.titulo}" — ${livro.autor}`);
      const resultados = await buscarNoGutendex(livro.titulo, livro.autor);
      const candidato = melhorCandidato(livro, resultados);

      if (!candidato) {
        console.log("   ➖ Não achei uma versão de domínio público confiável no Gutenberg.\n");
        continue;
      }

      const urlTexto = urlTextoPlano(candidato.r.formats);
      if (!urlTexto) {
        console.log(`   ➖ Achei "${candidato.r.title}", mas sem versão em texto puro disponível.\n`);
        continue;
      }

      const idioma = candidato.r.languages?.join(",") || "desconhecido";
      console.log(
        `   ✅ Match: "${candidato.r.title}" (Gutenberg #${candidato.r.id}, idioma: ${idioma}, ` +
        `similaridade título: ${(candidato.simTitulo * 100).toFixed(0)}%)`
      );

      if (!APLICAR) {
        console.log("   (modo seguro — nada foi baixado nem gravado)\n");
        continue;
      }

      const resp = await fetch(urlTexto);
      if (!resp.ok) throw new Error(`Falha ao baixar texto — status ${resp.status}`);
      let conteudo = limparTextoGutenberg(await resp.text());

      if (conteudo.length > CONTEUDO_MAX_LENGTH) {
        conteudo = conteudo.slice(0, CONTEUDO_MAX_LENGTH);
        console.log(`   ⚠️  Texto cortado em ${CONTEUDO_MAX_LENGTH} caracteres.`);
      }

      await pool.query("UPDATE livros SET conteudo = $1 WHERE id = $2", [conteudo, livro.id]);
      console.log(`   💾 Gravado no banco (${conteudo.length} caracteres).\n`);
    } catch (err) {
      console.error(`   ❌ Erro em "${livro.titulo}": ${err.message}\n`);
    }
  }

  await pool.end();
  console.log(
    APLICAR
      ? "🎉 Concluído."
      : "🎉 Concluído (modo seguro). Rode com --aplicar para gravar de verdade."
  );
}

main();