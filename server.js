// server.js
const express = require('express');
const fetch = require('node-fetch'); // Se estiver usando Node < 18
const app = express();
const PORT = process.env.PORT || 3000;

// Servir arquivos estáticos da pasta "public"
app.use(express.static('public'));

// Endpoint que chama o webhook do n8n
app.get('/api/chamar-n8n', async (req, res) => {
  try {
    // Substitua essa URL pela Production URL do seu node Webhook no n8n
    const n8nEndpoint = 'https://makeone.app.n8n.cloud/webhook/837b4994-f89a-4386-9a76-2f38f0742637';

    const response = await fetch(n8nEndpoint);
    if (!response.ok) {
      throw new Error(`Falha ao chamar n8n: ${response.statusText}`);
    }

    // Ler o JSON retornado pelo n8n
    const data = await response.json();
    // Enviar esse JSON ao front-end
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ocorreu um erro ao chamar n8n.' });
  }
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}...`);
});
