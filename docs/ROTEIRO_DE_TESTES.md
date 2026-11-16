# Roteiro de testes — AtlasBook

Use este roteiro para testar o sistema manualmente e **anotar o resultado de cada passo** (coluna "Obtido") para a apresentação. Marque ✅ se o resultado foi o esperado e ❌ se não foi (descreva em "Observações").

- **Data do teste:** ____/____/______
- **Responsável:** ______________________
- **Navegador / versão:** ______________________

---

## 0. Preparação

1. PostgreSQL rodando e banco `atlasbook` criado.
2. Backend: `cd backend` → `npm install` → `npm run db:init` → `npm run dev` (porta 3001).
3. Frontend: `cd frontend` → `npm install` → `npm run dev` (porta 5173).
4. Abrir `http://localhost:5173`.
5. Contas usadas neste roteiro:

| Conta | Tipo | Login | Senha |
|---|---|---|---|
| Administrador (criado pelo `db:init`) | Bibliotecário | `admin` | `admin123` |
| Leitora de teste (será criada no passo A2) | Leitor | `maria` | `1234` |
| Segundo leitor de teste (passo A6) | Leitor | `joao` | `1234` |
| Bibliotecário de teste (será criado no passo D1) | Bibliotecário | `bib2` | `1234` |

> Se `maria`, `joao` ou `bib2` já existirem de testes anteriores, use outros logins ou rode `npm run db:reset` e `npm run db:init`.

---

## A. Cadastro público (controle de acesso)

| # | Passo | Resultado esperado | Obtido | Observações |
|---|---|---|:-:|---|
| A1 | Na tela de login, clicar em **Cadastrar**. | O formulário **não** oferece a escolha "Bibliotecário"; aparece o aviso de que o cadastro cria conta de leitor. | | |
| A2 | Cadastrar: nome `Maria Teste`, login `maria`, senha `1234`, confirmar `1234`. | Conta criada e login automático; barra lateral mostra o perfil **Leitor**; **não** aparece o item "Leitores" no menu. | | |
| A3 | Sair (logout) e cadastrar novamente com o mesmo login `maria`. | Mensagem de erro "Login já cadastrado". | | |
| A4 | Cadastrar com senha de 2 caracteres. | Mensagem "A senha deve ter no mínimo 4 caracteres". | | |
| A5 | Cadastrar com senhas diferentes em "Senha" e "Confirmar senha". | Mensagem "As senhas não coincidem". | | |
| A6 | Cadastrar `joao` (senha `1234`) informando um CPF (ex.: `111.111.111-11`); depois sair e tentar cadastrar outra pessoa com o **mesmo CPF**. | Segundo cadastro recusado com mensagem "CPF ou login já cadastrado" (sem erro de servidor). | | |

---

## B. Autenticação

| # | Passo | Resultado esperado | Obtido | Observações |
|---|---|---|:-:|---|
| B1 | Entrar como **Bibliotecário**: `admin` / `admin123`. | Acesso ao sistema; menu inclui **Leitores**. | | |
| B2 | Sair. Entrar como **Leitor** com `maria` / senha errada. | Mensagem "Login ou senha incorretos". | | |
| B3 | Entrar como **Bibliotecário** usando o login `maria` (que é leitora) e a senha correta. | Recusado ("Login ou senha incorretos"): leitor não entra como bibliotecário. | | |
| B4 | Entrar corretamente como leitor `maria`. | Acesso ao sistema com perfil **Leitor**. | | |
| B5 | Com o sistema aberto, digitar manualmente `http://localhost:5173/leitores` na barra do navegador (logado como leitor). | Redireciona para o início; a tela de Leitores não é exibida. | | |
| B6 | Fechar a aba e abrir o sistema novamente. | Pede login novamente (a sessão fica em `sessionStorage`). | | |

---

## C. Permissões — o que o leitor **não** pode fazer

### C1–C3: pela interface (logado como leitor `maria`)

| # | Passo | Resultado esperado | Obtido | Observações |
|---|---|---|:-:|---|
| C1 | Abrir **Livros**. | Não aparecem os botões **+ Adicionar Livro**, **Editar** e **Excluir**. | | |
| C2 | Abrir **Autores** e **Gêneros**. | Sem opções de cadastrar, editar ou excluir. | | |
| C3 | Abrir o menu lateral. | Item **Leitores** não aparece. | | |

