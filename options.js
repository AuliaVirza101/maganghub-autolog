const apiKeyInput = document.getElementById("apiKey");
const toggleKeyBtn = document.getElementById("toggleKeyBtn");
const testKeyBtn = document.getElementById("testKeyBtn");
const detectModelsBtn = document.getElementById("detectModelsBtn");
const modelSelect = document.getElementById("modelSelect");
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

// Toggle show/hide API key
toggleKeyBtn.addEventListener("click", () => {
  if (apiKeyInput.type === "password") {
    apiKeyInput.type = "text";
    toggleKeyBtn.textContent = "Sembunyikan";
  } else {
    apiKeyInput.type = "password";
    toggleKeyBtn.textContent = "Lihat";
  }
});

// Deteksi model langsung dari API Google
async function handleDetectModels(silent = false) {
  const key = apiKeyInput.value.trim();
  if (!key) {
    if (!silent) showAlert("error", "Masukkan API Key terlebih dahulu untuk mendeteksi model.");
    apiKeyInput.focus();
    return false;
  }

  detectModelsBtn.textContent = "Mendeteksi...";
  try {
    const models = await fetchAvailableModels(key);
    if (models.length === 0) {
      if (!silent) showAlert("error", "Tidak ada model generateContent yang aktif pada API Key ini.");
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

    // Pilih model prioritas jika ada
    const preferredOrder = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash-latest", "gemini-2.0-flash-lite"];
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
      showAlert("success", `✅ Berhasil mendeteksi <strong>${models.length} model</strong> dari akun Google Anda. Model terpilih: <code>${modelSelect.value}</code>.`);
    }
    return true;
  } catch (err) {
    if (!silent) showAlert("error", `Gagal mendeteksi model: ${err.message}`);
    return false;
  } finally {
    detectModelsBtn.textContent = "🔄 Deteksi Model Akun Saya";
  }
}

detectModelsBtn.addEventListener("click", () => handleDetectModels(false));

// Test connection
testKeyBtn.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showAlert("error", "Masukkan API Key terlebih dahulu untuk menguji koneksi.");
    apiKeyInput.focus();
    return;
  }

  testKeyBtn.disabled = true;
  testKeyBtn.textContent = "Menguji...";
  showAlert("info", "Sedang memeriksa model dan menguji koneksi ke Gemini API...");

  try {
    // Jalankan deteksi model dulu agar pilihan model sinkron dengan akun
    await handleDetectModels(true);

    const model = modelSelect.value;
    const success = await testApiKey(key, model);
    if (success) {
      showAlert(
        "success",
        `✅ <strong>Berhasil terhubung!</strong> API Key valid dan model <code>${model}</code> siap digunakan.`
      );
    } else {
      showAlert("error", "Respons kosong dari Gemini API. Periksa pengaturan akun Anda.");
    }
  } catch (err) {
    showAlert("error", `❌ <strong>Gagal terhubung:</strong> ${err.message}`);
  } finally {
    testKeyBtn.disabled = false;
    testKeyBtn.textContent = "Test Koneksi";
  }
});

// Load saved settings
async function initOptions() {
  const settings = await loadSettings();
  apiKeyInput.value = settings.apiKey || "";
  modelSelect.value = settings.model || "gemini-2.0-flash";
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
      apiKey: apiKeyInput.value.trim(),
      model: modelSelect.value,
      posisi: posisiInput.value.trim(),
      konteks: konteksInput.value.trim(),
      autoCheckbox: autoCheckboxInput.checked,
    });

    showAlert("success", "✅ <strong>Pengaturan berhasil disimpan!</strong> Anda dapat langsung menggunakan ekstensi.");
  } catch (err) {
    showAlert("error", `Gagal menyimpan: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Simpan Pengaturan";
  }
});

initOptions();
