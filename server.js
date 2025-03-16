/************************************************************
 * server.js - Exemplo Completo para Produção
 ************************************************************/
const express = require('express');
const fetch = require('node-fetch');  // se estiver em Node < 18
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * 1) Configurações Express:
 *    - Aceitar até 5 MB de JSON
 *    - Servir estáticos da pasta "public"
 */
app.use(express.json({ limit: '5mb' }));
app.use(express.static('public'));

/**
 * 2) Conexão com Supabase
 *    - Defina as variáveis de ambiente no Render:
 *      SUPABASE_URL (ex.: https://xxxxx.supabase.co)
 *      SUPABASE_SERVICE_KEY (chave de serviço, se estiver usando RLS ou quiser inserir sem restrições)
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
// Se você estiver usando apenas a anon key e Policies adequadas, então use a anon key.
// Em produção, a "service key" facilita pois ignora RLS.
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 3) /api/start-n8n
 *    - Chama o Start Job Webhook no n8n (para iniciar o fluxo)
 */
app.get('/api/start-n8n', async (req, res) => {
  try {
    const startEndpoint = 'https://makeone.app.n8n.cloud/webhook/webhook/start-job'; 
    // Substitua pela URL correta do seu webhook de Start no n8n

    const response = await fetch(startEndpoint, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Erro ao iniciar job no n8n: ${response.statusText}`);
    }

    const data = await response.json();
    // ex.: { jobId: "JOB-1678907890", userMessage: "Processando..." }
    return res.json(data);

  } catch (err) {
    console.error('Erro ao iniciar job n8n:', err);
    return res.status(500).json({ error: 'Ocorreu um erro ao iniciar o job no n8n.' });
  }
});

/**
 * 4) /api/save-result?jobId=XYZ
 *    - Chamado no final do fluxo do n8n (HTTP Request Node),
 *      com o body JSON (até 5 MB).
 *    - Salva os resultados no Supabase em "openai_output"
 */
app.post('/api/save-result', async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'Faltou jobId na query.' });
  }

  try {
    // Vamos salvar o JSON inteiro em "raw" e marcar done = true
    // Se quiser garantir que não duplique, podemos usar "upsert".
    // Mas como o node "Create a Row" no n8n não tem upsert nativo,
    // aqui é um exemplo de "insert" simples. Se jobId for UNIQUE,
    // terá erro caso tente inserir de novo.
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
      // Se der erro de duplicado e você quiser permitir upsert,
      // você pode tratar aqui ou usar o "onConflict" no Supabase.
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
 *    - O front-end faz polling para ver se finalizou
 *    - Consulta a tabela "openai_output" no Supabase
 */
app.get('/api/status-n8n', async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'Faltou jobId.' });
  }

  try {
    // Busca 1 registro com "job_id = jobId"
    const { data, error } = await supabase
      .from('openai_output')
      .select('*')
      .eq('job_id', jobId)
      .single();

    if (error) {
      // Se vier erro "No rows found", data fica undefined
      console.error('Erro ao buscar no Supabase:', error);
      return res.status(500).json({ error: 'Falha ao consultar DB.' });
    }

    if (!data) {
      // Se não encontrou, não terminou
      return res.json({ done: false });
    }

    // data.done => boolean
    // data.raw => JSON
    // Retorna { done: boolean, ...conteúdo } pro front
    return res.json({
      done: data.done,
      // Desestruture "raw" conforme preferir
      ...data.raw
    });

  } catch (err) {
    console.error('Erro inesperado ao checar status:', err);
    return res.status(500).json({ error: 'Erro inesperado ao checar status do job.' });
  }
});

/**
 * 6) Inicia o servidor
 */
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}...`);
});
