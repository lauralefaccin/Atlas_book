// scripts/popular-conteudo.js
//
// Preenche o campo `conteudo` dos livros que são REALMENTE domínio público,
// baixando o texto integral do Project Gutenberg (fonte legal e gratuita).
//
// Como rodar:
//   node scripts/popular-conteudo.js
//
// Requisitos:
//   - Node 18+ (usa fetch nativo)
//   - Seu servidor/máquina precisa ter acesso à internet (gutenberg.org)
//   - As variáveis de ambiente do banco (mesmas do .env usado pelo pool.js)
//
// Como adicionar mais livros:
//   1. Confirme que o autor morreu há mais de 70 anos (domínio público no Brasil)
//      ou que a obra já não tem direitos vigentes.
//   2. Procure o livro em https://www.gutenberg.org/browse/languages/pt
//      (ou em https://www.gutenberg.org se preferir texto no idioma original).
//   3. Pegue o número do eBook na URL, ex: gutenberg.org/ebooks/55752 -> id 55752.
//   4. Adicione uma linha no array LIVROS abaixo, com o "titulo" IGUAL ao que
//      está salvo na coluna `titulo` da tabela `livros`.

import pool from "../src/db/pool.js";

const CONTEUDO_MAX_LENGTH = 3000000; // mesmo limite usado em src/routes/livros.js (ajustado para comportar romances completos)

// título deve bater exatamente com o valor salvo na coluna `titulo`.
// Os campos extras (autor, nacionalidade, ano, genero) só são usados se o
// livro AINDA NÃO existir no banco — nesse caso o script cria a linha
// automaticamente antes de preencher o `conteudo`. Se o livro já existir,
// esses campos são ignorados e só o `conteudo` é atualizado.
const LIVROS = [
  { titulo: "Dom Casmurro", gutenbergId: 55752, autor: "Machado de Assis", nacionalidade: "Brasil", ano: 1899, genero: "Romance" },
  { titulo: "O Cortiço", gutenbergId: 69187, autor: "Aluísio Azevedo", nacionalidade: "Brasil", ano: 1890, genero: "Romance" },

  // Substituí os 3 títulos que só existiam em inglês (Um Estudo em Vermelho,
  // O Cão dos Baskervilles, Assim Falou Zaratustra) por clássicos brasileiros
  // que já são domínio público E já estão em português no Gutenberg
  // (nem precisam de tradução, pois foram escritos originalmente em pt-BR).
  // Machado de Assis (m. 1908) e José de Alencar (m. 1877) — ambos com mais
  // de 70 anos de falecimento, portanto em domínio público no Brasil.
  { titulo: "Memórias Póstumas de Brás Cubas", gutenbergId: 54829, autor: "Machado de Assis", nacionalidade: "Brasil", ano: 1881, genero: "Romance" },
  { titulo: "Iracema", gutenbergId: 67740, autor: "José de Alencar", nacionalidade: "Brasil", ano: 1865, genero: "Romance" },
  { titulo: "Quincas Borba", gutenbergId: 55682, autor: "Machado de Assis", nacionalidade: "Brasil", ano: 1891, genero: "Romance" },

  // Adicione aqui outros livros confirmadamente em domínio público, ex:
  // { titulo: "Vinte Mil Léguas Submarinas", gutenbergId: XXXXX, autor: "Júlio Verne", nacionalidade: "França", ano: 1870, genero: "Ficção científica" },
];

function urlTextoGutenberg(id) {
  return `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`;
}

// O Gutenberg envolve o texto com um cabeçalho/licença e um rodapé de licença.
// Isso remove essas partes, deixando só o conteúdo da obra.
function limparTextoGutenberg(texto) {
  const inicioMarcadores = [
    /\*\*\* START OF (THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i,
  ];
  const fimMarcadores = [
    /\*\*\* END OF (THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i,
  ];

  let corpo = texto;

  for (const re of inicioMarcadores) {
    const m = corpo.match(re);
    if (m) {
      corpo = corpo.slice(m.index + m[0].length);
      break;
    }
  }

  for (const re of fimMarcadores) {
    const m = corpo.match(re);
    if (m) {
      corpo = corpo.slice(0, m.index);
      break;
    }
  }

  return corpo.trim();
}

async function baixarConteudo(gutenbergId) {
  const url = urlTextoGutenberg(gutenbergId);
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Falha ao baixar ${url} — status ${resp.status}`);
  }
  const bruto = await resp.text();
  return limparTextoGutenberg(bruto);
}

async function main() {
  console.log("📚 Populando campo 'conteudo' com textos de domínio público...\n");

  for (const livro of LIVROS) {
    try {
      console.log(`⬇️  Baixando "${livro.titulo}" (Gutenberg #${livro.gutenbergId})...`);
      let conteudo = await baixarConteudo(livro.gutenbergId);

      if (conteudo.length > CONTEUDO_MAX_LENGTH) {
        console.warn(
          `   ⚠️  Texto tem ${conteudo.length} caracteres, cortando para ${CONTEUDO_MAX_LENGTH}.`
        );
        conteudo = conteudo.slice(0, CONTEUDO_MAX_LENGTH);
      }

      const { rowCount } = await pool.query(
        "UPDATE livros SET conteudo = $1 WHERE titulo = $2",
        [conteudo, livro.titulo]
      );

      if (rowCount === 0) {
        // Livro ainda não existe no banco — cria a linha agora, já com o
        // conteúdo, usando os metadados definidos no array LIVROS acima.
        if (!livro.autor) {
          console.warn(
            `   ⚠️  Nenhum livro encontrado com o título "${livro.titulo}" e não há "autor" definido em LIVROS para criá-lo automaticamente. Pulando.`
          );
        } else {
          await pool.query(
            `INSERT INTO livros (titulo, autor, nacionalidade, ano, genero, conteudo, exemplares)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              livro.titulo,
              livro.autor,
              livro.nacionalidade || null,
              livro.ano || null,
              livro.genero || null,
              conteudo,
              1,
            ]
          );
          console.log(
            `   ✨ "${livro.titulo}" não existia no banco — criado agora com ${conteudo.length} caracteres.\n`
          );
        }
      } else {
        console.log(`   ✅ "${livro.titulo}" atualizado com ${conteudo.length} caracteres.\n`);
      }
    } catch (err) {
      console.error(`   ❌ Erro em "${livro.titulo}": ${err.message}\n`);
    }
  }

  await pool.end();
  console.log("🎉 Concluído.");
}

main();