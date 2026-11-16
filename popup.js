const TARGET_HOST = "monev.maganghub.kemnaker.go.id";

const $ = (id) => document.getElementById(id);

const settingsBtn = $("settingsBtn");
const noticeBar = $("noticeBar");
const kegiatanInput = $("kegiatanInput");
const generateBtn = $("generateBtn");
const generateBtnText = $("generateBtnText");
const statusBox = $("statusBox");
const previewCard = $("previewCard");
const prevUraian = $("prevUraian");
const prevPembelajaran = $("prevPembelajaran");
const prevKendala = $("prevKendala");
const countUraian = $("countUraian");
const countPembelajaran = $("countPembelajaran");
const countKendala = $("countKendala");
const injectBtn = $("injectBtn");
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

function updateCharCount(el, counterEl) {
  const len = el.value.length;
  counterEl.textContent = `${len} karakter`;
  if (len < 120) {
    counterEl.style.color = "#f87171";
  } else {
    counterEl.style.color = "#6ee7b7";
  }
}

[prevUraian, prevPembelajaran, prevKendala].forEach((textarea) => {
  textarea.addEventListener("input", () => {
    updateCharCount(prevUraian, countUraian);
    updateCharCount(prevPembelajaran, countPembelajaran);
    updateCharCount(prevKendala, countKendala);
  });
});

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
    handleGenerate();
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

async function handleGenerate() {
  const kegiatan = kegiatanInput.value.trim();
  if (kegiatan.length < 5) {
    showStatus("error", "Mohon isi ringkasan kegiatan hari ini terlebih dahulu.");
    kegiatanInput.focus();
    return;
  }

  hideStatus();
  generateBtn.disabled = true;
  generateBtnText.textContent = "AI sedang menyusun laporan...";

  try {
    const tab = await getActiveTab();
    const tanggal = extractDateFromUrl(tab?.url || "");

    const hasil = await generateLaporan({ kegiatan, tanggal });

    // Tampilkan di preview card (editable)
    prevUraian.value = hasil.uraian;
    prevPembelajaran.value = hasil.pembelajaran;
    prevKendala.value = hasil.kendala;

    updateCharCount(prevUraian, countUraian);
    updateCharCount(prevPembelajaran, countPembelajaran);
    updateCharCount(prevKendala, countKendala);

    previewCard.hidden = false;
    showStatus("info", "Draft jurnal selesai disusun. Anda dapat mengedit teks sebelum menyuntikkan ke form.");

    // Simpan ke storage cache
    await chrome.storage.local.set({ lastKegiatan: kegiatan });
  } catch (err) {
    showStatus("error", err.message || "Gagal menghasilkan jurnal laporan.");
  } finally {
    generateBtn.disabled = false;
    generateBtnText.textContent = "Generate Ulang dengan AI";
  }
}

async function handleInject() {
  hideStatus();
  injectBtn.disabled = true;

  const tab = await getActiveTab();
  let currentHost = "";
  try {
    currentHost = new URL(tab?.url || "").hostname;
  } catch {}

  if (currentHost !== TARGET_HOST) {
    showStatus("error", "Harap beralih ke tab form Monev MagangHub terlebih dahulu.");
    injectBtn.disabled = false;
    return;
  }

  const dataToInject = {
    uraian: prevUraian.value.trim(),
    pembelajaran: prevPembelajaran.value.trim(),
    kendala: prevKendala.value.trim(),
  };

  const settings = await loadSettings();

  try {
    const [execution] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillMonevForm,
      args: [dataToInject, { autoCheckbox: settings.autoCheckbox }],
    });

    const result = execution?.result;
    if (!result?.ok) {
      throw new Error(result?.error || "Gagal mengisi form.");
    }

    const r = result.report;
    const notes = [];
    if (r.missing.length > 0) notes.push(`Field belum terisi: ${r.missing.join(", ")}`);
    if (r.kehadiran !== "ok" && r.kehadiran !== "sudah terisi") notes.push(`Status Kehadiran: ${r.kehadiran}`);
    if (settings.autoCheckbox && r.checkbox !== "ok" && r.checkbox !== "sudah tercentang") {
      notes.push(`Checkbox pernyataan: ${r.checkbox}`);
    }

    const notesHtml = notes.length > 0 ? `<ul>${notes.map((n) => `<li>${n}</li>`).join("")}</ul>` : "";
    showStatus(
      notes.length > 0 ? "error" : "success",
      `<strong>Form berhasil diisi!</strong> Silakan periksa kembali di halaman MagangHub, lalu klik tombol <strong>Simpan</strong>.${notesHtml}`
    );
  } catch (err) {
    showStatus("error", `Terjadi kesalahan saat mengisi form: ${err.message}`);
  } finally {
    injectBtn.disabled = false;
  }
}

generateBtn.addEventListener("click", handleGenerate);
injectBtn.addEventListener("click", handleInject);

init();
