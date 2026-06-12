import { Router } from "express";
import pool from "../db/pool.js";
import { authMiddleware, soBibliotecario } from "../middlewares/auth.js";

const router = Router();

router.get("/", authMiddleware, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM autores ORDER BY nome");
  return res.json(rows);
});

router.post("/", authMiddleware, soBibliotecario, async (req, res) => {
  const { nome, ano_nascimento, nacionalidade, descricao, principais_generos } = req.body;
  if (!nome) return res.status(400).json({ erro: "nome é obrigatório." });
  const { rows } = await pool.query(
    `INSERT INTO autores (nome, ano_nascimento, nacionalidade, descricao, principais_generos)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [nome, ano_nascimento || null, nacionalidade || null, descricao || null,
     JSON.stringify(principais_generos || [])]
  );
  return res.status(201).json(rows[0]);
});

router.put("/:id", authMiddleware, soBibliotecario, async (req, res) => {
  const { nome, ano_nascimento, nacionalidade, descricao, principais_generos } = req.body;
  const { rows } = await pool.query(
    `UPDATE autores SET nome=$1, ano_nascimento=$2, nacionalidade=$3,
     descricao=$4, principais_generos=$5 WHERE id=$6 RETURNING *`,
    [nome, ano_nascimento || null, nacionalidade || null, descricao || null,
     JSON.stringify(principais_generos || []), req.params.id]
  );
  if (!rows.length) return res.status(404).json({ erro: "Autor não encontrado." });
  return res.json(rows[0]);
});

router.delete("/:id", authMiddleware, soBibliotecario, async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM autores WHERE id=$1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ erro: "Autor não encontrado." });
  return res.json({ mensagem: "Autor removido." });
});

export default router;