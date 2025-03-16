/************************************************************
 * server.js - Versão com logs de debug para ver raw exato
 ************************************************************/
const express = require('express');
const fetch = require('node-fetch'); // se Node < 18
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * 1) Configurações Express
 */
app.use(express.json({ limit: '5mb' }));
app.use(express.static('public'));

/**
 * 2) Conexão com Supabase
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 3) /api/start-n8n
 */
app.get('/api/start-n8n', async (req, res) => {
  try {
    console.log('[SERVER] Iniciando fluxo n8n via start-job webhook...');

    const startEndpoint = 'https://makeone.app.n8n.cloud/webhook/webhook/start-job';
    const response = await fetch(startEndpoint, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Erro ao iniciar job no n8n: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[SERVER] Resposta do n8n no start:', data);
    return res.json(data);

  } catch (err) {
    console.error('[SERVER] Erro ao iniciar job n8n:', err);
    return res.status(500).json({ error: 'Ocorreu um erro ao iniciar o job no n8n.' });
  }
});

/**
 * 4) /api/save-result?jobId=XYZ
 *    - Chamado pelo n8n ao terminar
 */
app.post('/api/save-result', async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'Faltou jobId na query.' });
  }

  try {
    console.log(`[SERVER] /api/save-result chamado. jobId=${jobId}`);
    console.log('[SERVER] Conteúdo recebido do n8n em req.body:', JSON.stringify(req.body, null, 2));

    // Insere no Supabase
    const { data, error } = await supabase
      .from('openai_output')
      .insert([
        {
          job_id: jobId,
          done: true,
          raw: req.body  // Armazenamos exatamente o que chegou
        }
      ]);

    if (error) {
      console.error('[SERVER] Erro ao inserir no Supabase:', error);
      return res.status(500).json({ error: 'Falha ao salvar no DB.' });
    }

    console.log(`[SERVER] Salvei resultado no Supabase p/ jobId=${jobId}`);
    return res.json({ success: true });

  } catch (err) {
    console.error('[SERVER] Erro inesperado ao salvar resultado:', err);
    return res.status(500).json({ error: 'Erro inesperado ao salvar resultado.' });
  }
});

/**
 * 5) /api/status-n8n?jobId=XYZ
 *    - Polling do front
 */
app.get('/api/status-n8n', async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'Faltou jobId.' });
  }

  try {
    console.log(`[SERVER] Recebi polling p/ jobId="${jobId}"`);
    const pattern = jobId.replace(/[%_]/g, '\\$&');

    // Tenta achar a row
    const { data, error } = await supabase
      .from('openai_output')
      .select('*')
      .like('job_id', pattern + '%')
      .maybeSingle();

    if (error) {
      console.error('[SERVER] Erro ao buscar no Supabase:', error);
      return res.status(500).json({ error: 'Falha ao consultar DB.' });
    }

    // Se não achou ou done=false
    if (!data || !data.done) {
      console.log('[SERVER] Ainda não finalizado ou não achou. Retornando done=false...');
      return res.json({ done: false });
    }

    // Se achou e done=true
    const raw = data.raw || {};
    console.log('[SERVER] Row do DB (done=true). raw:', JSON.stringify(raw, null, 2));

    // Tenta parsear raw.message.content se for string
    let content = raw?.message?.content;
    if (typeof content === 'string') {
      try {
        content = JSON.parse(content);
      } catch (err) {
        console.error('[SERVER] Falha ao dar JSON.parse no content:', err);
        content = {};
      }
    }

    // Extrai arrays
    const headlines = content?.manchetes_do_dia || [];
    const artigos = content?.artigos_finalistas || [];

    console.log('[SERVER] Retornando headlines/artigos ao front:', headlines, artigos);
    return res.json({
      done: true,
      headlines,
      artigos
    });

  } catch (err) {
    console.error('[SERVER] Erro inesperado ao checar status:', err);
    return res.status(500).json({ error: 'Erro inesperado ao checar status do job.' });
  }
});

/**
 * 6) Subida do servidor
 */
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}...`);
});
