// Element References
const providerSelect = document.getElementById("providerSelect");
const panelGemini = document.getElementById("panelGemini");
const panelCustom = document.getElementById("panelCustom");

// Gemini fields
const apiKeyInput = document.getElementById("apiKey");
const toggleKeyBtn = document.getElementById("toggleKeyBtn");
const modelSelect = document.getElementById("modelSelect");
const detectModelsBtn = document.getElementById("detectModelsBtn");

// Custom fields
const presetSelect = document.getElementById("presetSelect");
const customBaseUrlInput = document.getElementById("customBaseUrl");
const customApiKeyInput = document.getElementById("customApiKey");
const toggleCustomKeyBtn = document.getElementById("toggleCustomKeyBtn");
const customModelInput = document.getElementById("customModel");

// General fields
const testConnectionBtn = document.getElementById("testConnectionBtn");
const posisiInput = document.getElementById("posisi");
const konteksInput = document.getElementById("konteks");
const autoCheckboxInput = document.getElementById("autoCheckbox");
const settingsForm = document.getElementById("settingsForm");
const alertBox = document.getElementById("alertBox");
const saveBtn = document.getElementById("saveBtn");

function showAlert(type, message) {
  alertBox.className = `alert-box ${type}`;
  alertBox.innerHTML = message;
  alertBox.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function hideAlert() {
  alertBox.hidden = true;
}

// Switch Provider Panels: Ganti tampilan formulir secara reaktif
function updateProviderView() {
  const isCustom = providerSelect.value === "custom";
  if (isCustom) {
    panelGemini.style.display = "none";
    panelCustom.style.display = "flex";
  } else {
    panelGemini.style.display = "flex";
    panelCustom.style.display = "none";
  }
}

providerSelect.addEventListener("change", updateProviderView);

// Toggle visibility password
function setupToggle(button, input) {
  button.addEventListener("click", () => {
    if (input.type === "password") {
      input.type = "text";
      button.textContent = "Sembunyikan";
    } else {
      input.type = "password";
      button.textContent = "Lihat";
    }
  });
}

setupToggle(toggleKeyBtn, apiKeyInput);
setupToggle(toggleCustomKeyBtn, customApiKeyInput);

// Presets untuk Custom / OpenAI-Compatible
const PRESETS = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "deepseek/deepseek-chat",
  },
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.2",
  },
};

presetSelect.addEventListener("change", () => {
  const chosen = PRESETS[presetSelect.value];
  if (chosen) {
    customBaseUrlInput.value = chosen.baseUrl;
    customModelInput.value = chosen.model;
  }
});

// Gemini: Deteksi model HANYA yang Free Tier
async function handleDetectModels(silent = false) {
  const key = apiKeyInput.value.trim();
  if (!key) {
    if (!silent) showAlert("error", "Masukkan API Key Gemini terlebih dahulu untuk mendeteksi model.");
    apiKeyInput.focus();
    return false;
  }

  detectModelsBtn.textContent = "Mendeteksi...";
  try {
    const models = await fetchAvailableModels(key);
    if (models.length === 0) {
      if (!silent) showAlert("error", "Tidak ada model Flash Free Tier yang ditemukan pada API Key ini.");
      return false;
    }

    const currentVal = modelSelect.value;
    modelSelect.innerHTML = "";

    models.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      modelSelect.appendChild(opt);
    });

    const preferredOrder = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash-latest"];
    let chosen = null;
    for (const pref of preferredOrder) {
      if (models.some((m) => m.id === pref)) {
        chosen = pref;
        break;
      }
    }

    if (chosen) {
      modelSelect.value = chosen;
    } else if (models.some((m) => m.id === currentVal)) {
      modelSelect.value = currentVal;
    } else {
      modelSelect.value = models[0].id;
    }

    if (!silent) {
      showAlert("success", `✅ Berhasil mendeteksi <strong>${models.length} model Free Tier</strong>. Model terpilih: <code>${modelSelect.value}</code>.`);
    }
    return true;
  } catch (err) {
    if (!silent) showAlert("error", `Gagal mendeteksi model: ${err.message}`);
    return false;
  } finally {
    detectModelsBtn.textContent = "🔄 Deteksi Model Free Tier";
  }
}

detectModelsBtn.addEventListener("click", () => handleDetectModels(false));

// Test Connection for Active Provider
testConnectionBtn.addEventListener("click", async () => {
  const isCustom = providerSelect.value === "custom";
  const config = {
    provider: isCustom ? "custom" : "gemini",
    apiKey: apiKeyInput.value.trim(),
    model: modelSelect.value,
    customBaseUrl: customBaseUrlInput.value.trim(),
    customApiKey: customApiKeyInput.value.trim(),
    customModel: customModelInput.value.trim(),
  };

  if (!isCustom && !config.apiKey) {
    showAlert("error", "Masukkan API Key Gemini terlebih dahulu.");
    apiKeyInput.focus();
    return;
  }

  if (isCustom && (!config.customBaseUrl || !config.customModel)) {
    showAlert("error", "Base URL dan Model ID wajib diisi untuk provider custom.");
    return;
  }

  testConnectionBtn.disabled = true;
  testConnectionBtn.textContent = "Menguji Koneksi...";
  showAlert("info", `Sedang menguji koneksi ke <strong>${isCustom ? config.customBaseUrl : "Google Gemini"}</strong>...`);

  try {
    if (!isCustom) {
      await handleDetectModels(true);
      config.model = modelSelect.value;
    }

    const success = await testConnection(config);
    if (success) {
      showAlert(
        "success",
        `✅ <strong>Berhasil terhubung!</strong> Provider <code>${isCustom ? config.customModel : config.model}</code> aktif dan siap digunakan.`
      );
    } else {
      showAlert("error", "Respons kosong dari server. Periksa endpoint dan model Anda.");
    }
  } catch (err) {
    showAlert("error", `❌ <strong>Gagal terhubung:</strong> ${err.message}`);
  } finally {
    testConnectionBtn.disabled = false;
    testConnectionBtn.textContent = "🔌 Test Koneksi AI";
  }
});

// Load saved settings
async function initOptions() {
  const settings = await loadSettings();

  providerSelect.value = settings.provider || "gemini";
  updateProviderView();

  apiKeyInput.value = settings.apiKey || "";
  modelSelect.value = settings.model || "gemini-2.0-flash";

  customBaseUrlInput.value = settings.customBaseUrl || "https://api.openai.com/v1";
  customApiKeyInput.value = settings.customApiKey || "";
  customModelInput.value = settings.customModel || "gpt-4o-mini";

  posisiInput.value = settings.posisi || "";
  konteksInput.value = settings.konteks || "";
  autoCheckboxInput.checked = !!settings.autoCheckbox;
}

// Save settings on submit
settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  saveBtn.disabled = true;
  saveBtn.textContent = "Menyimpan...";

  try {
    await saveSettings({
      provider: providerSelect.value,
      apiKey: apiKeyInput.value.trim(),
      model: modelSelect.value,
      customBaseUrl: customBaseUrlInput.value.trim(),
      customApiKey: customApiKeyInput.value.trim(),
      customModel: customModelInput.value.trim(),
      posisi: posisiInput.value.trim(),
      konteks: konteksInput.value.trim(),
      autoCheckbox: autoCheckboxInput.checked,
    });

    showAlert("success", "✅ <strong>Pengaturan berhasil disimpan!</strong> Perubahan sudah aktif di ekstensi.");
  } catch (err) {
    showAlert("error", `Gagal menyimpan: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Simpan Pengaturan";
  }
});

initOptions();
