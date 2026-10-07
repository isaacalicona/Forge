const grid = document.getElementById("grid");
const tpl = document.getElementById("card-tpl");
const dialog = document.getElementById("upload");
const form = document.getElementById("upload-form");
const dropzone = document.getElementById("dropzone");
const preview = document.getElementById("preview");
const fileInput = form.elements.image;
const statusEl = document.getElementById("form-status");
const submitBtn = document.getElementById("submit-btn");

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MACH_KMH = 1235;

let rockets = [];
let sortKey = "newest";

const fmt = (n, digits = 2) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });

const serial = (id) => `FRG-${String(id).padStart(4, "0")}`;

const sorters = {
  newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  fastest: (a, b) => b.topSpeedKmh - a.topSpeedKmh,
  tallest: (a, b) => b.heightM - a.heightM,
  heaviest: (a, b) => b.weightKg - a.weightKg,
};

/* ---------- rendering ---------- */

function renderSkeletons(count = 6) {
  grid.replaceChildren(
    ...Array.from({ length: count }, () => {
      const el = document.createElement("div");
      el.className = "card is-skeleton";
      el.innerHTML = `
        <div class="card-media"></div>
        <div class="card-body">
          <div class="sk-line w-60"></div>
          <div class="sk-line w-40"></div>
          <div class="sk-line w-90"></div>
          <div class="sk-line w-90"></div>
          <div class="sk-line w-90"></div>
        </div>`;
      return el;
    }),
  );
}

function renderNotice({ title, body, action, error = false }) {
  const el = document.createElement("div");
  el.className = `notice${error ? " is-error" : ""}`;
  el.innerHTML = `
    <svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true">
      <path d="M32 6c7 6 10.5 14 10.5 24v12h-21V30C21.5 20 25 12 32 6Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="4 3"/>
      <circle cx="32" cy="26" r="4" fill="none" stroke="currentColor" stroke-width="1.4"/>
      <path d="M21.5 34 14 43v4h7.5M42.5 34 50 43v4h-7.5M27 42v12M37 42v12M32 42v16" fill="none" stroke="currentColor" stroke-width="1.6"/>
    </svg>
    <div><h3></h3><p></p></div>`;
  el.querySelector("h3").textContent = title;
  el.querySelector("p").textContent = body;
  if (action) el.querySelector("div").append(action);
  grid.replaceChildren(el);
}

function buildCard(r, i, max, featured) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.style.setProperty("--i", i);
  if (featured) node.classList.add("is-featured");

  const img = node.querySelector("img");
  img.src = r.imageUrl;
  img.alt = `${r.name}, built by ${r.builder}`;

  node.querySelector(".card-serial").textContent = serial(r.id);
  node.querySelector(".card-name").textContent = r.name;
  node.querySelector(".card-builder").textContent = r.builder;
  node.querySelector(".card-desc").textContent = r.description || "";

  const values = {
    heightM: [fmt(r.heightM), "m"],
    weightKg: [fmt(r.weightKg), "kg"],
    topSpeedKmh: [fmt(r.topSpeedKmh, 0), `km/h · M${fmt(r.topSpeedKmh / MACH_KMH, 2)}`],
  };
  for (const stat of node.querySelectorAll(".stat")) {
    const key = stat.dataset.key;
    const [value, unit] = values[key];
    const valueEl = stat.querySelector(".stat-value");
    valueEl.textContent = value;
    const small = document.createElement("small");
    small.textContent = unit;
    valueEl.append(small);
    const pct = max[key] > 0 ? Math.max(r[key] / max[key], 0.03) : 0;
    stat.querySelector(".bar i").style.setProperty("--pct", pct.toFixed(3));
  }

  node.querySelector(".pill-motor").textContent = r.motor || "";
  node.querySelector(".pill-apogee").textContent =
    r.apogeeM != null ? `Apogee ${fmt(r.apogeeM, 0)} m` : "";

  const date = new Date(r.createdAt);
  const time = node.querySelector(".card-date");
  time.dateTime = date.toISOString();
  time.textContent = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return node;
}

function renderGrid() {
  if (!rockets.length) {
    const btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.type = "button";
    btn.textContent = "Upload the first rocket";
    btn.addEventListener("click", openUpload);
    renderNotice({
      title: "The hangar is empty",
      body: "No rockets on the pad yet. Upload a photo and a few specs and yours becomes the first card on the board.",
      action: btn,
    });
    return;
  }

  const max = {
    heightM: Math.max(...rockets.map((r) => r.heightM)),
    weightKg: Math.max(...rockets.map((r) => r.weightKg)),
    topSpeedKmh: Math.max(...rockets.map((r) => r.topSpeedKmh)),
  };
  const sorted = [...rockets].sort(sorters[sortKey]);
  const featureFirst = sortKey === "newest" && sorted.length >= 3;

  grid.replaceChildren(...sorted.map((r, i) => buildCard(r, i, max, featureFirst && i === 0)));
  observeCards();
}

