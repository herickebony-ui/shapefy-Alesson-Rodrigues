// Espelho do functions/utils/phone.js para uso no front (test send, broadcast manual, etc).
// Estratégia idêntica: + na frente respeita o DDI; sem + tenta lib com BR como default;
// fallback final preserva edge cases BR antigos (sem 9, sem 55, etc).

import { parsePhoneNumberFromString } from 'libphonenumber-js';

export const normalizePhone = (raw) => {
  if (raw == null) return null;
  const rawStr = String(raw).trim();
  if (!rawStr) return null;

  // 1. Com +: respeita o DDI digitado (gringo).
  if (rawStr.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(rawStr);
    if (parsed && parsed.isValid()) return parsed.number.replace(/^\+/, '');
    return null;
  }

  // 2. Sem +: tenta lib com BR como default.
  const parsed = parsePhoneNumberFromString(rawStr, 'BR');
  if (parsed && parsed.isValid()) return parsed.number.replace(/^\+/, '');

  // 3. Fallback BR antigo (preserva números edge que a lib pode rejeitar).
  let clean = rawStr.replace(/\D/g, '');
  if (!clean || clean.length < 10) return null;
  if (clean.length === 10 || clean.length === 11) clean = '55' + clean;
  if (clean.length === 12 && clean.startsWith('55')) {
    clean = clean.slice(0, 4) + '9' + clean.slice(4);
  }
  if (clean.length !== 13) return null;
  return clean;
};

// Variante BR com/sem o 9. Pra qualquer país != BR retorna null.
export const getPhoneVariant = (clean) => {
  if (!clean || !clean.startsWith('55')) return null;
  const local = clean.substring(4);
  if (local.startsWith('9') && local.length === 9) {
    return clean.slice(0, 4) + local.slice(1);
  }
  return null;
};
