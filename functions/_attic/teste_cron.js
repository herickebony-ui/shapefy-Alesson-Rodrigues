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

  const normalizePhone = (raw) => {
    let p = raw.replace(/\D/g, '');
    if (p.length === 10 || p.length === 11) p = '55' + p;
    return p.length >= 12 ? p : null;
  };

  const getPhoneVariant = (p) => {
    if (p.length === 13 && p[4] === '9') return p.slice(0,4) + p.slice(5);
    if (p.length === 12) return p.slice(0,4) + '9' + p.slice(4);
    return null;
  };

  const resolveWhatsAppNumber = async (raw) => {
    const main = normalizePhone(raw);
    if (!main) return null;
    const variant = getPhoneVariant(main);
    return variant || main;
  };

  const amanhaISO = '2026-04-13';
  const [s1, s2] = await Promise.all([
    db.collection('feedback_schedules').where('pendingFeedbackDates', 'array-contains', amanhaISO).get(),
    db.collection('feedback_schedules').where('pendingTrainingDates', 'array-contains', amanhaISO).get()
  ]);
  const ids = [...new Set([...s1.docs.map(d => d.id), ...s2.docs.map(d => d.id)])].slice(0, 10);
  console.log('Testando', ids.length, 'alunos\n');

  for (const id of ids) {
    const s = await db.collection('students').doc(id).get();
    const student = s.data();
    const nome = (student.name || 'Aluno').split(' ')[0];
    const rawPhone = student.whatsapp || student.phone || '';
    const phone = await resolveWhatsAppNumber(rawPhone);

    if (!phone) { console.log(`❌ ${nome} | sem número`); continue; }

    try {
      const res = await axios.post(
        `${cleanHost}/rest/sendMessage/${mega.instanceKey}/text`,
        { messageData: { to: phone, text: `Teste cron: ${nome}` } },
        { headers: { Authorization: `Bearer ${mega.token}`, 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      console.log(`✅ ${nome} | ${phone} | ${res.data.messageData?.status}`);
    } catch(e) {
      console.log(`❌ ${nome} | ${phone} | ${e.response?.data?.message || e.message}`);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  process.exit(0);
}
run();
