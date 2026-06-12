import { Router } from "express";
import pool from "../db/pool.js";
import { authMiddleware, soBibliotecario } from "../middlewares/auth.js";

const router = Router();

router.get("/", authMiddleware, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM generos ORDER BY nome");
  return res.json(rows);
});

router.post("/", authMiddleware, soBibliotecario, async (req, res) => {
  const { nome, cor, descricao } = req.body;
  if (!nome || !descricao) return res.status(400).json({ erro: "nome e descricao são obrigatórios." });
  const { rows } = await pool.query(
    "INSERT INTO generos (nome, cor, descricao) VALUES ($1,$2,$3) RETURNING *",
    [nome, cor || "#c08928", descricao]
  );
  return res.status(201).json(rows[0]);
});

router.put("/:id", authMiddleware, soBibliotecario, async (req, res) => {
  const { nome, cor, descricao } = req.body;
  const { rows } = await pool.query(
    "UPDATE generos SET nome=$1, cor=$2, descricao=$3 WHERE id=$4 RETURNING *",
    [nome, cor, descricao, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ erro: "Gênero não encontrado." });
  return res.json(rows[0]);
});

router.delete("/:id", authMiddleware, soBibliotecario, async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM generos WHERE id=$1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ erro: "Gênero não encontrado." });
  return res.json({ mensagem: "Gênero removido." });
});

export default router;