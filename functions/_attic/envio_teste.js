const admin = require('firebase-admin');
const axios = require('axios');
const { format } = require('date-fns');

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

async function run() {
  const megaSnap = await db.doc('settings/whatsapp_config').get();
  const mega = megaSnap.data();
  let cleanHost = mega.host.trim();
  if (!cleanHost.startsWith('http')) cleanHost = 'https://' + cleanHost;
  cleanHost = cleanHost.replace(/\/$/, '');

  const configSnap = await db.doc('settings/feedback_reminder_template').get();
  const config = configSnap.data();

  const amanhaISO = '2026-04-13';

  const [s1, s2] = await Promise.all([
    db.collection('feedback_schedules').where('pendingFeedbackDates', 'array-contains', amanhaISO).get(),
    db.collection('feedback_schedules').where('pendingTrainingDates', 'array-contains', amanhaISO).get()
  ]);

  const ids = [...new Set([...s1.docs.map(d => d.id), ...s2.docs.map(d => d.id)])].slice(0, 10);
  console.log('Enviando para', ids.length, 'alunos\n');

  let enviados = 0;

  for (const id of ids) {
    const [studentSnap, scheduleSnap] = await Promise.all([
      db.collection('students').doc(id).get(),
      db.collection('feedback_schedules').doc(id).get()
    ]);

    const student = studentSnap.data();
    const schedule = scheduleSnap.data();
    const nome = student.name || 'Aluno';
    const firstName = nome.split(' ')[0];
    const rawPhone = student.whatsapp || student.phone || '';

    let phone = rawPhone.replace(/\D/g, '');
    if (phone.length === 10 || phone.length === 11) phone = '55' + phone;
    if (phone.length === 12 && phone.startsWith('55')) phone = phone.slice(0,4) + '9' + phone.slice(4);

    if (!phone || phone.length !== 13) {
      console.log(firstName, '| SEM NÚMERO — pulando');
      continue;
    }

    // Valida número
    try {
      const check = await axios.get(
        cleanHost + '/rest/instance/isOnWhatsApp/' + mega.instanceKey,
        { params: { jid: phone + '@s.whatsapp.net' }, headers: { Authorization: 'Bearer ' + mega.token }, timeout: 10000 }
      );
      if (check.data?.exists !== true) {
        console.log(firstName, '| Não está no WhatsApp — pulando');
        continue;
      }
    } catch(e) {
      console.log(firstName, '| ERRO validação:', e.response?.data?.message || e.message, '— pulando');
      continue;
    }

    // Identifica tipo
    const datas = schedule.dates || [];
    const item = datas.find(d => d?.date === amanhaISO);
    const tipo = item?.type || 'feedback';

    // Monta mensagem
    let variacoes = [];
    if (tipo === 'training') {
      variacoes = [config.smsTemplateTraining1 || '', config.smsTemplateTraining2 || ''].filter(Boolean);
    } else {
      variacoes = [config.smsTemplateFeedback1 || '', config.smsTemplateFeedback2 || ''].filter(Boolean);
    }
    if (variacoes.length === 0) variacoes = [config.smsTemplate || 'Olá {{NOME}}! Lembrete de {{DATA}}. {{LINK}}'];

    const template = variacoes[Math.floor(Math.random() * variacoes.length)];
    const msg = template
      .replaceAll('{{NOME}}', firstName)
      .replaceAll('{{DATA}}', format(new Date(amanhaISO + 'T12:00:00Z'), 'dd/MM'))
      .replaceAll('{{LINK}}', config.link || '');

    // Envia
    try {
      await axios.post(
        cleanHost + '/rest/sendMessage/' + mega.instanceKey + '/text',
        { messageData: { to: phone, text: msg } },
        { headers: { Authorization: 'Bearer ' + mega.token, 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      enviados++;
      console.log(`✅ [${enviados}/10] ${firstName} | ${phone}`);
    } catch(e) {
      console.log(`❌ ${firstName} | ERRO envio:`, e.response?.data || e.message);
    }

    // Delay entre 8 e 15 segundos
    if (enviados < ids.length) {
      const delay = Math.floor(Math.random() * 7000) + 8000;
      console.log(`   Aguardando ${Math.round(delay/1000)}s...\n`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  console.log(`\n🏁 Concluído. Enviados: ${enviados}/10`);
  process.exit(0);
}

run();
