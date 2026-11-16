const apiKeyInput = document.getElementById("apiKey");
const toggleKeyBtn = document.getElementById("toggleKeyBtn");
const testKeyBtn = document.getElementById("testKeyBtn");
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

// Test connection
testKeyBtn.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  const model = modelSelect.value;

  if (!key) {
    showAlert("error", "Masukkan API Key terlebih dahulu untuk menguji koneksi.");
    apiKeyInput.focus();
    return;
  }

  testKeyBtn.disabled = true;
  testKeyBtn.textContent = "Menguji...";
  showAlert("info", "Sedang menguji koneksi ke endpoint Gemini API...");

  try {
    const success = await testApiKey(key, model);
    if (success) {
      showAlert("success", "✅ <strong>Berhasil terhubung!</strong> API Key dan model valid.");
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
  modelSelect.value = settings.model || "gemini-1.5-flash";
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
