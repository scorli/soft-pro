// Alliance Pro — фоновий service worker.
// Відповідає за таймер і будильник, які мають працювати ЗАВЖДИ,
// навіть коли вкладка неактивна або браузер згорнутий, та бути
// синхронізованими між усіма сторінками (єдиний глобальний таймер).
"use strict";

const TIMER_KEY = "alliancepro_timer";
const REMINDER_KEY = "alliancepro_reminder";
const TIMER_ALARM = "ap-timer";
const REMINDER_ALARM = "ap-reminder";

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Alliance Pro — " + title,
      message: message,
      priority: 2,
      requireInteraction: true
    });
  } catch (e) {}
}

// Розсилаємо повідомлення всім вкладкам, де є наш контент-скрипт,
// щоб вони відтворили звук та показали сигнал синхронно.
function broadcast(msg) {
  try {
    chrome.tabs.query({}, function (tabs) {
      void chrome.runtime.lastError;
      (tabs || []).forEach(function (tab) {
        if (!tab || tab.id == null) return;
        try {
          chrome.tabs.sendMessage(tab.id, msg, function () {
            void chrome.runtime.lastError; // вкладки без скрипта ігноруємо
          });
        } catch (e) {}
      });
    });
  } catch (e) {}
}

chrome.runtime.onMessage.addListener(function (msg) {
  if (!msg || !msg.type) return;
  if (msg.type === "AP_TIMER_SET" && msg.endTime) {
    chrome.alarms.create(TIMER_ALARM, { when: msg.endTime });
  } else if (msg.type === "AP_TIMER_CLEAR") {
    chrome.alarms.clear(TIMER_ALARM);
  } else if (msg.type === "AP_REMINDER_SET" && msg.when) {
    chrome.alarms.create(REMINDER_ALARM, { when: msg.when });
  } else if (msg.type === "AP_REMINDER_CLEAR") {
    chrome.alarms.clear(REMINDER_ALARM);
  }
});

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (!alarm) return;
  const ts = Date.now();

  if (alarm.name === TIMER_ALARM) {
    chrome.storage.local.get(TIMER_KEY, function (r) {
      const t = (r && r[TIMER_KEY]) || {};
      t.status = "idle";
      t.endTime = null;
      t.remaining = 0;
      t.fired = ts;
      const o = {};
      o[TIMER_KEY] = t;
      chrome.storage.local.set(o);
    });
    notify("Таймер", "Час вийшов!");
    broadcast({ type: "AP_TIMER_FIRED", ts: ts });
  } else if (alarm.name === REMINDER_ALARM) {
    chrome.storage.local.get(REMINDER_KEY, function (r) {
      const rem = (r && r[REMINDER_KEY]) || {};
      const time = rem.time || "";
      rem.active = false;
      rem.when = null;
      rem.fired = ts;
      const o = {};
      o[REMINDER_KEY] = rem;
      chrome.storage.local.set(o);
      notify("Будильник", time ? "Нагадування о " + time : "Нагадування!");
    });
    broadcast({ type: "AP_REMINDER_FIRED", ts: ts });
  }
});

// Якщо service worker перезапустився — відновлюємо активні будильники
// зі збереженого стану (бо chrome.alarms могли скинутись при оновленні).
function restoreAlarms() {
  chrome.storage.local.get([TIMER_KEY, REMINDER_KEY], function (r) {
    const t = r && r[TIMER_KEY];
    if (t && t.status === "running" && t.endTime && t.endTime > Date.now()) {
      chrome.alarms.create(TIMER_ALARM, { when: t.endTime });
    }
    const rem = r && r[REMINDER_KEY];
    if (rem && rem.active && rem.when && rem.when > Date.now()) {
      chrome.alarms.create(REMINDER_ALARM, { when: rem.when });
    }
  });
}

chrome.runtime.onStartup.addListener(restoreAlarms);
chrome.runtime.onInstalled.addListener(restoreAlarms);
