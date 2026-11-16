/**
 * testar-api.js — teste de fumaça (smoke test) da API do AtlasBook.
 *
 * Verifica controle de acesso, permissões, livros, estante e persistência.
 * Roda contra um backend JÁ em execução (npm run dev / npm start) e usa
 * apenas o fetch nativo do Node (Node 18+), sem dependências extras.
 *
 * Uso (com o backend rodando em outro terminal):
 *   node scripts/testar-api.js fase1    -> cria dados e confere permissões
 *   (reinicie o backend: Ctrl+C e npm run dev)
 *   node scripts/testar-api.js fase2    -> confere se os dados persistiram
 *
 * Variável opcional: BASE_URL (padrão http://localhost:3001/api)
 */
import fs from "fs";
import os from "os";
import path from "path";

const BASE = process.env.BASE_URL || "http://localhost:3001/api";
const ESTADO = path.join(os.tmpdir(), "atlasbook-teste-estado.json");
const fase = process.argv[2] || "fase1";

let ok = 0;
let falhas = 0;

async function http(metodo, rota, { token, corpo } = {}) {
  const res = await fetch(`${BASE}${rota}`, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  });
  const dados = await res.json().catch(() => ({}));
  return { status: res.status, dados };
}

function checar(descricao, condicao, detalhe = "") {
  if (condicao) {
    ok++;
    console.log(`  ✅ ${descricao}`);
  } else {
    falhas++;
    console.log(`  ❌ ${descricao} ${detalhe}`);
  }
}

async function login(loginVal, senha, tipo) {
  const r = await http("POST", "/auth/login", { corpo: { login: loginVal, senha, tipo } });
  return r.status === 200 ? r.dados.token : null;
}

