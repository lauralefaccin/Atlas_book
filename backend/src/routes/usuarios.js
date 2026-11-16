import { Router } from "express";
import bcrypt from "bcrypt";
import pool from "../db/pool.js";
import { authMiddleware, soBibliotecario } from "../middlewares/auth.js";

const router = Router();
const TABELAS = {
  leitor: "leitores",
  bibliotecario: "bibliotecarios",
};

function obterTabela(tipo) {
  if (!Object.prototype.hasOwnProperty.call(TABELAS, tipo)) {
    return null;
  }
  return TABELAS[tipo];
}

router.use(authMiddleware, soBibliotecario);

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, nome, cpf, login, data_registro, 'leitor' AS tipo
      FROM leitores
      UNION ALL
      SELECT id, nome, cpf, login, NULL AS data_registro, 'bibliotecario' AS tipo
      FROM bibliotecarios
      ORDER BY nome
    `);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Erro ao buscar usuários." });
  }
});

// POST /api/usuarios — cria leitor OU bibliotecário.
// Protegida por authMiddleware + soBibliotecario (router.use acima):
// é a ÚNICA forma de criar uma conta de bibliotecário.
router.post("/", async (req, res) => {
  const { tipo, nome, cpf, login, senha, data_registro } = req.body;
  const tabela = obterTabela(tipo);

  if (!tabela) {
    return res.status(400).json({ erro: "Tipo de usuário inválido." });
  }
  if (!nome || !login || !senha) {
    return res.status(400).json({ erro: "nome, login e senha são obrigatórios." });
  }
  if (senha.length < 4) {
    return res.status(400).json({ erro: "A senha deve ter no mínimo 4 caracteres." });
  }

  try {
    const { rows: exist } = await pool.query(
      `SELECT id FROM ${tabela} WHERE login = $1`,
      [login]
    );
    if (exist.length > 0) {
      return res.status(409).json({ erro: "Login já cadastrado." });
    }

    const hash = await bcrypt.hash(senha, 10);
    let rows;

    if (tabela === "leitores") {
      ({ rows } = await pool.query(
        `INSERT INTO leitores (nome, cpf, login, senha_hash, data_registro)
         VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE))
         RETURNING id, nome, cpf, login, data_registro`,
        [nome, cpf || null, login, hash, data_registro || null]
      ));
    } else {
      ({ rows } = await pool.query(
        `INSERT INTO bibliotecarios (nome, cpf, login, senha_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, nome, cpf, login`,
        [nome, cpf || null, login, hash]
      ));
    }

    return res.status(201).json({ ...rows[0], tipo });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ erro: "CPF ou login já cadastrado." });
    }
    console.error(err);
    return res.status(500).json({ erro: "Erro ao criar usuário." });
  }
});

router.put("/:tipo/:id", async (req, res) => {
  const { tipo, id } = req.params;
  const { login, senha } = req.body;
  const tabela = obterTabela(tipo);

  if (!tabela) {
    return res.status(400).json({ erro: "Tipo de usuário inválido." });
  }
  if (!login) {
    return res.status(400).json({ erro: "Login é obrigatório." });
  }

  try {
    const { rows: exist } = await pool.query(
      `SELECT id FROM ${tabela} WHERE login = $1 AND id <> $2`,
      [login, id]
    );
    if (exist.length > 0) {
      return res.status(409).json({ erro: "Login já usado por outro usuário." });
    }

    let query;
    let params;
    const returningColumns = tabela === "leitores"
      ? "id, nome, cpf, login, data_registro"
      : "id, nome, cpf, login";

    if (senha) {
      const hash = await bcrypt.hash(senha, 10);
      query = `UPDATE ${tabela} SET login = $1, senha_hash = $2 WHERE id = $3 RETURNING ${returningColumns}`;
      params = [login, hash, id];
    } else {
      query = `UPDATE ${tabela} SET login = $1 WHERE id = $2 RETURNING ${returningColumns}`;
      params = [login, id];
    }

    const { rows } = await pool.query(query, params);
    if (rows.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    return res.json({ ...rows[0], tipo });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Erro ao atualizar usuário." });
  }
});

router.delete("/:tipo/:id", async (req, res) => {
  const { tipo, id } = req.params;
  const tabela = obterTabela(tipo);

  if (!tabela) {
    return res.status(400).json({ erro: "Tipo de usuário inválido." });
  }

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM ${tabela} WHERE id = $1`,
      [id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }
    return res.json({ mensagem: "Usuário removido com sucesso." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Erro ao remover usuário." });
  }
});

export default router;