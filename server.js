const express = require('express');
const fetch = require('node-fetch'); // If Node < 18
const app = express();
const PORT = process.env.PORT || 3000;

// 1) Serve static files from the "public" folder
app.use(express.static('public'));

/**
 *  2) /api/start-n8n
 *     - Calls the n8n "Start Job" webhook (which responds using "Respond to Webhook" Node).
 *     - That Webhook should return JSON like:
 *       {
 *         "jobId": "JOB-1678900000",
 *         "userMessage": "Estamos processando... aguarde!"
 *       }
 *     - We just pass that JSON straight back to the front end.
 */
app.get('/api/start-n8n', async (req, res) => {
  try {
    // Replace with your actual Start Job Webhook URL from n8n
    const startEndpoint = 'https://YOUR_N8N_DOMAIN/webhook/start-job';

    const response = await fetch(startEndpoint, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Erro ao iniciar job no n8n: ${response.statusText}`);
    }

    // Expecting something like { jobId: "JOB-...", userMessage: "..." }
    const data = await response.json();

    // Send that JSON to the front end
    res.json(data);

  } catch (err) {
    console.error('Erro ao iniciar job n8n:', err);
    res.status(500).json({ error: 'Ocorreu um erro ao iniciar o job no n8n.' });
  }
});

/**
 *  3) /api/status-n8n?jobId=XYZ
 *     - The front end polls this endpoint every few seconds to see if the job is done.
 *     - We call n8n's "Check Status" webhook with the same jobId.
 *     - If done, n8n returns the final data (ex.: { headlines: [...], artigos: [...] }).
 *     - If not done, n8n returns something like { done: false }.
 */
app.get('/api/status-n8n', async (req, res) => {
  try {
    const { jobId } = req.query;
    if (!jobId) {
      return res.status(400).json({ error: 'Faltou jobId.' });
    }

    // Replace with your actual Check Status Webhook URL
    const statusEndpoint = `https://YOUR_N8N_DOMAIN/webhook/check-status?jobId=${jobId}`;

    const response = await fetch(statusEndpoint, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Erro ao checar status n8n: ${response.statusText}`);
    }

    /**
     * n8n might return:
     * { done: false } // still processing
     * or final data like: { headlines: [...], artigos: [...] }
     */
    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error('Erro ao checar status n8n:', err);
    res.status(500).json({ error: 'Ocorreu um erro ao checar status no n8n.' });
  }
});

// 4) Start the server
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}...`);
});
