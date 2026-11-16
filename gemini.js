// Modul integrasi AI Engine (Google Gemini & OpenAI-Compatible / Custom Endpoint)
// Digunakan oleh popup.js dan options.js

const DEFAULT_SETTINGS = {
  provider: "gemini", // "gemini" | "custom"
  // Gemini settings:
  apiKey: "",
  model: "gemini-2.0-flash",
  // Custom / OpenAI-compatible settings:
  customBaseUrl: "https://api.openai.com/v1",
  customApiKey: "",
  customModel: "gpt-4o-mini",
  // General:
  posisi: "Software Engineer Intern",
  konteks: "Pengembangan sistem web dan backend",
  autoCheckbox: true,
};

async function loadSettings() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

async function saveSettings(newSettings) {
  await chrome.storage.local.set(newSettings);
}

const MIN_CHARS_PER_FIELD = 120;

const SYSTEM_PROMPT = `Anda adalah asisten cerdas yang bertugas membantu peserta magang MagangHub Kemnaker menyusun laporan jurnal harian (monev).
Dari poin/kalimat kegiatan singkat yang diberikan oleh user, kembangkan menjadi 3 bagian laporan resmi:
1. "uraian": Uraian aktivitas harian secara rinci mengenai apa yang dikerjakan, langkah-langkah teknis/operasionalnya, dan progres atau hasil yang dicapai.
2. "pembelajaran": Pembelajaran kompetensi atau insight yang diperoleh dari kegiatan tersebut (misal teknik problem solving, arsitektur, kolaborasi tim, atau best practices).
3. "kendala": Kendala realistis yang dihadapi selama pengerjaan beserta solusi/penanganannya. Bila tidak ada error fatal, sebutkan kendala penyesuaian ringan yang masuk akal (misal: koordinasi alur data, pemahaman dokumentasi, atau optimasi) dan bagaimana kendala itu diselesaikan.

Pedoman Penulisan:
- Gunakan Bahasa Indonesia baku, profesional, dengan sudut pandang orang pertama ("saya").
- WAJIB: Setiap field terdiri dari 1 paragraf padat dengan panjang minimal 150 - 350 karakter. Jangan kurang dari 120 karakter.
- DILARANG menggunakan markdown, bullet points (*, -), simbol angka (1., 2.), atau tanda kutip ganda pembuka/penutup.
- Jangan mengarang data sensitif/rahasia atau nama klien yang tidak relevan. Kembangkan secara logis dari ranah tugas/posisi yang ditentukan.
- Kembalikan HANYA format JSON valid dengan key: "uraian", "pembelajaran", "kendala".`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    uraian: { type: "STRING" },
    pembelajaran: { type: "STRING" },
    kendala: { type: "STRING" },
  },
  required: ["uraian", "pembelajaran", "kendala"],
};

class AIError extends Error {
  constructor(message, isRetryable = false) {
    super(message);
    this.isRetryable = isRetryable;
  }
}

