import { Router } from "express";
import pool from "../db/pool.js";
import { authMiddleware } from "../middlewares/auth.js";

const router = Router();

router.use(authMiddleware);

// GET /api/estante — retorna estante do usuário logado
router.get("/", async (req, res) => {
  const usuarioId = req.user.id;
  const usuarioTipo = req.user.tipo;

  try {
    const { rows } = await pool.query(
      `SELECT l.*, e.adicionado_em, e.status, e.is_favorito
       FROM estante e
       JOIN livros l ON l.id = e.livro_id
       WHERE e.usuario_id = $1 AND e.usuario_tipo = $2
       ORDER BY e.adicionado_em DESC`,
      [usuarioId, usuarioTipo]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Erro ao buscar estante." });
  }
});

// POST /api/estante/:livroId — adiciona livro à estante
router.post("/:livroId", async (req, res) => {
  const usuarioId = req.user.id;
  const usuarioTipo = req.user.tipo;
  const { livroId } = req.params;
  const { status = "Pretendo Ler" } = req.body;
  const livroIdNumber = Number(livroId);
  const validStatuses = ["Lendo", "Pretendo Ler", "Finalizado", "Desistiu"];

  if (!Number.isInteger(livroIdNumber) || livroIdNumber <= 0) {
    return res.status(400).json({ erro: "ID do livro inválido." });
  }

  if (typeof status !== "string" || !validStatuses.includes(status)) {
    return res.status(400).json({ erro: "Status inválido para a estante." });
  }

  try {
    await pool.query(
      `INSERT INTO estante (usuario_id, usuario_tipo, livro_id, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario_tipo, usuario_id, livro_id) DO NOTHING`,
      [usuarioId, usuarioTipo, livroIdNumber, status]
    );
    return res.status(201).json({ mensagem: "Livro adicionado à estante." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Erro ao adicionar à estante." });
  }
});

router.patch("/:livroId", async (req, res) => {
  const usuarioId = req.user.id;
  const usuarioTipo = req.user.tipo;
  const { livroId } = req.params;
  const { status } = req.body;
  const livroIdNumber = Number(livroId);
  const validStatuses = ["Lendo", "Pretendo Ler", "Finalizado", "Desistiu"];

  if (!Number.isInteger(livroIdNumber) || livroIdNumber <= 0) {
    return res.status(400).json({ erro: "ID do livro inválido." });
  }

  if (typeof status !== "string" || !validStatuses.includes(status)) {
    return res.status(400).json({ erro: "Status inválido para a estante." });
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE estante
       SET status = $1
       WHERE usuario_id = $2 AND usuario_tipo = $3 AND livro_id = $4`,
      [status, usuarioId, usuarioTipo, livroIdNumber]
    );

    if (rowCount === 0) {
      return res.status(404).json({ erro: "Livro não encontrado na estante." });
    }

    return res.json({ mensagem: "Status da estante atualizado." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Erro ao atualizar status da estante." });
  }
});

// PATCH /api/estante/:livroId/favorito — alterna o status de favorito
router.patch("/:livroId/favorito", async (req, res) => {
  const usuarioId = req.user.id;
  const usuarioTipo = req.user.tipo;
  const { livroId } = req.params;
  const livroIdNumber = Number(livroId);

  if (!Number.isInteger(livroIdNumber) || livroIdNumber <= 0) {
    return res.status(400).json({ erro: "ID do livro inválido." });
  }

  try {
    // Primeiro obtém o estado atual
    const { rows } = await pool.query(
      `SELECT is_favorito FROM estante
       WHERE usuario_id = $1 AND usuario_tipo = $2 AND livro_id = $3`,
      [usuarioId, usuarioTipo, livroIdNumber]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: "Livro não encontrado na estante." });
    }

    const novoEstadoFavorito = !rows[0].is_favorito;

    await pool.query(
      `UPDATE estante
       SET is_favorito = $1
       WHERE usuario_id = $2 AND usuario_tipo = $3 AND livro_id = $4`,
      [novoEstadoFavorito, usuarioId, usuarioTipo, livroIdNumber]
    );

    return res.json({ 
      mensagem: novoEstadoFavorito ? "Adicionado aos favoritos." : "Removido dos favoritos.",
      is_favorito: novoEstadoFavorito
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Erro ao atualizar favorito." });
  }
});

// DELETE /api/estante/:livroId — remove livro da estante
router.delete("/:livroId", async (req, res) => {
  const usuarioId = req.user.id;
  const usuarioTipo = req.user.tipo;
  const { livroId } = req.params;
  const livroIdNumber = Number(livroId);

  if (!Number.isInteger(livroIdNumber) || livroIdNumber <= 0) {
    return res.status(400).json({ erro: "ID do livro inválido." });
  }

  try {
    await pool.query(
      "DELETE FROM estante WHERE usuario_id=$1 AND usuario_tipo=$2 AND livro_id=$3",
      [usuarioId, usuarioTipo, livroIdNumber]
    );
    return res.json({ mensagem: "Livro removido da estante." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Erro ao remover da estante." });
  }
});

export default router;