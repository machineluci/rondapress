const express = require('express');
const fetch = require('node-fetch');  // Se Node < 18
const app = express();
const PORT = process.env.PORT || 3000;

// In-memory store (se estiver usando o esquema de salvar resultados em memória)
const jobResults = {};

/**
 * 1) Middleware para aceitar JSON (até 5 MB) e servir arquivos estáticos
 */
app.use(express.json({ limit: '5mb' }));
app.use(express.static('public'));

/**
 * 2) /api/start-n8n
 *    - Chama "Start Job Webhook" do n8n (rota GET)
 */
app.get('/api/start-n8n', async (req, res) => {
  try {
    // Ajuste a URL para seu "Start Job Webhook" do n8n
    const startEndpoint = 'https://SEU-N8N-DOMINIO/webhook/start-job';

    const response = await fetch(startEndpoint, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Erro ao iniciar job no n8n: ${response.statusText}`);
    }
    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error('Erro ao iniciar job n8n:', err);
    res.status(500).json({ error: 'Ocorreu um erro ao iniciar o job no n8n.' });
  }
});

/**
 * 3) /api/save-result?jobId=XYZ
 *    - Chamado no final do fluxo do n8n (HTTP Request Node),
 *      com o body JSON (até 5 MB).
 */
app.post('/api/save-result', (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'Faltou jobId na query.' });
  }
  jobResults[jobId] = {
    done: true,
    ...req.body
  };
  console.log(`>> Salvei resultado para jobId=${jobId}`, req.body);
  res.json({ success: true });
});

/**
 * 4) /api/status-n8n?jobId=XYZ
 *    - O front-end faz polling para ver se finalizou.
 */
app.get('/api/status-n8n', (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'Faltou jobId.' });
  }
  const record = jobResults[jobId];
  if (!record) {
    return res.json({ done: false });
  }
  res.json(record);
});

// 5) Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}...`);
});
