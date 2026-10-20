const ALLOWED_ORIGIN = "https://alicehbmanteng-eng.github.io";
const MODEL = "@cf/google/gemma-4-26b-a4b-it";

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

function makePrompt(mode, direction, text) {
  const destination = {
    "en-zh": "Translate English into natural Simplified Chinese.",
    "zh-en": "Translate Simplified Chinese into natural, professional English.",
    "ar-zh": "Translate Arabic into natural Simplified Chinese.",
    "auto": "Detect the source language. English must be translated into Simplified Chinese; Chinese into natural English; Arabic into Simplified Chinese."
  }[direction] || "Detect the source language. Translate English to Simplified Chinese and Chinese to natural English.";
  return [
    "You are a careful bilingual translation assistant for international B2B business.",
    destination,
    mode === "image" ? "Read the screenshot directly. Transcribe the visible source text accurately and translate it; do not summarize the screenshot." : "Translate the supplied text faithfully and completely.",
    "Keep paragraph breaks and speaker/message order where possible.",
    "Never change or invent names, company names, email addresses, URLs, product codes, quantities, prices, currencies, sizes, dates, delivery times, or negations. Preserve the original numerals and units.",
    "If any visible word, name, or number is uncertain, do not guess. Put a short warning in uncertainties.",
    "For Chinese-to-English business writing, use clear, natural, professional English without adding promises or facts.",
    "Return ONLY a valid JSON object with exactly these keys: sourceText (faithful transcription or original text), translatedText (complete translation), uncertainties (array of short warnings), detectedLanguage (language name)."
  ].join(" ") + (text ? "\n\nOriginal text / extra context:\n" + text.slice(0, 24000) : "");
}

function getModelText(result) {
  if (typeof result === "string") return result;
  if (typeof result?.response === "string") return result.response;
  if (typeof result?.output_text === "string") return result.output_text;
  if (typeof result?.choices?.[0]?.message?.content === "string") return result.choices[0].message.content;
  if (Array.isArray(result?.choices?.[0]?.message?.content)) {
    return result.choices[0].message.content.map(p => p.text || "").join("");
  }
  return "";
}

function parseModelJson(text) {
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error("AI response was not valid JSON");
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
      return json({
        ok: true,
        service: "Bilingual AI Screenshot Translator",
        model: MODEL,
        needsWorkersAIBinding: !env.AI,
        note: "POST requires your private APP_ACCESS_TOKEN."
      }, 200, origin);
    }

    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
    if (!env.AI || typeof env.AI.run !== "function") {
      return json({ error: "Cloudflare Workers AI binding is missing. Add an AI binding named AI in Worker Settings > Bindings." }, 503, origin);
    }
    if (!env.APP_ACCESS_TOKEN) {
      return json({ error: "Worker is not configured: add APP_ACCESS_TOKEN as a Secret in Worker Settings > Variables and Secrets." }, 503, origin);
    }
    const suppliedToken = request.headers.get("X-App-Token") || "";
    if (suppliedToken.length < 24 || suppliedToken !== env.APP_ACCESS_TOKEN) {
      return json({ error: "Access code is incorrect. Check the private APP_ACCESS_TOKEN value." }, 401, origin);
    }

    let body;
    try {
      const contentLength = Number(request.headers.get("Content-Length") || 0);
      if (contentLength > 8_000_000) return json({ error: "Request is too large. Crop the screenshot and try again." }, 413, origin);
      body = await request.json();
    } catch {
      return json({ error: "Invalid request body." }, 400, origin);
    }

    const mode = body.mode === "image" ? "image" : "text";
    const direction = ["en-zh", "zh-en", "ar-zh", "auto"].includes(body.direction) ? body.direction : "auto";
    const text = typeof body.text === "string" ? body.text.slice(0, 24000) : "";
    const userContent = [{ type: "text", text: makePrompt(mode, direction, text) }];

    if (mode === "image") {
      if (typeof body.imageBase64 !== "string" || !body.imageBase64.length) {
        return json({ error: "Please attach a screenshot." }, 400, origin);
      }
      if (body.imageBase64.length > 7_000_000) {
        return json({ error: "Image is too large. Crop or compress the screenshot and try again." }, 413, origin);
      }
      const mimeType = ["image/jpeg", "image/png", "image/webp"].includes(body.mimeType) ? body.mimeType : "image/jpeg";
      userContent.push({
        type: "image_url",
        image_url: { url: "data:" + mimeType + ";base64," + body.imageBase64 }
      });
    } else if (!text.trim()) {
      return json({ error: "Please enter text to translate." }, 400, origin);
    }

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          {
            role: "system",
            content: "You are a precise multilingual vision and translation model. Output only valid JSON. Never guess uncertain names or numbers."
          },
          { role: "user", content: mode === "image" ? userContent : makePrompt("text", direction, text) }
        ],
        temperature: 0.1,
        max_tokens: 3000,
        chat_template_kwargs: { enable_thinking: false }
      });

      const modelText = getModelText(result);
      const parsed = parseModelJson(modelText);
      return json({
        sourceText: String(parsed.sourceText || (mode === "text" ? text : "")),
        translatedText: String(parsed.translatedText || ""),
        uncertainties: Array.isArray(parsed.uncertainties) ? parsed.uncertainties.map(String).slice(0, 20) : [],
        detectedLanguage: String(parsed.detectedLanguage || ""),
        model: MODEL
      }, 200, origin);
    } catch (error) {
      const message = String(error?.message || error || "AI request failed");
      if (/quota|limit|neuron|rate|capacity|busy|429/i.test(message)) {
        return json({ error: "Workers AI free quota or capacity may be exhausted. Try again later. Details: " + message.slice(0, 260) }, 429, origin);
      }
      return json({ error: "Workers AI request failed: " + message.slice(0, 420) }, 502, origin);
    }
  }
};