async function fase1() {
  const sufixo = Date.now().toString().slice(-6);
  const loginLeitor = `teste_leitor_${sufixo}`;
  const loginLeitor2 = `teste_leitor2_${sufixo}`;
  const loginBib = `teste_bib_${sufixo}`;

  console.log("\n[1] Cadastro público e controle de acesso");
  let r = await http("POST", "/auth/cadastro", {
    corpo: { nome: "Hacker", login: `hack_${sufixo}`, senha: "1234", tipo: "bibliotecario" },
  });
  checar("Cadastro público como bibliotecário é recusado (403)", r.status === 403, `status=${r.status}`);
  checar("A conta de bibliotecário NÃO foi criada (login falha)",
    (await login(`hack_${sufixo}`, "1234", "bibliotecario")) === null);

  r = await http("POST", "/auth/cadastro", {
    corpo: { nome: "Leitor Teste", cpf: `T${sufixo}`, login: loginLeitor, senha: "1234", tipo: "leitor" },
  });
  checar("Cadastro público como leitor funciona (201)", r.status === 201, `status=${r.status}`);

  r = await http("POST", "/auth/cadastro", {
    corpo: { nome: "Leitor Dois", login: loginLeitor2, senha: "1234" },
  });
  checar("Cadastro público sem 'tipo' cria leitor (201)", r.status === 201, `status=${r.status}`);

  r = await http("POST", "/auth/cadastro", {
    corpo: { nome: "Duplicado", login: loginLeitor, senha: "1234", tipo: "leitor" },
  });
  checar("Login duplicado é recusado (409)", r.status === 409, `status=${r.status}`);

  r = await http("POST", "/auth/cadastro", {
    corpo: { nome: "CPF repetido", cpf: `T${sufixo}`, login: `outro_${sufixo}`, senha: "1234" },
  });
  checar("CPF duplicado é recusado (409, não 500)", r.status === 409, `status=${r.status}`);

  r = await http("POST", "/auth/cadastro", { corpo: { nome: "Curta", login: `c_${sufixo}`, senha: "12" } });
  checar("Senha curta é recusada (400)", r.status === 400, `status=${r.status}`);

  console.log("\n[2] Autenticação");
  const tokenAdmin = await login("admin", "admin123", "bibliotecario");
  checar("Login do admin (bibliotecário) funciona", !!tokenAdmin);
  const tokenLeitor = await login(loginLeitor, "1234", "leitor");
  checar("Login do leitor funciona", !!tokenLeitor);
  const tokenLeitor2 = await login(loginLeitor2, "1234", "leitor");
  checar("Login do segundo leitor funciona", !!tokenLeitor2);
  checar("Senha errada é recusada", (await login(loginLeitor, "errada", "leitor")) === null);
  checar("Leitor não consegue logar como bibliotecário",
    (await login(loginLeitor, "1234", "bibliotecario")) === null);
  r = await http("GET", "/livros");
  checar("Rota protegida sem token retorna 401", r.status === 401, `status=${r.status}`);
  r = await http("GET", "/livros", { token: "token.invalido.aqui" });
  checar("Token inválido retorna 401", r.status === 401, `status=${r.status}`);

  console.log("\n[3] Leitor NÃO acessa operações de bibliotecário");
  const livroModelo = { titulo: "Livro Proibido", autor: "Autor X", genero: "Ficção" };
  const proibidas = [
    ["POST", "/livros", livroModelo],
    ["PUT", "/livros/1", livroModelo],
    ["DELETE", "/livros/1"],
    ["POST", "/autores", { nome: "Autor Proibido" }],
    ["PUT", "/autores/1", { nome: "X" }],
    ["DELETE", "/autores/1"],
    ["POST", "/generos", { nome: "Gênero Proibido", cor: "#000000" }],
    ["PUT", "/generos/1", { nome: "X" }],
    ["DELETE", "/generos/1"],
    ["GET", "/leitores"],
    ["POST", "/leitores", { nome: "X", login: "x", senha: "1234" }],
    ["GET", "/usuarios"],
    ["POST", "/usuarios", { tipo: "bibliotecario", nome: "Hacker", login: `h2_${sufixo}`, senha: "1234" }],
    ["PUT", "/usuarios/leitor/1", { login: "novo" }],
    ["DELETE", "/usuarios/leitor/1"],
  ];
  for (const [metodo, rota, corpo] of proibidas) {
    r = await http(metodo, rota, { token: tokenLeitor, corpo });
    checar(`Leitor em ${metodo} ${rota} -> 403`, r.status === 403, `status=${r.status}`);
  }
  checar("Leitor não virou bibliotecário via POST /usuarios",
    (await login(`h2_${sufixo}`, "1234", "bibliotecario")) === null);

  console.log("\n[4] Bibliotecário cria outro bibliotecário (rota administrativa)");
  r = await http("POST", "/usuarios", {
    token: tokenAdmin,
    corpo: { tipo: "bibliotecario", nome: "Bibliotecário Novo", login: loginBib, senha: "1234" },
  });
  checar("Admin cria bibliotecário (201)", r.status === 201, `status=${r.status}`);
  checar("Novo bibliotecário consegue logar", !!(await login(loginBib, "1234", "bibliotecario")));
  r = await http("POST", "/usuarios", {
    token: tokenAdmin,
    corpo: { tipo: "admin", nome: "Tipo inválido", login: `i_${sufixo}`, senha: "1234" },
  });
  checar("Tipo de usuário inválido é recusado (400)", r.status === 400, `status=${r.status}`);

  console.log("\n[5] Gerenciamento de livros (bibliotecário)");
  r = await http("POST", "/livros", {
    token: tokenAdmin,
    corpo: { titulo: `Livro de Teste ${sufixo}`, autor: "Autor Teste", genero: "Ficção", editora: "Editora T", ano: 2024 },
  });
  checar("Bibliotecário cadastra livro (201)", r.status === 201, `status=${r.status}`);
  const livroId = r.dados.id;
  r = await http("PUT", `/livros/${livroId}`, {
    token: tokenAdmin,
    corpo: { titulo: `Livro de Teste ${sufixo} (editado)`, autor: "Autor Teste", genero: "Ficção", ano: 2025 },
  });
  checar("Bibliotecário edita livro (200)", r.status === 200 && r.dados.ano === 2025, `status=${r.status}`);
  r = await http("GET", `/livros/${livroId}`, { token: tokenLeitor });
  checar("Leitor consegue LER o livro (GET)", r.status === 200, `status=${r.status}`);
  r = await http("POST", "/livros", { token: tokenAdmin, corpo: { titulo: "Sem autor" } });
  checar("Livro sem autor é recusado (400)", r.status === 400, `status=${r.status}`);

  console.log("\n[6] Estante pessoal");
  r = await http("POST", `/estante/${livroId}`, { token: tokenLeitor });
  checar("Leitor adiciona livro à estante (201)", r.status === 201, `status=${r.status}`);
  r = await http("PATCH", `/estante/${livroId}`, { token: tokenLeitor, corpo: { status: "Lendo" } });
  checar("Leitor altera status para 'Lendo'", r.status === 200, `status=${r.status}`);
  r = await http("PATCH", `/estante/${livroId}/favorito`, { token: tokenLeitor });
  checar("Leitor marca como favorito", r.status === 200 && r.dados.is_favorito === true, `status=${r.status}`);
  r = await http("PATCH", `/estante/${livroId}`, { token: tokenLeitor, corpo: { status: "Qualquer coisa" } });
  checar("Status inválido é recusado (400)", r.status === 400, `status=${r.status}`);
  r = await http("GET", "/estante", { token: tokenLeitor });
  const item = Array.isArray(r.dados) ? r.dados.find((l) => l.id === livroId) : null;
  checar("Estante do leitor lista o livro com status/favorito",
    !!item && item.status === "Lendo" && item.is_favorito === true);
  r = await http("GET", "/estante", { token: tokenLeitor2 });
  checar("Estante é privada: outro leitor NÃO vê o livro",
    r.status === 200 && !r.dados.some((l) => l.id === livroId));
  r = await http("POST", "/estante/999999", { token: tokenLeitor });
  checar("Adicionar livro inexistente à estante NÃO dá erro 500", r.status !== 500, `status=${r.status}`);

  fs.writeFileSync(ESTADO, JSON.stringify({ sufixo, loginLeitor, loginLeitor2, loginBib, livroId }));
  console.log(`\nEstado salvo em ${ESTADO}`);
  console.log("➡  Agora REINICIE o backend e rode: node scripts/testar-api.js fase2");
}

