const express = require('express');
const fetch = require('node-fetch'); // Se Node < 18
const app = express();
const PORT = process.env.PORT || 3000;

// =============
// 1) In-Memory Store
// =============
const jobResults = {};

// 2) Middlewares
app.use(express.static('public')); // Serve index.html, demo.html, styles.css
app.use(express.json()); // Para ler JSON no body (importante para /api/save-result)

// =============
// 3) /api/start-n8n
//    - Chama "Start Job Webhook" no n8n
//    - Recebe { jobId } e retorna ao front-end
// =============
app.get('/api/start-n8n', async (req, res) => {
  try {
    // Ajuste a URL para seu "Start Job Webhook" no n8n
    const startEndpoint = 'https://makeone.app.n8n.cloud/webhook/webhook/start-job';

    const response = await fetch(startEndpoint, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Erro ao iniciar job no n8n: ${response.statusText}`);
    }

    // Ex: { jobId: "JOB-1678907890", userMessage: "Processando..." }
    const data = await response.json();
    // Repassa ao front-end
    res.json(data);

  } catch (err) {
    console.error('Erro ao iniciar job n8n:', err);
    res.status(500).json({ error: 'Ocorreu um erro ao iniciar o job no n8n.' });
  }
});

// =============
// 4) /api/save-result?jobId=XYZ
//    - Chamado pelo n8n ao final do fluxo (HTTP Request Node).
//    - Salva { headlines, artigos } em memória => jobResults[jobId].
// =============
app.post('/api/save-result', (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'Faltou jobId na query.' });
  }

  // Ex.: { headlines: [...], artigos: [...] }
  jobResults[jobId] = {
    done: true,
    ...req.body
  };
  console.log(`>> Salvei resultado para jobId=${jobId}`, req.body);
  res.json({ success: true });
});

// =============
// 5) /api/status-n8n?jobId=XYZ
//    - O front-end faz polling aqui.
//    - Se não tiver nada => { done: false }
//    - Se já salvamos => devolvemos { done: true, headlines, artigos }
// =============
app.get('/api/status-n8n', (req, res) => {
  try {
    const { jobId } = req.query;
    if (!jobId) {
      return res.status(400).json({ error: 'Faltou jobId.' });
    }

    // Verifica se já temos algo em jobResults
    const record = jobResults[jobId];
    if (!record) {
      // Não achou => ainda processando
      return res.json({ done: false });
    }

    // Se achou => job finalizado
    res.json(record);

  } catch (err) {
    console.error('Erro ao checar status no server memory:', err);
    res.status(500).json({ error: 'Ocorreu um erro ao checar status no server.' });
  }
});

// =============
// 6) Inicia o servidor
// =============
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}...`);
});
