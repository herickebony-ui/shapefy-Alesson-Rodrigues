import { db } from '../firebase';
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';

// ============================================
// CENÁRIO 1: ATRIBUIÇÃO DE TAREFA
// ============================================
export const scheduleWhatsAppNotification = async ({
  taskId,
  taskTitle,
  studentName,
  responsibleId,
  dueDate,
  comment = "",
  assignerName = "",
  type = "task_assigned"
}) => {
  try {
    if (!responsibleId) return;

    const userSnap = await getDoc(doc(db, 'users', responsibleId));
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    const targetPhone = userData.whatsapp || userData.phone || userData.celular;

    if (!targetPhone || String(targetPhone).replace(/\D/g, "").length < 10) return;

    const scheduledDate = new Date();
    scheduledDate.setMinutes(scheduledDate.getMinutes() + 3);

    // Formata data COM hora
    let dueDateFormatted = "Sem prazo";
    if (dueDate) {
      const d = new Date(dueDate);
      if (!isNaN(d.getTime())) {
        dueDateFormatted = d.toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
      }
    }

    await addDoc(collection(db, 'notification_queue'), {
      type,
      taskId,
      targetUserId: responsibleId,
      targetName: userData.name,
      targetPhone,
      assignerName: assignerName || "Alguém",
      messagePayload: {
        taskTitle: taskTitle || "Sem título",
        studentName: studentName || "",
        comment: comment || "",
        dueDate: dueDateFormatted
      },
      status: 'pending',
      scheduledFor: scheduledDate,
      createdAt: new Date()
    });

  } catch (error) {
    console.error("Erro no agendador:", error);
  }
};

// ============================================
// CENÁRIO 2: COMENTÁRIO COM MENÇÃO
// ============================================
export const scheduleCommentNotification = async ({
  taskId,
  taskTitle,
  studentName,
  responsibleId,
  commentText,
  commenterName
}) => {
  try {
    if (!responsibleId) return;

    const userSnap = await getDoc(doc(db, 'users', responsibleId));
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    const targetPhone = userData.whatsapp || userData.phone || userData.celular;

    if (!targetPhone || String(targetPhone).replace(/\D/g, "").length < 10) return;

    const scheduledDate = new Date();
    scheduledDate.setMinutes(scheduledDate.getMinutes() + 1);

    await addDoc(collection(db, 'notification_queue'), {
      type: 'comment_mention',
      taskId,
      targetUserId: responsibleId,
      targetName: userData.name,
      targetPhone,
      assignerName: commenterName || "Alguém",
      messagePayload: {
        taskTitle: taskTitle || "Sem título",
        studentName: studentName || "",
        comment: commentText || "",
        dueDate: ""
      },
      status: 'pending',
      scheduledFor: scheduledDate,
      createdAt: new Date()
    });

  } catch (error) {
    console.error("Erro ao agendar comentário:", error);
  }
};