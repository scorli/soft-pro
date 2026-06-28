(function () {
  "use strict";

  const AP = (window.AlliancePro = window.AlliancePro || {});
  const CONTAINER_ID = "alliance-pro-container";

  if (window.location.hostname === "chat.sender.ftband.net") return;

  function panelHTML() {
    return `
      <div class="ap-header" id="ap-drag-handle">
        <div class="ap-brand">
          <span class="ap-brand-dot"></span>
          <span>Soft&nbsp;Pro</span>
        </div>
        <div class="ap-header-actions">
          <button class="ap-icon-btn ap-theme-btn" title="Темна тема">🌙</button>
          <button class="ap-icon-btn" id="ap-hide-btn" title="Сховати панель">✕</button>
        </div>
      </div>

      <div class="ap-body" id="ap-body">
        <div class="ap-tabs">
          <button class="ap-tab" data-tab="calc">Калькулятор</button>
          <button class="ap-tab" data-tab="timer">Таймер</button>
        </div>

        <div class="ap-panes">
          <section class="ap-pane" data-pane="calc">
            <div id="ap-calc-display" class="ap-calc-display" tabindex="0" title="Клікніть і використовуйте клавіатуру">0</div>
            <div class="ap-calc-grid">
              <button data-action="clear" class="ap-calc-btn ap-calc-fn">C</button>
              <button data-action="back" class="ap-calc-btn ap-calc-fn">⌫</button>
              <button data-action="percent" class="ap-calc-btn ap-calc-fn">%</button>
              <button data-op="/" class="ap-calc-btn ap-calc-op">÷</button>

              <button data-num="7" class="ap-calc-btn">7</button>
              <button data-num="8" class="ap-calc-btn">8</button>
              <button data-num="9" class="ap-calc-btn">9</button>
              <button data-op="*" class="ap-calc-btn ap-calc-op">×</button>

              <button data-num="4" class="ap-calc-btn">4</button>
              <button data-num="5" class="ap-calc-btn">5</button>
              <button data-num="6" class="ap-calc-btn">6</button>
              <button data-op="-" class="ap-calc-btn ap-calc-op">−</button>

              <button data-num="1" class="ap-calc-btn">1</button>
              <button data-num="2" class="ap-calc-btn">2</button>
              <button data-num="3" class="ap-calc-btn">3</button>
              <button data-op="+" class="ap-calc-btn ap-calc-op">+</button>

              <button data-num="0" class="ap-calc-btn ap-calc-zero">0</button>
              <button data-num="." class="ap-calc-btn">.</button>
              <button data-action="equals" class="ap-calc-btn ap-calc-eq">=</button>
            </div>
          </section>

          <section class="ap-pane" data-pane="timer">
            <div id="ap-timer-display" class="ap-timer-display">00:00</div>

            <div class="ap-timer-inputs">
              <div class="ap-stepper">
                <button class="ap-step-btn" data-step="-60">−</button>
                <div class="ap-stepper-field">
                  <input id="ap-timer-min" class="ap-time-input" type="number" min="0" max="180" value="5">
                  <span class="ap-stepper-cap">хв</span>
                </div>
                <button class="ap-step-btn" data-step="60">+</button>
              </div>
              <span class="ap-timer-colon">:</span>
              <div class="ap-stepper">
                <button class="ap-step-btn" data-step="-1">−</button>
                <div class="ap-stepper-field">
                  <input id="ap-timer-sec" class="ap-time-input" type="number" min="0" max="59" value="0">
                  <span class="ap-stepper-cap">сек</span>
                </div>
                <button class="ap-step-btn" data-step="1">+</button>
              </div>
            </div>

            <div class="ap-quick">
              <button class="ap-quick-btn" data-min="1">1 хв</button>
              <button class="ap-quick-btn" data-min="3">3 хв</button>
              <button class="ap-quick-btn" data-min="5">5 хв</button>
              <button class="ap-quick-btn" data-min="10">10 хв</button>
            </div>

            <div class="ap-actions">
              <button id="ap-timer-start" class="ap-btn ap-btn-primary">Старт</button>
              <button id="ap-timer-pause" class="ap-btn ap-btn-ghost" disabled>Пауза</button>
              <button id="ap-timer-reset" class="ap-btn ap-btn-ghost">Скинути</button>
              <button id="ap-alarm-stop" class="ap-btn ap-btn-danger" style="display:none">Стоп сигнал</button>
            </div>

            <div class="ap-reminder">
              <span class="ap-field-label" style="flex-basis:100%">Будильник</span>
              <div class="ap-alarm-main">
                <input type="time" id="ap-rem-time">
                <button id="ap-rem-toggle" class="ap-btn ap-btn-primary">Поставити</button>
              </div>
              <div class="ap-alarm-quick">
                <button class="ap-alarm-add" data-min="15">+15 хв</button>
                <button class="ap-alarm-add" data-min="30">+30 хв</button>
                <button class="ap-alarm-add" data-min="60">+1 год</button>
              </div>
              <span id="ap-rem-status" class="ap-rem-status"></span>
            </div>
          </section>
        </div>
      </div>
    `;
  }

  function setActiveTab(tab) {
    document.querySelectorAll(".ap-tab").forEach((t) => t.classList.toggle("ap-tab-active", t.dataset.tab === tab));
    document.querySelectorAll(".ap-pane").forEach((p) => p.classList.toggle("ap-pane-active", p.dataset.pane === tab));
  }

  function build() {
    if (document.getElementById(CONTAINER_ID)) return;

    const container = document.createElement("div");
    container.id = CONTAINER_ID;
    container.className = "ap-container ap-mini";
    container.innerHTML = panelHTML();
    document.body.appendChild(container);

    const restore = document.createElement("button");
    restore.id = "ap-restore";
    restore.title = "Soft Pro";
    restore.textContent = "SP";
    restore.style.display = "none";
    restore.addEventListener("click", () => { container.style.display = "flex"; restore.style.display = "none"; });
    document.body.appendChild(restore);

    container.querySelector(".ap-theme-btn").addEventListener("click", () => AP.theme.toggle());
    container.querySelector("#ap-hide-btn").addEventListener("click", () => {
      container.style.display = "none";
      restore.style.display = "flex";
    });
    container.querySelectorAll(".ap-tab").forEach((t) => {
      t.addEventListener("click", () => {
        setActiveTab(t.dataset.tab);
        if (t.dataset.tab === "calc") {
          const d = document.getElementById("ap-calc-display");
          if (d) d.focus();
        }
      });
    });

    AP.theme.init();
    setActiveTab("calc");
    AP.calculator.init();
    AP.draggable.initDraggable(container, container.querySelector("#ap-drag-handle"));
  }

  function start() {
    AP.storage.getAllowedSites((list) => {
      const host = window.location.hostname;
      const ok = list.some((s) => {
        s = (s || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        return s && (host === s || host.endsWith("." + s));
      });
      if (!ok) return;
      if (document.body) build();
      else document.addEventListener("DOMContentLoaded", build);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
