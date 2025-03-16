/************************************************************
 * server.js - Versão com parse automático de content
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
 *    - Inicia o fluxo no n8n via webhook (GET)
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
 *    - Chamado no final do fluxo do n8n (POST)
 *    - Salva no Supabase a linha com (done=true, raw=...)
 */
app.post('/api/save-result', async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'Faltou jobId na query.' });
  }

  try {
    console.log(`[SERVER] /api/save-result chamado. jobId=${jobId}`);

    // Insere a linha no Supabase
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
 *    - Front faz polling aqui a cada X segundos
 *    - .maybeSingle() evita erro quando 0 rows
 *    - .like() lida com eventuais quebras de linha no 'job_id'
 *    - Faremos parse de raw.message.content se for string
 */
app.get('/api/status-n8n', async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'Faltou jobId.' });
  }

  try {
    console.log(`[SERVER] Recebi polling p/ jobId="${jobId}"`);

    // Evitar problemas se jobId tiver '%' ou '_' (wildcards do LIKE)
    const pattern = jobId.replace(/[%_]/g, '\\$&');

    // Busca por job_id que comece com o pattern
    const { data, error } = await supabase
      .from('openai_output')
      .select('*')
      .like('job_id', pattern + '%')
      .maybeSingle();

    if (error) {
      console.error('[SERVER] Erro ao buscar no Supabase:', error);
      return res.status(500).json({ error: 'Falha ao consultar DB.' });
    }

    // Se não achou row ou achou mas done=false
    if (!data || !data.done) {
      return res.json({ done: false });
    }

    // Caso done=true, precisamos extrair .manchetes_do_dia e .artigos_finalistas
    // Observando que data.raw pode ter message.content como string
    const raw = data.raw || {};
    let content = raw?.message?.content;

    // Se for string, tentamos parsear
    if (typeof content === 'string') {
      try {
        content = JSON.parse(content);
      } catch (err) {
        console.error('[SERVER] Falha ao dar JSON.parse no content:', err);
        content = {};
      }
    }

    // Extraímos arrays
    const headlines = content?.manchetes_do_dia || [];
    const artigos = content?.artigos_finalistas || [];

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
