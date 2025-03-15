const express = require('express');
const fetch = require('node-fetch'); // Para Node < 18
const app = express();
const PORT = process.env.PORT || 3000;

// 1) Servir arquivos estáticos (index.html, demo.html, styles.css) da pasta 'public'
app.use(express.static('public'));

/**
 *  2) /api/start-n8n
 *     - Chama seu "Start Job Webhook" do n8n (rota GET).
 *     - Espera receber { jobId, ... } e repassa ao front-end.
 */
app.get('/api/start-n8n', async (req, res) => {
  try {
    // URL do seu Start Job Webhook no n8n
    const startEndpoint = 'https://makeone.app.n8n.cloud/webhook/webhook/start-job';

    const response = await fetch(startEndpoint, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Erro ao iniciar job no n8n: ${response.statusText}`);
    }

    // Ex.: { jobId: "JOB-1678907890", userMessage: "Processando..." }
    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error('Erro ao iniciar job n8n:', err);
    res.status(500).json({ error: 'Ocorreu um erro ao iniciar o job no n8n.' });
  }
});

/**
 *  3) /api/status-n8n?jobId=XYZ
 *     - O front-end faz polling a cada X segundos.
 *     - Chamamos n8n "/webhook/webhook/check-status?jobId=XYZ"
 *     - Retorna { done: false } ou { done: true, headlines: [...], artigos: [...] }
 */
app.get('/api/status-n8n', async (req, res) => {
  try {
    const { jobId } = req.query;
    if (!jobId) {
      return res.status(400).json({ error: 'Faltou jobId.' });
    }

    const statusEndpoint = `https://makeone.app.n8n.cloud/webhook/webhook/check-status?jobId=${jobId}`;
    const response = await fetch(statusEndpoint, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Erro ao checar status no n8n: ${response.statusText}`);
    }

    // Ex.: { done: false } ou { done: true, headlines: [...], artigos: [...] }
    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error('Erro ao checar status n8n:', err);
    res.status(500).json({ error: 'Ocorreu um erro ao checar status no n8n.' });
  }
});

// 4) Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}...`);
});
