const axios = require('axios');

async function run() {
  try {
    const res = await axios.post(
      'https://apistart01.megaapi.com.br/rest/sendMessage/megastart-MBH5otxL4OlOCosRQYRVALSHnM/text',
      { messageData: { to: '557381298530', text: 'Teste simples' } },
      { headers: { Authorization: 'Bearer MBH5otxL4OlOCosRQYRVALSHnM', 'Content-Type': 'application/json' } }
    );
    console.log('Resposta:', JSON.stringify(res.data, null, 2));
  } catch(e) {
    console.log('ERRO:', e.response?.data || e.message);
  }
  process.exit(0);
}

run();
