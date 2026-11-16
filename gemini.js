// Modul integrasi AI Engine (Google Gemini & OpenAI-Compatible / Custom Endpoint)
// Digunakan oleh popup.js dan options.js

const DEFAULT_SETTINGS = {
  provider: "gemini", // "gemini" | "custom"
  // Gemini settings:
  apiKey: "",
  model: "gemini-3.5-flash",
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

// SYSTEM PROMPT KETAT: Anti-Halusinasi & Anti-Mengarang Kegiatan Fiktif
const SYSTEM_PROMPT = `Anda adalah asisten formal yang bertugas merapikan laporan harian (Monev) peserta MagangHub Kemnaker menjadi kalimat formal dan baku.

ATURAN UTAMA (ANTI-HALUSINASI - SANGAT KETAT):
1. BERPEGANG TEGUH PADA INPUT USER: Anda HANYA boleh menjelaskan kegiatan yang secara eksplisit ditulis oleh user.
2. DILARANG KERAS MENGARANG PEKERJAAN TAMBAHAN: Jangan pernah menambahkan aktivitas baru, tugas lain, rapat fiktif, modul lain, atau tools/teknologi spesifik yang sama sekali tidak disebutkan oleh user.
   - Contoh Salah: User input "perbaikan bug login", AI mengarang "Saya juga menghadiri rapat sprint planning dan melakukan deployment ke server produksi". (INI DILARANG KERAS!)
   - Contoh Benar: Fokus hanya pada proses analisa bug login, pengecekan alur autentikasi tersebut, pengujian ulang, dan hasil bahwa bug login tersebut berhasil diselesaikan.
3. CARA MEMENUHI PANJANG KARAKTER (MINIMAL 150-300 KARAKTER):
   Untuk memenuhi batas panjang karakter, elaborasikan aspek ketelitian kerja, proses pengecekan ulang, kehati-hatian, koordinasi yang relevan, atau validasi hasil dari KEGIATAN ITU SENDIRI, BUKAN dengan mengarang pekerjaan baru.

Format 3 Bagian Laporan:
- "uraian": Jelaskan apa yang dikerjakan berdasarkan input user, bagaimana langkah fokus penyelesaiannya, dan hasil akhirnya. Tetap jujur pada konteks input.
- "pembelajaran": Insight, keterampilan, atau pemahaman yang didapat KHUSUS dari kegiatan tersebut (misal pentingnya ketelitian, pemahaman alur sistem, manajemen waktu, dll).
- "kendala": Kendala realistis yang berkaitan langsung dengan kegiatan itu (misalnya butuh ketelitian lebih, penyesuaian format, atau pengecekan berulang) dan bagaimana cara mengatasinya dengan baik.

Format Bahasa:
- Bahasa Indonesia baku, sopan, sudut pandang orang pertama ("saya").
- 1 paragraf padat per kolom, panjang 150–350 karakter.
- TANPA markdown, TANPA bullet points, TANPA tanda kutip pembuka/penutup.
- Kembalikan HANYA format JSON murni: {"uraian": "...", "pembelajaran": "...", "kendala": "..."}.`;

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

  const candidateModels = models.filter((m) => {
    const id = (m.name || "").replace(/^models\//, "").toLowerCase();
    const canGenerate = m.supportedGenerationMethods?.includes("generateContent");
    const isExcluded =
      id.includes("embedding") ||
      id.includes("aqa") ||
      id.includes("imagen") ||
      id.includes("tts") ||
      id.includes("audio") ||
      id.includes("video") ||
      id.includes("live");
    return canGenerate && !isExcluded;
  });

  function scoreModel(id) {
    if (id.includes("3.5-flash")) return 100;
    if (id.includes("3.8-flash")) return 95;
    if (id.includes("3.6-flash")) return 90;
    if (id.includes("flash-lite")) return 85;
    if (id.includes("2.0-flash")) return 80;
    if (id.includes("flash")) return 70;
    return 10;
  }

  candidateModels.sort((a, b) => {
    const idA = a.name.replace(/^models\//, "").toLowerCase();
    const idB = b.name.replace(/^models\//, "").toLowerCase();
    return scoreModel(idB) - scoreModel(idA);
  });

  return candidateModels.map((m) => {
    const id = m.name.replace(/^models\//, "");
    const isTopFlash = scoreModel(id.toLowerCase()) >= 80;
    const badge = isTopFlash ? "⚡ [Rekomendasi Cepat]" : "[Tersedia]";
    return {
      id,
      name: `${id} ${badge}`,
    };
  });
}

// Temperature diturunkan ke 0.2 agar AI строго faktual dan tidak mengarang bebas
async function callGeminiApi({ apiKey, model, systemPrompt, userPrompt, schema, temperature = 0.2, timeoutMs = 45000 }) {
  if (!apiKey) {
    throw new AIError("API Key Gemini belum diatur. Silakan atur di menu Pengaturan.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature,
      thinkingConfig: { thinkingBudget: 0 },
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
      throw new AIError(`Model "${model}" terlalu lama merespons (timeout). Coba pilih model Flash lain.`, true);
    }
    throw new AIError("Koneksi gagal. Periksa koneksi internet Anda.");
  } finally {
    clearTimeout(timer);
  }

  // Jika thinkingConfig ditolak oleh model tertentu (400 Bad Request), coba ulang tanpa thinkingConfig
  if (!response.ok && response.status === 400 && resJson?.error?.message?.includes("thinking")) {
    delete payload.generationConfig.thinkingConfig;
    const retryRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (retryRes && retryRes.ok) {
      response = retryRes;
      resJson = await retryRes.json().catch(() => ({}));
    }
  }

  if (!response.ok) {
    const errorMsg = resJson?.error?.message || response.statusText;
    if (response.status === 400 || response.status === 401) {
      throw new AIError(`API Key Gemini tidak valid atau parameter tidak didukung: ${errorMsg}`);
    }
    if (response.status === 403) {
      throw new AIError("Akses API ditolak (403). Pastikan Generative Language API aktif.");
    }
    if (response.status === 404) {
      throw new AIError(`Model "${model}" tidak aktif atau sudah didepresiasi oleh Google. Coba pilih model Flash lain.`, true);
    }
    if (response.status === 429) {
      throw new AIError("Batas kuota gratis Gemini tercapai sementara. Tunggu sebentar lalu coba lagi.", true);
    }
    throw new AIError(`Gemini Error (${response.status}): ${errorMsg}`);
  }

  const parts = resJson?.candidates?.[0]?.content?.parts || [];
  const textWithoutThoughts = parts
    .filter((p) => !p.thought)
    .map((p) => p.text || "")
    .join("")
    .trim();

  const rawText = textWithoutThoughts || parts.map((p) => p.text || "").join("").trim();
  if (!rawText) {
    throw new AIError("Gemini tidak mengembalikan teks output.", true);
  }

  return rawText;
}

// -------------------------------------------------------------
// 2. OPENAI-COMPATIBLE / CUSTOM ENDPOINT ENGINE
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
    temperature: 0.2, // Rendah agar tidak halusinasi
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
  promptParts.push(`Kegiatan nyata yang dikerjakan hari ini: ${kegiatan}`);

  const userPrompt = promptParts.join("\n");
  let rawJsonText = "";

  if (settings.provider === "custom") {
    rawJsonText = await callOpenAICompatibleApi({
      baseUrl: settings.customBaseUrl,
      apiKey: settings.customApiKey,
      model: settings.customModel,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
    });
  } else {
    // Mode Google Gemini (Coba model terpilih, jika gagal coba fallback)
    const modelsToTry = [
      settings.model,
      "gemini-3.5-flash",
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-flash-lite-latest",
      "gemini-2.0-flash",
    ].filter(Boolean);

    const uniqueModels = [...new Set(modelsToTry)];
    let lastError = null;

    for (const model of uniqueModels) {
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
      model: model || "gemini-3.5-flash",
      systemPrompt: "Jawablah dengan 1 kata: 'OK'.",
      userPrompt: "Halo",
    });
    return raw.trim().length > 0;
  }
}