### C4–C8: direto na API (backend) — comprova que a regra vale mesmo sem o frontend

Rodar no **Git Bash** (ou outro terminal com `curl`). Primeiro, obter o token da leitora:

```bash
curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" \
  -d '{"login":"maria","senha":"1234","tipo":"leitor"}'
```

Copie o valor de `"token"` e use no lugar de `TOKEN_LEITOR` abaixo.

| # | Comando | Resultado esperado | Obtido | Observações |
|---|---|---|:-:|---|
| C4 | Tentar criar conta de bibliotecário **sem login**:<br>`curl -i -X POST http://localhost:3001/api/auth/cadastro -H "Content-Type: application/json" -d '{"nome":"Intruso","login":"intruso","senha":"1234","tipo":"bibliotecario"}'` | `403 Forbidden` — "O cadastro público permite apenas contas de leitor...". Depois, tentar logar como `intruso` (bibliotecário) deve falhar. | | |
| C5 | Leitor tentando criar bibliotecário:<br>`curl -i -X POST http://localhost:3001/api/usuarios -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN_LEITOR" -d '{"tipo":"bibliotecario","nome":"Intruso","login":"intruso2","senha":"1234"}'` | `403 Forbidden` — "Acesso restrito a bibliotecários." | | |
| C6 | Leitor tentando criar livro:<br>`curl -i -X POST http://localhost:3001/api/livros -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN_LEITOR" -d '{"titulo":"Teste","autor":"Autor","genero":"Ficção"}'` | `403 Forbidden` | | |
| C7 | Leitor tentando listar usuários:<br>`curl -i http://localhost:3001/api/usuarios -H "Authorization: Bearer TOKEN_LEITOR"` | `403 Forbidden` | | |
| C8 | Acessar sem token:<br>`curl -i http://localhost:3001/api/livros` | `401 Unauthorized` — "Token não fornecido." | | |

---

## D. Bibliotecário — criação de usuários e gerenciamento de livros

Entrar como `admin` / `admin123` (tipo Bibliotecário).

| # | Passo | Resultado esperado | Obtido | Observações |
|---|---|---|:-:|---|
| D1 | Menu **Leitores** → **+ Novo Usuário**; tipo **Bibliotecário**; nome `Bibliotecário Dois`, login `bib2`, senha `1234`. | Usuário criado e exibido na tabela com o selo "Bibliotecário". | | |
| D2 | Sair e entrar como Bibliotecário com `bib2` / `1234`. | Login funciona; menu **Leitores** visível. | | |
| D3 | Como bibliotecário, **+ Novo Usuário** do tipo **Leitor** (login `joao`, caso não tenha sido cadastrado em A6). | Leitor criado; campo "Data de Registro" aparece apenas para o tipo Leitor. | | |
| D4 | Editar o login ou a senha de um leitor (✏️ Editar). | Dados atualizados; o novo login/senha funciona no login. | | |
| D5 | Menu **Livros** → **+ Adicionar Livro**: preencher título, autor (existente), gênero, editora e ano; salvar. | Livro aparece na lista/cards. | | |
| D6 | Editar o livro criado (alterar o ano). | Alteração exibida na lista. | | |
| D7 | Abrir o livro e clicar em **Ler**. | Abre o painel de leitura: leitor da Internet Archive (se houver `archive_id`) ou o texto/sinopse. | | |
| D8 | Cadastrar livro **sem** autor ou gênero. | Mensagem "Preencha pelo menos título, autor e gênero". | | |
| D9 | Excluir o livro criado em D5 (confirmar). | Livro some do acervo (e da estante de quem o tinha). | | |

---

## E. Estante pessoal (leitor)

Entrar como leitor `maria`.

| # | Passo | Resultado esperado | Obtido | Observações |
|---|---|---|:-:|---|
| E1 | Em **Livros**, clicar no ícone de estante de um livro. | Mensagem "… foi adicionado à sua Estante!". | | |
| E2 | Abrir **Estante**. | O livro aparece na lista (status inicial "Pretendo Ler" — confira ao filtrar por esse status). | | |
| E3 | Abrir o livro pela estante e trocar o status para **Lendo**. | Mensagem de confirmação; ao voltar à **Estante** e filtrar por **Lendo**, o livro aparece. | | |
| E4 | Marcar o livro como **favorito** (estrela no card da Estante). | Estrela preenchida; o livro aparece ao ativar o filtro **Favoritos**. | | |
| E5 | Tentar adicionar o mesmo livro de novo. | Mensagem "Este livro já está na sua estante!" (sem duplicar). | | |
| E6 | Sair e entrar como o leitor `joao`; abrir **Estante**. | A estante do `joao` **não** mostra os livros da `maria` (estante é privada). | | |
| E7 | Como `maria`, remover o livro da estante (botão de remover; confirmar). | Livro some da estante da `maria`, mas continua no acervo. | | |

