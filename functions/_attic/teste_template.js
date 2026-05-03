const axios = require('axios');

const msg = `*Pollyanna, Amanhã é dia de enviar o seu feedback!!!*
*Não responda essa notificação.*
1. No aplicativo ShapeFy, acesse a aba "preencher feedback".
2. Anexe suas fotos
3. Preencha o formulário
Atente-se!
Envie cada foto no campo correto do formulário.
Ex.: "Lateral" → foto lateral do lado indicado; "Frente" → foto de frente.
Essa correspondência garante registro e análise adequados.
Reitero: atrasos no envio podem prolongar a devolutiva do feedback.
*Prazo de devolutiva: 4 dias úteis.*
Estamos a sua disposição!`;

async function run() {
  try {
    const res = await axios.post(
      'https://apistart01.megaapi.com.br/rest/sendMessage/megastart-MBH5otxL4OlOCosRQYRVALSHnM/text',
      { messageData: { to: '557381298530', text: msg } },
      { headers: { Authorization: 'Bearer MBH5otxL4OlOCosRQYRVALSHnM', 'Content-Type': 'application/json' } }
    );
    console.log('Resposta:', res.data.message, '| Status:', res.data.messageData?.status);
  } catch(e) {
    console.log('ERRO:', e.response?.data || e.message);
  }
  process.exit(0);
}
run();
