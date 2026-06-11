// backend/src/server.js
// Servidor principal do GoodRoads — Node.js + Express + PostgreSQL

'use strict';

const express = require('express');
const cors    = require('cors');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
require('dotenv').config();

const pool = require('./config/banco');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// ─── Upload de imagens ────────────────────────────────────────────────────────

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas'));
  },
});

// ─── Autenticação JWT ────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'goodroads-dev-secret';

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, tipo: usuario.tipo },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

function autenticar(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ erro: 'Token não fornecido' });

  const token = header.replace('Bearer ', '');
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

function apenasAdmin(req, res, next) {
  if (req.usuario.tipo === 'admin' || req.usuario.tipo === 'prefeitura') {
    return next();
  }
  res.status(403).json({ erro: 'Sem permissão' });
}

// ─── Auth: Login ──────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha)
    return res.status(400).json({ erro: 'E-mail e senha obrigatórios' });

  try {
    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND ativo = TRUE',
      [email.toLowerCase()],
    );
    const usuario = rows[0];
    if (!usuario)
      return res.status(401).json({ erro: 'Credenciais inválidas' });

    const ok = await bcrypt.compare(senha, usuario.senha_hash);
    if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas' });

    res.json({
      token: gerarToken(usuario),
      usuario: {
        id:    usuario.id,
        nome:  usuario.nome,
        email: usuario.email,
        tipo:  usuario.tipo,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ─── Auth: Registro ───────────────────────────────────────────────────────────

app.post('/api/auth/registro', async (req, res) => {
  const { nome, email, senha, telefone } = req.body;
  if (!nome || !email || !senha)
    return res.status(400).json({ erro: 'Campos obrigatórios faltando' });

  try {
    const hash = await bcrypt.hash(senha, 12);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, tipo, telefone)
       VALUES ($1, $2, $3, 'comum', $4)
       RETURNING id, nome, email, tipo`,
      [nome, email.toLowerCase(), hash, telefone || null],
    );
    const usuario = rows[0];
    res.status(201).json({
      token: gerarToken(usuario),
      usuario,
    });
  } catch (err) {
    if (err.code === '23505') // unique_violation
      return res.status(409).json({ erro: 'E-mail já cadastrado' });
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ─── Ocorrências: Listar (autenticado) ────────────────────────────────────────

app.get('/api/ocorrencias', autenticar, async (req, res) => {
  try {
    // Usuário comum vê só as próprias; admin/prefeitura vê todas
    const ehAdmin =
      req.usuario.tipo === 'admin' || req.usuario.tipo === 'prefeitura';

    const query = ehAdmin
      ? `SELECT o.*, u.nome AS solicitante,
                (SELECT COUNT(*) FROM imagens WHERE ocorrencia_id = o.id) AS total_fotos
         FROM ocorrencias o
         JOIN usuarios u ON u.id = o.usuario_id
         ORDER BY
           CASE o.urgencia WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
           o.criado_em DESC
         LIMIT 100`
      : `SELECT o.*,
                (SELECT COUNT(*) FROM imagens WHERE ocorrencia_id = o.id) AS total_fotos
         FROM ocorrencias o
         WHERE o.usuario_id = $1
         ORDER BY o.criado_em DESC`;

    const params = ehAdmin ? [] : [req.usuario.id];
    const { rows } = await pool.query(query, params);

    // Mapear para o formato esperado pelo Flutter
    const lista = rows.map(row => ({
      id:           row.id,
      titulo:       row.tipo_problema.replace(/_/g, ' '),
      descricao:    row.descricao || '',
      latitude:     parseFloat(row.latitude),
      longitude:    parseFloat(row.longitude),
      status:       row.status,
      criado_em:    row.criado_em,
      imagens_urls: [],  // carregado separado se necessário
      protocolo:    row.protocolo,
      urgencia:     row.urgencia,
      municipio:    row.municipio,
    }));

    res.json(lista);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ─── Ocorrências: Criar ───────────────────────────────────────────────────────

app.post('/api/ocorrencias', autenticar, async (req, res) => {
  const {
    titulo, descricao, latitude, longitude,
    tipo_problema, urgencia, municipio,
  } = req.body;

  if (!latitude || !longitude)
    return res.status(400).json({ erro: 'Localização obrigatória' });

  // Se não vier tipo_problema, infere do título
  const tipo = tipo_problema || 'outro';

  try {
    const { rows } = await pool.query(
      `INSERT INTO ocorrencias
         (usuario_id, tipo_problema, descricao, urgencia, latitude, longitude, municipio)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.usuario.id,
        tipo,
        descricao || '',
        urgencia || 'media',
        latitude,
        longitude,
        municipio || null,
      ],
    );

    const o = rows[0];
    res.status(201).json({
      id:        o.id,
      titulo:    o.tipo_problema.replace(/_/g, ' '),
      descricao: o.descricao,
      latitude:  parseFloat(o.latitude),
      longitude: parseFloat(o.longitude),
      status:    o.status,
      criado_em: o.criado_em,
      imagens_urls: [],
      protocolo: o.protocolo,
      urgencia:  o.urgencia,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ─── Ocorrências: Detalhe ─────────────────────────────────────────────────────

app.get('/api/ocorrencias/:id', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, u.nome AS solicitante, u.telefone AS telefone_solicitante
       FROM ocorrencias o
       JOIN usuarios u ON u.id = o.usuario_id
       WHERE o.id = $1`,
      [req.params.id],
    );
    if (!rows.length)
      return res.status(404).json({ erro: 'Ocorrência não encontrada' });

    const imagens = await pool.query(
      'SELECT url_imagem FROM imagens WHERE ocorrencia_id = $1',
      [req.params.id],
    );
    const historico = await pool.query(
      `SELECT h.status, h.observacao, h.data_alteracao, u.nome AS responsavel
       FROM historico_status h
       JOIN usuarios u ON u.id = h.usuario_responsavel
       WHERE h.ocorrencia_id = $1
       ORDER BY h.data_alteracao ASC`,
      [req.params.id],
    );

    const o = rows[0];
    res.json({
      id:           o.id,
      titulo:       o.tipo_problema.replace(/_/g, ' '),
      descricao:    o.descricao,
      latitude:     parseFloat(o.latitude),
      longitude:    parseFloat(o.longitude),
      status:       o.status,
      criado_em:    o.criado_em,
      imagens_urls: imagens.rows.map(i => i.url_imagem),
      protocolo:    o.protocolo,
      urgencia:     o.urgencia,
      municipio:    o.municipio,
      solicitante:  o.solicitante,
      historico:    historico.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ─── Ocorrências: Atualizar status (admin/prefeitura) ─────────────────────────

app.patch('/api/ocorrencias/:id/status', autenticar, apenasAdmin, async (req, res) => {
  const { status, observacao } = req.body;
  const statusValidos = ['pendente','em_analise','em_andamento','resolvido','cancelado'];

  if (!statusValidos.includes(status))
    return res.status(400).json({ erro: 'Status inválido' });

  try {
    // Insere no histórico — o trigger `trg_sync_status` atualiza ocorrencias.status
    await pool.query(
      `INSERT INTO historico_status (ocorrencia_id, status, usuario_responsavel, observacao)
       VALUES ($1, $2, $3, $4)`,
      [req.params.id, status, req.usuario.id, observacao || null],
    );

    const { rows } = await pool.query(
      'SELECT * FROM ocorrencias WHERE id = $1',
      [req.params.id],
    );
    const o = rows[0];

    res.json({
      id:        o.id,
      titulo:    o.tipo_problema.replace(/_/g, ' '),
      descricao: o.descricao,
      latitude:  parseFloat(o.latitude),
      longitude: parseFloat(o.longitude),
      status:    o.status,
      criado_em: o.criado_em,
      imagens_urls: [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ─── Imagens: Upload ──────────────────────────────────────────────────────────

app.post(
  '/api/ocorrencias/:id/imagens',
  autenticar,
  upload.single('imagem'),
  async (req, res) => {
    if (!req.file)
      return res.status(400).json({ erro: 'Nenhuma imagem enviada' });

    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const urlImagem = `${baseUrl}/uploads/${req.file.filename}`;

    try {
      await pool.query(
        'INSERT INTO imagens (ocorrencia_id, url_imagem) VALUES ($1, $2)',
        [req.params.id, urlImagem],
      );
      res.status(201).json({ url_imagem: urlImagem });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Erro ao salvar imagem' });
    }
  },
);

// ─── Mapa: Ocorrências próximas ───────────────────────────────────────────────

app.get('/api/mapa/proximas', autenticar, async (req, res) => {
  const { lat, lon, km = 5 } = req.query;
  if (!lat || !lon)
    return res.status(400).json({ erro: 'lat e lon obrigatórios' });

  try {
    const { rows } = await pool.query(
      'SELECT * FROM ocorrencias_proximo($1, $2, $3)',
      [parseFloat(lat), parseFloat(lon), parseFloat(km)],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ─── Relatórios (admin) ───────────────────────────────────────────────────────

app.get('/api/relatorios/resumo', autenticar, apenasAdmin, async (req, res) => {
  try {
    const [statusRows, tipoRows] = await Promise.all([
      pool.query('SELECT * FROM vw_resumo_status'),
      pool.query('SELECT * FROM vw_resumo_tipo_problema'),
    ]);
    res.json({
      por_status:         statusRows.rows,
      por_tipo_problema:  tipoRows.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ─── Inicialização ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[GoodRoads] Servidor rodando na porta ${PORT}`);
});