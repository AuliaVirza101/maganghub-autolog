const TARGET_HOST = "monev.maganghub.kemnaker.go.id";

const $ = (id) => document.getElementById(id);

const settingsBtn = $("settingsBtn");
const noticeBar = $("noticeBar");
const kegiatanInput = $("kegiatanInput");
const actionBtn = $("actionBtn");
const actionBtnText = $("actionBtnText");
const statusBox = $("statusBox");
const tabStatus = $("tabStatus");

// Buka halaman options
settingsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());

function showStatus(type, messageHtml) {
  statusBox.className = `status-box ${type}`;
  statusBox.innerHTML = messageHtml;
  statusBox.hidden = false;
}

function hideStatus() {
  statusBox.hidden = true;
  statusBox.innerHTML = "";
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function extractDateFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const dateParam = urlObj.searchParams.get("date");
    if (!dateParam) return "";
    const parsedDate = new Date(`${dateParam}T00:00:00`);
    return isNaN(parsedDate)
      ? dateParam
      : parsedDate.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
  } catch {
    return "";
  }
}

// Setup Chip Presets
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const text = chip.getAttribute("data-text");
    if (kegiatanInput.value.trim().length > 0) {
      kegiatanInput.value += `, serta ${text.toLowerCase()}`;
    } else {
      kegiatanInput.value = text;
    }
    kegiatanInput.focus();
  });
});

// Shortcut Ctrl+Enter / Cmd+Enter
kegiatanInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleGenerateAndFill();
  }
});

// Inisialisasi
async function init() {
  const settings = await loadSettings();
  const cached = await chrome.storage.local.get("lastKegiatan");
  if (cached.lastKegiatan) {
    kegiatanInput.value = cached.lastKegiatan;
  }

  const warnings = [];

  // Validasi konfigurasi provider
  if (settings.provider === "custom") {
    if (!settings.customBaseUrl || !settings.customModel) {
      warnings.push('Pengaturan Custom Provider belum lengkap. <a href="#" id="linkOptions">Buka Pengaturan</a>.');
    }
  } else {
    if (!settings.apiKey) {
      warnings.push('API Key Gemini belum diatur. <a href="#" id="linkOptions">Buka Pengaturan</a> untuk memasukkan key.');
    }
  }

  const tab = await getActiveTab();
  let currentHost = "";
  try {
    currentHost = new URL(tab?.url || "").hostname;
  } catch {}

  const activeModelDisplay = settings.provider === "custom" ? settings.customModel : settings.model;

  if (currentHost === TARGET_HOST) {
    tabStatus.innerHTML = `<span style="color:#10b981;">●</span> Monev Terhubung (${activeModelDisplay})`;
  } else {
    tabStatus.innerHTML = `<span style="color:#f59e0b;">●</span> Tab bukan Monev (${activeModelDisplay})`;
    warnings.push("Buka form 'Tambah Laporan' di <strong>monev.maganghub.kemnaker.go.id</strong>.");
  }

  if (warnings.length > 0) {
    noticeBar.innerHTML = warnings.join("<br>");
    noticeBar.hidden = false;
    const linkOpts = document.getElementById("linkOptions");
    if (linkOpts) {
      linkOpts.addEventListener("click", (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
      });
    }
  }

  kegiatanInput.focus();
}

// 1-Click Action: Generate AI dan Langsung Tembak ke Form MagangHub
async function handleGenerateAndFill() {
  const kegiatan = kegiatanInput.value.trim();
  if (kegiatan.length < 5) {
    showStatus("error", "Mohon isi ringkasan kegiatan hari ini terlebih dahulu.");
    kegiatanInput.focus();
    return;
  }

  const tab = await getActiveTab();
  let currentHost = "";
  try {
    currentHost = new URL(tab?.url || "").hostname;
  } catch {}

  if (currentHost !== TARGET_HOST) {
    showStatus("error", "Buka halaman <strong>monev.maganghub.kemnaker.go.id</strong> dan buka form 'Tambah Laporan' terlebih dahulu.");
    return;
  }

  hideStatus();
  actionBtn.disabled = true;
  actionBtnText.textContent = "AI sedang menyusun & mengisi...";
  showStatus("info", "Sedang menyusun laporan formal dan menyuntikkan ke form...");

  try {
    const tanggal = extractDateFromUrl(tab?.url || "");
    const settings = await loadSettings();

    // 1. Generate Laporan dari AI
    const hasil = await generateLaporan({ kegiatan, tanggal });

    // 2. Langsung Inject ke Form Halaman MagangHub
    const [execution] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillMonevForm,
      args: [hasil, { autoCheckbox: settings.autoCheckbox }],
    });

    const result = execution?.result;
    if (!result?.ok) {
      throw new Error(result?.error || "Gagal mengisi form di halaman MagangHub.");
    }

    const r = result.report;
    const notes = [];
    if (r.missing.length > 0) notes.push(`Field belum terisi: ${r.missing.join(", ")}`);
    if (r.kehadiran !== "ok" && r.kehadiran !== "sudah terisi") notes.push(`Status Kehadiran: ${r.kehadiran}`);

    const notesHtml = notes.length > 0 ? `<ul>${notes.map((n) => `<li>${n}</li>`).join("")}</ul>` : "";
    showStatus(
      notes.length > 0 ? "error" : "success",
      `<strong>🎉 Form MagangHub Berhasil Diisi!</strong><br>Seluruh kolom (Uraian, Pembelajaran, Kendala, Hadir & Centang) sudah terisi langsung di web. Kamu bisa langsung mengeditnya di web jika perlu, lalu klik tombol <strong>Simpan</strong>.${notesHtml}`
    );

    // Ubah teks tombol jadi opsi Generate Ulang jika user kurang sreg
    actionBtnText.textContent = "🔄 Generate Ulang & Timpa Form";
    await chrome.storage.local.set({ lastKegiatan: kegiatan });
  } catch (err) {
    showStatus("error", err.message || "Terjadi kesalahan saat memproses laporan.");
    actionBtnText.textContent = "⚡ Generate & Langsung Isi Form";
  } finally {
    actionBtn.disabled = false;
  }
}

actionBtn.addEventListener("click", handleGenerateAndFill);

init();
