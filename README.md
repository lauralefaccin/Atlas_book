# AtlasBook

Sistema de gerenciamento de biblioteca online com dois perfis de usuário: **bibliotecário** (administração do acervo e dos usuários) e **leitor** (consulta ao acervo, leitura e estante pessoal).

Um dos objetivos do projeto é permitir que o leitor **leia os livros dentro do próprio sistema**, usando o leitor embutido da [Internet Archive](https://archive.org) (apenas edições em português e de leitura livre) ou o texto cadastrado no próprio acervo.

---

## Componentes deste repositório

Este repositório (`Atlas_book`) reúne os dois sistemas que compõem o AtlasBook:

| Pasta / arquivo | Finalidade |
|---|---|
| `backend/` | API REST (Node.js + Express). Faz autenticação com JWT, controla permissões por perfil, e persiste usuários, livros, autores, gêneros e estantes no PostgreSQL. Sobe na porta **3001**. |
| `frontend/` | Interface web (React + Vite). Telas de login/cadastro, acervo, detalhes e leitura do livro, estante pessoal, autores, gêneros e gestão de usuários. Sobe na porta **5173** e consome a API em `http://localhost:3001/api`. |
| `backend/src/db/` | `init.js` cria as tabelas e os dados iniciais (gêneros, autores, 30 livros de exemplo, administrador e leitores de exemplo); `reset.js` apaga as tabelas. |
| `backend/src/services/internetArchive.js` | Busca, na Internet Archive, uma edição em português e de leitura livre de cada livro de exemplo durante o `db:init`. |
| `backend/scripts/` | Scripts auxiliares: `testar-api.js` (teste automático da API) e `popular-conteudo.js` (baixa textos de domínio público do Project Gutenberg para o campo `conteudo`). |
| `api.yaml` | Especificação OpenAPI (resumida) da API. |
| `docs/ROTEIRO_DE_TESTES.md` | Roteiro de testes manuais (cadastro, autenticação, livros, estante, permissões e persistência). |
| `Dockerfile` (em `backend/` e `frontend/`) e `docker-compose.yml` | Empacotamento em contêineres. Veja a observação na seção [Docker](#docker). |

---

## Tecnologias

- **Frontend:** React 19, React Router DOM, Vite
- **Backend:** Node.js (ES Modules), Express, JWT, bcrypt
- **Banco de dados:** PostgreSQL
- **APIs externas:** Open Library (busca de dados ao cadastrar livros) e Internet Archive (leitura embutida)

---

## Pré-requisitos

- Node.js 20 ou superior
- PostgreSQL em execução na máquina (porta padrão 5432)
- Acesso à internet (opcional, mas necessário para a busca na Open Library e na Internet Archive)

---

## Como executar (ambiente local)

Abra **dois terminais**: um para o backend e outro para o frontend.

### 1. Banco de dados

Crie o banco no PostgreSQL:

```sql
CREATE DATABASE atlasbook;
```

### 2. Backend

```bash
cd backend
npm install
```

Crie o arquivo `backend/.env` (copie de `.env.example`) e preencha:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=atlasbook
DB_USER=postgres
DB_PASSWORD=sua_senha
JWT_SECRET=uma_chave_secreta_longa
PORT=3001
```

> ⚠️ `JWT_SECRET` é **obrigatório**. Sem ele o login retorna erro. Nunca envie o `.env` para o GitHub (ele já está no `.gitignore`).

Crie as tabelas e os dados iniciais:

```bash
npm run db:init
```

> O `db:init` também consulta a Internet Archive para os livros de exemplo e pode levar alguns segundos. Se faltar internet, ele continua normalmente e apenas deixa os livros sem leitura embutida.

Inicie o servidor:

```bash
npm run dev
```

O backend ficará disponível em `http://localhost:3001`. Ao iniciar, ele também cria/atualiza as tabelas que faltarem, **sem apagar dados existentes**.

Se precisar recriar o banco do zero (apaga tudo):

```bash
npm run db:reset
npm run db:init
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend ficará disponível em `http://localhost:5173`.

> O backend aceita requisições apenas da origem `http://localhost:5173` (CORS) e o frontend aponta para `http://localhost:3001/api`. Se mudar alguma dessas portas, ajuste `backend/src/server.js` e `frontend/src/services/api.js`.

---

## Acesso inicial

Após `npm run db:init`, é criado um administrador:

| Campo | Valor |
|-------|-------|
| Tipo  | Bibliotecário |
| Login | `admin` |
| Senha | `admin123` |

Altere essa senha (tela **Leitores → Editar**) antes de usar o sistema fora de testes.

---

## Perfis e controle de acesso

| Ação | Sem login | Leitor | Bibliotecário |
|---|:-:|:-:|:-:|
| Cadastrar-se (cria conta de **leitor**) | ✅ | — | — |
| Entrar no sistema | ✅ | ✅ | ✅ |
| Ver acervo, autores e gêneros; ler livros | ❌ | ✅ | ✅ |
| Gerenciar a própria estante (adicionar, status, favoritos) | ❌ | ✅ | ✅ |
| Cadastrar, editar e excluir livros, autores e gêneros | ❌ | ❌ | ✅ |
| Listar, criar, editar e remover usuários | ❌ | ❌ | ✅ |
| **Criar conta de bibliotecário** | ❌ | ❌ | ✅ |

Regras importantes:

- O **cadastro público só cria leitores**. A tela de cadastro não oferece a opção de bibliotecário e o backend recusa (`403`) qualquer tentativa de cadastro público com `tipo: "bibliotecario"`.
- **Contas de bibliotecário só são criadas por um bibliotecário autenticado**, na tela **Leitores → + Novo Usuário** (rota `POST /api/usuarios`).
- As permissões são verificadas **no backend** (middlewares `authMiddleware` e `soBibliotecario`), e não apenas escondendo botões no frontend.
- Senhas são armazenadas com hash (bcrypt) e a sessão usa token JWT com validade de 8 horas.
- A sessão do navegador fica em `sessionStorage`: ao fechar a aba, é preciso entrar novamente. Os dados (livros, usuários, estantes) ficam no PostgreSQL e permanecem após reiniciar a aplicação.

---

## Funcionalidades

### Bibliotecário
- Gerenciar livros do acervo (cadastrar com busca automática na Open Library, editar, excluir)
- Gerenciar autores e gêneros literários
- Gerenciar usuários: cadastrar leitores e bibliotecários, alterar login/senha e remover

### Leitor
- Navegar e pesquisar o acervo
- Ler o livro dentro do sistema (leitor da Internet Archive ou texto do acervo)
- Montar a estante pessoal com status (Lendo, Pretendo Ler, Finalizado, Desistiu) e favoritos

### Geral
- Autenticação com JWT e login automático após o cadastro
- Dashboard com estatísticas do acervo

---

## Leitura de livros (Internet Archive)

Ao cadastrar um livro, o sistema procura na Internet Archive uma edição **em português** e de **leitura livre** (livros em empréstimo controlado não podem ser incorporados). Se encontrar, o identificador é salvo no campo `archive_id` e o botão **Ler** abre o leitor da Internet Archive dentro da página. Caso contrário, é exibido o texto do campo "Conteúdo do livro" (ou a sinopse). Obras ainda protegidas por direitos autorais geralmente ficam sem leitura embutida.

---

## Testes

- **Manual:** siga o roteiro em [`docs/ROTEIRO_DE_TESTES.md`](docs/ROTEIRO_DE_TESTES.md).
- **Automático (API):** com o backend rodando, em outro terminal:

```bash
cd backend
node scripts/testar-api.js fase1
# reinicie o backend (Ctrl+C e npm run dev)
node scripts/testar-api.js fase2
```

A fase 1 testa cadastro, autenticação, permissões, livros e estante; a fase 2 confirma que os dados persistiram após o reinício.

---

## Resumo da API

Base: `http://localhost:3001/api` — todas as rotas, exceto `/auth/*`, exigem o cabeçalho `Authorization: Bearer <token>`.

| Rota | Quem acessa |
|---|---|
| `POST /auth/login`, `POST /auth/cadastro` (somente leitor) | Público |
| `GET /livros`, `GET /livros/:id`, `GET /autores`, `GET /generos` | Leitor e bibliotecário |
| `POST/PUT/DELETE /livros`, `/autores`, `/generos` | Bibliotecário |
| `GET/POST/PATCH/DELETE /estante...` | Usuário logado (apenas a própria estante) |
| `GET/POST /usuarios`, `PUT/DELETE /usuarios/:tipo/:id`, `/leitores` | Bibliotecário |

A especificação completa está em `api.yaml`.

---

## Docker

O repositório contém `Dockerfile`s e um `docker-compose.yml`, mas essa configuração **ainda não foi validada de ponta a ponta** e, no estado atual, não sobe o sistema completo sem ajustes:

- o `docker-compose.yml` usa imagens publicadas externamente (`filipecasa/meu-backend:v1` e `filipecasa/meu-frontend:v1`) e expõe o backend na porta 5000, enquanto a aplicação escuta em `PORT` (padrão 3001) e o frontend chama `http://localhost:3001`;
- não define `JWT_SECRET` para o backend;
- o `Dockerfile` do frontend executa `npm start`, mas o `package.json` do frontend não possui esse script;
- o CORS do backend só aceita `http://localhost:5173`.

Para executar o sistema, use as instruções da seção [Como executar](#como-executar-ambiente-local). Apenas o PostgreSQL pode ser iniciado via Docker, se preferir:

```bash
docker run --name atlas_banco -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=atlasbook -p 5432:5432 -d postgres:15-alpine
```

(nesse caso use `DB_PASSWORD=postgres` no `.env`).