async function fase2() {
  if (!fs.existsSync(ESTADO)) {
    console.log("Rode a fase1 antes.");
    process.exit(1);
  }
  const { loginLeitor, loginLeitor2, loginBib, livroId } = JSON.parse(fs.readFileSync(ESTADO, "utf8"));

  console.log("\n[7] Persistência após reiniciar o backend");
  const tokenAdmin = await login("admin", "admin123", "bibliotecario");
  checar("Admin ainda loga", !!tokenAdmin);
  checar("Leitor cadastrado antes do restart ainda loga", !!(await login(loginLeitor, "1234", "leitor")));
  checar("Bibliotecário criado antes do restart ainda loga", !!(await login(loginBib, "1234", "bibliotecario")));

  const tokenLeitor = await login(loginLeitor, "1234", "leitor");
  const tokenLeitor2 = await login(loginLeitor2, "1234", "leitor");
  let r = await http("GET", `/livros/${livroId}`, { token: tokenLeitor });
  checar("Livro cadastrado continua existindo", r.status === 200, `status=${r.status}`);
  r = await http("GET", "/estante", { token: tokenLeitor });
  const item = Array.isArray(r.dados) ? r.dados.find((l) => l.id === livroId) : null;
  checar("Livro continua na estante do leitor", !!item);
  checar("Status 'Lendo' persistiu", item?.status === "Lendo", `status=${item?.status}`);
  checar("Favorito persistiu", item?.is_favorito === true);
  r = await http("GET", "/estante", { token: tokenLeitor2 });
  checar("Estante do outro leitor continua sem o livro", !r.dados.some((l) => l.id === livroId));
  r = await http("GET", "/livros", { token: tokenLeitor });
  checar("Acervo inicial (seed) continua com 30 livros ou mais", Array.isArray(r.dados) && r.dados.length >= 30,
    `total=${r.dados?.length}`);

  console.log("\n[8] Remoção de livro e limpeza da estante");
  r = await http("DELETE", `/livros/${livroId}`, { token: tokenAdmin });
  checar("Bibliotecário exclui o livro (200)", r.status === 200, `status=${r.status}`);
  r = await http("GET", "/estante", { token: tokenLeitor });
  checar("Livro excluído some da estante do leitor", !r.dados.some((l) => l.id === livroId));
}

console.log(`AtlasBook — teste de API (${fase}) em ${BASE}`);
try {
  if (fase === "fase2") await fase2();
  else await fase1();
} catch (err) {
  console.error("\nErro ao executar os testes (o backend está rodando?):", err.message);
  process.exit(1);
}
console.log(`\nResultado: ${ok} passaram, ${falhas} falharam.`);
process.exit(falhas ? 1 : 0);