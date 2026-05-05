// ============================================================================
// 📞 NORMALIZAÇÃO E VALIDAÇÃO DE NÚMEROS — INTERNACIONAL VIA libphonenumber-js
// ============================================================================
// Centraliza a lógica que antes estava duplicada em broadcast.js e crons.js.
//
// Estratégia:
// 1. Se o número começa com `+` → usa libphonenumber-js, respeita DDI digitado
//    (Suíça +41, EUA +1, Irlanda +353, etc).
// 2. Se NÃO começa com `+` → tenta libphonenumber-js com BR como default.
//    Se a lib aceitar (mesmo número BR sem o 9), retorna direto.
// 3. Fallback final: lógica BR original (10/11 dígitos → adiciona 55 → adiciona
//    o 9 se faltar). Preserva edge cases que aceitávamos antes.
//
// Retorno: dígitos puros sem o `+`, ex: "5511987654321" ou "14155551234".
// `null` quando o número é inválido.
// ============================================================================

const { parsePhoneNumberFromString } = require("libphonenumber-js");
const axios = require("axios");

const normalizePhone = (raw) => {
    if (raw == null) return null;
    const rawStr = String(raw).trim();
    if (!rawStr) return null;

    // 1. Com +: respeita o DDI digitado (gringo)
    if (rawStr.startsWith("+")) {
        const parsed = parsePhoneNumberFromString(rawStr);
        if (parsed && parsed.isValid()) return parsed.number.replace(/^\+/, "");
        return null;
    }

    // 2. Sem +: tenta lib com BR como default
    const parsed = parsePhoneNumberFromString(rawStr, "BR");
    if (parsed && parsed.isValid()) return parsed.number.replace(/^\+/, "");

    // 3. Fallback: lógica BR antiga (preserva números edge que a lib pode rejeitar)
    let clean = rawStr.replace(/\D/g, "");
    if (!clean || clean.length < 10) return null;
    if (clean.length === 10 || clean.length === 11) clean = "55" + clean;
    if (clean.length === 12 && clean.startsWith("55")) {
        clean = clean.slice(0, 4) + "9" + clean.slice(4);
    }
    if (clean.length !== 13) return null;
    return clean;
};

// Variante BR com/sem o 9. Só faz sentido pra números brasileiros móveis;
// pra qualquer outro país retorna null.
const getPhoneVariant = (clean) => {
    if (!clean || !clean.startsWith("55")) return null;
    const local = clean.substring(4); // após 55DD
    if (local.startsWith("9") && local.length === 9) {
        return clean.slice(0, 4) + local.slice(1); // remove o 9
    }
    return null;
};

// Valida via MegaAPI se o número existe no WhatsApp.
const checkIsOnWhatsApp = async (cleanHost, instanceKey, token, number) => {
    try {
        const res = await axios.get(
            `${cleanHost}/rest/instance/isOnWhatsApp/${instanceKey}`,
            {
                params: { jid: `${number}@s.whatsapp.net` },
                headers: { Authorization: `Bearer ${token}` },
                timeout: 10000,
            }
        );
        return res.data?.exists === true;
    } catch (err) {
        if (err.response) {
            const status = err.response.status;
            const msg = err.response.data?.message || err.message;
            throw new Error(`Erro MegaAPI (${status} - ${msg}): problema na instância, não no número`);
        }
        throw new Error(`Falha de rede ao validar número: ${err.message}`);
    }
};

// Resolve o número WhatsApp válido. Tenta o principal, depois variante BR
// (com/sem 9). Retorna "xxx@s.whatsapp.net" ou null.
const resolveWhatsAppNumber = async (cleanHost, instanceKey, token, raw) => {
    const main = normalizePhone(raw);
    if (!main) return null;

    if (await checkIsOnWhatsApp(cleanHost, instanceKey, token, main)) {
        return `${main}@s.whatsapp.net`;
    }

    const variant = getPhoneVariant(main);
    if (variant && (await checkIsOnWhatsApp(cleanHost, instanceKey, token, variant))) {
        return `${variant}@s.whatsapp.net`;
    }

    return null;
};

module.exports = {
    normalizePhone,
    getPhoneVariant,
    checkIsOnWhatsApp,
    resolveWhatsAppNumber,
};