---

## F. Persistência (reiniciar a aplicação)

Preparação: como `maria`, deixar **pelo menos um livro** na estante com status **Lendo** e **favorito** (repita E1–E4 se removeu no E7). Como `admin`, ter um livro cadastrado por você.

| # | Passo | Resultado esperado | Obtido | Observações |
|---|---|---|:-:|---|
| F1 | No terminal do backend: `Ctrl+C` e `npm run dev` novamente. (Opcional: reiniciar também o frontend.) | No log **não** aparece "Livros inseridos" (os dados não foram recriados). | | |
| F2 | Entrar novamente como `maria`. | Login funciona (usuário foi mantido). | | |
| F3 | Abrir **Estante**. | Livro continua na estante, com status **Lendo** e **favorito**. | | |
| F4 | Entrar como `admin` e abrir **Livros**. | O livro cadastrado por você continua no acervo; o acervo inicial (30 livros) está íntegro. | | |
| F5 | Entrar como `admin` e abrir **Leitores**. | Usuários criados (`maria`, `joao`, `bib2`) continuam listados. | | |
| F6 | (Opcional) Reiniciar o PostgreSQL e repetir F2–F5. | Mesmos resultados. | | |

---

## G. Resultado dos testes automáticos (referência)

O script `backend/scripts/testar-api.js` automatiza os testes de cadastro, autenticação, permissões, livros, estante e persistência diretamente na API.

| Execução | Resultado |
|---|---|
| Fase 1 (cadastro, autenticação, permissões, livros e estante) | 44 verificações — **44 passaram, 0 falharam** |
| Fase 2 (após reiniciar o backend: persistência e exclusão de livro) | 11 verificações — **11 passaram, 0 falharam** |

Essas execuções foram feitas em ambiente de desenvolvimento com PostgreSQL 16 local. Para repetir na sua máquina: veja a seção **Testes** do `README.md`.

---

## H. Problemas encontrados e corrigidos

| # | Problema encontrado | Como foi verificado | Correção |
|---|---|---|---|
| 1 | **Escalonamento de privilégio:** o cadastro público permitia escolher "Bibliotecário". Qualquer pessoa criava uma conta administrativa e recebia token de administrador. | `POST /api/auth/cadastro` com `"tipo":"bibliotecario"` retornava `201` e o login seguinte funcionava (comprovado antes da correção). | Cadastro público cria **somente leitor** e o backend responde `403` para outro tipo; tela de cadastro sem a opção. Bibliotecário só é criado por outro bibliotecário (`POST /api/usuarios`, tela Leitores → + Novo Usuário). Depois da correção: `403` e o login do "intruso" falha. |
| 2 | CPF já cadastrado causava **erro 500** (violação de unicidade no banco). | Cadastro com CPF repetido. | Passou a responder `409` com a mensagem "CPF ou login já cadastrado". |
| 3 | Adicionar à estante um livro **inexistente** causava **erro 500** (chave estrangeira). | `POST /api/estante/999999`. | Passou a responder `404` "Livro não encontrado." |

**Verificado e sem problemas:** livros, estante, status e favoritos persistem após reiniciar o backend; a estante é privada por usuário; leitor recebe `403` em todas as rotas de escrita de livros/autores/gêneros e em todas as rotas de usuários.

### Limitações conhecidas (não corrigidas nesta entrega)

- O login fica em `sessionStorage`: fechar a aba exige novo login.
- O token JWT continua válido por até 8 horas mesmo que o usuário seja removido nesse intervalo (o backend não consulta o banco a cada requisição).
- Um bibliotecário pode excluir a própria conta; se o usuário `admin` for removido, ele é recriado com a senha padrão `admin123` na próxima inicialização do backend (altere a senha padrão antes de usar fora de testes).
- Configuração Docker incompleta (detalhes no `README.md`).