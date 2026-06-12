import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes      from "./routes/auth.js";
import leitoresRoutes   from "./routes/leitores.js";
import usuariosRoutes   from "./routes/usuarios.js";
import livrosRoutes     from "./routes/livros.js";
import estanteRoutes    from "./routes/estante.js";
import generosRouter from "./routes/generos.js";
import autoresRouter from "./routes/autores.js";
import { initDatabase } from "./db/init.js";

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares globais ───────────────────────────────────
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// ── Rotas ─────────────────────────────────────────────────
app.use("/api/auth",     authRoutes);
app.use("/api/leitores", leitoresRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/livros",   livrosRoutes);
app.use("/api/estante",  estanteRoutes);
app.use("/api/generos", generosRouter);
app.use("/api/autores", autoresRouter);