function renderReadout() {
  const set = (key, value, unit) => {
    const dd = document.querySelector(`[data-stat="${key}"]`);
    dd.textContent = value;
    if (unit) {
      const small = document.createElement("small");
      small.textContent = unit;
      dd.append(small);
    }
  };
  if (!rockets.length) {
    set("count", "0");
    ["fastest", "tallest", "stack"].forEach((k) => set(k, "—"));
    return;
  }
  const fastest = rockets.reduce((a, b) => (b.topSpeedKmh > a.topSpeedKmh ? b : a));
  const tallest = rockets.reduce((a, b) => (b.heightM > a.heightM ? b : a));
  const stack = rockets.reduce((sum, r) => sum + r.heightM, 0);
  set("count", String(rockets.length));
  set("fastest", fmt(fastest.topSpeedKmh, 0), `km/h · ${fastest.name}`);
  set("tallest", fmt(tallest.heightM), `m · ${tallest.name}`);
  set("stack", fmt(stack, 1), "m");
}

const io = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.25 })
  : null;

function observeCards() {
  for (const card of grid.querySelectorAll(".card")) {
    io ? io.observe(card) : card.classList.add("is-in");
  }
}

/* ---------- data ---------- */

async function loadRockets() {
  renderSkeletons();
  try {
    const res = await fetch("/api/rockets");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rockets = await res.json();
    renderReadout();
    renderGrid();
  } catch {
    const retry = document.createElement("button");
    retry.className = "btn btn-ghost";
    retry.type = "button";
    retry.textContent = "Try again";
    retry.addEventListener("click", loadRockets);
    renderNotice({
      title: "Lost telemetry",
      body: "We couldn't reach the hangar just now. Check your connection and try again.",
      action: retry,
      error: true,
    });
  }
}

/* ---------- sorting ---------- */

document.querySelectorAll("[data-sort]").forEach((btn) => {
  btn.addEventListener("click", () => {
    sortKey = btn.dataset.sort;
    document.querySelectorAll("[data-sort]").forEach((b) => b.classList.toggle("is-active", b === btn));
    if (rockets.length) renderGrid();
  });
});

/* ---------- upload dialog ---------- */

function openUpload() {
  dialog.showModal();
  form.elements.name.focus();
}

function resetForm() {
  form.reset();
  clearErrors();
  setPreview(null);
  statusEl.textContent = "";
  statusEl.classList.remove("is-error");
}

function clearErrors() {
  form.querySelectorAll("[data-error]").forEach((el) => (el.textContent = ""));
  form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
}

function showErrors(fields) {
  for (const [key, msg] of Object.entries(fields)) {
    const el = form.querySelector(`[data-error="${key}"]`);
    if (!el) continue;
    el.textContent = msg;
    el.closest(".field")?.classList.add("is-invalid");
  }
  const first = Object.keys(fields)[0];
  form.elements[first]?.focus?.();
}

let previewUrl = null;
function setPreview(file) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = file ? URL.createObjectURL(file) : null;
  preview.hidden = !file;
  if (file) preview.src = previewUrl;
  else preview.removeAttribute("src");
  dropzone.classList.toggle("has-image", Boolean(file));
}

function validate() {
  const f = form.elements;
  const errors = {};
  const positive = (v) => v.trim() !== "" && Number(v) > 0;
  if (!f.name.value.trim()) errors.name = "Give your rocket a name.";
  if (!f.builder.value.trim()) errors.builder = "Tell us who built it.";
  if (!positive(f.heightM.value)) errors.heightM = "Enter a height in metres.";
  if (!positive(f.weightKg.value)) errors.weightKg = "Enter a weight in kilograms.";
  if (f.topSpeedKmh.value.trim() === "" || Number(f.topSpeedKmh.value) < 0) errors.topSpeedKmh = "Enter a top speed in km/h.";
  if (f.apogeeM.value.trim() !== "" && Number(f.apogeeM.value) < 0) errors.apogeeM = "Apogee must be a positive number.";
  const file = fileInput.files[0];
  if (!file) errors.image = "Add a photo of your rocket.";
  else if (file.size > MAX_IMAGE_BYTES) errors.image = "Images must be 4 MB or smaller.";
  return errors;
}

document.querySelectorAll("[data-open-upload]").forEach((b) => b.addEventListener("click", openUpload));
document.querySelectorAll("[data-close-upload]").forEach((b) => b.addEventListener("click", () => dialog.close()));
dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
dialog.addEventListener("close", resetForm);

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  form.querySelector('[data-error="image"]').textContent = "";
  setPreview(file || null);
});
["dragenter", "dragover"].forEach((t) => dropzone.addEventListener(t, () => dropzone.classList.add("is-over")));
["dragleave", "drop"].forEach((t) => dropzone.addEventListener(t, () => dropzone.classList.remove("is-over")));

form.addEventListener("input", (e) => {
  const field = e.target.closest(".field");
  if (field?.classList.contains("is-invalid")) {
    field.classList.remove("is-invalid");
    field.querySelector(".field-error").textContent = "";
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();
  statusEl.classList.remove("is-error");

  const errors = validate();
  if (Object.keys(errors).length) {
    showErrors(errors);
    statusEl.textContent = "A few fields need attention.";
    statusEl.classList.add("is-error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Launching…";
  statusEl.textContent = "Uploading photo and specs…";

  try {
    const res = await fetch("/api/rockets", { method: "POST", body: new FormData(form) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.fields) showErrors(data.fields);
      throw new Error(data.error || "Upload failed. Please try again.");
    }
    rockets.unshift(data);
    sortKey = "newest";
    document.querySelectorAll("[data-sort]").forEach((b) => b.classList.toggle("is-active", b.dataset.sort === "newest"));
    renderReadout();
    renderGrid();
    dialog.close();
    document.getElementById("hangar").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.classList.add("is-error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Launch it";
  }
});

loadRockets();
