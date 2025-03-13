const express = require('express');
const fetch = require('node-fetch'); // Se o Node estiver < 18, senão pode usar fetch nativo
const app = express();
const PORT = process.env.PORT || 3000;

// Servir arquivos estáticos (pasta "public")
app.use(express.static('public'));

// Rota que seu front-end chama ao clicar "Gerar Manchetes"
app.get('/api/chamar-n8n', async (req, res) => {
  try {
    // Substitua AQUI pela Production Webhook URL do seu fluxo n8n:
    const n8nEndpoint = 'https://makeone.app.n8n.cloud/webhook/837b4994-f89a-4386-9a76-2f38f0742637';

    // Faz a requisição ao endpoint do n8n
    const response = await fetch(n8nEndpoint);
    if (!response.ok) {
      throw new Error(`Erro ao chamar n8n: ${response.statusText}`);
    }

    // Supondo que o n8n retorne JSON
    const data = await response.json();
    // Retornamos o JSON ao front-end
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ocorreu um erro ao chamar n8n.' });
  }
});

// Sobe o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}...`);
});
