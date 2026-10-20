const ALLOWED_ORIGIN = "https://alicehbmanteng-eng.github.io";
const MODEL = "gemini-3.8-flash";

function json(data, status, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
  if (origin === ALLOWED_ORIGIN) {
    headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN;
    headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, X-App-Token";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function makePrompt(mode, direction, sourceText) {
  const target = {
    "en-zh": "Transcribe English and translate it into natural Simplified Chinese.",
    "zh-en": "Transcribe Simplified Chinese and translate it into natural, professional English.",
    "ar-zh": "Transcribe Arabic and translate it into natural Simplified Chinese.",
    "auto": "Detect the primary language. If it is English, translate to Simplified Chinese. If it is Chinese, translate to natural English. If it is Arabic, translate to Simplified Chinese."
  }[direction] || "Detect whether the text is English or Chinese and translate it to the other language.";
  const base = [
    "You are a careful bilingual translation assistant for international business.",
    target,
    "Return a faithful, complete translation, not a summary.",
    "Preserve names, company names, email addresses, URLs, product codes, quantities, currencies, dimensions, prices, dates, and negations exactly unless translation is needed for surrounding prose.",
    "Never invent unreadable text. For uncertain image text, omit it from sourceText or mark it as [unclear], and explain the uncertainty in uncertainties.",
    "Preserve paragraph and message boundaries as much as possible. Keep tone and intent. For Chinese-to-English business writing, use natural, professional, clear English without adding claims.",
    "Return JSON with exactly these fields: sourceText (faithful source transcription or the original text), translatedText (full translation), uncertainties (array of short uncertainty notes), detectedLanguage (short language name)."
  ].join(" ");
  if (mode === "image") return base + " Read text directly from the attached screenshot; do not rely on an external OCR transcript. " + (sourceText ? "Additional user note: " + sourceText : "");
  return base + "\n\nTranslate the following text:\n" + sourceText;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      if (origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-App-Token",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }
    if (origin && origin !== ALLOWED_ORIGIN) return json({ error: "This website is not allowed to use this endpoint." }, 403, origin);
    if (request.method === "GET") {
      return json({ ok: true, service: "Bilingual Vision Translator", model: MODEL, note: "POST requires a valid app token." }, 200, origin);
    }
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
    if (!env.GEMINI_API_KEY) return json({ error: "Backend is not configured: set GEMINI_API_KEY in Worker Secrets." }, 503, origin);
    if (!env.APP_ACCESS_TOKEN) return json({ error: "Backend is not configured: set APP_ACCESS_TOKEN in Worker Secrets." }, 503, origin);
    const suppliedToken = request.headers.get("X-App-Token") || "";
    if (suppliedToken.length < 16 || suppliedToken !== env.APP_ACCESS_TOKEN) {
      return json({ error: "Access code is incorrect. Check the private APP_ACCESS_TOKEN value." }, 401, origin);
    }

    let body;
    try {
      const length = Number(request.headers.get("Content-Length") || 0);
      if (length > 9_000_000) return json({ error: "Image is too large. Please crop or compress it and try again." }, 413, origin);
      body = await request.json();
    } catch {
      return json({ error: "Invalid request body." }, 400, origin);
    }

    const mode = body.mode === "image" ? "image" : "text";
    const direction = ["en-zh", "zh-en", "ar-zh", "auto"].includes(body.direction) ? body.direction : "auto";
    const parts = [{ text: makePrompt(mode, direction, typeof body.text === "string" ? body.text.slice(0, 30000) : "") }];

    if (mode === "image") {
      if (typeof body.imageBase64 !== "string" || !body.imageBase64.length) return json({ error: "Please attach a screenshot." }, 400, origin);
      if (body.imageBase64.length > 8_500_000) return json({ error: "Image is too large. Crop the screenshot and try again." }, 413, origin);
      const mimeType = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(body.mimeType) ? body.mimeType : "image/jpeg";
      parts.push({ inline_data: { mime_type: mimeType, data: body.imageBase64 } });
    } else {
      if (typeof body.text !== "string" || !body.text.trim()) return json({ error: "Please enter text to translate." }, 400, origin);
    }

    let upstream;
    try {
      upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                sourceText: { type: "STRING" },
                translatedText: { type: "STRING" },
                uncertainties: { type: "ARRAY", items: { type: "STRING" } },
                detectedLanguage: { type: "STRING" }
              },
              required: ["sourceText", "translatedText", "uncertainties", "detectedLanguage"]
            }
          }
        })
      });
    } catch {
      return json({ error: "Cannot reach Google Gemini API. Check your connection and try again." }, 502, origin);
    }

    const raw = await upstream.text();
    if (!upstream.ok) {
      let reason = "Gemini API request failed (" + upstream.status + ").";
      try {
        const err = JSON.parse(raw);
        if (err.error && err.error.message) reason = err.error.message;
      } catch {}
      if (upstream.status === 429) reason = "Gemini free-tier quota/rate limit reached. Wait and try again later.";
      if (upstream.status === 400 || upstream.status === 403) reason = "Gemini API rejected the request. Check that the API key is valid and this model is available to your account.";
      return json({ error: reason }, upstream.status === 429 ? 429 : 502, origin);
    }

    try {
      const data = JSON.parse(raw);
      const responseText = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
      const result = JSON.parse(responseText);
      return json({
        sourceText: String(result.sourceText || ""),
        translatedText: String(result.translatedText || ""),
        uncertainties: Array.isArray(result.uncertainties) ? result.uncertainties.map(String).slice(0, 20) : [],
        detectedLanguage: String(result.detectedLanguage || ""),
        model: MODEL
      }, 200, origin);
    } catch {
      return json({ error: "Gemini returned an unreadable response. Try again with a clearer or smaller screenshot." }, 502, origin);
    }
  }
};