function cleanOutput(text) {
  return String(text || "")
    .replace(/[*_#`]+/g, "")
    .replace(/^\s*["“”']+|["“”']+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// -------------------------------------------------------------
// 1. GOOGLE GEMINI ENGINE
// -------------------------------------------------------------

async function fetchAvailableModels(apiKey) {
  if (!apiKey) throw new AIError("API Key Gemini belum diisi.");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const response = await fetch(endpoint).catch(() => null);
  if (!response) {
    throw new AIError("Gagal menghubungi server Google. Cek koneksi internet.");
  }

  const resJson = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = resJson?.error?.message || response.statusText;
    throw new AIError(`Gagal mengambil model (${response.status}): ${errorMsg}`);
  }

  const models = resJson.models || [];
  return models
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => {
      const id = m.name.replace(/^models\//, "");
      return {
        id,
        name: m.displayName ? `${m.displayName} (${id})` : id,
      };
    });
}

async function callGeminiApi({ apiKey, model, systemPrompt, userPrompt, schema, temperature = 0.7, timeoutMs = 30000 }) {
  if (!apiKey) {
    throw new AIError("API Key Gemini belum diatur. Silakan atur di menu Pengaturan.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature,
      ...(schema ? { responseMimeType: "application/json", responseSchema: schema } : {}),
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response, resJson;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    resJson = await response.json().catch(() => ({}));
  } catch (err) {
    if (err.name === "AbortError") {
      throw new AIError(`Model ${model} timeout (terlalu lama merespons).`, true);
    }
    throw new AIError("Koneksi gagal. Periksa koneksi internet Anda.");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorMsg = resJson?.error?.message || response.statusText;
    if (response.status === 400 || response.status === 401) {
      throw new AIError("API Key Gemini tidak valid. Cek kembali key di Pengaturan.");
    }
    if (response.status === 403) {
      throw new AIError("Akses API ditolak (403). Pastikan Generative Language API aktif.");
    }
    if (response.status === 404) {
      throw new AIError(`Model "${model}" tidak ditemukan di akun ini. Silakan klik Deteksi Model.`, true);
    }
    if (response.status === 429) {
      throw new AIError("Batas kuota Gemini tercapai. Tunggu 1 menit lalu coba lagi.", true);
    }
    throw new AIError(`Gemini Error (${response.status}): ${errorMsg}`);
  }

  const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!rawText) {
    throw new AIError("Gemini tidak mengembalikan teks output.", true);
  }

  return rawText;
}

// -------------------------------------------------------------
// 2. OPENAI-COMPATIBLE / CUSTOM ENDPOINT ENGINE
// (OpenAI, Groq, DeepSeek, OpenRouter, Ollama, LM Studio, vLLM)
// -------------------------------------------------------------

async function callOpenAICompatibleApi({ baseUrl, apiKey, model, systemPrompt, userPrompt, timeoutMs = 30000 }) {
  if (!baseUrl) {
    throw new AIError("Base URL API belum diisi.");
  }

  const cleanBase = baseUrl.replace(/\/+$/, "");
  const endpoint = `${cleanBase}/chat/completions`;

  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const payload = {
    model: model || "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `${userPrompt}\n\nIngat: Format balasan WAJIB berupa objek JSON murni: {"uraian": "...", "pembelajaran": "...", "kendala": "..."}` },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response, resJson;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify(payload),
    });
    resJson = await response.json().catch(() => ({}));
  } catch (err) {
    if (err.name === "AbortError") {
      throw new AIError(`Request ke ${endpoint} timeout.`);
    }
    throw new AIError(`Gagal terhubung ke ${cleanBase}. Pastikan URL dapat diakses dan server aktif.`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorMsg = resJson?.error?.message || response.statusText;
    throw new AIError(`Provider Error (${response.status}): ${errorMsg}`);
  }

  const content = resJson?.choices?.[0]?.message?.content || "";
  if (!content) {
    throw new AIError("Provider tidak mengembalikan konten balasan.");
  }

  return content;
}

// -------------------------------------------------------------
// 3. UNIFIED GENERATION & TEST RUNNER
// -------------------------------------------------------------

function extractJsonFromText(rawText) {
  let cleaned = rawText.trim();
  // Strip code block markdown if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

async function generateLaporan({ kegiatan, tanggal = "" }) {
  const settings = await loadSettings();

  const promptParts = [];
  if (settings.posisi) promptParts.push(`Posisi/Role Peserta: ${settings.posisi}`);
  if (settings.konteks) promptParts.push(`Konteks Bidang/Divisi: ${settings.konteks}`);
  if (tanggal) promptParts.push(`Tanggal Laporan: ${tanggal}`);
  promptParts.push(`Kegiatan yang dikerjakan hari ini: ${kegiatan}`);

  const userPrompt = promptParts.join("\n");

  let rawJsonText = "";

  if (settings.provider === "custom") {
    // Mode Custom / OpenAI-Compatible (OpenAI, DeepSeek, Groq, Ollama, dll)
    rawJsonText = await callOpenAICompatibleApi({
      baseUrl: settings.customBaseUrl,
      apiKey: settings.customApiKey,
      model: settings.customModel,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
    });
  } else {
    // Mode Google Gemini (Default)
    const modelsToTry = [
      settings.model || "gemini-2.0-flash",
      "gemini-2.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-2.0-flash-lite",
    ];

    let lastError = null;
    for (const model of modelsToTry) {
      try {
        rawJsonText = await callGeminiApi({
          apiKey: settings.apiKey,
          model,
          systemPrompt: SYSTEM_PROMPT,
          userPrompt,
          schema: RESPONSE_SCHEMA,
        });
        if (rawJsonText) break;
      } catch (err) {
        lastError = err;
        if (!err.isRetryable) throw err;
      }
    }
    if (!rawJsonText && lastError) throw lastError;
  }

  const parsed = extractJsonFromText(rawJsonText);
  const result = {
    uraian: cleanOutput(parsed.uraian),
    pembelajaran: cleanOutput(parsed.pembelajaran),
    kendala: cleanOutput(parsed.kendala),
  };

  if (!result.uraian || !result.pembelajaran || !result.kendala) {
    throw new AIError("Format JSON tidak memuat kolom yang lengkap.");
  }

  return result;
}

async function testConnection(settingsToTest) {
  const { provider, apiKey, model, customBaseUrl, customApiKey, customModel } = settingsToTest;

  if (provider === "custom") {
    const raw = await callOpenAICompatibleApi({
      baseUrl: customBaseUrl,
      apiKey: customApiKey,
      model: customModel,
      systemPrompt: "Jawablah dengan JSON: {\"status\": \"OK\"}",
      userPrompt: "Halo",
    });
    return raw.length > 0;
  } else {
    const raw = await callGeminiApi({
      apiKey,
      model: model || "gemini-2.0-flash",
      systemPrompt: "Jawablah dengan 1 kata: 'OK'.",
      userPrompt: "Halo",
    });
    return raw.trim().length > 0;
  }
}
