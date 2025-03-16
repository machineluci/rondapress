/************************************************************
 * server.js - Versão final: parse automático robusto
 *   - Não requer mudar fluxo do n8n.
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
 *    - Defina as variáveis:
 *      SUPABASE_URL  e  SUPABASE_SERVICE_KEY
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 3) /api/start-n8n
 *    - Inicia o fluxo no n8n via GET
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
 *    - Chamado pelo n8n ao finalizar o fluxo.
 *    - Salva no DB (coluna raw) tudo o que o n8n mandar.
 */
app.post('/api/save-result', async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'Faltou jobId na query.' });
  }

  try {
    console.log(`[SERVER] /api/save-result chamado. jobId=${jobId}`);
    console.log('[SERVER] Corpo recebido do n8n (req.body):', JSON.stringify(req.body, null, 2));

    const { data, error } = await supabase
      .from('openai_output')
      .insert([
        {
          job_id: jobId,
          done: true,
          raw: req.body // Armazena 1:1 o que chegou do n8n
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
 *    - O front faz polling aqui a cada X segundos.
 *    - Tenta parsear .manchetes_do_dia e .artigos_finalistas de qualquer jeito.
 */
app.get('/api/status-n8n', async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'Faltou jobId.' });
  }

  try {
    console.log(`[SERVER] Polling p/ jobId="${jobId}"`);
    const pattern = jobId.replace(/[%_]/g, '\\$&');

    // Localiza a linha no supabase
    const { data, error } = await supabase
      .from('openai_output')
      .select('*')
      .like('job_id', pattern + '%')
      .maybeSingle();

    if (error) {
      console.error('[SERVER] Erro ao consultar DB:', error);
      return res.status(500).json({ error: 'Falha ao consultar DB.' });
    }

    // Se não achou ou (done=false)
    if (!data || !data.done) {
      console.log('[SERVER] Ainda não finalizado ou não existe. Retornando done=false...');
      return res.json({ done: false });
    }

    // Tenta extrair as arrays
    console.log('[SERVER] Achou row done=true. raw:', JSON.stringify(data.raw, null, 2));

    const { manchetes, artigos } = extraiaDados(data.raw);
    console.log('[SERVER] Retornando headlines/artigos:', manchetes, artigos);

    return res.json({
      done: true,
      headlines: manchetes,
      artigos
    });

  } catch (err) {
    console.error('[SERVER] Erro inesperado no polling:', err);
    return res.status(500).json({ error: 'Erro inesperado ao checar status do job.' });
  }
});

/**
 * 6) Função auxiliar que tenta de todo jeito achar e parsear
 *    "manchetes_do_dia" e "artigos_finalistas".
 */
function extraiaDados(raw) {
  // 1) Se for string, tente parsear
  let obj;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      obj = {};
    }
  } else {
    obj = raw || {};
  }

  // 2) Se tiver .message como string, parse
  if (typeof obj.message === 'string') {
    try {
      obj.message = JSON.parse(obj.message);
    } catch {
      // sem drama
    }
  }

  // 3) Se tiver .message.content como string, parse
  if (obj.message && typeof obj.message.content === 'string') {
    try {
      obj.message.content = JSON.parse(obj.message.content);
    } catch {
      // sem drama
    }
  }

  // 4) Tenta ler arrays
  const manchetes =
    obj?.message?.content?.manchetes_do_dia ||
    obj?.manchetes_do_dia ||
    [];
  const artigos =
    obj?.message?.content?.artigos_finalistas ||
    obj?.artigos_finalistas ||
    [];

  // Sempre retorna arrays (mesmo que vazios)
  return {
    manchetes: Array.isArray(manchetes) ? manchetes : [],
    artigos: Array.isArray(artigos) ? artigos : []
  };
}

/**
 * 7) Sobe o servidor
 */
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}...`);
});
