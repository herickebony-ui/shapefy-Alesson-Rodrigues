const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

async function run() {
  const configSnap = await db.doc('settings/feedback_reminder_template').get();
  const config = configSnap.data();
  
  console.log('Template Feedback 1:', config.smsTemplateFeedback1);
  console.log('Template Feedback 2:', config.smsTemplateFeedback2);
  console.log('Template Training 1:', config.smsTemplateTraining1);
  console.log('Link:', config.link);
  
  process.exit(0);
}
run();
