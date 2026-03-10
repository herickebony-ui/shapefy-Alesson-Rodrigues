import crypto from "crypto";

function firstIp(v) {
  if (!v) return null;
  return String(v).split(",")[0].trim();
}

export default function handler(req, res) {
  // ... (seus headers de CORS continuam iguais aqui) ...
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const ip = firstIp(req.headers["x-forwarded-for"]) || req.socket?.remoteAddress || null;

    // 1. Decodifica a cidade para aceitar acentos (Ex: São Paulo)
    let rawCity = req.headers["x-vercel-ip-city"];
    const city = rawCity ? decodeURIComponent(rawCity) : null;
    
    const region_code = req.headers["x-vercel-ip-country-region"] || null;
    const country = req.headers["x-vercel-ip-country"] || "BR";
    
    // 2. Monta a string IGUAL à sua função antiga
    const locationStr =
      city && region_code ? `${city} - ${region_code}, ${country}` :
      city ? `${city}, ${country}` :
      country ? `${country}` :
      "Brasil (Local não detectado)";
      
    const payload = {
      ip: ip ? String(ip).replace("::ffff:", "") : "IP Oculto",
      location: locationStr, // ✅ Já enviamos formatado
      ts: Date.now(),
    };

    const secret = process.env.AUDIT_SIGNING_SECRET; 
    // Se não tiver secret configurado, não quebra, mas avisa
    if (!secret) throw new Error("Faltou AUDIT_SIGNING_SECRET");

    const sig = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(payload))
      .digest("hex");

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ payload, sig });

  } catch (e) {
    return res.status(500).json({ error: "Audit Error", msg: String(e) });
  }
}
