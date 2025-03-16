/************************************************************
 * server.js - Exemplo Final com maybeSingle + logs
 ************************************************************/
const express = require('express');
const fetch = require('node-fetch'); // se Node < 18
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * 1) Configurações Express
 *    - Aceitar até 5 MB de JSON
 *    - Servir estáticos da pasta 'public'
 */
app.use(express.json({ limit: '5mb' }));
app.use(express.static('public'));

/**
 * 2) Conexão com Supabase
 *    - Defina no Render (Config Vars):
 *      SUPABASE_URL = https://XXXX.supabase.co
 *      SUPABASE_SERVICE_KEY = ...
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 3) /api/start-n8n
 *    - Inicia o fluxo no n8n via webhook
 */
app.get('/api/start-n8n', async (req, res) => {
  try {
    console.log('[SERVER] Iniciando fluxo n8n via start-job webhook...');

    // Substitua pela URL do seu Start Job Webhook no n8n
    const startEndpoint = 'https://makeone.app.n8n.cloud/webhook/webhook/start-job';
    const response = await fetch(startEndpoint, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Erro ao iniciar job no n8n: ${response.statusText}`);
    }

    const data = await response.json();
    // Ex.: data = { jobId: "JOB-1678907890", userMessage: "...", ... }
    console.log('[SERVER] Resposta do n8n no start:', data);

    return res.json(data);

  } catch (err) {
    console.error('[SERVER] Erro ao iniciar job n8n:', err);
    return res.status(500).json({ error: 'Ocorreu um erro ao iniciar o job no n8n.' });
  }
});

/**
 * 4) /api/save-result?jobId=XYZ
 *    - Chamado no final do fluxo do n8n (quando terminar)
 *    - Salva no Supabase
 */
app.post('/api/save-result', async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'Faltou jobId na query.' });
  }

  try {
    console.log(`[SERVER] /api/save-result chamado. jobId=${jobId}`);
    // Insere a linha no Supabase com done=true
    const { data, error } = await supabase
      .from('openai_output')
      .insert([
        {
          job_id: jobId,
          done: true,
          raw: req.body
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
 *    - O front-end faz polling aqui para ver se finalizou
 *    - Com .maybeSingle() evitamos erro 500 quando 0 rows
 */
app.get('/api/status-n8n', async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'Faltou jobId.' });
  }

  try {
    console.log(`[SERVER] Recebi polling p/ jobId="${jobId}"`);

    // Usamos maybeSingle() => data será null se 0 rows
    const { data, error } = await supabase
      .from('openai_output')
      .select('*')
      .eq('job_id', jobId)
      .maybeSingle();

    // Log para ver o que veio
    console.log('[SERVER] Supabase data=', data);

    if (error) {
      console.error('[SERVER] Erro ao buscar no Supabase:', error);
      return res.status(500).json({ error: 'Falha ao consultar DB.' });
    }

    // Se não achou row (data=null) ou found mas done=false => {done:false}
    if (!data || !data.done) {
      return res.json({ done: false });
    }

    // Se achou e done=true => retorna headlines/artigos
    const raw = data.raw || {};
    const headlines = raw?.message?.content?.manchetes_do_dia || [];
    const artigos = raw?.message?.content?.artigos_finalistas || [];

    console.log('[SERVER] Achou row done=true, retornando manchetes/artigos...');
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
 * 6) Inicia o servidor
 */
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}...`);
});
