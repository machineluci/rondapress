/************************************************************
 * server.js - Exemplo Completo em Produção no Render
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
 *      SUPABASE_URL=https://xxxx.supabase.co
 *      SUPABASE_SERVICE_KEY=chave_de_servico
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
    // Substitua pela URL do seu Start Job Webhook n8n
    const startEndpoint = 'https://makeone.app.n8n.cloud/webhook/webhook/start-job';

    const response = await fetch(startEndpoint, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Erro ao iniciar job no n8n: ${response.statusText}`);
    }

    const data = await response.json();
    // Ex.: data = { jobId: "JOB-1678907890", ... }

    return res.json(data);

  } catch (err) {
    console.error('Erro ao iniciar job n8n:', err);
    return res.status(500).json({ error: 'Ocorreu um erro ao iniciar o job no n8n.' });
  }
});

/**
 * 4) /api/save-result?jobId=XYZ
 *    - Chamado no final do fluxo do n8n
 *    - Salva no Supabase
 */
app.post('/api/save-result', async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'Faltou jobId na query.' });
  }

  try {
    // Insere (ou atualiza) a linha no Supabase
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
      console.error('Erro ao inserir no Supabase:', error);
      return res.status(500).json({ error: 'Falha ao salvar no DB.' });
    }

    console.log(`>> Salvei resultado no Supabase p/ jobId=${jobId}`);
    return res.json({ success: true });

  } catch (err) {
    console.error('Erro inesperado ao salvar resultado:', err);
    return res.status(500).json({ error: 'Erro inesperado ao salvar resultado.' });
  }
});

/**
 * 5) /api/status-n8n?jobId=XYZ
 *    - O front-end faz polling aqui para ver se finalizou
 *    - Agora usamos .maybeSingle(), pra evitar erro 500 caso 0 rows sejam retornadas
 */
app.get('/api/status-n8n', async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'Faltou jobId.' });
  }

  try {
    // Usamos maybeSingle() para não retornar erro se 0 rows.
    const { data, error } = await supabase
      .from('openai_output')
      .select('*')
      .eq('job_id', jobId)
      .maybeSingle();

    if (error) {
      // Se houve um erro real do Supabase (ex.: credenciais)
      console.error('Erro ao buscar no Supabase:', error);
      return res.status(500).json({ error: 'Falha ao consultar DB.' });
    }

    // Se não encontrou (data=null) ou se found mas done=false => continua processando
    if (!data || !data.done) {
      return res.json({ done: false });
    }

    // Se chegou aqui, data.done===true => retorne manchetes/artigos
    const raw = data.raw; // JSON salvo pelo n8n
    const headlines = raw?.message?.content?.manchetes_do_dia || [];
    const artigos = raw?.message?.content?.artigos_finalistas || [];

    // Mande de volta { done:true, headlines, artigos }
    return res.json({
      done: true,
      headlines,
      artigos
    });

  } catch (err) {
    console.error('Erro inesperado ao checar status:', err);
    return res.status(500).json({ error: 'Erro inesperado ao checar status do job.' });
  }
});

/**
 * 6) Sobe o servidor
 */
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}...`);
});
