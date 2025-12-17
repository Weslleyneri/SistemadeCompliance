import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";

const app = express();
app.use(cors());

const upload = multer({ dest: "uploads/" });

/**
 * ATENÇÃO:
 * Aqui você conecta o fornecedor REAL/autorizado (background check).
 * Não implemente scraping nem acesso a bases não autorizadas.
 */
async function callAuthorizedProvider({ name, cpf, dob, checkType }) {
  // EXEMPLO (mock): simula uma resposta - modulo de teste API 
  // Troque por fetch/axios para o provedor real (com API key/secret).
  return {
    provider: "AUTHORIZED_PROVIDER",
    type: checkType,
    subject: { name, cpf, dob },
    status: "CLEAR", // ou "HIT"/"REVIEW"
    notes: "Resultado retornado pelo provedor autorizado (mock).",
    link: null
  };
}

function appendAuditLog(entry) {
  const path = "audit-log.jsonl";
  fs.appendFileSync(path, JSON.stringify(entry) + "\n", "utf8");
}

app.post("/checks/run", upload.single("file"), async (req, res) => {
  try {
    const { name, cpf, dob, checkType, purpose, email, consent } = req.body;

    if (!name || !cpf || !dob || !checkType || !purpose || !email) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }
    if (consent !== "true") {
      return res.status(400).json({ error: "Consentimento obrigatório." });
    }

    // Actor fixo (manual). Em produção: autenticação (SSO/login) e RBAC.
    const actor = "manual.operator@positivo.com.br";

    const checkId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Se veio arquivo (relatório), apenas registra metadata (não exponha publicamente)
    const attachment = req.file
      ? { originalName: req.file.originalname, storedAs: req.file.filename, size: req.file.size }
      : null;

    const result = await callAuthorizedProvider({ name, cpf, dob, checkType });

    const auditEntry = {
      checkId,
      timestamp,
      actor,
      purpose,
      email,
      checkType,
      subject: { name, cpf, dob },
      attachment,
      resultStatus: result.status
    };
    appendAuditLog(auditEntry);

    return res.json({ checkId, timestamp, actor, result });
  } catch (e) {
    return res.status(500).json({ error: "Erro interno", details: String(e) });
  }
});

app.get("/health", (_, res) => res.json({ ok: true }));

app.listen(3000, () => console.log("Compliance portal API on http://localhost:3000"));
