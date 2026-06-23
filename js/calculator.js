(function () {
  "use strict";

  const AP = (window.AlliancePro = window.AlliancePro || {});
  const MAX_TOTAL_SECONDS = 180 * 60 + 59;

  const SOUNDS = {
    classic: { label: "Класичний", freq: 880, type: "sine" },
    bell: { label: "Дзвінок", freq: 1320, type: "triangle" },
    beep: { label: "Біп", freq: 1000, type: "square" },
    soft: { label: "М'який", freq: 660, type: "sine" },
    alert: { label: "Тривога", freq: 520, type: "sawtooth" }
  };

  let audioCtx = null;
  let calcInited = false;
  let timerInited = false;
  let reminderInited = false;

  function ensureAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        audioCtx = null;
      }
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, type, duration, vol) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = type || "sine";
    gain.gain.value = vol == null ? 0.3 : vol;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (duration || 250) / 1000);
  }

  function playSound(id, duration) {
    const s = SOUNDS[id] || SOUNDS.classic;
    tone(s.freq, s.type, duration || 250, 0.3);
  }

  function init() {
    initCalculator();
    initTimer();
    initReminder();
  }

  function initCalculator() {
    const display = document.getElementById("ap-calc-display");
    const grid = document.querySelector(".ap-calc-grid");
    if (!display || !grid || calcInited) return;
    calcInited = true;

    let state = { current: "0", previous: null, operator: null, overwrite: true };

    const render = () => (display.textContent = state.current);

    const fmt = (n) => {
      if (!isFinite(n)) return "Помилка";
      return parseFloat(n.toFixed(10)).toString();
    };

    function inputDigit(d) {
      if (state.overwrite) {
        state.current = d === "." ? "0." : d;
        state.overwrite = false;
        return;
      }
      if (d === "." && state.current.includes(".")) return;
      state.current = state.current === "0" && d !== "." ? d : state.current + d;
    }

    function setOperator(op) {
      if (state.operator && !state.overwrite) compute();
      state.previous = state.current;
      state.operator = op;
      state.overwrite = true;
    }

    function compute() {
      const a = parseFloat(state.previous);
      const b = parseFloat(state.current);
      if (isNaN(a) || isNaN(b) || !state.operator) return;
      let r;
      switch (state.operator) {
        case "+": r = a + b; break;
        case "-": r = a - b; break;
        case "*": r = a * b; break;
        case "/": r = b === 0 ? NaN : a / b; break;
        default: return;
      }
      state.current = fmt(r);
      state.operator = null;
      state.previous = null;
      state.overwrite = true;
    }

    function clearAll() {
      state = { current: "0", previous: null, operator: null, overwrite: true };
    }
    function backspace() {
      if (state.overwrite) return;
      state.current = state.current.length > 1 ? state.current.slice(0, -1) : "0";
      if (state.current === "" || state.current === "-") state.current = "0";
    }
    function percent() {
      const c = parseFloat(state.current);
      if (isNaN(c)) return;
      state.current = fmt(c / 100);
      state.overwrite = true;
    }

    grid.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.dataset.num !== undefined) inputDigit(btn.dataset.num);
      else if (btn.dataset.op) setOperator(btn.dataset.op);
      else if (btn.dataset.action === "equals") compute();
      else if (btn.dataset.action === "clear") clearAll();
      else if (btn.dataset.action === "back") backspace();
      else if (btn.dataset.action === "percent") percent();
      render();
    });

    display.addEventListener("click", () => display.focus());

    function handleKey(e) {
      const activeTab = document.querySelector(".ap-tab-active");
      if (!activeTab || activeTab.dataset.tab !== "calc") return;
      const container = document.getElementById("alliance-pro-container");
      if (!container) return;
      const ae = document.activeElement;
      if (!(ae === display || container.contains(ae))) return;
      if (ae && ae !== display && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) return;

      const k = e.key;
      if (k >= "0" && k <= "9") inputDigit(k);
      else if (k === "." || k === ",") inputDigit(".");
      else if (k === "+" || k === "-" || k === "*" || k === "/") setOperator(k);
      else if (k === "Enter" || k === "=") compute();
      else if (k === "Backspace") backspace();
      else if (k === "Escape" || k === "c" || k === "C") clearAll();
      else if (k === "%") percent();
      else return;
      e.preventDefault();
      render();
    }
    document.addEventListener("keydown", handleKey);

    render();
  }

  function hasRuntime() {
    try { return !!(window.chrome && chrome.runtime && chrome.runtime.sendMessage); } catch (e) { return false; }
  }
  function sendSW(m) {
    if (!hasRuntime()) return;
    try { chrome.runtime.sendMessage(m, () => { void chrome.runtime.lastError; }); } catch (e) {}
  }

  // Глобальний таймер: стан зберігається у chrome.storage (спільний для всіх
  // вкладок і сайтів), час рахується від endTime (не «тікає» локально, тому
  // не зупиняється, коли вкладка неактивна), а спрацювання у фоні забезпечує
  // service worker через chrome.alarms.
  function initTimer() {
    const display = document.getElementById("ap-timer-display");
    const minInput = document.getElementById("ap-timer-min");
    const secInput = document.getElementById("ap-timer-sec");
    const startBtn = document.getElementById("ap-timer-start");
    const pauseBtn = document.getElementById("ap-timer-pause");
    const resetBtn = document.getElementById("ap-timer-reset");
    const alarmStopBtn = document.getElementById("ap-alarm-stop");
    const quickBtns = document.querySelectorAll(".ap-quick-btn");
    const stepBtns = document.querySelectorAll(".ap-step-btn");
    if (!display || !startBtn || timerInited) return;
    timerInited = true;

    let cache = {
      status: "idle",
      endTime: null,
      remaining: 0,
      min: parseInt(minInput.value, 10) || 0,
      sec: parseInt(secInput.value, 10) || 0,
      fired: 0
    };
    let displayId = null;
    let alarmIntervalId = null;
    let lastFiredHandled = 0;

    const fmtTime = (t) => {
      const m = Math.floor(t / 60).toString().padStart(2, "0");
      const s = Math.floor(t % 60).toString().padStart(2, "0");
      return `${m}:${s}`;
    };
    const inputSeconds = () => {
      const m = parseInt(minInput.value, 10) || 0;
      const s = parseInt(secInput.value, 10) || 0;
      return Math.max(0, m * 60 + s);
    };
    const setFromTotal = (total) => {
      total = Math.max(0, Math.min(MAX_TOTAL_SECONDS, total));
      minInput.value = Math.floor(total / 60);
      secInput.value = total % 60;
    };

    function computeRemaining() {
      if (cache.status === "running" && cache.endTime) {
        return Math.max(0, Math.round((cache.endTime - Date.now()) / 1000));
      }
      if (cache.status === "paused") return cache.remaining || 0;
      return inputSeconds();
    }
    function render() { display.textContent = fmtTime(computeRemaining()); }

    function setButtons() {
      const running = cache.status === "running";
      startBtn.disabled = running;
      pauseBtn.disabled = !running;
      stepBtns.forEach((b) => (b.disabled = running));
      quickBtns.forEach((b) => (b.disabled = running));
      minInput.disabled = running;
      secInput.disabled = running;
    }

    function persist() { AP.storage.setSharedTimer(cache); }

    function startAlarm() {
      if (alarmIntervalId) return;
      const id = AP.storage.getSettings().timerSound || "classic";
      let count = 0;
      ensureAudio();
      playSound(id);
      alarmIntervalId = setInterval(() => {
        count++;
        playSound(id);
        if (count >= 8) stopAlarm();
      }, 500);
      display.classList.add("ap-alarm");
      if (alarmStopBtn) alarmStopBtn.style.display = "inline-flex";
    }
    function stopAlarm() {
      if (alarmIntervalId) clearInterval(alarmIntervalId);
      alarmIntervalId = null;
      display.classList.remove("ap-alarm");
      if (alarmStopBtn) alarmStopBtn.style.display = "none";
    }
    AP._timerAlarm = { start: startAlarm, stop: stopAlarm };

    function handleFired(ts) {
      ts = ts || Date.now();
      if (ts === lastFiredHandled) return;
      lastFiredHandled = ts;
      cache.status = "idle";
      cache.endTime = null;
      cache.remaining = 0;
      render();
      setButtons();
      startAlarm();
    }

    function displayLoop() {
      if (displayId) clearInterval(displayId);
      displayId = setInterval(() => {
        render();
        // Підстраховка на активній вкладці: якщо час вийшов, а фонове
        // повідомлення ще не прийшло — оновлюємо стан кнопок.
        if (cache.status === "running" && computeRemaining() <= 0) {
          cache.status = "idle";
          cache.endTime = null;
          cache.remaining = 0;
          setButtons();
        }
      }, 500);
    }

    quickBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (cache.status === "running") return;
        minInput.value = parseInt(btn.dataset.min, 10) || 0;
        secInput.value = 0;
        cache.status = "idle"; cache.endTime = null; cache.remaining = 0;
        cache.min = parseInt(minInput.value, 10) || 0; cache.sec = 0;
        render(); persist();
      });
    });

    stepBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (cache.status === "running") return;
        setFromTotal(inputSeconds() + (parseInt(btn.dataset.step, 10) || 0));
        cache.status = "idle"; cache.endTime = null; cache.remaining = 0;
        cache.min = parseInt(minInput.value, 10) || 0; cache.sec = parseInt(secInput.value, 10) || 0;
        render(); persist();
      });
    });

    startBtn.addEventListener("click", () => {
      ensureAudio();
      stopAlarm();
      let secs = cache.status === "paused" ? (cache.remaining || 0) : inputSeconds();
      if (secs <= 0) secs = inputSeconds();
      if (secs <= 0) return;
      cache.status = "running";
      cache.endTime = Date.now() + secs * 1000;
      cache.remaining = 0;
      cache.min = parseInt(minInput.value, 10) || 0;
      cache.sec = parseInt(secInput.value, 10) || 0;
      persist();
      sendSW({ type: "AP_TIMER_SET", endTime: cache.endTime });
      setButtons();
      render();
    });

    pauseBtn.addEventListener("click", () => {
      cache.remaining = computeRemaining();
      cache.status = "paused";
      cache.endTime = null;
      persist();
      sendSW({ type: "AP_TIMER_CLEAR" });
      setButtons();
      render();
    });

    resetBtn.addEventListener("click", () => {
      stopAlarm();
      cache.status = "idle";
      cache.endTime = null;
      cache.remaining = 0;
      cache.min = parseInt(minInput.value, 10) || 0;
      cache.sec = parseInt(secInput.value, 10) || 0;
      persist();
      sendSW({ type: "AP_TIMER_CLEAR" });
      setButtons();
      render();
    });

    if (alarmStopBtn) alarmStopBtn.addEventListener("click", stopAlarm);

    [minInput, secInput].forEach((inp) => {
      inp.addEventListener("change", () => {
        if (cache.status === "running") return;
        setFromTotal(inputSeconds());
        cache.status = "idle"; cache.endTime = null; cache.remaining = 0;
        cache.min = parseInt(minInput.value, 10) || 0; cache.sec = parseInt(secInput.value, 10) || 0;
        render(); persist();
      });
    });

    function applyShared(t, live) {
      if (!t) return;
      cache = Object.assign({ status: "idle", endTime: null, remaining: 0, min: 0, sec: 0, fired: 0 }, t);
      if (cache.status !== "running") {
        if (typeof t.min === "number") minInput.value = t.min;
        if (typeof t.sec === "number") secInput.value = t.sec;
      }
      render();
      setButtons();
      if (live && t.fired) handleFired(t.fired);
    }

    // Синхронізація між вкладками/сайтами
    AP.storage.onSharedChange("alliancepro_timer", (t) => { if (t) applyShared(t, true); });

    // Сигнал зі service worker (працює навіть коли вкладка у фоні)
    if (hasRuntime()) {
      try {
        chrome.runtime.onMessage.addListener((msg) => {
          if (msg && msg.type === "AP_TIMER_FIRED") handleFired(msg.ts || Date.now());
        });
      } catch (e) {}
    }

    // Початкове завантаження стану
    AP.storage.getSharedTimer((t) => {
      if (t) {
        applyShared(t, false);
        if (cache.status === "running" && computeRemaining() <= 0) {
          cache.status = "idle"; cache.endTime = null; cache.remaining = 0;
          persist(); render(); setButtons();
        }
      } else {
        render(); setButtons();
      }
      displayLoop();
    });
  }

  // Будильник: теж глобальний і фоновий (chrome.storage + service worker),
  // тож спрацьовує навіть коли вкладка неактивна, і синхронізований всюди.
  function initReminder() {
    const timeInput = document.getElementById("ap-rem-time");
    const toggle = document.getElementById("ap-rem-toggle");
    const status = document.getElementById("ap-rem-status");
    if (!timeInput || !toggle || reminderInited) return;
    reminderInited = true;

    let lastFiredHandled = 0;

    function refresh(r) {
      if (r && r.active) {
        timeInput.value = r.time;
        toggle.textContent = "Скасувати";
        if (!status.textContent || status.textContent.indexOf("Будильник о") === 0) {
          status.textContent = "Будильник о " + r.time;
        }
        status.classList.add("ap-on");
      } else {
        toggle.textContent = "Поставити";
        if (status.textContent.indexOf("Будильник о") === 0) status.textContent = "";
      }
    }

    function computeWhen(t) {
      const parts = t.split(":");
      const d = new Date();
      d.setHours(parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0, 0, 0);
      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
      return d.getTime();
    }

    // Кнопки +час лише НАКОПИЧУЮТЬ час у полі (база — поточний час або вже
    // вибране значення). Будильник запускається лише кнопкою "Поставити".
    function addMinutes(min) {
      let base;
      const v = timeInput.value;
      if (/^\d{1,2}:\d{2}$/.test(v)) {
        const parts = v.split(":");
        base = new Date();
        base.setHours(parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0, 0, 0);
      } else {
        base = new Date();
        base.setSeconds(0, 0);
      }
      const d = new Date(base.getTime() + min * 60000);
      timeInput.value = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    }

    document.querySelectorAll(".ap-alarm-add").forEach((b) => {
      b.addEventListener("click", () => addMinutes(parseInt(b.dataset.min, 10) || 0));
    });

    function fire(ts, time) {
      ts = ts || Date.now();
      if (ts === lastFiredHandled) return;
      lastFiredHandled = ts;
      status.textContent = "Будильник! (" + (time || timeInput.value || "") + ")";
      status.classList.add("ap-on");
      toggle.textContent = "Поставити";
      ensureAudio();
      if (AP._timerAlarm) AP._timerAlarm.start();
      else playSound(AP.storage.getSettings().timerSound || "classic");
    }

    toggle.addEventListener("click", () => {
      AP.storage.getSharedReminder((r) => {
        if (r && r.active) {
          AP.storage.setSharedReminder({ time: r.time, active: false, when: null });
          sendSW({ type: "AP_REMINDER_CLEAR" });
          status.textContent = "";
          status.classList.remove("ap-on");
          refresh(null);
          return;
        }
        const t = timeInput.value;
        if (!t) {
          AP.ui && AP.ui.alert({ title: "Вкажіть час", text: "Оберіть час для нагадування." });
          return;
        }
        ensureAudio();
        const when = computeWhen(t);
        AP.storage.setSharedReminder({ time: t, active: true, when: when });
        sendSW({ type: "AP_REMINDER_SET", when: when });
        refresh({ time: t, active: true });
      });
    });

    // Синхронізація між вкладками
    AP.storage.onSharedChange("alliancepro_reminder", (r) => {
      refresh(r && r.active ? r : null);
      if (r && r.fired) fire(r.fired, r.time);
    });

    // Сигнал зі service worker
    if (hasRuntime()) {
      try {
        chrome.runtime.onMessage.addListener((msg) => {
          if (msg && msg.type === "AP_REMINDER_FIRED") fire(msg.ts || Date.now());
        });
      } catch (e) {}
    }

    AP.storage.getSharedReminder((r) => refresh(r && r.active ? r : null));
  }

  AP.calculator = { init, playSound, SOUNDS };
})();
