const express = require('express');
const fetch = require('node-fetch'); // Se Node < 18
const app = express();
const PORT = process.env.PORT || 3000;

// Servir arquivos estáticos
app.use(express.static('public'));

// Endpoint para disparar seu workflow n8n
app.get('/api/chamar-n8n', async (req, res) => {
  try {
    // Ajuste a URL do seu fluxo n8n (Webhook ou algo similar):
    const n8nEndpoint = 'https://makeone.app.n8n.cloud/webhook/837b4994-f89a-4386-9a76-2f38f0742637';

    const response = await fetch(n8nEndpoint);
    if (!response.ok) {
      throw new Error(`Erro ao chamar n8n: ${response.statusText}`);
    }

    // Supondo que n8n retorne JSON
    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ocorreu um erro ao chamar n8n.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}...`);
});

