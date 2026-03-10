const functions = require("firebase-functions");
const axios = require("axios");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

exports.getAuditData = functions.https.onCall(async (data, context) => {
  try {
    // Captura IP
    let ip = context.rawRequest.headers['x-forwarded-for'] || context.rawRequest.socket.remoteAddress;
    if (ip && ip.includes(',')) ip = ip.split(',')[0];
    if (!ip) ip = "IP Indetectável";

    // Busca Geolocalização
    const geoResponse = await axios.get(`http://ip-api.com/json/${ip}`);
    const geo = geoResponse.data;

    return {
      ip: ip,
      cidade: geo.city || "Desconhecida",
      estado: geo.region || "Desconhecido",
      pais: geo.country || "Desconhecido",
      provedor: geo.isp || "Desconhecido",
      data_hora_servidor: new Date().toISOString()
    };
  } catch (error) {
    console.error("Erro:", error);
    return { ip: "Erro", cidade: "Erro" };
  }
});
function renderTemplate(text, vars) {
  return String(text || "").replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] ?? ""));
}

function isValidEmail(email) {
  return typeof email === "string" && /\S+@\S+\.\S+/.test(email);
}

function isValidPhone(phone) {
  return typeof phone === "string" && phone.replace(/\D/g, "").length >= 10;
}

function firstName(fullName) {
  if (!fullName) return "";
  return String(fullName).trim().split(/\s+/)[0] || "";
}

function formatDatePtBR(yyyyMmDd) {
  const [y, m, d] = String(yyyyMmDd).split("-");
  if (!y || !m || !d) return yyyyMmDd;
  return `${d}/${m}/${y}`;
}

function weekDayPtBR(dateObj, timeZone) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone }).format(dateObj);
}

// pega "YYYY-MM-DD" no timezone certo
function dateKeyInTz(dateObj, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone
  }).format(dateObj);
}

// pega a hora (0-23) no timezone certo
function hourInTz(dateObj, timeZone) {
  const h = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    timeZone
  }).format(dateObj);
  return Number(h);
}

// ======= AQUI TU VAI PLUGAR TEU SMS REAL =======
// Por enquanto: stub (não manda SMS, só loga)
async function sendSmsStub(to, message) {
  console.log("[SMS_STUB]", to, message);
}

// ======= EmailJS via API (backend) =======
async function sendEmailViaEmailJS({ toEmail, toName, subject, message }) {
  const payload = {
    service_id: process.env.EMAILJS_SERVICE_ID,
    template_id: process.env.EMAILJS_TEMPLATE_ID,
    user_id: process.env.EMAILJS_PUBLIC_KEY,
    accessToken: process.env.EMAILJS_PRIVATE_KEY,
    template_params: {
      to_email: toEmail,
      to_name: toName,
      subject,
      message
    }
  };

  await axios.post("https://api.emailjs.com/api/v1.0/email/send", payload, {
    headers: { "Content-Type": "application/json" }
  });
}

// ======= CRON: roda todo dia =======
exports.sendFeedbackReminders = functions.pubsub
  .schedule("every day 09:00")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    // 1) Ler settings do template
    const settingsSnap = await db.doc("settings/feedback_reminder_template").get();
    const settings = settingsSnap.exists ? settingsSnap.data() : null;
    if (!settings || !settings.enabled) return null;

    const tz = settings.timeZone || "America/Sao_Paulo";

    // 2) (extra segurança) só roda na hora configurada no doc
    const now = new Date();
    const sendHour = Number(settings.sendHour ?? 9);
    if (hourInTz(now, tz) !== sendHour) return null;

    // 3) calcular data alvo (D-1, D-2...)
    const daysBefore = Number(settings.daysBefore ?? 1);
    const target = new Date(now);
    target.setDate(target.getDate() + daysBefore);

    const targetKey = dateKeyInTz(target, tz); // "YYYY-MM-DD"
    const dataPt = formatDatePtBR(targetKey);
    const diaSemana = weekDayPtBR(target, tz);

    // 4) escolher qual campo consultar (feedback ou training)
    const onlyType = settings.onlyType || "feedback";
    const field = onlyType === "training" ? "pendingTrainingDates" : "pendingFeedbackDates";

    const schedulesSnap = await db
      .collection("feedback_schedules")
      .where(field, "array-contains", targetKey)
      .get();

    if (schedulesSnap.empty) return null;

    for (const schedDoc of schedulesSnap.docs) {
      const studentId = schedDoc.id;

      // 5) pegar dados do aluno
      const studentSnap = await db.doc(`students/${studentId}`).get();
      if (!studentSnap.exists) continue;

      const student = studentSnap.data() || {};
      const fullName = student.name || schedDoc.data()?.studentName || "";
      const nome = firstName(fullName);

      const email = student.email || "";
      const phone =
        student.phone ||
        student.smsPhone ||
        student.whatsapp ||
        student.whatsappPhone ||
        "";

      const link = settings.link || "";

      const vars = {
        NOME: nome,
        DATA: dataPt,
        DIA_SEMANA: diaSemana,
        LINK: link
      };

      const sendEmail = !!settings.sendChannels?.email;
      const sendSms = !!settings.sendChannels?.sms;

      // ===== EMAIL =====
      if (sendEmail && isValidEmail(email)) {
        const logId = `feedback_${studentId}_${targetKey}_D${daysBefore}_email`;
        const logRef = db.collection("notification_logs").doc(logId);

        // anti-dup: se já existe, pula
        try {
          await logRef.create({
            studentId,
            channel: "email",
            dateKey: targetKey,
            daysBefore,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (e) {
          // já enviado
        }

        // se o doc existe, não envia
        const check = await logRef.get();
        if (check.exists && check.data()?.sentAt) {
          // já enviado e marcado como sentAt
        } else if (check.exists) {
          try {
            const subject = renderTemplate(settings.emailSubjectTemplate, vars);
            const message = renderTemplate(settings.emailTemplate, vars);

            await sendEmailViaEmailJS({
              toEmail: email,
              toName: nome,
              subject,
              message
            });

            await logRef.set(
              { sentAt: admin.firestore.FieldValue.serverTimestamp() },
              { merge: true }
            );
          } catch (err) {
            // falhou -> apaga log pra tentar novamente amanhã
            await logRef.delete().catch(() => {});
          }
        }
      }

      // ===== SMS =====
      if (sendSms && isValidPhone(phone)) {
        const logId = `feedback_${studentId}_${targetKey}_D${daysBefore}_sms`;
        const logRef = db.collection("notification_logs").doc(logId);

        // anti-dup
        try {
          await logRef.create({
            studentId,
            channel: "sms",
            dateKey: targetKey,
            daysBefore,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (e) {}

        const check = await logRef.get();
        if (check.exists && check.data()?.sentAt) {
          // já enviado
        } else if (check.exists) {
          try {
            const message = renderTemplate(settings.smsTemplate, vars);

            // troca pelo teu SMS real depois
            await sendSmsStub(phone, message);

            await logRef.set(
              { sentAt: admin.firestore.FieldValue.serverTimestamp() },
              { merge: true }
            );
          } catch (err) {
            await logRef.delete().catch(() => {});
          }
        }
      }
    }

    return null;
  });
