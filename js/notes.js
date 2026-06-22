(function () {
  "use strict";

  const AP = (window.AlliancePro = window.AlliancePro || {});

  let handler = null;
  let boundId = null;

  function effId() {
    return AP.getEffectiveChatId ? AP.getEffectiveChatId() : "__nochat__";
  }

  function normalizeUrl(u) {
    u = (u || "").trim();
    if (!u) return "";
    return /^https?:\/\//i.test(u) ? u : "https://" + u;
  }

  function renderLinks() {
    const box = document.getElementById("ap-links");
    const field = document.getElementById("ap-links-field");
    if (!box) return;
    const links = (AP.storage.getSettings().usefulLinks || []).filter((l) => l && (l.url || "").trim());
    box.innerHTML = "";
    if (!links.length) {
      if (field) field.style.display = "none";
      return;
    }
    if (field) field.style.display = "flex";
    links.forEach((l) => {
      const a = document.createElement("a");
      a.className = "ap-link-chip";
      a.href = normalizeUrl(l.url);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = (l.name || "").trim() || l.url;
      a.title = normalizeUrl(l.url);
      box.appendChild(a);
    });
  }

  function load() {
    renderLinks();
    const textarea = document.getElementById("ap-notes-textarea");
    if (!textarea) return;

    if (handler) {
      textarea.removeEventListener("input", handler);
      handler = null;
    }

    boundId = effId();
    textarea.disabled = false;
    textarea.placeholder = AP.getActiveChatId && AP.getActiveChatId()
      ? "Нотатка для цього чату…"
      : "Нотатка (без активного чату)…";
    textarea.value = AP.storage.getChatData(boundId).notes || "";

    handler = () => {
      const data = AP.storage.getChatData(boundId);
      data.notes = textarea.value;
      AP.storage.setChatData(boundId, data);
    };
    textarea.addEventListener("input", handler);
  }

  AP.notes = { load, renderLinks };
})();
