const axios = require('axios');

const HOST = 'https://apistart01.megaapi.com.br';
const INSTANCE = 'megastart-MBH5otxL4OlOCosRQYRVALSHnM';
const TOKEN = 'MBH5otxL4OlOCosRQYRVALSHnM';

const numeros = [
  '5573988713842',
  '5573991489478',
  '5573999039306'
];

async function run() {
  for (const phone of numeros) {
    try {
      const res = await axios.post(
        `${HOST}/rest/sendMessage/${INSTANCE}/text`,
        { messageData: { to: phone, text: 'Teste debug' } },
        { headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } }
      );
      console.log(phone, '→', JSON.stringify(res.data));
    } catch(e) {
      console.log(phone, '→ ERRO:', e.response?.data || e.message);
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  process.exit(0);
}

run();
