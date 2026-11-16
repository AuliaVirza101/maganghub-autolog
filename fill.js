// Script injeksi DOM untuk halaman Monev MagangHub Kemnaker
// Dijalankan via chrome.scripting.executeScript({ func: fillMonevForm })
// Wajib self-contained tanpa dependensi variabel luar.

async function fillMonevForm(data, opts = {}) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const norm = (str) => (str || "").replace(/\s+/g, " ").trim().toLowerCase();
  const isVisible = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";

  function getElementLabel(el) {
    const parts = [];
    if (el.labels) {
      for (const l of el.labels) parts.push(l.textContent);
    }
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/)) {
        parts.push(document.getElementById(id)?.textContent);
      }
    }
    parts.push(
      el.getAttribute("aria-label"),
      el.getAttribute("placeholder"),
      el.getAttribute("name"),
      el.id
    );
    const formControl = el.closest('.MuiFormControl-root, .MuiTextField-root, [class*="FormControl"], [class*="form-group"]');
    if (formControl) {
      const label = formControl.querySelector("label, legend");
      if (label) parts.push(label.textContent);
    }
    return norm(parts.filter(Boolean).join(" "));
  }

  // React & MUI meng-override setter value prototype biasa.
  // Harus dipanggil via prototype descriptor agar synthetic state React mendeteksi perubahan.
  function setNativeValue(el, value) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) {
      el.focus();
      setter.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.blur();
    } else {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  // Cari kontainer form: dialog modal jika ada, fallback ke form atau document
  function findFormRoot() {
    const candidates = [
      ...document.querySelectorAll('[role="dialog"], .MuiDialog-root, .MuiDrawer-root, form'),
    ].filter((c) => isVisible(c) && c.querySelector("textarea"));
    return candidates[candidates.length - 1] || document;
  }

  const root = findFormRoot();
  const report = {
    filled: [],
    missing: [],
    kehadiran: "skip",
    checkbox: "skip",
  };

  // 1. TEXTAREA (Uraian, Pembelajaran, Kendala)
  const textareas = [...root.querySelectorAll("textarea")].filter(
    (t) => !t.readOnly && !t.disabled && t.getAttribute("aria-hidden") !== "true" && isVisible(t)
  );

  const TARGET_FIELDS = [
    { key: "uraian", name: "Uraian Aktivitas", regex: /uraian|aktivitas|kegiatan|deskripsi/i },
    { key: "pembelajaran", name: "Pembelajaran", regex: /pembelajaran|belajar|pelajaran|kompetensi/i },
    { key: "kendala", name: "Kendala", regex: /kendala|hambatan|masalah|tantangan/i },
  ];

  const matchedElements = {};
  const usedElements = new Set();

  for (const field of TARGET_FIELDS) {
    const found = textareas.find((el) => !usedElements.has(el) && field.regex.test(getElementLabel(el)));
    if (found) {
      usedElements.add(found);
      matchedElements[field.key] = found;
    }
  }

  // Fallback jika label tidak tertangkap (sesuai urutan posisi di form)
  const remaining = textareas.filter((el) => !usedElements.has(el));
  for (const field of TARGET_FIELDS) {
    if (!matchedElements[field.key] && remaining.length > 0) {
      const el = remaining.shift();
      usedElements.add(el);
      matchedElements[field.key] = el;
    }
  }

  if (Object.keys(matchedElements).length === 0) {
    return {
      ok: false,
      error: "Form laporan tidak terdeteksi. Buka modal/halaman 'Tambah Laporan' dulu di MagangHub.",
    };
  }

  for (const field of TARGET_FIELDS) {
    const targetEl = matchedElements[field.key];
    const val = data[field.key];
    if (targetEl && val) {
      setNativeValue(targetEl, val);
      report.filled.push(field.name);
      await sleep(40);
    } else {
      report.missing.push(field.name);
    }
  }

  // 2. PRESENSI / KEHADIRAN -> "Hadir"
  const TARGET_ATTENDANCE = "hadir";
  const kehadiranRegex = /kehadiran|presensi|absen|status hadir/i;

  async function handleKehadiran() {
    // A. Native <select>
    for (const sel of root.querySelectorAll("select")) {
      const ctx = getElementLabel(sel) + " " + norm(sel.closest(".MuiFormControl-root")?.textContent);
      if (!kehadiranRegex.test(ctx)) continue;
      const opt = [...sel.options].find((o) => norm(o.textContent) === TARGET_ATTENDANCE);
      if (!opt) return "opsi tidak ditemukan";
      if (sel.value === opt.value) return "sudah terisi";
      setNativeValue(sel, opt.value);
      return "ok";
    }

    // B. Material-UI Combobox (div role=combobox)
    const combos = [...root.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"]')].filter(isVisible);
    const combo = combos.find((c) => {
      const fc = c.closest(".MuiFormControl-root") || c.parentElement;
      const lb = c.getAttribute("aria-labelledby");
      const lbText = lb ? lb.split(/\s+/).map((id) => document.getElementById(id)?.textContent).join(" ") : "";
      return kehadiranRegex.test(norm((fc?.querySelector("label, legend")?.textContent || "") + " " + lbText));
    }) || (combos.length === 1 ? combos[0] : null);

    if (!combo) return "tidak ditemukan";
    if (norm(combo.textContent) === TARGET_ATTENDANCE) return "sudah terisi";

    combo.focus();
    combo.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    combo.click();

    // Tunggu popover options muncul di DOM
    for (let i = 0; i < 25; i++) {
      await sleep(60);
      const opt = [...document.querySelectorAll('[role="option"]')].find(
        (o) => isVisible(o) && norm(o.textContent) === TARGET_ATTENDANCE
      );
      if (opt) {
        opt.click();
        await sleep(150);
        return "ok";
      }
    }
    // Tutup combobox jika opsi tidak ketemu
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return "opsi 'Hadir' tidak ditemukan";
  }

  try {
    report.kehadiran = await handleKehadiran();
  } catch (err) {
    report.kehadiran = "error: " + err.message;
  }

  // 3. CHECKBOX PERNYATAAN INTEGRITAS
  if (opts.autoCheckbox) {
    const checkboxes = [...root.querySelectorAll('input[type="checkbox"]')].filter((b) => !b.disabled);
    const agreeBox = checkboxes.find((b) =>
      /menyatakan|meninjau|memastikan|benar|setuju|keabsahan/i.test(
        norm(b.closest("label")?.textContent) + " " + getElementLabel(b)
      )
    ) || (checkboxes.length === 1 ? checkboxes[0] : null);

    if (!agreeBox) {
      report.checkbox = "tidak ditemukan";
    } else if (agreeBox.checked) {
      report.checkbox = "sudah tercentang";
    } else {
      agreeBox.click();
      report.checkbox = "ok";
    }
  }

  // 4. SCROLL KE TOMBOL SIMPAN
  const submitButton = [...root.querySelectorAll("button")].find((btn) =>
    /simpan|kirim|submit/i.test(btn.textContent)
  );
  if (submitButton) {
    submitButton.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return { ok: true, report };
}
