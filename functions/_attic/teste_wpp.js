const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

async function run() {
  const megaSnap = await db.doc('settings/whatsapp_config').get();
  const mega = megaSnap.data();
  let cleanHost = mega.host.trim();
  if (!cleanHost.startsWith('http')) cleanHost = 'https://' + cleanHost;
  cleanHost = cleanHost.replace(/\/$/, '');

  const amanhaISO = '2026-04-13';

  const [s1, s2] = await Promise.all([
    db.collection('feedback_schedules').where('pendingFeedbackDates', 'array-contains', amanhaISO).get(),
    db.collection('feedback_schedules').where('pendingTrainingDates', 'array-contains', amanhaISO).get()
  ]);

  const ids = [...new Set([...s1.docs.map(d => d.id), ...s2.docs.map(d => d.id)])].slice(0, 10);
  console.log('Candidatos para', amanhaISO, ':', ids.length, '\n');

  for (const id of ids) {
    const s = await db.collection('students').doc(id).get();
    const student = s.data();
    const nome = (student.name || 'Aluno').split(' ')[0];
    const rawPhone = student.whatsapp || student.phone || '';

    let phone = rawPhone.replace(/\D/g, '');
    if (phone.length === 10 || phone.length === 11) phone = '55' + phone;
    if (phone.length === 12 && phone.startsWith('55')) phone = phone.slice(0,4) + '9' + phone.slice(4);

    if (!phone || phone.length !== 13) {
      console.log(nome, '| SEM NÚMERO | raw:', rawPhone);
      continue;
    }

    try {
      const check = await axios.get(
        cleanHost + '/rest/instance/isOnWhatsApp/' + mega.instanceKey,
        { params: { jid: phone + '@s.whatsapp.net' }, headers: { Authorization: 'Bearer ' + mega.token }, timeout: 10000 }
      );
      const existe = check.data?.exists === true;
      console.log(nome, '|', phone, '| WhatsApp:', existe ? '✅' : '❌');
    } catch(e) {
      console.log(nome, '|', phone, '| ERRO:', e.response?.data?.message || e.message);
    }
  }
  process.exit(0);
}

run();
