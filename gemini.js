// Modul integrasi Gemini API & Pengaturan
// Digunakan oleh popup.js dan options.js

const DEFAULT_SETTINGS = {
  apiKey: "",
  model: "gemini-2.0-flash",
  posisi: "Software Engineer Intern",
  konteks: "Pengembangan sistem web dan backend",
  autoCheckbox: true,
};

const RECOMMENDED_MODELS = [
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Sangat Cepat & Direkomendasikan)" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Generasi Terbaru)" },
  { id: "gemini-1.5-flash-latest", name: "Gemini 1.5 Flash Latest" },
  { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite (Ringan & Cepat)" },
];

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
- Variasikan pembuka kalimat agar terdengar alami dan tidak monoton.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    uraian: { type: "STRING" },
    pembelajaran: { type: "STRING" },
    kendala: { type: "STRING" },
  },
  required: ["uraian", "pembelajaran", "kendala"],
};

class GeminiError extends Error {
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

// Mengambil daftar model yang aktif dan didukung oleh API key pengguna
async function fetchAvailableModels(apiKey) {
  if (!apiKey) throw new GeminiError("API Key belum diisi.");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const response = await fetch(endpoint).catch(() => null);
  if (!response) {
    throw new GeminiError("Gagal menghubungi server Google. Cek koneksi internet.");
  }

  const resJson = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = resJson?.error?.message || response.statusText;
    throw new GeminiError(`Gagal mengambil model (${response.status}): ${errorMsg}`);
  }

  const models = resJson.models || [];
  // Filter model yang mendukung method generateContent
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
    throw new GeminiError("API Key Gemini belum diatur. Silakan atur di menu Pengaturan.");
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    resJson = await response.json().catch(() => ({}));
  } catch (err) {
    if (err.name === "AbortError") {
      throw new GeminiError(`Model ${model} timeout (terlalu lama merespons).`, true);
    }
    throw new GeminiError("Koneksi gagal. Periksa koneksi internet Anda.");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorMsg = resJson?.error?.message || response.statusText;
    if (response.status === 400 || response.status === 401) {
      throw new GeminiError("API Key tidak valid. Cek kembali key di Pengaturan.");
    }
    if (response.status === 403) {
      throw new GeminiError("Akses API ditolak (403). Pastikan Generative Language API aktif di Google Cloud.");
    }
    if (response.status === 404) {
      throw new GeminiError(`Model "${model}" tidak ditemukan di akun ini. Coba pilih model Gemini 2.0 Flash atau Gemini 2.5 Flash.`, true);
    }
    if (response.status === 429) {
      throw new GeminiError("Batas kuota / rate limit tercapai. Tunggu 1 menit lalu coba lagi.", true);
    }
    throw new GeminiError(`Gemini Error (${response.status}): ${errorMsg}`);
  }

  const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!rawText) {
    throw new GeminiError("Gemini tidak mengembalikan teks output.", true);
  }

  return rawText;
}

async function generateLaporan({ kegiatan, tanggal = "" }) {
  const settings = await loadSettings();
  if (!settings.apiKey) {
    throw new GeminiError("API Key Gemini belum diatur. Buka Pengaturan untuk memasukkan API Key.");
  }

  const promptParts = [];
  if (settings.posisi) promptParts.push(`Posisi/Role Peserta: ${settings.posisi}`);
  if (settings.konteks) promptParts.push(`Konteks Bidang/Divisi: ${settings.konteks}`);
  if (tanggal) promptParts.push(`Tanggal Laporan: ${tanggal}`);
  promptParts.push(`Kegiatan yang dikerjakan hari ini: ${kegiatan}`);

  const userPrompt = promptParts.join("\n");

  const modelsToTry = [
    settings.model || "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-2.0-flash-lite",
  ];

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const rawJson = await callGeminiApi({
        apiKey: settings.apiKey,
        model,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        schema: RESPONSE_SCHEMA,
      });

      const parsed = JSON.parse(rawJson);
      const result = {
        uraian: cleanOutput(parsed.uraian),
        pembelajaran: cleanOutput(parsed.pembelajaran),
        kendala: cleanOutput(parsed.kendala),
      };

      if (
        result.uraian.length >= MIN_CHARS_PER_FIELD &&
        result.pembelajaran.length >= MIN_CHARS_PER_FIELD &&
        result.kendala.length >= MIN_CHARS_PER_FIELD
      ) {
        return result;
      }

      lastError = new GeminiError("Hasil teks terlalu singkat dari batas minimum MagangHub.");
    } catch (err) {
      lastError = err;
      if (!err.isRetryable) throw err;
    }
  }

  throw lastError || new GeminiError("Gagal men-generate laporan dengan Gemini.");
}

async function testApiKey(apiKey, model = "gemini-2.0-flash") {
  const result = await callGeminiApi({
    apiKey,
    model,
    systemPrompt: "Jawablah dengan 1 kata: 'OK'.",
    userPrompt: "Halo",
  });
  return result.trim().length > 0;
}
