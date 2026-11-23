/**
 * =========================================================================
 * ТОО «Метод и Ко» | Бюро стандартов «МЕТОДИКО»
 * УМНЫЙ ОБЛАЧНЫЙ МОСТ v7.1:
 * САЙТ (Единый Кабинет client.html + index.html + brief.html)
 *   ➔ GOOGLE ТАБЛИЦА + ЖУРНАЛ СОБЫТИЙ ДЛЯ БОТА + GOOGLE ДИСК
 *   ➔ АВТО-EMAIL КЛИЕНТУ (0 ₸)
 *   ➔ ЛИЧНЫЙ ПУЛЬТ РУКОВОДИТЕЛЯ (@metodico_sait_zayavki_bot) + GEMINI
 * =========================================================================
 * Секретные ключи хранятся ТОЛЬКО в «Настройки проекта -> Свойства скрипта»:
 *   - ADMIN_BOT_TOKEN          : токен личного пульта (@metodico_sait_zayavki_bot)
 *   - CLIENT_BOT_TOKEN         : токен ТГ-колокольчика уведомлений (@metodico_brif_bot)
 *   - ADMIN_CHAT_ID            : ваш личный Telegram ID
 *   - GEMINI_API_KEY           : ключ из Google AI Studio
 *   - DIRECTOR_KEY             : длинный секретный ключ входа в Штаб Руководителя (сменяемый за 1 мин)
 *   - CURATOR_KEY              : длинный секретный ключ входа для Куратора (сменяемый за 1 мин)
 *   - STAMP_FILE_ID            : ID файла печати metodico_stamp_sign.png в закрытой папке на Google Диске
 *   - NOTIFY_EVENTS_EMAIL      : "true" или email для дублирования событий Журнала на почту (для бота)
 *   - PORTAL_SECRET            : секрет для подписей клиентских ссылок (опционально)
 *   - ROOT_PROJECTS_FOLDER_ID  : ID корневой папки проектов на Диске (создаётся сам при 1-м запуске)
 *   - CONTRACT_TEMPLATE_ID     : (необязательно) ID шаблона Google Docs
 * =========================================================================
 */

const CONFIG = {
  SHEET_LEADS: "Заявки МЕТОДИКО",
  SHEET_QUEUE: "График и Очередь",
  SHEET_MEMORY: "Память диалогов",
  SHEET_EVENTS: "Журнал событий",
  COMPANY_NAME: "ТОО «Метод и Ко» | Бюро «МЕТОДИКО»",
  SITE_URL: "https://metodico-kz.netlify.app",
  CLIENT_BOT_USERNAME: "metodico_brif_bot",
  ROOT_FOLDER_NAME: "МЕТОДИКО — Проекты клиентов",
  MAX_CAPACITY_POINTS: 10, // Потолок одновременной загрузки (5-7 активных проектов)
  GEMINI_MODEL: "gemini-3.5-flash-lite"
};

// Карта столбцов листа «Заявки МЕТОДИКО» (1-based; колонки 1..24 неизменны, 25..29 добавлены справа по К4)
const COL = {
  KP: 1,
  DATE: 2,
  NAME: 3,
  ORG: 4,
  PHONE: 5,
  EMAIL: 6,
  TG: 7,
  CATEGORY: 8,
  DEV_LANG: 9,
  MODULES: 10,
  SITE_PRICE: 11,
  DAYS: 12,
  URGENT: 13,
  STATUS: 14,
  AGREED_PRICE: 15,
  POINTS: 16,
  SUMMARY: 17,
  BRIEF: 18,
  REQUISITES: 19,
  START_DATE: 20,
  END_DATE: 21,
  META_DOC: 22,
  DRIVE_LINK: 23,
  DEAL_JSON: 24,
  CLIENT_TYPE: 25,   // Y: Тип клиента (ВУЗы и колледжи / Корпорации и B2B / Школы и «Ұстаз» / EdTech и онлайн-школы)
  NEXT_ACTION: 26,   // Z: Следующее действие (ведёт Наталья / бот)
  ACTION_DUE: 27,    // AA: Срок (дата) (ведёт Наталья / бот)
  MISSING_INFO: 28,  // AB: Чего не хватает (ведёт Наталья / бот)
  LAST_CONTACT: 29   // AC: Последний контакт (дата) (ведёт Наталья / бот)
};

const STATUSES = {
  DRAFT_KP: "🟡 1. Черновик сметы (ждём распаковку)",
  IN_BRIEF: "🟣 2. В опроснике (идет распаковка)",
  FOR_APPROVAL: "🔵 3. На разборе у Натальи",
  EXTRA_QUESTION: "🟠 4. Доп. вопрос / Уточнение",
  FINAL_KP_SENT: "💼 5. Финальное КП отправлено (ждем 2 раб. дн.)",
  KP_ACCEPTED: "🤝 6. КП принято клиентом",
  CONTRACT_SENT: "📄 7. Договор на согласовании",
  CONTRACT_AGREED: "✍️ 8. Договор согласован (подпись и 100% оплата)",
  WAITING_MATERIALS: "⏳ 9. Оплачено — ждем материалы (бронь 3 раб. дн.)",
  IN_WORK: "🟢 10. В РАБОТЕ (Активный слот)",
  IN_QUEUE: "📅 11. В ОЧЕРЕДИ (Забронирована дата)",
  DONE: "✅ 12. Сдано / АВР подписан",
  REJECTED: "⚪ 13. Отказ",
  PAUSED: "⏸️ 14. Пауза"
};

// Официальный серверный прайс-лист модулей калькулятора (для серверного пересчёта суммы по В4 и В1)
const SERVER_PRICE_CATALOG = [
  // 1. ВУЗы и колледжи
  { code: "vuz_36", match: ["36 академ", "36 сағат"], price: 180000, days: 3 },
  { code: "vuz_72", match: ["72 академ", "72 сағат"], price: 300000, days: 4 },
  { code: "vuz_108", match: ["108–144", "108-144"], price: 450000, days: 6 },
  { code: "vuz_pool", match: ["комплексный цикл кафедры", "кафедраның кешенді циклі", "4–5 дисцип", "4–5 пән"], price: 950000, days: 10 },
  { code: "vuz_rubric", match: ["шкала оценки навыков", "бағалау шкаласы", "дескриптор"], price: 150000, days: 2 },
  { code: "vuz_tests", match: ["фонд оценочных средств", "бағалау құралдарының қоры", "100 тест"], price: 150000, days: 2 },
  { code: "vuz_html", match: ["интерактивная панель запуска", "интерактивті панелі"], price: 120000, days: 2 },
  // 2. Корпорации и B2B
  { code: "corp_salesbook", match: ["книга продаж", "сату кітабы"], price: 200000, days: 3 },
  { code: "corp_onboard", match: ["стандарты онбординга", "бейімдеу стандарттары", "72 час", "72 сағат"], price: 250000, days: 3 },
  { code: "corp_sim", match: ["диалоговый тренажер", "диалогтік тренажер", "3 ключевых сценар", "3 негізгі сценарий"], price: 350000, days: 5 },
  { code: "corp_qa", match: ["отдел контроля качества", "сапаны бақылау бөлімі"], price: 180000, days: 2 },
  // 3. Школы и «Ұстаз»
  { code: "sch_34", match: ["34 часа", "34 сағат", "34 академ"], price: 180000, days: 3 },
  { code: "sch_68", match: ["68 часов", "68 сағат", "68 академ"], price: 280000, days: 4 },
  { code: "sch_comic", match: ["предпечатная верстка", "комикс-дәптерін әзірлеу", "pre-press pdf"], price: 180000, days: 5 },
  { code: "sch_html", match: ["html-тренажер программы", "бағдарламаның интерактивті html"], price: 150000, days: 3 },
  { code: "sch_qa", match: ["стандарты преподавания и qa", "жеке мектеп үшін оқыту стандарттары"], price: 280000, days: 4 },
  // 4. EdTech и онлайн-школы
  { code: "edt_express", match: ["экспресс-аудит курса", "экспресс-аудиті"], price: 150000, days: 2 },
  { code: "edt_deep", match: ["глубокий аудит 10 уроков", "10 сабақ пен үй тапсырмаларына"], price: 250000, days: 4 },
  { code: "edt_arch", match: ["проектирование онбординга и архитектуры", "онбординг пен курс архитектурасын"], price: 180000, days: 3 },
  { code: "edt_reanim", match: ["реанимация курса", "қайта жандандыру"], price: 450000, days: 6 },
  { code: "edt_voice", match: ["voice-to-course", "аудио-наговоров", "аудиожазбалардан курс"], price: 350000, days: 5 },
  { code: "edt_workbook", match: ["воркбук а4", "брендированная рабочая тетрадь"], price: 150000, days: 3 },
  { code: "edt_curators", match: ["регламент проверки дз", "үй тапсырмасын тексеру регламенті"], price: 120000, days: 2 }
];

function getSecret(key, fallback) {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(key) || fallback || "";
}

function setSecret(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}

/**
 * =========================================================================
 * 1. ПЕРВИЧНАЯ НАСТРОЙКА ВСЕХ ЛИСТОВ ТАБЛИЦЫ И КОРНЕВОЙ ПАПКИ ДИСКА
 * =========================================================================
 */
function setupMetodikoCRM() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let leadsSheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  if (!leadsSheet) leadsSheet = ss.insertSheet(CONFIG.SHEET_LEADS);

  const leadHeaders = [
    "ID КП",                          // A (1)
    "Дата заявки",                    // B (2)
    "Имя заказчика",                  // C (3)
    "Организация / Должность",        // D (4)
    "Телефон (WhatsApp)",             // E (5)
    "Email",                          // F (6)
    "Telegram",                       // G (7)
    "Направление ЦА",                 // H (8)
    "Язык разработки",                // I (9)
    "Выбранные модули",               // J (10)
    "Смета с сайта (₸)",              // K (11)
    "Срок (раб. дн)",                 // L (12)
    "Режим срочности",                // M (13)
    "Статус (Маркер)",                // N (14)
    "Согласованная сумма (₸)",        // O (15)
    "Баллы нагрузки",                 // P (16)
    "ИИ-выжимка (Дилтс/ФКР)",         // Q (17)
    "Полный бриф и доп.вопросы",      // R (18)
    "Реквизиты для договора",         // S (19)
    "Дата старта",                    // T (20)
    "Плановая дата сдачи",            // U (21)
    "Ссылка на Договор (Google Док)", // V (22)
    "Папка проекта (Google Диск)",    // W (23)
    "Состояние сделки (JSON)",        // X (24)
    "Тип клиента",                    // Y (25)
    "Следующее действие",             // Z (26)
    "Срок (дата)",                    // AA (27)
    "Чего не хватает",                // AB (28)
    "Последний контакт (дата)"        // AC (29)
  ];

  leadsSheet.getRange(1, 1, 1, leadHeaders.length).setValues([leadHeaders]);
  leadsSheet.getRange(1, 1, 1, leadHeaders.length)
    .setFontWeight("bold")
    .setBackground("#152238")
    .setFontColor("#FFFFFF")
    .setWrap(true);
  leadsSheet.setFrozenRows(1);
  ensureExtendedColumns(leadsSheet);

  let queueSheet = ss.getSheetByName(CONFIG.SHEET_QUEUE);
  if (!queueSheet) queueSheet = ss.insertSheet(CONFIG.SHEET_QUEUE);
  setupQueueSheetLayout(queueSheet);

  let memSheet = ss.getSheetByName(CONFIG.SHEET_MEMORY);
  if (!memSheet) memSheet = ss.insertSheet(CONFIG.SHEET_MEMORY);
  const memHeaders = ["Chat ID", "ID КП", "Категория", "Язык общения", "Шаг", "Собранные ответы (JSON)", "Обновлено"];
  memSheet.getRange(1, 1, 1, memHeaders.length).setValues([memHeaders]);
  memSheet.getRange(1, 1, 1, memHeaders.length).setFontWeight("bold").setBackground("#1E293B").setFontColor("#FFFFFF");
  memSheet.setFrozenRows(1);

  ensureEventsLogSheet(ss);

  recalculateQueueSheet();
  try { getOrCreateRootProjectsFolder(); } catch (e) { Logger.log("Root folder init: " + e); }
  try { MailApp.getRemainingDailyQuota(); } catch (e) { Logger.log("MailApp quota check: " + e); }
  try {
    const dKey = getOrCreateStaffSecretKey("director");
    const cKey = getOrCreateStaffSecretKey("assistant");
    const tgRes = sendStaffKeysToAdminTelegram("🔐 СИСТЕМА МЕТОДИКО v7.1 ОБНОВЛЕНА — ВАШИ СЕКРЕТНЫЕ КЛЮЧИ ШТАБА");
    setSecret("KEYS_SENT_TO_TG_V7", "1");
    Logger.log("✅ Ключи Штаба созданы и отправлены в Telegram! Руководитель: " + dKey.slice(0, 8) + "... | Куратор: " + cKey.slice(0, 8) + "... | Ответ TG: " + (tgRes ? tgRes.getResponseCode() : "нет ADMIN_BOT_TOKEN/ADMIN_CHAT_ID"));
  } catch (e) {
    Logger.log("⚠️ Ошибка отправки ключей в TG: " + e);
  }
}

// Синоним для запуска из выпадающего меню Apps Script
function setupMetodicoSystem() {
  return setupMetodikoCRM();
}

// Смена секретных ключей Штаба за 1 минуту (из Apps Script или командой /newkey в Telegram-боте)
function rotateStaffKeys(targetChatId) {
  const dirKey = "DIR_" + Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "").slice(0, 12);
  const curKey = "CUR_" + Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "").slice(0, 12);
  setSecret("DIRECTOR_KEY", dirKey);
  setSecret("CURATOR_KEY", curKey);
  setSecret("KEYS_SENT_TO_TG_V7", "1");
  sendStaffKeysToAdminTelegram("🔄 СЕКРЕТНЫЕ КЛЮЧИ ШТАБА СМЕНЕНЫ (старые ключи больше не работают)", targetChatId);
  return { directorKey: dirKey, curatorKey: curKey };
}

function sendStaffKeysToAdminTelegram(customHeader, targetChatId) {
  const token = getSecret("ADMIN_BOT_TOKEN");
  const chatId = targetChatId || getSecret("ADMIN_CHAT_ID");
  if (!token || !chatId) return;

  const dirKey = getOrCreateStaffSecretKey("director");
  const curKey = getOrCreateStaffSecretKey("assistant");
  const dirUrl = getStaffHubUrl("director");
  const curUrl = getStaffHubUrl("assistant");

  const hdr = customHeader || "🔐 СЕКРЕТНЫЕ КЛЮЧИ И ССЫЛКИ ВХОДА В ШТАБ БЮРО «МЕТОДИКО»";
  let msg = `<b>${hdr}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👑 <b>1. Ключ Руководителя (Наталья Коденцева):</b>\n<code>${dirKey}</code>\n\n`;
  msg += `👩‍💼 <b>2. Ключ Куратора (Помощница):</b>\n<code>${curKey}</code>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📌 <b>Как пользоваться:</b>\n`;
  msg += `• Нажмите кнопку <b>«👑 Открыть Штаб всех заказов»</b> ниже (или вставьте ключ в поле входа на странице <code>client.html</code>).\n`;
  msg += `• Чтобы сменить ключи в любой момент за 5 секунд, отправьте в этот бот команду <code>/newkey</code> (или нажмите кнопку ниже).`;

  return sendTelegramApi(token, "sendMessage", {
    chat_id: chatId,
    text: msg,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "👑 Открыть Штаб всех заказов (Руководитель)", url: dirUrl }],
        [{ text: "👩‍💼 Открыть Штаб (Режим Куратора)", url: curUrl }],
        [{ text: "📊 Штабная сводка по заказам", callback_data: "staff_report" }],
        [{ text: "🔄 Сменить секретные ключи (/newkey)", callback_data: "rotate_staff_keys" }]
      ]
    }
  });
}

function ensureInitialKeysSentToTelegram() {
  try {
    if (!getSecret("KEYS_SENT_TO_TG_V7")) {
      const token = getSecret("ADMIN_BOT_TOKEN");
      const chatId = getSecret("ADMIN_CHAT_ID");
      if (token && chatId) {
        setSecret("KEYS_SENT_TO_TG_V7", "1");
        sendStaffKeysToAdminTelegram("🔐 ВАШИ СЕКРЕТНЫЕ КЛЮЧИ ШТАБА БЮРО «МЕТОДИКО» (автоматическая отправка после обновления)");
      }
    }
  } catch (e) {}
}

function ensureEventsLogSheet(ssObj) {
  const ss = ssObj || SpreadsheetApp.getActiveSpreadsheet();
  let evSheet = ss.getSheetByName(CONFIG.SHEET_EVENTS);
  if (!evSheet) {
    evSheet = ss.insertSheet(CONFIG.SHEET_EVENTS);
    const evHeaders = ["Время", "№ заявки", "Событие", "Кратко", "Кто"];
    evSheet.getRange(1, 1, 1, evHeaders.length).setValues([evHeaders])
      .setFontWeight("bold").setBackground("#152238").setFontColor("#FFFFFF").setWrap(true);
    evSheet.setFrozenRows(1);
    try {
      evSheet.setColumnWidth(1, 150);
      evSheet.setColumnWidth(2, 130);
      evSheet.setColumnWidth(3, 210);
      evSheet.setColumnWidth(4, 460);
      evSheet.setColumnWidth(5, 110);
    } catch (e) {}
  } else if (!evSheet.getRange(1, 1).getValue()) {
    const evHeaders = ["Время", "№ заявки", "Событие", "Кратко", "Кто"];
    evSheet.getRange(1, 1, 1, evHeaders.length).setValues([evHeaders])
      .setFontWeight("bold").setBackground("#152238").setFontColor("#FFFFFF").setWrap(true);
    evSheet.setFrozenRows(1);
  }
  return evSheet;
}

function ensureExtendedColumns(sheet) {
  if (!sheet) return;
  const extHeaders = [
    { col: COL.DRIVE_LINK, title: "Папка проекта (Google Диск)" },
    { col: COL.DEAL_JSON, title: "Состояние сделки (JSON)" },
    { col: COL.CLIENT_TYPE, title: "Тип клиента" },
    { col: COL.NEXT_ACTION, title: "Следующее действие" },
    { col: COL.ACTION_DUE, title: "Срок (дата)" },
    { col: COL.MISSING_INFO, title: "Чего не хватает" },
    { col: COL.LAST_CONTACT, title: "Последний контакт (дата)" }
  ];
  extHeaders.forEach(h => {
    if (!sheet.getRange(1, h.col).getValue()) {
      sheet.getRange(1, h.col).setValue(h.title)
        .setFontWeight("bold").setBackground("#152238").setFontColor("#FFFFFF").setWrap(true);
    }
  });

  // Автозаполнение колонки «Тип клиента» (Y) для существующих строк, если она ещё пустая (колонки Z..AC не трогаем)
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const cats = sheet.getRange(2, COL.CATEGORY, lastRow - 1, 1).getValues();
      const types = sheet.getRange(2, COL.CLIENT_TYPE, lastRow - 1, 1).getValues();
      let changed = false;
      for (let i = 0; i < cats.length; i++) {
        if (!types[i][0] && cats[i][0]) {
          types[i][0] = mapCategoryToClientType(cats[i][0]);
          changed = true;
        }
      }
      if (changed) {
        sheet.getRange(2, COL.CLIENT_TYPE, lastRow - 1, 1).setValues(types);
      }
    }
  } catch (e) {}

  try { ensureEventsLogSheet(); } catch (e) {}
}

function mapCategoryToClientType(categoryText) {
  const key = detectBranchKey(categoryText);
  if (key === "vuz") return "ВУЗы и колледжи";
  if (key === "school") return "Школы и «Ұстаз»";
  if (key === "edtech") return "EdTech и онлайн-школы";
  if (key === "b2b") return "Корпорации и B2B";
  const s = String(categoryText || "").toLowerCase();
  if (s.includes("вуз") || s.includes("колледж") || s.includes("жоо")) return "ВУЗы и колледжи";
  if (s.includes("школ") || s.includes("ұстаз") || s.includes("устаз") || s.includes("мектеп")) return "Школы и «Ұстаз»";
  if (s.includes("edtech") || s.includes("онлайн")) return "EdTech и онлайн-школы";
  return "Корпорации и B2B";
}

function isRejectedStatus(statusText) {
  const s = String(statusText || "").toLowerCase();
  return s.includes("отказ");
}

function isPausedStatus(statusText) {
  const s = String(statusText || "").toLowerCase();
  return s.includes("пауза");
}

// Лестница статусов для предотвращения случайного отката назад (К3)
function getStatusStageOrder(statusText) {
  const s = String(statusText || "");
  if (isRejectedStatus(s)) return 99;
  if (isPausedStatus(s)) return 98;
  if (s.includes("✅") || s.includes("12.")) return 12;
  if (s.includes("📅") || s.includes("11.")) return 11;
  if (s.includes("🟢") || s.includes("10.")) return 10;
  if (s.includes("⏳") || s.includes("9.")) return 9;
  if (s.includes("✍️") || s.includes("8.")) return 8;
  if (s.includes("📄") || s.includes("7.")) return 7;
  if (s.includes("🤝") || s.includes("6.")) return 6;
  if (s.includes("💼") || s.includes("5.")) return 5;
  if (s.includes("🟠") || s.includes("4.")) return 4;
  if (s.includes("🔵") || s.includes("3.")) return 3;
  if (s.includes("🟣") || s.includes("2.")) return 2;
  if (s.includes("🟡") || s.includes("1.")) return 1;
  return 0;
}

// Централизованное обновление статуса с записью в лист «Журнал событий» (К3, К4)
function updateOrderStatus(sheet, rowIdx, newStatus, actor, options) {
  if (!sheet || rowIdx < 2 || !newStatus) return false;
  const opts = options || {};
  const oldStatus = String(sheet.getRange(rowIdx, COL.STATUS).getValue() || "").trim();
  const kp = String(sheet.getRange(rowIdx, COL.KP).getValue() || "").trim();

  if (oldStatus === newStatus) {
    paintStatusCell(sheet, rowIdx, newStatus);
    return false;
  }

  // Запрещаем непроизвольный откат статуса назад (если только не передан force: true или статус Доп.вопрос/Отказ/Пауза)
  if (!opts.force && oldStatus) {
    const oldRank = getStatusStageOrder(oldStatus);
    const newRank = getStatusStageOrder(newStatus);
    if (oldRank > newRank && newStatus !== STATUSES.EXTRA_QUESTION) {
      return false;
    }
  }

  sheet.getRange(rowIdx, COL.STATUS).setValue(newStatus);
  paintStatusCell(sheet, rowIdx, newStatus);

  if (isRejectedStatus(newStatus)) {
    patchDealState(sheet, rowIdx, { needsAttention: false });
  }

  if (oldStatus && oldStatus !== newStatus && !opts.skipStatusEvent) {
    appendBotEventLog(kp, "статус_изменён", `${oldStatus} → ${newStatus}`, actor || "система");
  }
  if (isRejectedStatus(newStatus) && !isRejectedStatus(oldStatus)) {
    appendBotEventLog(kp, "отказ", "Заказ переведён в статус «Отказ»", actor || "Наталья");
  }
  return true;
}

// Автоматическое выравнивание отставшего статуса (например, MK-2026-826, где договор отправлен, а статус остался «3. На разборе»)
function healLaggingOrderStatus(sheet, rowIdx, row, deal) {
  if (!sheet || rowIdx < 2 || !row || !deal) return row ? row[COL.STATUS - 1] : "";
  const curStatus = String(row[COL.STATUS - 1] || "");
  if (isRejectedStatus(curStatus) || isPausedStatus(curStatus)) return curStatus;

  const curRank = getStatusStageOrder(curStatus);
  let targetStatus = "";

  if (deal.paidAt && curRank < 9) {
    targetStatus = STATUSES.WAITING_MATERIALS;
  } else if ((deal.clientSignedOnline || (Array.isArray(deal.signedContractFiles) && deal.signedContractFiles.length > 0)) && curRank < 8) {
    targetStatus = STATUSES.CONTRACT_AGREED;
  } else if ((deal.contractSignedByAdmin || deal.contractSignedAt || extractDocUrlFromCol22(row[COL.META_DOC - 1]) || deal.contractDocUrl) && curRank < 7) {
    targetStatus = STATUSES.CONTRACT_SENT;
  } else if (deal.chosenVariant && curRank < 6) {
    targetStatus = STATUSES.KP_ACCEPTED;
  } else if ((deal.kpSignedByAdmin || deal.kpSentAt) && curRank < 5) {
    targetStatus = STATUSES.FINAL_KP_SENT;
  }

  if (targetStatus && targetStatus !== curStatus) {
    updateOrderStatus(sheet, rowIdx, targetStatus, "система", { force: true });
    row[COL.STATUS - 1] = targetStatus;
    return targetStatus;
  }
  return curStatus;
}

// Очистка строки «Кратко» от телефонов, ИИН/БИН, email и банковских счетов (К3)
function sanitizeEventShortText(rawText, maxLen) {
  const limit = maxLen || 120;
  let s = String(rawText || "").replace(/[\r\n\t]+/g, " ").trim();
  // Вырезаем IBAN счета KZ...
  s = s.replace(/\bKZ[A-Z0-9]{14,20}\b/gi, "[ИИК скрыт]");
  // Вырезаем Email
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]");
  // Вырезаем БИН/ИИН (12 цифр подряд) и телефоны (10-15 цифр с пробелами/скобками/дефисами)
  s = s.replace(/\b\d{12}\b/g, "[ИИН/БИН]");
  s = s.replace(/(?:\+?\d[\d\s\-()]{8,16}\d)/g, "[тел.]");
  s = s.replace(/\s{2,}/g, " ").trim();
  if (s.length > limit) {
    s = s.slice(0, limit).trim() + "…";
  }
  return s || "—";
}

// Запись строки в лист «Журнал событий» + опциональное дублирование на почту Натальи (К3)
function appendBotEventLog(kpNumber, eventCode, shortText, actor) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const evSheet = ensureEventsLogSheet(ss);
    const timeAlmaty = Utilities.formatDate(new Date(), "Asia/Almaty", "dd.MM.yyyy HH:mm:ss");
    const kp = String(kpNumber || "—").trim();
    const code = String(eventCode || "событие").trim();
    const maxChars = code === "сообщение_клиента" ? 100 : 130;
    const cleanShort = sanitizeEventShortText(shortText, maxChars);
    const who = actor || "система";

    evSheet.appendRow([timeAlmaty, kp, code, cleanShort, who]);

    // Опциональное дублирование события письмом на почту Натальи (включается настройкой NOTIFY_EVENTS_EMAIL в Свойствах скрипта)
    const emailPref = String(getSecret("NOTIFY_EVENTS_EMAIL") || "").trim();
    if (emailPref && emailPref.toLowerCase() !== "false" && emailPref !== "0") {
      let targetEmail = emailPref.includes("@") ? emailPref : "";
      if (!targetEmail) {
        try { targetEmail = Session.getEffectiveUser().getEmail(); } catch (e) {}
      }
      if (!targetEmail) targetEmail = "metodico.kz@gmail.com";
      const subj = `[МЕТОДИКО] событие ${kp}: ${code}`;
      const bodyLines = [
        `Заявка: ${kp} | Время: ${timeAlmaty} (Алматы)`,
        `Событие: ${code} | Кто: ${who}`,
        `Кратко: ${cleanShort}`
      ].join("\n");
      MailApp.sendEmail(targetEmail, subj, bodyLines, { name: "Журнал событий МЕТОДИКО" });
    }
  } catch (err) {
    Logger.log("appendBotEventLog warn: " + err.toString());
  }
}

// Триггер ручного изменения колонки «Статус (Маркер)» прямо в Google Таблице (К3, К4)
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    if (!sheet || sheet.getName() !== CONFIG.SHEET_LEADS) return;
    const col = e.range.getColumn();
    const rowIdx = e.range.getRow();
    if (rowIdx < 2 || col !== COL.STATUS) return;

    const newVal = String(e.value || sheet.getRange(rowIdx, COL.STATUS).getValue() || "").trim();
    const oldVal = String(e.oldValue || "").trim();
    const kp = String(sheet.getRange(rowIdx, COL.KP).getValue() || "").trim();
    if (!newVal || !kp) return;

    paintStatusCell(sheet, rowIdx, newVal);
    if (isRejectedStatus(newVal)) {
      patchDealState(sheet, rowIdx, { needsAttention: false });
    }
    if (oldVal && oldVal !== newVal) {
      appendBotEventLog(kp, "статус_изменён", `${oldVal} → ${newVal}`, "Наталья");
    }
    if (isRejectedStatus(newVal) && !isRejectedStatus(oldVal)) {
      appendBotEventLog(kp, "отказ", "Заказ переведён в статус «Отказ» в таблице", "Наталья");
    }
  } catch (err) {}
}

// Порядковый номер КП с сервера: MK-2026-001, MK-2026-002... (В3)
function generateNextSequentialKpNumber(sheet) {
  const year = new Date().getFullYear();
  const propKey = "LAST_KP_SEQ_" + year;
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) {}

  try {
    let lastSeq = parseInt(getSecret(propKey, "0"), 10) || 0;
    const existingSet = {};

    if (sheet && sheet.getLastRow() >= 2) {
      const vals = sheet.getRange(2, COL.KP, sheet.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < vals.length; i++) {
        const val = String(vals[i][0] || "").trim().toUpperCase();
        if (!val) continue;
        existingSet[val] = true;
        // Учитываем уже выданные порядковые номера с ведущим нулём (001..099) либо если счётчик уже выше
        const m = val.match(new RegExp("^MK-" + year + "-(\\d+)$"));
        if (m) {
          const numStr = m[1];
          const numVal = parseInt(numStr, 10);
          if (numStr.startsWith("0") && numVal > lastSeq) {
            lastSeq = numVal;
          }
        }
      }
    }

    let nextSeq = lastSeq + 1;
    let candidate = "";
    while (true) {
      const padded = nextSeq < 10 ? ("00" + nextSeq) : (nextSeq < 100 ? ("0" + nextSeq) : String(nextSeq));
      candidate = `MK-${year}-${padded}`;
      if (!existingSet[candidate.toUpperCase()]) break;
      nextSeq++;
    }

    setSecret(propKey, String(nextSeq));
    return candidate;
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// Пересчёт сметы и срока на сервере по прайсу (В1, В2, В4)
function recalculateServerLeadTotals(selectedItems, devLangCode, isUrgent) {
  const items = Array.isArray(selectedItems) ? selectedItems : [];
  let basePrice = 0;
  let baseDays = 0;
  const verifiedItems = [];

  items.forEach(rawIt => {
    if (!rawIt || typeof rawIt !== "object") return;
    const rawCode = String(rawIt.code || "").trim().toLowerCase();
    const rawName = String(rawIt.name || "").trim().slice(0, 220);
    const nameLower = rawName.toLowerCase();

    let matched = null;
    if (rawCode) {
      matched = SERVER_PRICE_CATALOG.find(c => c.code === rawCode);
    }
    if (!matched && nameLower) {
      matched = SERVER_PRICE_CATALOG.find(c => c.match.some(sub => nameLower.includes(sub)));
    }

    if (matched) {
      basePrice += matched.price;
      baseDays += matched.days;
      verifiedItems.push({ code: matched.code, name: rawName || matched.code, price: matched.price, days: matched.days });
    } else {
      // Шаг 1 калькулятора (цель задачи, 0 ₸)
      verifiedItems.push({ code: "task_0", name: rawName || "Цель задачи", price: 0, days: 0 });
    }
  });

  let priceMult = 1.0;
  let daysMult = 1.0;
  if (devLangCode === "kz") { priceMult = 1.10; daysMult = 1.10; }
  else if (devLangCode === "both") { priceMult = 1.25; daysMult = 1.20; }

  let totalPrice = basePrice * priceMult;
  if (isUrgent) totalPrice *= 1.20;
  totalPrice = Math.round(totalPrice / 1000) * 1000;

  const totalDays = baseDays > 0 ? Math.ceil(baseDays * daysMult) : 0;

  return {
    basePrice: basePrice,
    baseDays: baseDays,
    totalPrice: totalPrice,
    totalDays: totalDays,
    verifiedItems: verifiedItems
  };
}

// Ограничение частоты запросов (Rate Limit по телефону/email: 3 заявки в час, 20 сообщений в час — В4)
function checkRateLimit(bucketPrefix, identifier, maxCount, windowSeconds) {
  try {
    const cleanId = String(identifier || "anon").replace(/[^a-zA-Z0-9+@._-]/g, "").slice(0, 60) || "anon";
    const key = "rl_" + bucketPrefix + "_" + cleanId;
    const cache = CacheService.getScriptCache();
    const cur = parseInt(cache.get(key) || "0", 10);
    if (cur >= maxCount) return false;
    cache.put(key, String(cur + 1), windowSeconds || 3600);
    return true;
  } catch (e) {
    return true;
  }
}

// Проверка типа и размера загружаемого файла (В4)
function validateUploadedFile(fileName, mimeType, fileBase64) {
  if (!fileBase64) return { ok: false, message: "Файл пустой." };
  // ~4.5 МБ в base64 ≈ 6 300 000 символов
  if (String(fileBase64).length > 6400000) {
    return { ok: false, message: "Размер файла превышает допустимый лимит 4.5 МБ." };
  }
  const name = String(fileName || "").trim();
  const forbiddenExt = /\.(exe|bat|cmd|msi|scr|pif|com|vbs|vbe|js|jse|wsf|wsh|ps1|sh|php|py|rb|pl|jar|apk|dll|sys|htm|html|svg)$/i;
  if (forbiddenExt.test(name)) {
    return { ok: false, message: "Данный тип файла не разрешён по правилам безопасности." };
  }
  const allowedExt = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|rtf|odt|ods|odp|zip|rar|7z|jpg|jpeg|png|webp|gif|bmp|mp3|wav|ogg|webm|m4a|mp4)$/i;
  if (name.includes(".") && !allowedExt.test(name)) {
    return { ok: false, message: "Разрешены только документы (PDF, Word, Excel, презентации), изображения, архивы и аудио." };
  }
  return { ok: true };
}

function setupQueueSheetLayout(queueSheet) {
  queueSheet.clear();
  queueSheet.getRange("A1:G1").merge()
    .setValue("📊 ПРОИЗВОДСТВЕННЫЙ ГРАФИК И ОЧЕРЕДЬ ЗАГРУЗКИ БЮРО «МЕТОДИКО» (Потолок: " + CONFIG.MAX_CAPACITY_POINTS + " баллов)")
    .setFontWeight("bold").setFontSize(12).setBackground("#152238").setFontColor("#D4AF37");

  queueSheet.getRange("A2:D2").setValues([["Занято баллов сейчас:", 0, "Свободно баллов:", CONFIG.MAX_CAPACITY_POINTS]]);
  queueSheet.getRange("E2:G2").setValues([["Ближайшее свободное окно:", formatDateRu(addWorkingDays(new Date(), 1)), "Правило: 100% оплата + все материалы -> старт след. раб. день"]]);
  queueSheet.getRange("A2:G2").setFontWeight("bold").setBackground("#F8FAFC");

  const qHeaders = ["№ п/п", "ID КП", "Заказчик / Организация", "Направление и Язык", "Баллы", "Статус слота", "Старт ➔ Сдача"];
  queueSheet.getRange(4, 1, 1, qHeaders.length).setValues([qHeaders]);
  queueSheet.getRange(4, 1, 1, qHeaders.length).setFontWeight("bold").setBackground("#334155").setFontColor("#FFFFFF");
  queueSheet.setFrozenRows(4);
}

/**
 * =========================================================================
 * 2. ОБРАБОТКА ВХОДЯЩИХ ЗАПРОСОВ: GET (ОЧЕРЕДЬ + КАБИНЕТ) И POST
 * =========================================================================
 */
function doGet(e) {
  try {
    ensureInitialKeysSentToTelegram();
    const params = (e && e.parameter) ? e.parameter : {};
    const action = params.action || "";

    if (action === "queue_status") {
      return jsonResponse(getPublicQueueStatus());
    }
    if (action === "client_portal") {
      return jsonResponse(getClientPortalState(params.kp || "", params.t || "", params.admin || ""));
    }
    if (action === "find_by_phone") {
      return jsonResponse(findOrdersByPhoneApi(params.phone || ""));
    }
    if (action === "staff_dashboard") {
      return jsonResponse(getStaffDashboardState(params.staff || ""));
    }
    return jsonResponse({ status: "ok", service: "METODIKO Bridge v7.1" });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

function doPost(e) {
  try {
    ensureInitialKeysSentToTelegram();
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput("OK");
    }

    const botType = (e.parameter && e.parameter.bot) ? e.parameter.bot : "default";
    const data = JSON.parse(e.postData.contents);

    // Щит от дублирования Telegram update_id
    if (data.update_id) {
      const cache = CacheService.getScriptCache();
      const cacheKey = "tg_upd_" + botType + "_" + data.update_id;
      if (cache.get(cacheKey)) {
        return ContentService.createTextOutput("OK");
      }
      cache.put(cacheKey, "1", 21600);
    }

    // Клиентский бот-колокольчик уведомлений (?bot=client)
    if (botType === "client") {
      return handleClientNotifierBot(data);
    }

    // Кнопки в Пульте руководителя (Админ-бот)
    if (data.callback_query) {
      return handleAdminCallback(data.callback_query);
    }

    // Текстовое сообщение в Пульте руководителя
    if (data.message) {
      const adminChatId = getSecret("ADMIN_CHAT_ID");
      if (adminChatId && data.message.chat && String(data.message.chat.id) === String(adminChatId)) {
        return handleAdminMessage(data.message);
      }
      return ContentService.createTextOutput("OK");
    }

    // Honeypot-фильтр от спам-ботов с сайта (В4)
    if (data.hp || data.company_fax_code || data.website_url_hp) {
      return jsonResponse({ status: "error", message: "Запрос отклонён защитой от автоматических ботов." });
    }

    // Действия из Единого Кабинета Клиента / Админ-просмотра А4 / Штаба (client.html)
    if (data.type === "client_portal_action") {
      return jsonResponse(handleClientPortalPost(data));
    }

    // Заявка с отдельной страницы веб-распаковщика (brief.html)
    if (data.type === "web_brief") {
      return jsonResponse(processWebBriefSubmission(data));
    }

    // Первичная заявка с калькулятора сайта (index.html)
    return jsonResponse(processNewWebsiteLead(data));

  } catch (error) {
    Logger.log("doPost error: " + error.toString());
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

function handleClientNotifierBot(update) {
  const clientToken = getSecret("CLIENT_BOT_TOKEN");
  if (!clientToken || !update || !update.message || !update.message.chat) {
    return ContentService.createTextOutput("OK");
  }

  const msg = update.message;
  const chatId = String(msg.chat.id);
  const text = (msg.text || "").toString().trim();
  const tgUser = (msg.from && msg.from.username) ? ("@" + msg.from.username) : "";

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  if (sheet) ensureExtendedColumns(sheet);

  const mStart = text.match(/^\/start(?:\s+([A-Za-z0-9_-]+))?/i);
  let rowIdx = -1;
  if (sheet) {
    if (mStart && mStart[1]) {
      rowIdx = findRowByKp(sheet, mStart[1].trim());
    }
    if (rowIdx === -1) {
      rowIdx = findRowByTgChatId(sheet, chatId);
    }
    if (rowIdx === -1 && tgUser) {
      rowIdx = findRowByTgUsername(sheet, tgUser);
    }
  }

  if (rowIdx !== -1 && sheet) {
    const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const deal = parseJsonSafe(row[COL.DEAL_JSON - 1], {});
    const kp = String(row[COL.KP - 1]);
    const lang = deal.chatLang === "kz" ? "kz" : "ru";
    const alreadyConnected = Boolean(extractTgChatId(row, deal));
    saveClientTgChat(sheet, rowIdx, chatId, tgUser);

    const portalUrl = getClientPortalUrl(kp);
    if (mStart) {
      const helloMsg = lang === "kz"
        ? `🔔 <b>№ ${escapeHtml(kp)} өтінімі бойынша хабарламалар қосылды!</b>\n\nНаталья Коденцева Қорытынды КП, Шарт немесе сұрақ дайындаған бойда мен сізге осы жерге бірден хабар беремін.\n\n📌 Барлық құжаттар, таңдау және реквизиттер сайттағы Жеке кабинетте 👇`
        : `🔔 <b>Уведомления по заявке № ${escapeHtml(kp)} подключены!</b>\n\nТеперь как только руководитель Бюро «МЕТОДИКО» Наталья Коденцева подготовит Финальное КП, Договор или уточняющий вопрос — я сразу пришлю вам сигнал сюда с кнопкой входа.\n\n📌 Вся работа с документами и выбор варианта идут на сайте в вашем Личном кабинете 👇`;

      sendTelegramApi(clientToken, "sendMessage", {
        chat_id: chatId,
        text: helloMsg,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: lang === "kz" ? "🌐 Жеке кабинетті ашу" : "🌐 Открыть мой Личный кабинет", url: portalUrl }]]
        }
      });

      if (!alreadyConnected) {
        const adminToken = getSecret("ADMIN_BOT_TOKEN");
        const adminChatId = getSecret("ADMIN_CHAT_ID");
        if (adminToken && adminChatId) {
          sendTelegramApi(adminToken, "sendMessage", {
            chat_id: adminChatId,
            text: `🔔 Клиент по <b>${escapeHtml(kp)}</b> (${escapeHtml(row[COL.NAME - 1])}) подключил Telegram-уведомления (ID: <code>${chatId}</code>${tgUser ? ", " + escapeHtml(tgUser) : ""}).`,
            parse_mode: "HTML"
          });
        }
      }
    } else {
      const hintMsg = lang === "kz"
        ? `ℹ️ <b>№ ${escapeHtml(kp)}</b> жобасы бойынша барлық жауаптар, КП таңдау, Шартты түзету және файл жүктеу тек сайттағы Жеке кабинетте жүргізіледі 👇`
        : `ℹ️ Вся работа по заявке <b>${escapeHtml(kp)}</b> (ответы, выбор КП, правка Договора А4 и загрузка материалов) идёт в вашем Личном кабинете на сайте 👇`;

      sendTelegramApi(clientToken, "sendMessage", {
        chat_id: chatId,
        text: hintMsg,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: lang === "kz" ? "🌐 Жеке кабинетті ашу" : "🌐 Открыть Личный кабинет", url: portalUrl }]]
        }
      });
    }
    return ContentService.createTextOutput("OK");
  }

  sendTelegramApi(clientToken, "sendMessage", {
    chat_id: chatId,
    text: `Здравствуйте! Бюро «МЕТОДИКО» перенесло расчёт сметы, распаковку, КП и Договор в единый Личный кабинет на сайте.\n\nНажмите кнопку ниже, чтобы открыть сайт и оформить заявку 👇`,
    reply_markup: {
      inline_keyboard: [[{ text: "🌐 Открыть сайт МЕТОДИКО", url: `${CONFIG.SITE_URL}/#calculator` }]]
    }
  });
  return ContentService.createTextOutput("OK");
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * =========================================================================
 * 3. ПЕРВИЧНАЯ ЗАЯВКА С КАЛЬКУЛЯТОРА И РАСПАКОВКА (С СОЗДАНИЕМ ПАПКИ НА ДИСКЕ)
 * =========================================================================
 */
function processNewWebsiteLead(lead) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  if (!sheet) {
    setupMetodikoCRM();
    sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  }
  ensureExtendedColumns(sheet);

  // В4: Серверная проверка обязательных полей
  const rawName = String(lead.clientName || "").trim().slice(0, 150);
  const rawOrg = String(lead.clientOrg || "—").trim().slice(0, 200);
  const rawPhone = String(lead.clientPhone || "").trim();
  const phoneDigits = rawPhone.replace(/[^\d]/g, "");
  const normPhone = normalizePhone(rawPhone);
  const cleanEmail = String(lead.clientEmail || "").trim().slice(0, 150);
  const cleanTg = String(lead.clientTg || "—").trim().slice(0, 100);

  if (!/[a-zA-Zа-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ]{2,}/.test(rawName)) {
    return { status: "error", message: "Укажите корректное имя (минимум 2 буквы)." };
  }
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return { status: "error", message: "Укажите корректный номер телефона (10–15 цифр)." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
    return { status: "error", message: "Укажите корректный Email." };
  }

  // В4 + В1: Серверный пересчёт суммы по прайсу и запрет заявки на 0 ₸
  const devCode = lead.devLanguage || "ru";
  const isUrgent = Boolean(lead.isUrgent);
  const calc = recalculateServerLeadTotals(lead.selectedItems, devCode, isUrgent);
  if (calc.totalPrice <= 0) {
    return { status: "error", message: "Выберите хотя бы один платный модуль на шагах 2–3 (заявки на 0 ₸ не принимаются)." };
  }

  // В4: Лимит частоты — не более 3 заявок в час с одного телефона или email
  if (!checkRateLimit("lead_phone", phoneDigits.slice(-10), 3, 3600) || !checkRateLimit("lead_email", cleanEmail.toLowerCase(), 3, 3600)) {
    return { status: "error", message: "Превышен лимит: не более 3 заявок в час с одного номера или Email. Пожалуйста, подождите или напишите нам в WhatsApp." };
  }

  let itemsSummary = "";
  if (calc.verifiedItems.length) {
    itemsSummary = calc.verifiedItems
      .map((item, idx) => `${idx + 1}. ${item.name} (${Number(item.price).toLocaleString("ru-RU")} ₸, ${item.days} дн.)`)
      .join("\n");
  }

  // В3: Порядковый номер КП выдаёт только сервер (MK-2026-001, MK-2026-002...)
  const kpNumber = generateNextSequentialKpNumber(sheet);
  const devLangLabel = getDevLangLabel(devCode);
  const loadPoints = calculateLoadPoints(calc.totalDays || 10, devCode, calc.verifiedItems);
  const chatLang = (lead.interfaceLang === "kz" || detectKazakhSentence(lead.audienceCategory)) ? "kz" : "ru";
  const clientType = mapCategoryToClientType(lead.audienceCategory);

  const dealInit = {
    chatLang: chatLang,
    devLanguageCode: devCode,
    selectedItems: calc.verifiedItems,
    crmMeta: {
      source: String(lead.utm_source || "website").slice(0, 100),
      utm_medium: String(lead.utm_medium || "").slice(0, 100),
      utm_campaign: String(lead.utm_campaign || "").slice(0, 100),
      referrer: String(lead.referrer || "").slice(0, 300),
      city: String(lead.clientCity || "").slice(0, 100),
      phoneNormalized: normPhone,
      createdAtIso: new Date().toISOString()
    }
  };

  const rowData = [
    kpNumber,
    new Date().toLocaleString("ru-RU"),
    rawName,
    rawOrg || "—",
    normPhone || rawPhone,
    cleanEmail,
    cleanTg || "—",
    String(lead.audienceCategory || clientType).slice(0, 150),
    devLangLabel,
    itemsSummary,
    calc.totalPrice,
    calc.totalDays,
    isUrgent ? "Срочно (+20%)" : "Стандарт",
    STATUSES.DRAFT_KP,
    calc.totalPrice,
    loadPoints,
    "", // Q: ИИ-выжимка
    "", // R: Полный бриф
    "", // S: Реквизиты
    "", // T: Дата старта
    "", // U: Плановая дата сдачи
    "", // V: Договор
    "", // W: Папка Google Диск
    JSON.stringify(dealInit), // X: Deal state
    clientType, // Y (25): Тип клиента (автоматически по К4)
    "",         // Z (26): Следующее действие (ведёт Наталья / бот)
    "",         // AA (27): Срок (дата)
    "",         // AB (28): Чего не хватает
    ""          // AC (29): Последний контакт (дата)
  ];

  sheet.appendRow(rowData);
  const rowIdx = sheet.getLastRow();
  paintStatusCell(sheet, rowIdx, STATUSES.DRAFT_KP);
  SpreadsheetApp.flush();

  // К3: Запись в лист «Журнал событий»
  appendBotEventLog(kpNumber, "новая_заявка", `${clientType}: смета ${calc.totalPrice.toLocaleString("ru-RU")} ₸ (${calc.totalDays} раб. дн.)`, "клиент");

  // Автоматически создаём именную папку клиента на Google Диске
  const folderInfo = ensureProjectDriveFolder(sheet, rowIdx);

  const portalToken = generatePortalToken(kpNumber);
  const portalUrl = getClientPortalUrl(kpNumber);
  const adminPortalUrl = getAdminPortalUrl(kpNumber);

  // Уведомляем Наталью в личный пульт (спокойное уведомление: клиент перешёл к Шагу 2)
  lead.totalPrice = calc.totalPrice;
  lead.totalDays = calc.totalDays;
  sendAdminStep1Notice(lead, kpNumber, rowIdx, itemsSummary, devLangLabel, loadPoints, portalUrl, adminPortalUrl, folderInfo.rootUrl);

  return {
    status: "success",
    kpNumber: kpNumber,
    totalPrice: calc.totalPrice,
    totalDays: calc.totalDays,
    portalToken: portalToken,
    portalUrl: portalUrl,
    driveFolderUrl: folderInfo.rootUrl || ""
  };
}

function processWebBriefSubmission(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  if (!sheet) {
    setupMetodikoCRM();
    sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  }
  ensureExtendedColumns(sheet);

  let kpNumber = String(payload.kpNumber || "").trim();
  let rowIdx = kpNumber ? findRowByKp(sheet, kpNumber) : -1;
  if (!kpNumber || rowIdx === -1) {
    // Если бриф отправлен напрямую без существующей строки — проверяем лимит и выдаём порядковый номер с сервера
    const pDigits = String(payload.clientPhone || "").replace(/[^\d]/g, "");
    if (pDigits.length >= 10 && !checkRateLimit("lead_phone", pDigits.slice(-10), 3, 3600)) {
      return { status: "error", message: "Превышен лимит заявок в час (не более 3). Пожалуйста, подождите." };
    }
    kpNumber = generateNextSequentialKpNumber(sheet);
  }

  const chatLang = payload.interfaceLang === "kz" ? "kz" : "ru";
  const category = String(payload.audienceCategory || "Не указано").slice(0, 150);
  const clientType = mapCategoryToClientType(category);

  const structuredAnswers = {
    q1: String(payload.q1_goal || "").slice(0, 3000),
    q2: String(payload.q2_criteria || "").slice(0, 3000),
    q3: String(payload.q3_resources || "").slice(0, 3000),
    q4: String(payload.q4_team || "").slice(0, 3000),
    q5: String(payload.q5_budget || "").slice(0, 3000),
    q6: String(payload.q6_fkr_branch || "").slice(0, 4000),
    q7: String(payload.q7_extra || "").slice(0, 3000),
    q8: String(payload.q8_requisites || "").slice(0, 2000),
    city: String(payload.clientCity || "").slice(0, 100)
  };

  const rawAnswersText = [
    `1. Главная задача и эффект (Дилтс): ${structuredAnswers.q1 || "—"}`,
    `2. Критерии результата: ${structuredAnswers.q2 || "—"}`,
    `3. Исходные материалы на руках: ${structuredAnswers.q3 || "—"}`,
    `4. Команда и время со стороны заказчика: ${structuredAnswers.q4 || "—"}`,
    `5. Комфортность бюджета/сроков и дата старта: ${structuredAnswers.q5 || "—"}`,
    `6. Специфика направления (ФКР и стандарты): ${structuredAnswers.q6 || "—"}`,
    `7. Доп. информация и оставшиеся вопросы: ${structuredAnswers.q7 || "—"}`,
    `8. Форма оплаты и реквизиты: ${structuredAnswers.q8 || "—"}`
  ].join("\n");

  const aiAnalysis = analyzeBriefWithGemini({
    kpNumber: kpNumber,
    category: category,
    lang: chatLang,
    rawText: rawAnswersText,
    audioBase64: payload.audioBase64 || "",
    audioMimeType: payload.audioMimeType || "audio/webm"
  });

  const fullBriefText = aiAnalysis.transcript
    ? rawAnswersText + "\n\n[РАСШИФРОВКА ГОЛОСОВОГО СООБЩЕНИЯ]:\n" + aiAnalysis.transcript
    : rawAnswersText;
  const devCode = payload.devLanguage || "ru";

  if (rowIdx === -1) {
    const dealObj = {
      chatLang: chatLang,
      devLanguageCode: devCode,
      briefAnswers: structuredAnswers,
      transcript: aiAnalysis.transcript || "",
      crmMeta: {
        source: payload.utm_source || "web_brief",
        city: structuredAnswers.city,
        phoneNormalized: normalizePhone(payload.clientPhone || ""),
        createdAtIso: new Date().toISOString()
      }
    };
    const newRow = [
      kpNumber,
      new Date().toLocaleString("ru-RU"),
      String(payload.clientName || "Клиент с сайта").slice(0, 150),
      String(payload.clientOrg || "—").slice(0, 200),
      normalizePhone(payload.clientPhone) || payload.clientPhone || "—",
      String(payload.clientEmail || "—").slice(0, 150),
      String(payload.clientTg || "—").slice(0, 100),
      category,
      getDevLangLabel(devCode),
      "Заявка через веб-распаковщик",
      Number(payload.totalPrice) || 0,
      Number(payload.totalDays) || 10,
      "Стандарт",
      STATUSES.FOR_APPROVAL,
      Number(payload.totalPrice) || 0,
      calculateLoadPoints(payload.totalDays || 10, devCode, []),
      aiAnalysis.summary,
      fullBriefText,
      aiAnalysis.requisites || structuredAnswers.q8 || "—",
      "", "", "", "",
      JSON.stringify(dealObj),
      clientType,
      "", "", "", ""
    ];
    sheet.appendRow(newRow);
    rowIdx = sheet.getLastRow();
    paintStatusCell(sheet, rowIdx, STATUSES.FOR_APPROVAL);
  } else {
    if (category && category !== "Не указано") {
      sheet.getRange(rowIdx, COL.CATEGORY).setValue(category);
      sheet.getRange(rowIdx, COL.CLIENT_TYPE).setValue(clientType);
    }
    if (payload.clientEmail && payload.clientEmail !== "—") {
      sheet.getRange(rowIdx, COL.EMAIL).setValue(String(payload.clientEmail).trim().slice(0, 150));
    }
    if (payload.clientTg && payload.clientTg !== "—") {
      sheet.getRange(rowIdx, COL.TG).setValue(String(payload.clientTg).trim().slice(0, 100));
    }
    if (payload.clientPhone && payload.clientPhone !== "—") {
      sheet.getRange(rowIdx, COL.PHONE).setValue(normalizePhone(payload.clientPhone) || String(payload.clientPhone).trim());
    }
    if (payload.clientOrg && payload.clientOrg !== "—") {
      sheet.getRange(rowIdx, COL.ORG).setValue(String(payload.clientOrg).trim().slice(0, 200));
    }
    updateOrderStatus(sheet, rowIdx, STATUSES.FOR_APPROVAL, "клиент");
    sheet.getRange(rowIdx, COL.SUMMARY).setValue(aiAnalysis.summary);
    sheet.getRange(rowIdx, COL.BRIEF).setValue(fullBriefText);
    if (aiAnalysis.requisites || structuredAnswers.q8) {
      sheet.getRange(rowIdx, COL.REQUISITES).setValue(aiAnalysis.requisites || structuredAnswers.q8);
    }
    patchDealState(sheet, rowIdx, {
      chatLang: chatLang,
      briefAnswers: structuredAnswers,
      transcript: aiAnalysis.transcript || "",
      needsAttention: true
    });
  }

  SpreadsheetApp.flush();
  appendBotEventLog(kpNumber, "бриф_заполнен", payload.audioBase64 ? "Отправлена распаковка проекта (голос + текст)" : "Отправлена распаковка проекта (текст)", "клиент");

  // Создаём папку проекта на Диске и сохраняем туда файл Брифа
  ensureProjectDriveFolder(sheet, rowIdx);
  generateAndSaveBriefDoc(sheet, rowIdx, fullBriefText, aiAnalysis.summary);

  // Уведомляем Наталью в личный бот + отправляем клиенту в ТГ (если подключён) и на Email
  sendBriefReadyCardToAdmin(sheet, rowIdx, aiAnalysis);
  notifyClientAllChannels(sheet, rowIdx, "brief_received");

  const portalToken = generatePortalToken(kpNumber);
  return {
    status: "success",
    kpNumber: kpNumber,
    portalToken: portalToken,
    portalUrl: getClientPortalUrl(kpNumber)
  };
}

/**
 * =========================================================================
 * 4. ПУЛЬТ РУКОВОДИТЕЛЯ (ТОЛЬКО ЛИЧНЫЙ БОТ НАТАЛЬИ)
 * =========================================================================
 */
function sendAdminStep1Notice(lead, kpNumber, rowIdx, itemsSummary, devLangLabel, loadPoints, portalUrl, adminPortalUrl, driveUrl) {
  const token = getSecret("ADMIN_BOT_TOKEN");
  const adminChatId = getSecret("ADMIN_CHAT_ID");
  if (!token || !adminChatId) return;

  const urgentBadge = lead.isUrgent ? "⚡ <b>СРОЧНЫЙ РЕЖИМ (+20%)</b>\n" : "";

  let msgText = `🟡 <b>ШАГ 1/2 (КАЛЬКУЛЯТОР): ${kpNumber}</b> (строка #${rowIdx})\n`;
  msgText += `━━━━━━━━━━━━━━━━━━━━\n`;
  msgText += `👤 <b>Заказчик:</b> ${escapeHtml(lead.clientName)}\n`;
  msgText += `🏢 <b>Организация:</b> ${escapeHtml(lead.clientOrg)}\n`;
  msgText += `📞 <b>Телефон (WA):</b> <code>${escapeHtml(lead.clientPhone)}</code>\n`;
  msgText += `📧 <b>Email:</b> <code>${escapeHtml(lead.clientEmail || "—")}</code>\n`;
  msgText += `✈️ <b>Telegram:</b> <code>${escapeHtml(lead.clientTg || "—")}</code>\n`;
  msgText += `🎯 <b>Направление:</b> ${escapeHtml(lead.audienceCategory)}\n`;
  msgText += `🌐 <b>Язык материалов:</b> ${escapeHtml(devLangLabel)} (вес: ${loadPoints} б.)\n`;
  msgText += `${urgentBadge}`;
  msgText += `📋 <b>Модули:</b>\n${escapeHtml(itemsSummary)}\n\n`;
  msgText += `💰 <b>Предв. смета:</b> <b>${Number(lead.totalPrice).toLocaleString("ru-RU")} ₸</b> | ⏱ <b>${lead.totalDays} раб. дн.</b>\n`;
  msgText += `<i>Клиент сейчас переходит к Шагу 2 (распаковке на сайте). После заполнения придёт полная карточка на разбор.</i>`;

  const keyboard = [];
  if (adminPortalUrl) keyboard.push([{ text: "👁️ Открыть Кабинет (Режим руководителя)", url: adminPortalUrl }]);
  if (driveUrl) keyboard.push([{ text: "📂 Папка клиента на Google Диске", url: driveUrl }]);
  keyboard.push([{ text: "📊 Открыть Google Таблицу", url: SpreadsheetApp.getActiveSpreadsheet().getUrl() }]);

  sendTelegramApi(token, "sendMessage", {
    chat_id: adminChatId,
    text: msgText,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: keyboard }
  });
}

function sendBriefReadyCardToAdmin(sheet, rowIdx, aiAnalysis, customHeader) {
  const token = getSecret("ADMIN_BOT_TOKEN");
  const adminChatId = getSecret("ADMIN_CHAT_ID");
  if (!token || !adminChatId) return;

  const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
  const kpNumber = row[COL.KP - 1];
  const deal = parseJsonSafe(row[COL.DEAL_JSON - 1], {});
  const adminPortalUrl = getAdminPortalUrl(kpNumber);
  const driveUrl = row[COL.DRIVE_LINK - 1] || (deal.driveFolders && deal.driveFolders.rootUrl) || "";

  const hdr = customHeader || "🟣➡️🔵 РАСПАКОВКА ГОТОВА! НА РАЗБОРЕ";
  let text = `<b>${hdr}: ${kpNumber}</b> (строка #${rowIdx})\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `👤 <b>${escapeHtml(row[COL.NAME - 1])}</b> (${escapeHtml(row[COL.ORG - 1])})\n`;
  text += `📞 ${escapeHtml(row[COL.PHONE - 1])} | 📧 ${escapeHtml(row[COL.EMAIL - 1])} | TG: ${escapeHtml(row[COL.TG - 1])}\n`;
  text += `🎯 ${escapeHtml(row[COL.CATEGORY - 1])} | 🌐 ${escapeHtml(row[COL.DEV_LANG - 1])}\n`;
  text += `💰 Смета: <b>${Number(row[COL.AGREED_PRICE - 1] || row[COL.SITE_PRICE - 1]).toLocaleString("ru-RU")} ₸</b> | ⏱ ${row[COL.DAYS - 1]} раб. дн. | ⚖️ ${row[COL.POINTS - 1]} б.\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `<b>📌 ВЫЖИМКА (Дилтс / ФКР / Ресурсы):</b>\n${escapeHtml(aiAnalysis.summary)}\n\n`;
  text += `<b>🏦 РЕКВИЗИТЫ ДЛЯ ДОГОВОРА:</b>\n${escapeHtml(aiAnalysis.requisites || row[COL.REQUISITES - 1] || "Не указаны")}\n`;

  const kb = [
    [{ text: "📋 Собрать Финальное КП (3 варианта + Документ А4)", callback_data: `prep_kp_${kpNumber}` }],
    [
      { text: "❓ Задать доп. вопрос", callback_data: `ask_${kpNumber}` },
      { text: "✏️ Изменить сумму/срок", callback_data: `edit_${kpNumber}` }
    ],
    [{ text: "👁️ Проверить / Редактировать в Кабинете", url: adminPortalUrl }],
    [{ text: "🏛️ Открыть Штаб всех заказов на сайте", url: getStaffHubUrl("director") }],
    [{ text: "📊 Сводка по клиентам (% и документы)", callback_data: "staff_report" }]
  ];
  if (driveUrl) kb.push([{ text: "📂 Папка клиента на Google Диске", url: driveUrl }]);

  sendTelegramApi(token, "sendMessage", {
    chat_id: adminChatId,
    text: text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: kb }
  });
}

function handleAdminCallback(callbackQuery) {
  const token = getSecret("ADMIN_BOT_TOKEN");
  sendTelegramApi(token, "answerCallbackQuery", { callback_query_id: callbackQuery.id });

  const data = callbackQuery.data || "";
  const chatId = callbackQuery.message.chat.id.toString();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  ensureExtendedColumns(sheet);

  if (data === "admin_cancel") {
    clearAdminPendingAction(chatId);
    sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: "❎ Ввод отменён." });
    return ContentService.createTextOutput("OK");
  }

  if (data === "staff_report") {
    sendStaffSummaryReportToAdmin(chatId);
    return ContentService.createTextOutput("OK");
  }

  if (data === "show_staff_keys") {
    sendStaffKeysToAdminTelegram("🔐 ВАШИ ТЕКУЩИЕ СЕКРЕТНЫЕ КЛЮЧИ ШТАБА БЮРО «МЕТОДИКО»", chatId);
    return ContentService.createTextOutput("OK");
  }

  if (data === "rotate_staff_keys") {
    rotateStaffKeys(chatId);
    return ContentService.createTextOutput("OK");
  }

  // 1. Запрос дополнительного вопроса клиенту
  if (data.startsWith("ask_")) {
    const kp = data.replace("ask_", "");
    setAdminPendingAction(chatId, { type: "ask", kp: kp });
    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `❓ <b>Доп. вопрос по заявке ${kp}</b>\nНапишите вопрос следующим сообщением в этот чат — он сразу появится в Кабинете клиента и уйдёт ему на Email.`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "❌ Отмена", callback_data: "admin_cancel" }]] }
    });
    return ContentService.createTextOutput("OK");
  }

  // 2. Изменение суммы и/или срока
  if (data.startsWith("edit_")) {
    const kp = data.replace("edit_", "");
    setAdminPendingAction(chatId, { type: "edit", kp: kp });
    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `✏️ <b>Корректировка суммы/срока по ${kp}</b>\nНапишите новую сумму (и при желании комментарий):\n<code>480000 Сделали скидку за 2 модуля</code>`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "❌ Отмена", callback_data: "admin_cancel" }]] }
    });
    return ContentService.createTextOutput("OK");
  }

  // 3. Сборка черновика Финального КП + создание Документа А4 (проект без печати до утверждения)
  if (data.startsWith("prep_kp_")) {
    const kp = data.replace("prep_kp_", "");
    const rowIdx = findRowByKp(sheet, kp);
    if (rowIdx === -1) return ContentService.createTextOutput("OK");

    const variants = buildFinalKpVariants(sheet, rowIdx);
    patchDealState(sheet, rowIdx, { kpVariants: variants });

    ensureProjectDriveFolder(sheet, rowIdx);
    const kpDoc = generateAndSaveFinalKpDoc(sheet, rowIdx);
    const adminKpUrl = getAdminPortalUrl(kp, "kp");
    const preview = formatKp3VariantsPreview(kp, variants);

    const kb = [
      [{ text: "👁️ Прочитать / Отредактировать КП (А4 на сайте)", url: adminKpUrl }],
      [{ text: "📤 Утвердить и Отправить КП клиенту (на Email + в Кабинет)", callback_data: `send_kp_${kp}` }],
      [{ text: "✏️ Быстро поправить 3 цены в боте", callback_data: `edit_kp3_${kp}` }]
    ];
    if (kpDoc && kpDoc.docUrl) {
      kb.splice(1, 0, [{ text: "📄 Открыть Google Док КП (на Диске)", url: kpDoc.docUrl }]);
    }

    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: preview + (kpDoc && kpDoc.docUrl ? `\n\n📂 <i>Черновик КП (без печати) сохранён в папку клиента на Диске. Печать будет поставлена после вашего утверждения.</i>` : ""),
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: kb }
    });
    return ContentService.createTextOutput("OK");
  }

  // 4. Ручная правка цен 3 вариантов КП
  if (data.startsWith("edit_kp3_")) {
    const kp = data.replace("edit_kp3_", "");
    setAdminPendingAction(chatId, { type: "edit_kp3", kp: kp });
    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `✏️ <b>Новые цены 3 вариантов по ${kp}</b>\nНапишите 3 числа через пробел (для Экспресс, Оптимум, Флагман):\n<code>350000 550000 890000</code>`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "❌ Отмена", callback_data: "admin_cancel" }]] }
    });
    return ContentService.createTextOutput("OK");
  }

  // 5. Отправка Финального КП клиенту (утверждение Натальей -> PDF с печатью + Кабинет + Email)
  if (data.startsWith("send_kp_")) {
    const kp = data.replace("send_kp_", "");
    const rowIdx = findRowByKp(sheet, kp);
    if (rowIdx === -1) return ContentService.createTextOutput("OK");

    const deal = readDealState(sheet, rowIdx);
    const variants = Array.isArray(deal.kpVariants) && deal.kpVariants.length ? deal.kpVariants : buildFinalKpVariants(sheet, rowIdx);
    const deadlineDate = formatDateRu(addWorkingDays(new Date(), 2));

    patchDealState(sheet, rowIdx, {
      kpVariants: variants,
      kpSentAt: new Date().toISOString(),
      kpSignedByAdmin: true,
      kpSignedAt: formatDateRu(new Date()),
      kpDeadlineText: deadlineDate,
      remindedKp2d: false,
      needsAttention: false
    });
    updateOrderStatus(sheet, rowIdx, STATUSES.FINAL_KP_SENT, "Наталья");
    appendPortalEvent(sheet, rowIdx, "Финальное КП утверждено и подписано руководителем Бюро «МЕТОДИКО»");
    appendBotEventLog(kp, "кп_утверждено", "Наталья утвердила и подписала Финальное КП (3 варианта)", "Наталья");
    SpreadsheetApp.flush();

    ensureProjectDriveFolder(sheet, rowIdx);
    generateAndSaveFinalKpDoc(sheet, rowIdx);

    const delivery = notifyClientAllChannels(sheet, rowIdx, "final_kp");
    appendBotEventLog(kp, "кп_отправлено", "Финальное КП с печатью открыто клиенту в кабинете и отправлено на почту", "система");

    const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const portalUrl = getClientPortalUrl(kp, "kp");
    const adminKpUrl = getAdminPortalUrl(kp, "kp");

    const deliveryNote = formatDeliveryNoteHtml("Финальное КП", delivery, row[COL.EMAIL - 1], portalUrl);

    const kb = [[{ text: "👁️ Открыть КП в Кабинете", url: adminKpUrl }]];
    if (!delivery.tgSent && !delivery.emailSent) {
      const wa = buildWaQuickLink(row[COL.PHONE - 1], `Здравствуйте! Ваше Финальное КП № ${kp} с 3 вариантами и PDF готово: ${portalUrl}`);
      if (wa) kb.push([{ text: "📱 Передать в WhatsApp (запасной канал)", url: wa }]);
    }

    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `${deliveryNote}\n\n⏳ Ждём выбор варианта до <b>${deadlineDate}</b> (2 раб. дн.).`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: kb }
    });
    return ContentService.createTextOutput("OK");
  }

  // 6. Сборка предварительного Договора (проект без печати до утверждения Натальей)
  if (data.startsWith("approve_")) {
    const kp = data.replace("approve_", "");
    const rowIdx = findRowByKp(sheet, kp);
    if (rowIdx === -1) return ContentService.createTextOutput("OK");

    ensureProjectDriveFolder(sheet, rowIdx);
    const docRes = generateAndSaveContractDoc(sheet, rowIdx);
    const qInfo = getPublicQueueStatus();
    const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const price = Number(row[COL.AGREED_PRICE - 1] || row[COL.SITE_PRICE - 1] || 0).toLocaleString("ru-RU");
    const adminContractUrl = getAdminPortalUrl(kp, "contract");

    const replyTxt = `📄 <b>Черновик Договора по ${kp} (проект без печати) готов к вашей проверке!</b>\n`
      + `💰 Сумма: <b>${price} ₸</b> (100% предоплата) | ⏱ ${row[COL.DAYS - 1]} раб. дн.\n`
      + `📅 Ближайшее окно старта: <b>${qInfo.nextFreeWindow}</b>\n`
      + (docRes.docUrl ? `\n📂 <i>Сохранено в папку клиента на Диске.</i>` : "");

    const kb = [
      [{ text: "👁️ Прочитать / Отредактировать Договор (А4 на сайте)", url: adminContractUrl }],
      [{ text: "✅ Утвердить, подписать печатью и отправить клиенту", callback_data: `send_contract_${kp}` }],
      [{ text: "✏️ Изменить сумму/срок", callback_data: `edit_${kp}` }]
    ];
    if (docRes.docUrl) {
      kb.splice(1, 0, [{ text: "📄 Открыть Google Док Договора (на Диске)", url: docRes.docUrl }]);
    }

    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: replyTxt,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: kb }
    });
    return ContentService.createTextOutput("OK");
  }

  // 7. Отправка Договора клиенту (утверждение Натальей -> PDF с печатью + Кабинет + Email)
  if (data.startsWith("send_contract_")) {
    const kp = data.replace("send_contract_", "");
    const rowIdx = findRowByKp(sheet, kp);
    if (rowIdx === -1) return ContentService.createTextOutput("OK");

    patchDealState(sheet, rowIdx, {
      contractSignedByAdmin: true,
      contractSignedAt: formatDateRu(new Date()),
      needsAttention: false
    });
    updateOrderStatus(sheet, rowIdx, STATUSES.CONTRACT_SENT, "Наталья");
    appendPortalEvent(sheet, rowIdx, "Договор авторского заказа подписан со стороны ТОО «Метод и Ко» и направлен Заказчику");
    appendBotEventLog(kp, "договор_отправлен", "Договор подписан печатью ТОО и отправлен клиенту на согласование", "Наталья");
    SpreadsheetApp.flush();

    ensureProjectDriveFolder(sheet, rowIdx);
    generateAndSaveContractDoc(sheet, rowIdx);

    const delivery = notifyClientAllChannels(sheet, rowIdx, "contract");
    const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const portalUrl = getClientPortalUrl(kp, "contract");
    const adminContractUrl = getAdminPortalUrl(kp, "contract");

    const deliveryNote = formatDeliveryNoteHtml(`Договор по ${kp}`, delivery, row[COL.EMAIL - 1], portalUrl);

    const kb = [[{ text: "👁️ Открыть Договор в Кабинете", url: adminContractUrl }]];
    if (!delivery.tgSent && !delivery.emailSent) {
      const wa = buildWaQuickLink(row[COL.PHONE - 1], `Здравствуйте! Договор по проекту № ${kp} готов к проверке и согласованию: ${portalUrl}`);
      if (wa) kb.push([{ text: "📱 Передать в WhatsApp (запасной канал)", url: wa }]);
    }

    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `${deliveryNote}\n\nЖдём подтверждения или правок от клиента.`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: kb }
    });
    return ContentService.createTextOutput("OK");
  }

  // 8. Подписано + 100% оплачено ➔ Ждём материалы (ручное подтверждение Натальей)
  if (data.startsWith("paid_")) {
    const kp = data.replace("paid_", "");
    const rowIdx = findRowByKp(sheet, kp);
    if (rowIdx === -1) return ContentService.createTextOutput("OK");

    const holdUntil = formatDateRu(addWorkingDays(new Date(), 3));
    patchDealState(sheet, rowIdx, {
      paidAt: new Date().toISOString(),
      holdUntilText: holdUntil,
      remindedMat3d: false,
      needsAttention: false
    });
    updateOrderStatus(sheet, rowIdx, STATUSES.WAITING_MATERIALS, "Наталья");
    appendPortalEvent(sheet, rowIdx, "Поступление 100% оплаты подтверждено руководителем Бюро");
    appendBotEventLog(kp, "оплата_подтверждена", "Наталья подтвердила поступление 100% оплаты, бронь окна на 3 раб. дн.", "Наталья");
    recalculateQueueSheet();

    const delivery = notifyClientAllChannels(sheet, rowIdx, "waiting_materials");
    const rowNow = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const adminMatUrl = getAdminPortalUrl(kp, "materials");
    const driveUrl = sheet.getRange(rowIdx, COL.DRIVE_LINK).getValue();
    const deliveryNote = formatDeliveryNoteHtml(`Инструкция по материалам (${kp})`, delivery, rowNow[COL.EMAIL - 1], getClientPortalUrl(kp, "materials"));

    const kb = [
      [{ text: "🚀 Материалы приняты — СТАРТ В РАБОТУ", callback_data: `start_work_${kp}` }],
      [{ text: "👁️ Открыть Кабинет клиента", url: adminMatUrl }]
    ];
    if (driveUrl) kb.push([{ text: "📂 Папка проекта на Диске", url: driveUrl }]);

    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `💰 <b>По ${kp} зафиксированы подпись и 100% оплата!</b>\nМягкая бронь окна: до <b>${holdUntil}</b> (3 раб. дн.).\n\n${deliveryNote}`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: kb }
    });
    return ContentService.createTextOutput("OK");
  }

  // 9. Материалы приняты ➔ Включаем отсчёт срока и жёстко ставим в «График и Очередь»!
  if (data.startsWith("start_work_")) {
    const kp = data.replace("start_work_", "");
    const result = scheduleProjectIntoQueue(kp);
    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: result.adminMessage,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📤 Уведомить клиента о дате старта и сдачи", callback_data: `notify_start_${kp}` }],
          [{ text: "✅ Проект сдан (освободить слот)", callback_data: `done_${kp}` }]
        ]
      }
    });
    return ContentService.createTextOutput("OK");
  }

  // 10. Уведомление клиента о точном старте и дате сдачи (авто-Email + в Кабинете)
  if (data.startsWith("notify_start_")) {
    const kp = data.replace("notify_start_", "");
    const rowIdx = findRowByKp(sheet, kp);
    if (rowIdx === -1) return ContentService.createTextOutput("OK");
    const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const delivery = notifyClientAllChannels(sheet, rowIdx, "project_started");
    const deliveryNote = formatDeliveryNoteHtml(`Уведомление о старте ${kp}`, delivery, row[COL.EMAIL - 1], getClientPortalUrl(kp, "materials"));

    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `🚀 Даты по <b>${kp}</b> (${row[COL.START_DATE - 1]} ➔ ${row[COL.END_DATE - 1]}) обновлены в Кабинете!\n\n${deliveryNote}`,
      parse_mode: "HTML"
    });
    return ContentService.createTextOutput("OK");
  }

  // 11. Закрытие проекта и освобождение слота
  if (data.startsWith("done_")) {
    const kp = data.replace("done_", "");
    const rowIdx = findRowByKp(sheet, kp);
    if (rowIdx !== -1) {
      updateOrderStatus(sheet, rowIdx, STATUSES.DONE, "Наталья");
      recalculateQueueSheet();
      notifyClientAllChannels(sheet, rowIdx, "project_done");
      sendTelegramApi(token, "sendMessage", {
        chat_id: chatId,
        text: `✅ Проект <b>${kp}</b> переведён в статус «Сдано», баллы в графике освобождены.`,
        parse_mode: "HTML"
      });
    }
  }

  return ContentService.createTextOutput("OK");
}

function handleAdminMessage(msg) {
  const token = getSecret("ADMIN_BOT_TOKEN");
  const chatId = msg.chat.id.toString();
  const userText = (msg.text || "").trim();
  if (!userText) return ContentService.createTextOutput("OK");

  if (/^\/(keys|key|ключи|ключ)/i.test(userText) || /^(ключи|ключ|мои ключи)$/i.test(userText)) {
    sendStaffKeysToAdminTelegram("🔐 ВАШИ ТЕКУЩИЕ СЕКРЕТНЫЕ КЛЮЧИ ШТАБА БЮРО «МЕТОДИКО»", chatId);
    return ContentService.createTextOutput("OK");
  }

  if (/^\/(newkey|rotate|сменить)/i.test(userText) || /^(сменить ключ|сменить ключи|новый ключ)$/i.test(userText)) {
    rotateStaffKeys(chatId);
    return ContentService.createTextOutput("OK");
  }

  if (/^\/(start|report|штаб|сводка|отчет|отчёт)/i.test(userText) || /^(штаб|сводка|отчет|отчёт)$/i.test(userText)) {
    sendStaffSummaryReportToAdmin(chatId);
    sendStaffKeysToAdminTelegram("🔐 ВАШИ СЕКРЕТНЫЕ КЛЮЧИ И ССЫЛКИ ВХОДА В ШТАБ", chatId);
    return ContentService.createTextOutput("OK");
  }

  const pending = getAdminPendingAction(chatId);
  let mode = pending ? pending.type : "";
  let kp = pending ? pending.kp : "";

  if (!kp && msg.reply_to_message && msg.reply_to_message.text) {
    const rText = msg.reply_to_message.text;
    const mKp = rText.match(/MK-[A-Z0-9-]+/);
    if (mKp) {
      kp = mKp[0];
      if (rText.includes("Доп. вопрос по")) mode = "ask";
      else if (rText.includes("Корректировка суммы")) mode = "edit";
      else if (rText.includes("Новые цены 3 вариантов")) mode = "edit_kp3";
    }
  }

  if (!kp || !mode) {
    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: "ℹ️ Чтобы отправить вопрос или изменить сумму, сначала нажмите нужную кнопку под карточкой заявки."
    });
    return ContentService.createTextOutput("OK");
  }

  clearAdminPendingAction(chatId);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  const rowIdx = findRowByKp(sheet, kp);
  if (rowIdx === -1) return ContentService.createTextOutput("OK");

  // А) Доп. вопрос клиенту
  if (mode === "ask") {
    updateOrderStatus(sheet, rowIdx, STATUSES.EXTRA_QUESTION, "Наталья");
    const oldBrief = (sheet.getRange(rowIdx, COL.BRIEF).getValue() || "").toString();
    sheet.getRange(rowIdx, COL.BRIEF).setValue(oldBrief + "\n\n[ДОП. ВОПРОС ОТ НАТАЛЬИ]: " + userText);
    patchDealState(sheet, rowIdx, { lastExtraQuestion: userText, needsAttention: false });
    appendBotEventLog(kp, "ответ_бюро", userText.slice(0, 100), "Наталья");

    const delivery = notifyClientAllChannels(sheet, rowIdx, "extra_question");
    const portalUrl = getClientPortalUrl(kp, "brief");
    const rowNow = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];

    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: formatDeliveryNoteHtml(`Вопрос по ${kp}`, delivery, rowNow[COL.EMAIL - 1], portalUrl),
      parse_mode: "HTML"
    });
    return ContentService.createTextOutput("OK");
  }

  // Б) Корректировка согласованной суммы
  if (mode === "edit") {
    const matchPrice = userText.match(/^(\d+)(.*)/);
    if (matchPrice) {
      const newPrice = parseInt(matchPrice[1], 10);
      const comment = matchPrice[2].trim();
      sheet.getRange(rowIdx, COL.AGREED_PRICE).setValue(newPrice);
      if (comment) patchDealState(sheet, rowIdx, { adminPriceComment: comment });
      sendTelegramApi(token, "sendMessage", {
        chat_id: chatId,
        text: `✅ Смета по <b>${kp}</b> обновлена: <b>${newPrice.toLocaleString("ru-RU")} ₸</b>`,
        parse_mode: "HTML"
      });
    } else {
      sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Укажите сумму числом в начале сообщения, например: <code>480000 скидка</code>", parse_mode: "HTML" });
    }
    return ContentService.createTextOutput("OK");
  }

  // В) Ручная правка цен 3 вариантов Финального КП
  if (mode === "edit_kp3") {
    const nums = userText.replace(/\s+/g, " ").match(/\d+/g);
    if (!nums || nums.length < 3) {
      sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Нужно 3 числа через пробел, например: <code>350000 550000 890000</code>", parse_mode: "HTML" });
      return ContentService.createTextOutput("OK");
    }
    const deal = readDealState(sheet, rowIdx);
    const variants = Array.isArray(deal.kpVariants) && deal.kpVariants.length === 3 ? deal.kpVariants : buildFinalKpVariants(sheet, rowIdx);
    variants[0].price = parseInt(nums[0], 10);
    variants[1].price = parseInt(nums[1], 10);
    variants[2].price = parseInt(nums[2], 10);
    patchDealState(sheet, rowIdx, { kpVariants: variants });

    generateAndSaveFinalKpDoc(sheet, rowIdx);

    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: formatKp3VariantsPreview(kp, variants),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "👁️ Прочитать / Редактировать КП (А4)", url: getAdminPortalUrl(kp, "kp") }],
          [{ text: "📤 Отправить Финальное КП клиенту", callback_data: `send_kp_${kp}` }],
          [{ text: "✏️ Ещё поправить цены", callback_data: `edit_kp3_${kp}` }]
        ]
      }
    });
  }

  return ContentService.createTextOutput("OK");
}

/**
 * =========================================================================
 * 5. ОЧЕРЕДЬ ЗАГРУЗКИ (10 БАЛЛОВ) И НАПОМИНАНИЯ
 * =========================================================================
 */
function scheduleProjectIntoQueue(kpNumber) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  const rowIdx = findRowByKp(sheet, kpNumber);
  if (rowIdx === -1) return { adminMessage: "❌ Заявка не найдена." };

  const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
  const points = parseFloat(row[COL.POINTS - 1] || 2);
  const days = parseInt(row[COL.DAYS - 1] || 10, 10);

  const qInfo = getPublicQueueStatus();
  let startDate;
  let newStatus;

  if (qInfo.usedPoints + points <= CONFIG.MAX_CAPACITY_POINTS) {
    startDate = addWorkingDays(new Date(), 1);
    newStatus = STATUSES.IN_WORK;
  } else {
    startDate = qInfo.nextFreeDateObj;
    newStatus = STATUSES.IN_QUEUE;
  }

  const endDate = addWorkingDays(startDate, days);
  const startStr = formatDateRu(startDate);
  const endStr = formatDateRu(endDate);

  sheet.getRange(rowIdx, COL.START_DATE).setValue(startStr);
  sheet.getRange(rowIdx, COL.END_DATE).setValue(endStr);
  updateOrderStatus(sheet, rowIdx, newStatus, "Наталья");
  recalculateQueueSheet();

  const updatedQ = getPublicQueueStatus();
  const adminMessage = `🚀 <b>ПРОЕКТ ${kpNumber} ЗАПЛАНИРОВАН В ГРАФИКЕ!</b>\n`
    + `━━━━━━━━━━━━━━━━━━━━\n`
    + `👤 ${escapeHtml(row[COL.NAME - 1])} (${escapeHtml(row[COL.ORG - 1])})\n`
    + `📌 Статус: <b>${newStatus}</b>\n`
    + `📅 Старт работ: <b>${startStr}</b>\n`
    + `🏁 Плановая сдача: <b>${endStr}</b> (${days} раб. дн.)\n`
    + `⚖️ Загрузка Бюро сейчас: <b>${updatedQ.usedPoints} / ${CONFIG.MAX_CAPACITY_POINTS} баллов</b>`;

  return { adminMessage: adminMessage, startDate: startStr, endDate: endStr, status: newStatus };
}

function getPublicQueueStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  if (!sheet || sheet.getLastRow() < 2) {
    const tmr = addWorkingDays(new Date(), 1);
    return { usedPoints: 0, freePoints: CONFIG.MAX_CAPACITY_POINTS, activeCount: 0, nextFreeWindow: formatDateRu(tmr), nextFreeDateObj: tmr };
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, COL.DEAL_JSON).getValues();
  let usedPoints = 0;
  let activeCount = 0;
  let earliestEnd = null;

  data.forEach(r => {
    const st = r[COL.STATUS - 1] || "";
    if (st === STATUSES.IN_WORK || st === STATUSES.IN_QUEUE) {
      usedPoints += parseFloat(r[COL.POINTS - 1] || 2);
      activeCount++;
      const endDt = parseDateRu(r[COL.END_DATE - 1]);
      if (endDt && (!earliestEnd || endDt < earliestEnd)) {
        earliestEnd = endDt;
      }
    }
  });

  const tomorrow = addWorkingDays(new Date(), 1);
  const nextFreeDate = (usedPoints < CONFIG.MAX_CAPACITY_POINTS || !earliestEnd) ? tomorrow : addWorkingDays(earliestEnd, 1);

  return {
    usedPoints: usedPoints,
    freePoints: Math.max(0, CONFIG.MAX_CAPACITY_POINTS - usedPoints),
    activeCount: activeCount,
    nextFreeWindow: formatDateRu(nextFreeDate),
    nextFreeDateObj: nextFreeDate
  };
}

function recalculateQueueSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const leadsSheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  const queueSheet = ss.getSheetByName(CONFIG.SHEET_QUEUE);
  if (!queueSheet || !leadsSheet) return;

  setupQueueSheetLayout(queueSheet);
  if (leadsSheet.getLastRow() < 2) return;

  const data = leadsSheet.getRange(2, 1, leadsSheet.getLastRow() - 1, COL.DEAL_JSON).getValues();
  const rows = [];
  let usedPoints = 0;

  data.forEach(r => {
    const st = r[COL.STATUS - 1] || "";
    if (st === STATUSES.IN_WORK || st === STATUSES.IN_QUEUE) {
      const pts = parseFloat(r[COL.POINTS - 1] || 2);
      usedPoints += pts;
      rows.push([
        rows.length + 1,
        r[COL.KP - 1],
        `${r[COL.NAME - 1]} (${r[COL.ORG - 1]})`,
        `${r[COL.CATEGORY - 1]} | ${r[COL.DEV_LANG - 1]}`,
        pts,
        st,
        `${r[COL.START_DATE - 1] || "—"} ➔ ${r[COL.END_DATE - 1] || "—"}`
      ]);
    } else if (st === STATUSES.WAITING_MATERIALS) {
      const deal = parseJsonSafe(r[COL.DEAL_JSON - 1], {});
      rows.push([
        rows.length + 1,
        r[COL.KP - 1],
        `${r[COL.NAME - 1]} (${r[COL.ORG - 1]})`,
        `${r[COL.CATEGORY - 1]} | ${r[COL.DEV_LANG - 1]}`,
        0,
        st,
        `Бронь до ${deal.holdUntilText || "3 раб. дн."}`
      ]);
    }
  });

  if (rows.length > 0) {
    queueSheet.getRange(5, 1, rows.length, 7).setValues(rows);
  }
  const qInfo = getPublicQueueStatus();
  queueSheet.getRange("B2").setValue(usedPoints);
  queueSheet.getRange("D2").setValue(Math.max(0, CONFIG.MAX_CAPACITY_POINTS - usedPoints));
  queueSheet.getRange("F2").setValue(qInfo.nextFreeWindow);
}

function checkDeadlinesTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  if (!sheet || sheet.getLastRow() < 2) return;
  ensureExtendedColumns(sheet);

  const adminToken = getSecret("ADMIN_BOT_TOKEN");
  const adminChatId = getSecret("ADMIN_CHAT_ID");
  const now = new Date();
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, COL.DEAL_JSON).getValues();

  for (let i = 0; i < data.length; i++) {
    const rowIdx = i + 2;
    const r = data[i];
    const kp = r[COL.KP - 1];
    const st = String(r[COL.STATUS - 1] || "");
    if (!kp || isRejectedStatus(st)) continue;
    const deal = parseJsonSafe(r[COL.DEAL_JSON - 1], {});

    // Ж1: Автоматическая синхронизация файлов из папки 04_Наши_разработки_и_Сдача на Google Диске
    try {
      syncDriveFolder04ForOrder(sheet, rowIdx, r, deal);
    } catch (e) {}

    if (st === STATUSES.FINAL_KP_SENT && deal.kpSentAt && !deal.remindedKp2d) {
      if (countWorkingDaysBetween(new Date(deal.kpSentAt), now) >= 2) {
        patchDealState(sheet, rowIdx, { remindedKp2d: true });
        notifyClientAllChannels(sheet, rowIdx, "reminder_kp");
        if (adminToken && adminChatId) {
          sendTelegramApi(adminToken, "sendMessage", {
            chat_id: adminChatId,
            text: `⏰ <b>Прошло 2 раб. дня по Финальному КП ${kp}</b> (${escapeHtml(r[COL.NAME - 1])}).\nКлиенту отправлено вежливое напоминание.`,
            parse_mode: "HTML"
          });
        }
      }
    }

    if (st === STATUSES.WAITING_MATERIALS && deal.paidAt && !deal.remindedMat3d && !deal.clientMaterialsUrl && !deal.uploadedMaterialsCount) {
      if (countWorkingDaysBetween(new Date(deal.paidAt), now) >= 3) {
        patchDealState(sheet, rowIdx, { remindedMat3d: true });
        notifyClientAllChannels(sheet, rowIdx, "reminder_materials");
        if (adminToken && adminChatId) {
          sendTelegramApi(adminToken, "sendMessage", {
            chat_id: adminChatId,
            text: `⏳ <b>Прошло 3 раб. дня ожидания материалов по ${kp}</b> (${escapeHtml(r[COL.NAME - 1])}).\nНапоминание отправлено клиенту.`,
            parse_mode: "HTML"
          });
        }
      }
    }
  }
}

// Установка 15-минутного фонового триггера для автопроверки папки 04 и дедлайнов (Ж1)
function setupAutoTriggers15Min() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === "checkDeadlinesTrigger") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("checkDeadlinesTrigger").timeBased().everyMinutes(15).create();
}

// Ж1: Проверка папки «04_Наши_разработки_и_Сдача» и автообновление табло готовности + запись в «Журнал событий»
function syncDriveFolder04ForOrder(sheet, rowIdx, row, deal) {
  if (!sheet || rowIdx < 2 || !deal) return deal ? (deal.deliverables || []) : [];
  const resultsId = deal.driveFolders && deal.driveFolders.subFolders && deal.driveFolders.subFolders.resultsId;
  if (!resultsId) return ensureDeliverablesList(row, deal);

  const kp = String((row && row[COL.KP - 1]) || sheet.getRange(rowIdx, COL.KP).getValue() || "").trim();
  const list = ensureDeliverablesList(row, deal);
  let changed = false;

  try {
    const folder = DriveApp.getFolderById(resultsId);
    const files = folder.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      if (f.isTrashed()) continue;
      const fUrl = f.getUrl();
      const fName = f.getName();
      const fId = f.getId();
      const fUpdated = Utilities.formatDate(f.getLastUpdated(), "Asia/Almaty", "dd.MM.yyyy HH:mm");

      const exists = list.some(d => (d.fileUrl && d.fileUrl === fUrl) || (d.driveFileId && d.driveFileId === fId) || (d.fileName && d.fileName === fName));
      if (!exists) {
        const cleanTitle = fName.replace(/\.[a-zA-Z0-9]{2,5}$/, "").replace(/_/g, " ").trim() || fName;
        // Проверяем, можно ли привязать файл к первому незаполненному слоту без файла, либо создаём новую строку табло
        let targetSlot = list.find(d => !d.fileUrl && d.id !== "doc_avr" && d.status !== "approved");
        if (targetSlot) {
          targetSlot.fileName = fName;
          targetSlot.fileUrl = fUrl;
          targetSlot.driveFileId = fId;
          targetSlot.status = "review";
          targetSlot.progress = 100;
          targetSlot.updatedAt = fUpdated;
        } else {
          list.push({
            id: "drive04_" + fId.slice(-8),
            driveFileId: fId,
            title: cleanTitle,
            status: "review",
            progress: 100,
            fileUrl: fUrl,
            fileName: fName,
            staffNote: "Загружено в папку 04_Наши_разработки_и_Сдача",
            clientComment: "",
            updatedAt: fUpdated
          });
        }
        try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
        changed = true;
        appendPortalEvent(sheet, rowIdx, `Готовый файл «${fName}» выложен в папку 04 (Готово — на утверждение, 100%)`);
        appendBotEventLog(kp, "документ_выложен", `Файл в папке 04: ${fName} (готовность 100%, на утверждение)`, "Наталья");
      }
    }
  } catch (e) {
    Logger.log("syncDriveFolder04ForOrder warn: " + e.toString());
  }

  if (changed) {
    deal.deliverables = list;
    patchDealState(sheet, rowIdx, { deliverables: list });
  }
  return list;
}

/**
 * =========================================================================
 * 6. ЕДИНЫЙ КАБИНЕТ КЛИЕНТА, СЕКРЕТНЫЕ КЛЮЧИ ШТАБА И АДМИН-РЕЖИМ (К1)
 * =========================================================================
 */
function generatePortalToken(kpNumber) {
  const secret = getSecret("PORTAL_SECRET") || (SpreadsheetApp.getActiveSpreadsheet().getId() + "_MK_SEC_2026");
  const sigBytes = Utilities.computeHmacSha256Signature(String(kpNumber), secret);
  return sigBytes.map(b => ("0" + ((b & 0xff).toString(16))).slice(-2)).join("").slice(0, 16);
}

// К1: Секретные ключи Штаба хранятся ТОЛЬКО в «Свойствах скрипта» (DIRECTOR_KEY и CURATOR_KEY).
// Если ключ ещё не задан, он автоматически создаётся криптостойким генератором (36+ символов) и сохраняется в Свойствах скрипта.
// Чтобы сменить ключ за 1 минуту: Настройки проекта -> Свойства скрипта -> изменить DIRECTOR_KEY (или CURATOR_KEY) -> Сохранить.
function getOrCreateStaffSecretKey(role) {
  const propName = role === "assistant" ? "CURATOR_KEY" : "DIRECTOR_KEY";
  let key = String(getSecret(propName) || "").trim();
  if (!key || key.length < 16) {
    const prefix = role === "assistant" ? "CUR_" : "DIR_";
    const u1 = Utilities.getUuid().replace(/-/g, "");
    const u2 = Utilities.getUuid().replace(/-/g, "").slice(0, 12);
    key = prefix + u1 + u2;
    setSecret(propName, key);
  }
  return key;
}

function generateAdminToken(kpNumber) {
  const dirKey = getOrCreateStaffSecretKey("director");
  const sigBytes = Utilities.computeHmacSha256Signature("ADM:" + String(kpNumber), dirKey);
  return sigBytes.map(b => ("0" + ((b & 0xff).toString(16))).slice(-2)).join("").slice(0, 24);
}

function verifyPortalToken(kpNumber, token) {
  if (!kpNumber || !token) return false;
  return generatePortalToken(kpNumber) === String(token).trim();
}

function generateAssistantToken(kpNumber) {
  const curKey = getOrCreateStaffSecretKey("assistant");
  const sigBytes = Utilities.computeHmacSha256Signature("AST:" + String(kpNumber), curKey);
  return sigBytes.map(b => ("0" + ((b & 0xff).toString(16))).slice(-2)).join("").slice(0, 24);
}

function generateGlobalStaffToken(role) {
  return getOrCreateStaffSecretKey(role === "assistant" ? "assistant" : "director");
}

function getStaffHubUrl(role) {
  const key = encodeURIComponent(getOrCreateStaffSecretKey(role === "assistant" ? "assistant" : "director"));
  return `${CONFIG.SITE_URL}/client.html?staff=${key}`;
}

function resolveStaffRole(kpNumber, sig) {
  if (!sig) return "";
  const s = String(sig).trim();
  if (!s) return "";
  const dirKey = getOrCreateStaffSecretKey("director");
  const curKey = getOrCreateStaffSecretKey("assistant");
  if (s === dirKey) return "director";
  if (s === curKey) return "assistant";
  if (kpNumber && s === generateAdminToken(kpNumber)) return "director";
  if (kpNumber && s === generateAssistantToken(kpNumber)) return "assistant";
  return "";
}

function verifyAdminToken(kpNumber, adminSig) {
  const r = resolveStaffRole(kpNumber, adminSig);
  return r === "director" || r === "assistant";
}

function getClientPortalUrl(kpNumber, tab) {
  const t = encodeURIComponent(generatePortalToken(kpNumber));
  const base = `${CONFIG.SITE_URL}/client.html?kp=${encodeURIComponent(kpNumber)}&t=${t}`;
  return tab ? `${base}&tab=${encodeURIComponent(tab)}` : base;
}

function getAdminPortalUrl(kpNumber, tab) {
  const t = encodeURIComponent(generatePortalToken(kpNumber));
  const adm = encodeURIComponent(generateAdminToken(kpNumber));
  const base = `${CONFIG.SITE_URL}/client.html?kp=${encodeURIComponent(kpNumber)}&t=${t}&admin=${adm}`;
  return tab ? `${base}&tab=${encodeURIComponent(tab)}` : base;
}

function getClientPortalState(kpNumber, token, adminSig) {
  const staffRole = resolveStaffRole(kpNumber, adminSig);
  const isAdmin = staffRole === "director" || staffRole === "assistant";
  const isDirector = staffRole === "director";

  if (!verifyPortalToken(kpNumber, token) && !isAdmin) {
    return { status: "forbidden", message: "Неверная или устаревшая ссылка заявки." };
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  ensureExtendedColumns(sheet);
  const rowIdx = findRowByKp(sheet, kpNumber);
  if (rowIdx === -1) return { status: "not_found", message: "Заявка не найдена." };

  const row = sheet.getRange(rowIdx, 1, 1, COL.CLIENT_TYPE).getValues()[0];
  const deal = parseJsonSafe(row[COL.DEAL_JSON - 1], {});
  const qInfo = getPublicQueueStatus();

  // К3: Автовыравнивание статуса, если события ушли вперёд (например, MK-2026-826)
  const crmStatus = healLaggingOrderStatus(sheet, rowIdx, row, deal) || row[COL.STATUS - 1] || "";

  // К2: Печать и статус утверждения — строго по факту утверждения Натальей
  const kpApprovedByDirector = Boolean(deal.kpSignedByAdmin);
  const contractApprovedByDirector = Boolean(deal.contractSignedByAdmin);

  const kpPublished = kpApprovedByDirector || crmStatus.includes("💼") || crmStatus.includes("🤝") || crmStatus.includes("📄") || crmStatus.includes("✍️") || crmStatus.includes("⏳") || crmStatus.includes("🟢") || crmStatus.includes("📅") || crmStatus.includes("✅");
  const contractPublished = contractApprovedByDirector || crmStatus.includes("📄") || crmStatus.includes("✍️") || crmStatus.includes("⏳") || crmStatus.includes("🟢") || crmStatus.includes("📅") || crmStatus.includes("✅");

  // Ж1: Автопроверка новых файлов в папке 04_Наши_разработки_и_Сдача
  const deliverables = syncDriveFolder04ForOrder(sheet, rowIdx, row, deal);
  const readyDriveFiles = listReadyFilesFromDrive(deal);
  const progressPercent = computeOrderProgress(crmStatus, deal, deliverables);

  return {
    status: "ok",
    isAdmin: isAdmin,
    isDirector: isDirector,
    staffRole: staffRole || "client",
    kpNumber: kpNumber,
    createdAt: row[COL.DATE - 1] || "",
    branchKey: resolveBranchKeyFromCategory(row[COL.CATEGORY - 1]),
    clientType: row[COL.CLIENT_TYPE - 1] || mapCategoryToClientType(row[COL.CATEGORY - 1]),
    clientName: row[COL.NAME - 1],
    clientOrg: row[COL.ORG - 1],
    clientPhone: row[COL.PHONE - 1],
    clientEmail: row[COL.EMAIL - 1],
    clientTg: row[COL.TG - 1],
    category: row[COL.CATEGORY - 1],
    devLanguage: row[COL.DEV_LANG - 1],
    devLanguageCode: deal.devLanguageCode || inferDevLangCode(row[COL.DEV_LANG - 1]),
    modulesText: row[COL.MODULES - 1] || "",
    selectedItems: deal.selectedItems || [],
    sitePrice: Number(row[COL.SITE_PRICE - 1] || 0),
    isUrgent: String(row[COL.URGENT - 1] || "").toLowerCase().includes("сроч"),
    chatLang: deal.chatLang || "ru",
    crmStatus: crmStatus,
    progressPercent: progressPercent,
    agreedPrice: Number(row[COL.AGREED_PRICE - 1] || row[COL.SITE_PRICE - 1] || 0),
    totalDays: Number(row[COL.DAYS - 1] || 10),
    requisites: row[COL.REQUISITES - 1] || "",
    requisitesObj: deal.requisitesObj || null,
    contractUrl: extractDocUrlFromCol22(row[COL.META_DOC - 1]) || deal.contractDocUrl || "",
    contractPdfUrl: deal.contractPdfUrl || "",
    kpDocUrl: deal.kpDocUrl || "",
    kpPdfUrl: deal.kpPdfUrl || "",
    driveFolderUrl: isAdmin ? (row[COL.DRIVE_LINK - 1] || "") : "",
    clientMaterialsUrl: deal.clientMaterialsUrl || "",
    uploadedMaterials: deal.uploadedMaterials || [],
    signedContractFiles: deal.signedContractFiles || [],
    paymentReceiptFiles: deal.paymentReceiptFiles || [],
    readyFilesFromDrive: readyDriveFiles,
    deliverables: deliverables,
    messages: deal.messages || [],
    eventsLog: deal.eventsLog || [],
    kpSignedByAdmin: kpApprovedByDirector,
    kpSignedAt: deal.kpSignedAt || "",
    contractSignedByAdmin: contractApprovedByDirector,
    contractSignedAt: deal.contractSignedAt || "",
    clientSignedOnline: Boolean(deal.clientSignedOnline),
    clientSignedAt: deal.clientSignedAt || "",
    clientSignatureDataUrl: deal.clientSignatureDataUrl || "",
    startDate: row[COL.START_DATE - 1] || "",
    endDate: row[COL.END_DATE - 1] || "",
    nextFreeWindow: qInfo.nextFreeWindow,
    kpPublished: kpPublished,
    contractPublished: contractPublished,
    tgConnected: Boolean(extractTgChatId(row, deal)),
    tgDeepLink: getClientTgDeepLink(kpNumber),
    tgBotUsername: CONFIG.CLIENT_BOT_USERNAME,
    deal: {
      lastExtraQuestion: deal.lastExtraQuestion || "",
      briefAnswers: deal.briefAnswers || null,
      aiSummary: row[COL.SUMMARY - 1] || "",
      kpVariants: (isAdmin || kpPublished) ? (deal.kpVariants || []) : [],
      chosenVariant: deal.chosenVariant || null,
      kpDeadlineText: deal.kpDeadlineText || "",
      holdUntilText: deal.holdUntilText || "",
      contractCustomNotes: deal.contractCustomNotes || "",
      contractCustomBodyHtml: deal.contractCustomBodyHtml || "",
      contractComment: deal.contractComment || "",
      adminPriceComment: deal.adminPriceComment || ""
    }
  };
}

function handleClientPortalPost(data) {
  const kpNumber = String(data.kpNumber || "").trim();
  const staffRole = resolveStaffRole(kpNumber, data.admin || data.staff || "");
  const isAdmin = staffRole === "director" || staffRole === "assistant";

  if (!verifyPortalToken(kpNumber, data.token || "") && !isAdmin) {
    return { status: "forbidden", message: "Ошибка проверки ссылки или ключа доступа." };
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  ensureExtendedColumns(sheet);
  const rowIdx = findRowByKp(sheet, kpNumber);
  if (rowIdx === -1) return { status: "not_found", message: "Заявка не найдена." };

  const act = data.action || "";
  const adminToken = getSecret("ADMIN_BOT_TOKEN");
  const adminChatId = getSecret("ADMIN_CHAT_ID");
  const row = sheet.getRange(rowIdx, 1, 1, COL.CLIENT_TYPE).getValues()[0];

  // 1. Отправка распаковки прямо из Кабинета (client.html)
  if (act === "submit_brief") {
    const ans = data.answers || {};
    const category = String(data.audienceCategory || row[COL.CATEGORY - 1] || "Не указано").slice(0, 150);
    const chatLang = data.interfaceLang === "kz" ? "kz" : "ru";
    const clientType = mapCategoryToClientType(category);

    const safeAns = {
      q1: String(ans.q1 || "").slice(0, 3000),
      q2: String(ans.q2 || "").slice(0, 3000),
      q3: String(ans.q3 || "").slice(0, 3000),
      q4: String(ans.q4 || "").slice(0, 3000),
      q5: String(ans.q5 || "").slice(0, 3000),
      q6: String(ans.q6 || "").slice(0, 4000),
      q7: String(ans.q7 || "").slice(0, 3000),
      q8: String(ans.q8 || "").slice(0, 2000),
      city: String(ans.city || "").slice(0, 100)
    };

    const rawAnswersText = [
      `1. Главная задача и эффект (Дилтс): ${safeAns.q1 || "—"}`,
      `2. Критерии результата: ${safeAns.q2 || "—"}`,
      `3. Исходные материалы на руках: ${safeAns.q3 || "—"}`,
      `4. Команда и время со стороны заказчика: ${safeAns.q4 || "—"}`,
      `5. Комфортность бюджета/сроков и дата старта: ${safeAns.q5 || "—"}`,
      `6. Специфика направления (ФКР и стандарты): ${safeAns.q6 || "—"}`,
      `7. Доп. информация и оставшиеся вопросы: ${safeAns.q7 || "—"}`,
      `8. Форма оплаты и реквизиты: ${safeAns.q8 || "—"}`,
      safeAns.city ? `9. Город / Страна: ${safeAns.city}` : ""
    ].filter(Boolean).join("\n");

    const aiAnalysis = analyzeBriefWithGemini({
      kpNumber: kpNumber,
      category: category,
      lang: chatLang,
      rawText: rawAnswersText,
      audioBase64: data.audioBase64 || "",
      audioMimeType: data.audioMimeType || "audio/webm"
    });

    const fullBriefText = aiAnalysis.transcript
      ? rawAnswersText + "\n\n[РАСШИФРОВКА ГОЛОСОВОГО СООБЩЕНИЯ]:\n" + aiAnalysis.transcript
      : rawAnswersText;

    if (category && category !== "Не указано") {
      sheet.getRange(rowIdx, COL.CATEGORY).setValue(category);
      sheet.getRange(rowIdx, COL.CLIENT_TYPE).setValue(clientType);
    }
    if (data.clientName && data.clientName.trim()) sheet.getRange(rowIdx, COL.NAME).setValue(data.clientName.trim().slice(0, 150));
    if (data.clientOrg && data.clientOrg.trim()) sheet.getRange(rowIdx, COL.ORG).setValue(data.clientOrg.trim().slice(0, 200));
    if (data.clientPhone && data.clientPhone.trim()) sheet.getRange(rowIdx, COL.PHONE).setValue(normalizePhone(data.clientPhone.trim()));
    if (data.clientEmail && data.clientEmail.trim()) sheet.getRange(rowIdx, COL.EMAIL).setValue(data.clientEmail.trim().slice(0, 150));
    if (data.clientTg && data.clientTg.trim()) sheet.getRange(rowIdx, COL.TG).setValue(data.clientTg.trim().slice(0, 100));

    updateOrderStatus(sheet, rowIdx, STATUSES.FOR_APPROVAL, "клиент");
    sheet.getRange(rowIdx, COL.SUMMARY).setValue(aiAnalysis.summary);
    sheet.getRange(rowIdx, COL.BRIEF).setValue(fullBriefText);

    const reqFinal = (aiAnalysis.requisites && !aiAnalysis.requisites.toLowerCase().includes("не предостав"))
      ? aiAnalysis.requisites
      : (safeAns.q8 || row[COL.REQUISITES - 1] || "");
    if (reqFinal) sheet.getRange(rowIdx, COL.REQUISITES).setValue(reqFinal);

    patchDealState(sheet, rowIdx, {
      chatLang: chatLang,
      briefAnswers: safeAns,
      transcript: aiAnalysis.transcript || "",
      needsAttention: true
    });

    appendBotEventLog(kpNumber, "бриф_заполнен", data.audioBase64 ? "Отправлена распаковка из кабинета (голос + текст)" : "Отправлена распаковка из кабинета (текст)", "клиент");

    ensureProjectDriveFolder(sheet, rowIdx);
    generateAndSaveBriefDoc(sheet, rowIdx, fullBriefText, aiAnalysis.summary);
    sendBriefReadyCardToAdmin(sheet, rowIdx, aiAnalysis);
    notifyClientAllChannels(sheet, rowIdx, "brief_received");

    return { status: "ok", message: "Распаковка передана руководителю!" };
  }

  // 2. Ответ на дополнительный вопрос
  if (act === "answer_extra") {
    const ansText = String(data.text || "").trim().slice(0, 4000);
    if (!ansText) return { status: "error", message: "Введите текст ответа" };
    if (!checkRateLimit("chat_" + kpNumber, kpNumber, 20, 3600)) {
      return { status: "error", message: "Превышен лимит сообщений в час (не более 20). Пожалуйста, подождите." };
    }
    const oldBrief = (row[COL.BRIEF - 1] || "").toString();
    const updated = oldBrief + "\n\n[ОТВЕТ КЛИЕНТА ИЗ КАБИНЕТА НА ДОП. ВОПРОС]:\n" + ansText;
    sheet.getRange(rowIdx, COL.BRIEF).setValue(updated);
    updateOrderStatus(sheet, rowIdx, STATUSES.FOR_APPROVAL, "клиент");
    patchDealState(sheet, rowIdx, { lastExtraQuestion: "", needsAttention: true });
    appendBotEventLog(kpNumber, "сообщение_клиента", ansText.slice(0, 100), "клиент");

    const aiAnalysis = analyzeBriefWithGemini({
      kpNumber: kpNumber,
      category: row[COL.CATEGORY - 1],
      lang: (readDealState(sheet, rowIdx).chatLang || "ru"),
      rawText: updated, audioBase64: "", audioMimeType: ""
    });
    sheet.getRange(rowIdx, COL.SUMMARY).setValue(aiAnalysis.summary);
    if (aiAnalysis.requisites && !aiAnalysis.requisites.toLowerCase().includes("не предостав")) {
      sheet.getRange(rowIdx, COL.REQUISITES).setValue(aiAnalysis.requisites);
    }
    sendBriefReadyCardToAdmin(sheet, rowIdx, aiAnalysis, "🌐 КЛИЕНТ ОТВЕТИЛ НА ДОП. ВОПРОС");
    return { status: "ok" };
  }

  // 3. Выбор 1 из 3 вариантов Финального КП
  if (act === "select_kp_variant") {
    const varId = parseInt(data.variantId, 10);
    const deal = readDealState(sheet, rowIdx);
    const variants = Array.isArray(deal.kpVariants) ? deal.kpVariants : [];
    const chosen = variants.find(v => Number(v.id) === varId);
    if (!chosen) return { status: "error", message: "Вариант КП не найден" };

    sheet.getRange(rowIdx, COL.AGREED_PRICE).setValue(chosen.price);
    sheet.getRange(rowIdx, COL.DAYS).setValue(chosen.days);
    if (data.requisitesObj) {
      saveRequisitesHelper(sheet, rowIdx, data.requisitesObj);
    } else if (data.requisites && data.requisites.trim()) {
      sheet.getRange(rowIdx, COL.REQUISITES).setValue(data.requisites.trim().slice(0, 2000));
    }
    updateOrderStatus(sheet, rowIdx, STATUSES.KP_ACCEPTED, "клиент");
    patchDealState(sheet, rowIdx, { chosenVariant: chosen, needsAttention: true });
    appendBotEventLog(kpNumber, "вариант_выбран", `Вариант №${chosen.id}: ${chosen.title} (${Number(chosen.price).toLocaleString("ru-RU")} ₸)`, "клиент");

    // Обновляем КП на Диске отметкой выбранного пакета
    ensureProjectDriveFolder(sheet, rowIdx);
    generateAndSaveFinalKpDoc(sheet, rowIdx);

    const reqNow = (sheet.getRange(rowIdx, COL.REQUISITES).getValue() || "").toString().trim();
    const needsReq = !reqNow || reqNow === "—" || reqNow.toLowerCase().includes("не предостав");
    notifyAdminKpAccepted(sheet, rowIdx, chosen, needsReq);
    return { status: "ok", chosen: chosen };
  }

  // 4. Сохранение реквизитов и/или редактируемого текста А4 Договора
  if (act === "save_contract_edits") {
    if (data.requisitesObj) {
      saveRequisitesHelper(sheet, rowIdx, data.requisitesObj);
    }
    const patch = {};
    if (typeof data.contractCustomNotes === "string") {
      patch.contractCustomNotes = data.contractCustomNotes.trim().slice(0, 4000);
    }
    if (typeof data.contractCustomBodyHtml === "string") {
      patch.contractCustomBodyHtml = data.contractCustomBodyHtml.slice(0, 45000);
    }
    if (typeof data.clientOrg === "string" && data.clientOrg.trim()) {
      sheet.getRange(rowIdx, COL.ORG).setValue(data.clientOrg.trim().slice(0, 200));
    }
    if (Object.keys(patch).length) patchDealState(sheet, rowIdx, patch);

    ensureProjectDriveFolder(sheet, rowIdx);
    const docRes = generateAndSaveContractDoc(sheet, rowIdx);

    if (!isAdmin && adminToken && adminChatId) {
      const admUrl = getAdminPortalUrl(kpNumber, "contract");
      sendTelegramApi(adminToken, "sendMessage", {
        chat_id: adminChatId,
        text: `✏️ <b>Клиент обновил реквизиты / правки в А4 Договоре по ${kpNumber}</b>\n👤 ${escapeHtml(row[COL.NAME - 1])}\n${data.contractCustomNotes ? `📝 Примечание: ${escapeHtml(data.contractCustomNotes)}\n` : ""}📂 Файл на Диске автоматически обновлён.`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "👁️ Проверить Договор в Кабинете", url: admUrl }],
            ...(docRes.docUrl ? [[{ text: "📄 Открыть Google Док", url: docRes.docUrl }]] : [])
          ]
        }
      });
    }
    return { status: "ok", contractUrl: docRes.docUrl || "", contractPdfUrl: docRes.pdfUrl || "" };
  }

  // 5. Согласование и онлайн-подписание Договора клиентом на сайте
  if (act === "agree_contract") {
    if (data.requisitesObj) {
      saveRequisitesHelper(sheet, rowIdx, data.requisitesObj);
    }
    const agreePatch = {
      contractAgreedAt: new Date().toISOString(),
      clientSignedOnline: true,
      clientSignedAt: new Date().toLocaleString("ru-RU"),
      needsAttention: true
    };
    if (typeof data.clientSignatureDataUrl === "string" && data.clientSignatureDataUrl.startsWith("data:image/")) {
      agreePatch.clientSignatureDataUrl = data.clientSignatureDataUrl;
    }
    if (typeof data.contractCustomNotes === "string" && data.contractCustomNotes.trim()) {
      agreePatch.contractCustomNotes = data.contractCustomNotes.trim().slice(0, 4000);
    }
    if (typeof data.contractCustomBodyHtml === "string" && data.contractCustomBodyHtml.trim()) {
      agreePatch.contractCustomBodyHtml = data.contractCustomBodyHtml.slice(0, 45000);
    }

    patchDealState(sheet, rowIdx, agreePatch);
    updateOrderStatus(sheet, rowIdx, STATUSES.CONTRACT_AGREED, "клиент");
    appendPortalEvent(sheet, rowIdx, "Заказчик подписал и согласовал Договор онлайн в Личном кабинете");
    appendBotEventLog(kpNumber, "договор_подписан_клиентом", "Клиент подписал и согласовал договор онлайн в кабинете", "клиент");

    ensureProjectDriveFolder(sheet, rowIdx);
    generateAndSaveContractDoc(sheet, rowIdx, true);

    notifyAdminContractAgreed(sheet, rowIdx);
    notifyClientAllChannels(sheet, rowIdx, "contract_agreed");
    return { status: "ok" };
  }

  // 6. Комментарий / правка по договору
  if (act === "contract_comment") {
    const comment = String(data.text || "").trim().slice(0, 4000);
    if (!comment) return { status: "error", message: "Введите текст правки" };
    if (!checkRateLimit("chat_" + kpNumber, kpNumber, 20, 3600)) {
      return { status: "error", message: "Превышен лимит сообщений в час (не более 20). Пожалуйста, подождите." };
    }
    const oldBrief = (row[COL.BRIEF - 1] || "").toString();
    sheet.getRange(rowIdx, COL.BRIEF).setValue(oldBrief + "\n\n[ПРАВКА ПО ДОГОВОРУ С ПОРТАЛА]: " + comment);
    patchDealState(sheet, rowIdx, { contractComment: comment, needsAttention: true });
    appendBotEventLog(kpNumber, "сообщение_клиента", comment.slice(0, 100), "клиент");

    if (adminToken && adminChatId) {
      sendTelegramApi(adminToken, "sendMessage", {
        chat_id: adminChatId,
        text: `✏️ <b>Правка/вопрос по договору ${kpNumber}:</b>\n${escapeHtml(comment)}`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "👁️ Открыть и поправить Договор (А4)", url: getAdminPortalUrl(kpNumber, "contract") }],
            [{ text: "❓ Ответить клиенту", callback_data: `ask_${kpNumber}` }],
            [{ text: "📄 Пересобрать Договор", callback_data: `approve_${kpNumber}` }]
          ]
        }
      });
    }
    return { status: "ok" };
  }

  // 7. Передача ссылки на папку Google Диска клиента
  if (act === "submit_materials_link") {
    const url = String(data.driveLink || "").trim().slice(0, 600);
    const note = String(data.note || "").trim().slice(0, 1000);
    if (!url) return { status: "error", message: "Укажите ссылку на папку" };

    patchDealState(sheet, rowIdx, { clientMaterialsUrl: url, clientMaterialsNote: note, needsAttention: true });
    const oldBrief = (row[COL.BRIEF - 1] || "").toString();
    sheet.getRange(rowIdx, COL.BRIEF).setValue(oldBrief + `\n\n[ССЫЛКА НА МАТЕРИАЛЫ КЛИЕНТА]: ${url}${note ? " — " + note : ""}`);
    appendBotEventLog(kpNumber, "материалы_загружены", `Передана ссылка на материалы${note ? ": " + note : ""}`, "клиент");

    // Создаём файл-ярлык со ссылкой внутри подпапки 03_Материалы_клиента на вашем Диске
    try {
      const folderInfo = ensureProjectDriveFolder(sheet, rowIdx);
      if (folderInfo.subFolders && folderInfo.subFolders.materialsId) {
        const mFolder = DriveApp.getFolderById(folderInfo.subFolders.materialsId);
        mFolder.createFile(`Ссылка_на_материалы_${kpNumber}.txt`, `Ссылка клиента: ${url}\nКомментарий: ${note}\nДата: ${new Date().toLocaleString("ru-RU")}`, MimeType.PLAIN_TEXT);
      }
    } catch (e) { Logger.log("Materials note save warn: " + e); }

    if (adminToken && adminChatId) {
      sendTelegramApi(adminToken, "sendMessage", {
        chat_id: chatIdOrAdmin(adminChatId),
        text: `📂 <b>КЛИЕНТ ПЕРЕДАЛ ССЫЛКУ НА МАТЕРИАЛЫ (${kpNumber}):</b>\n👤 ${escapeHtml(row[COL.NAME - 1])}\n🔗 ${escapeHtml(url)}${note ? `\n💬 ${escapeHtml(note)}` : ""}`,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🚀 Материалы приняты — СТАРТ В РАБОТУ", callback_data: `start_work_${kpNumber}` }]] }
      });
    }
    return { status: "ok" };
  }

  // 8. Прямая загрузка файла материалов клиентом в подпапку 03_Материалы_клиента
  if (act === "upload_material_file") {
    const fileName = (data.fileName || ("material_" + Date.now())).replace(/[\\/:*?"<>|]/g, "_").slice(0, 180);
    const mimeType = data.mimeType || "application/octet-stream";
    const fileBase64 = data.fileBase64 || "";
    const checkF = validateUploadedFile(fileName, mimeType, fileBase64);
    if (!checkF.ok) return { status: "error", message: checkF.message };

    try {
      const folderInfo = ensureProjectDriveFolder(sheet, rowIdx);
      const targetFolderId = (folderInfo.subFolders && folderInfo.subFolders.materialsId) || folderInfo.rootId;
      const folder = DriveApp.getFolderById(targetFolderId);
      const bytes = Utilities.base64Decode(fileBase64);
      const blob = Utilities.newBlob(bytes, mimeType, fileName);
      const created = folder.createFile(blob);

      const deal = readDealState(sheet, rowIdx);
      const list = Array.isArray(deal.uploadedMaterials) ? deal.uploadedMaterials : [];
      list.push({ name: fileName, url: created.getUrl(), uploadedAt: new Date().toLocaleString("ru-RU") });
      patchDealState(sheet, rowIdx, { uploadedMaterials: list, uploadedMaterialsCount: list.length, needsAttention: true });
      appendBotEventLog(kpNumber, "материалы_загружены", `Загружен файл: ${fileName}`, "клиент");

      if (adminToken && adminChatId) {
        sendTelegramApi(adminToken, "sendMessage", {
          chat_id: adminChatId,
          text: `📎 <b>Клиент загрузил файл по ${kpNumber}:</b> <code>${escapeHtml(fileName)}</code>\n📂 Сохранено в папку «03_Материалы_клиента» на вашем Диске.`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📂 Открыть папку на Диске", url: folder.getUrl() }],
              [{ text: "🚀 Материалы приняты — СТАРТ В РАБОТУ", callback_data: `start_work_${kpNumber}` }]
            ]
          }
        });
      }
      return { status: "ok", fileName: fileName, fileUrl: created.getUrl() };
    } catch (err) {
      return { status: "error", message: "Ошибка сохранения файла: " + err.toString() };
    }
  }

  // 9. Админ сохраняет правки Финального КП прямо из Кабинета А4
  if (act === "admin_save_kp") {
    if (!isAdmin) return { status: "forbidden", message: "Требуются права руководителя" };
    if (Array.isArray(data.kpVariants) && data.kpVariants.length === 3) {
      patchDealState(sheet, rowIdx, { kpVariants: data.kpVariants });
      ensureProjectDriveFolder(sheet, rowIdx);
      const kpDoc = generateAndSaveFinalKpDoc(sheet, rowIdx);
      return { status: "ok", kpDocUrl: kpDoc.docUrl || "", kpPdfUrl: kpDoc.pdfUrl || "" };
    }
    return { status: "error", message: "Некорректные варианты КП" };
  }

  // 10. Админ сохраняет правки суммы/срока/реквизитов/текста Договора прямо из Кабинета А4
  if (act === "admin_save_contract") {
    if (!isAdmin) return { status: "forbidden", message: "Требуются права руководителя" };
    if (data.agreedPrice) sheet.getRange(rowIdx, COL.AGREED_PRICE).setValue(Number(data.agreedPrice));
    if (data.totalDays) sheet.getRange(rowIdx, COL.DAYS).setValue(Number(data.totalDays));
    if (data.requisitesObj) saveRequisitesHelper(sheet, rowIdx, data.requisitesObj);
    patchDealState(sheet, rowIdx, {
      contractCustomNotes: typeof data.contractCustomNotes === "string" ? data.contractCustomNotes.slice(0, 4000) : "",
      contractCustomBodyHtml: typeof data.contractCustomBodyHtml === "string" ? data.contractCustomBodyHtml.slice(0, 45000) : ""
    });
    ensureProjectDriveFolder(sheet, rowIdx);
    const docRes = generateAndSaveContractDoc(sheet, rowIdx);
    return { status: "ok", contractUrl: docRes.docUrl || "", contractPdfUrl: docRes.pdfUrl || "" };
  }

  // 11. Загрузка клиентом подписанного Договора (скан/фото/PDF) или чека об оплате
  if (act === "upload_signed_contract" || act === "upload_payment_receipt") {
    const isContractFile = act === "upload_signed_contract";
    const prefix = isContractFile ? "Подписанный_Договор_" : "Чек_оплаты_";
    const rawName = (data.fileName || (prefix + kpNumber + ".pdf")).replace(/[\\/:*?"<>|]/g, "_").slice(0, 180);
    const fileName = rawName.startsWith(prefix) ? rawName : (prefix + rawName);
    const mimeType = data.mimeType || "application/pdf";
    const fileBase64 = data.fileBase64 || "";
    const checkF = validateUploadedFile(rawName, mimeType, fileBase64);
    if (!checkF.ok) return { status: "error", message: checkF.message };

    try {
      const folderInfo = ensureProjectDriveFolder(sheet, rowIdx);
      const targetFolderId = (folderInfo.subFolders && folderInfo.subFolders.contractId) || folderInfo.rootId;
      const folder = DriveApp.getFolderById(targetFolderId);
      const bytes = Utilities.base64Decode(fileBase64);
      const blob = Utilities.newBlob(bytes, mimeType, fileName);
      const created = folder.createFile(blob);
      try { created.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}

      const deal = readDealState(sheet, rowIdx);
      const keyName = isContractFile ? "signedContractFiles" : "paymentReceiptFiles";
      const list = Array.isArray(deal[keyName]) ? deal[keyName] : [];
      list.push({ name: rawName, url: created.getUrl(), uploadedAt: new Date().toLocaleString("ru-RU") });

      const patch = { needsAttention: true };
      patch[keyName] = list;
      patchDealState(sheet, rowIdx, patch);

      if (isContractFile) {
        updateOrderStatus(sheet, rowIdx, STATUSES.CONTRACT_AGREED, "клиент");
        appendBotEventLog(kpNumber, "договор_подписан_клиентом", `Клиент загрузил скан подписанного договора: ${rawName}`, "клиент");
      } else {
        appendBotEventLog(kpNumber, "чек_прикреплён", `Клиент прикрепил документ об оплате: ${rawName}`, "клиент");
      }

      appendPortalEvent(sheet, rowIdx, isContractFile
        ? `Заказчик загрузил подписанный файл Договора: ${rawName}`
        : `Заказчик прикрепил документ об оплате (чек/платёжку): ${rawName}`);

      if (adminToken && adminChatId) {
        const icon = isContractFile ? "✍️📄" : "💳🧾";
        const label = isContractFile ? "КЛИЕНТ ЗАГРУЗИЛ ПОДПИСАННЫЙ ДОГОВОР" : "КЛИЕНТ ПРИКРЕПИЛ ЧЕК ОБ ОПЛАТЕ";
        sendTelegramApi(adminToken, "sendMessage", {
          chat_id: adminChatId,
          text: `${icon} <b>${label} (${kpNumber}):</b>\n👤 ${escapeHtml(row[COL.NAME - 1])} (${escapeHtml(row[COL.ORG - 1])})\n📎 Файл: <code>${escapeHtml(rawName)}</code>\n📂 Автоматически сохранён в папку «02_Договор_и_Реквизиты» на Google Диске.`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📄 Открыть загруженный файл", url: created.getUrl() }],
              [{ text: "💰 Подписано + 100% оплачено (Ждем материалы / Старт)", callback_data: `paid_${kpNumber}` }],
              [{ text: "👁️ Открыть Кабинет сделки", url: getAdminPortalUrl(kpNumber, "contract") }]
            ]
          }
        });
      }
      return { status: "ok", fileName: rawName, fileUrl: created.getUrl() };
    } catch (err) {
      return { status: "error", message: "Ошибка загрузки: " + err.toString() };
    }
  }

  // 12. Прямое сообщение в чате заказа на сайте (от клиента, от Натальи/помощницы или от цифрового помощника Бюро — Ж3)
  if (act === "post_portal_message") {
    const msgText = String(data.text || "").trim().slice(0, 4000);
    const fileBase64 = data.fileBase64 || "";
    if (!msgText && !fileBase64) return { status: "error", message: "Введите сообщение или прикрепите файл" };

    const fromStaff = Boolean(staffRole);
    const isAssistantBot = Boolean(data.isAssistantBot);

    if (!fromStaff && !isAssistantBot) {
      if (!checkRateLimit("chat_" + kpNumber, kpNumber, 20, 3600)) {
        return { status: "error", message: "Превышен лимит сообщений в час (не более 20). Пожалуйста, подождите." };
      }
    }

    if (fileBase64) {
      const checkF = validateUploadedFile(data.fileName || "file", data.mimeType || "", fileBase64);
      if (!checkF.ok) return { status: "error", message: checkF.message };
    }

    let senderRoleVal = "client";
    let senderName = row[COL.NAME - 1] || "Заказчик";
    if (isAssistantBot) {
      senderRoleVal = "assistant_bot";
      senderName = "Цифровой помощник Бюро";
    } else if (fromStaff) {
      senderRoleVal = staffRole;
      senderName = staffRole === "director" ? "Наталья Коденцева (Руководитель Бюро)" : "Куратор проектов Бюро «МЕТОДИКО»";
    }

    let attachedUrl = "";
    let attachedName = "";
    if (fileBase64) {
      try {
        const folderInfo = ensureProjectDriveFolder(sheet, rowIdx);
        const targetFolderId = fromStaff
          ? ((folderInfo.subFolders && folderInfo.subFolders.resultsId) || folderInfo.rootId)
          : ((folderInfo.subFolders && folderInfo.subFolders.materialsId) || folderInfo.rootId);
        const folder = DriveApp.getFolderById(targetFolderId);
        attachedName = (data.fileName || ("file_" + Date.now())).replace(/[\\/:*?"<>|]/g, "_").slice(0, 180);
        const bytes = Utilities.base64Decode(fileBase64);
        const blob = Utilities.newBlob(bytes, data.mimeType || "application/octet-stream", attachedName);
        const created = folder.createFile(blob);
        try { created.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
        attachedUrl = created.getUrl();
      } catch (e) {}
    }

    const deal = readDealState(sheet, rowIdx);
    const messages = Array.isArray(deal.messages) ? deal.messages : [];
    const newMsg = {
      id: "m_" + Date.now(),
      senderRole: senderRoleVal,
      isBot: isAssistantBot,
      senderName: senderName,
      text: msgText,
      fileName: attachedName,
      fileUrl: attachedUrl,
      createdAt: new Date().toLocaleString("ru-RU")
    };
    messages.push(newMsg);

    const patch = {
      messages: messages,
      needsAttention: (!fromStaff && !isAssistantBot)
    };
    if ((fromStaff || isAssistantBot) && msgText) {
      patch.lastExtraQuestion = msgText;
    }
    patchDealState(sheet, rowIdx, patch);
    appendPortalEvent(sheet, rowIdx, `${(fromStaff || isAssistantBot) ? "Сообщение от Бюро" : "Сообщение от Заказчика"}: ${(msgText || attachedName).slice(0, 80)}`);

    if (fromStaff || isAssistantBot) {
      appendBotEventLog(kpNumber, "ответ_бюро", (msgText || attachedName).slice(0, 100), isAssistantBot ? "система" : "Наталья");
      notifyClientAllChannels(sheet, rowIdx, "extra_question");
    } else {
      appendBotEventLog(kpNumber, "сообщение_клиента", (msgText || attachedName).slice(0, 100), "клиент");
      if (adminToken && adminChatId) {
        sendTelegramApi(adminToken, "sendMessage", {
          chat_id: adminChatId,
          text: `💬 <b>НОВОЕ СООБЩЕНИЕ В КАБИНЕТЕ (${kpNumber}):</b>\n👤 ${escapeHtml(row[COL.NAME - 1])} (${escapeHtml(row[COL.ORG - 1])})\n\n<i>«${escapeHtml(msgText || "Прикреплён файл")}»</i>${attachedUrl ? `\n📎 <a href="${attachedUrl}">${escapeHtml(attachedName)}</a>` : ""}`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "👁️ Ответить прямо в Кабинете на сайте", url: getAdminPortalUrl(kpNumber, "materials") }],
              [{ text: "❓ Ответить через бота", callback_data: `ask_${kpNumber}` }]
            ]
          }
        });
      }
    }
    return { status: "ok", messageObj: newMsg };
  }

  // 13. Клиент утверждает промежуточный/готовый документ заказа ИЛИ просит правку
  if (act === "client_review_deliverable") {
    const delivId = data.deliverableId || "";
    const decision = data.decision === "approve" ? "approved" : "revision";
    const comment = String(data.comment || "").trim().slice(0, 2000);
    const deal = readDealState(sheet, rowIdx);
    const list = ensureDeliverablesList(row, deal);
    const item = list.find(d => String(d.id) === String(delivId));
    if (!item) return { status: "error", message: "Документ не найден" };

    item.status = decision;
    if (decision === "approved") item.progress = 100;
    if (comment) item.clientComment = comment;
    item.updatedAt = new Date().toLocaleString("ru-RU");

    patchDealState(sheet, rowIdx, { deliverables: list, needsAttention: true });
    appendPortalEvent(sheet, rowIdx, decision === "approved"
      ? `Заказчик утвердил документ: «${item.title}»`
      : `Заказчик оставил комментарий к документу «${item.title}»: ${comment}`);

    if (decision === "approved") {
      appendBotEventLog(kpNumber, "утверждаю", `Клиент утвердил документ: ${item.title}`, "клиент");
    } else {
      appendBotEventLog(kpNumber, "сообщение_клиента", (`Правка к «${item.title}»: ${comment}`).slice(0, 100), "клиент");
    }

    if (adminToken && adminChatId) {
      const badge = decision === "approved" ? "✅ ДОКУМЕНТ УТВЕРЖДЁН КЛИЕНТОМ" : "✏️ КОММЕНТАРИЙ К ДОКУМЕНТУ";
      sendTelegramApi(adminToken, "sendMessage", {
        chat_id: adminChatId,
        text: `${badge} (${kpNumber}):\n👤 ${escapeHtml(row[COL.NAME - 1])}\n📄 Документ: <b>${escapeHtml(item.title)}</b>${comment ? `\n💬 Комментарий: <i>${escapeHtml(comment)}</i>` : ""}\n📊 Общий прогресс заказа: <b>${computeOrderProgress(row[COL.STATUS - 1], deal, list)}%</b>`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "👁️ Открыть табло документов заказа", url: getAdminPortalUrl(kpNumber, "materials") }]]
        }
      });
    }
    return { status: "ok", deliverables: list };
  }

  // 14. Руководитель или Помощница обновляет статус/% документа или загружает готовый файл в папку 04_Наши_разработки_и_Сдача
  if (act === "staff_update_deliverable") {
    if (!staffRole) return { status: "forbidden", message: "Требуется доступ сотрудника Бюро" };
    if (data.fileBase64) {
      const checkF = validateUploadedFile(data.fileName || "doc.pdf", data.mimeType || "", data.fileBase64);
      if (!checkF.ok) return { status: "error", message: checkF.message };
    }

    const deal = readDealState(sheet, rowIdx);
    const list = ensureDeliverablesList(row, deal);
    let item = list.find(d => String(d.id) === String(data.deliverableId || ""));
    if (!item) {
      item = {
        id: "doc_" + Date.now(),
        title: String(data.title || "Новый документ проекта").trim().slice(0, 200),
        status: "pending",
        progress: 0,
        fileUrl: "",
        fileName: "",
        staffNote: "",
        clientComment: "",
        updatedAt: new Date().toLocaleString("ru-RU")
      };
      list.push(item);
    }

    if (typeof data.title === "string" && data.title.trim()) item.title = data.title.trim().slice(0, 200);
    if (typeof data.status === "string" && data.status) item.status = data.status;
    if (data.progress !== undefined) item.progress = Math.min(100, Math.max(0, Number(data.progress || 0)));
    if (typeof data.staffNote === "string") item.staffNote = data.staffNote.trim().slice(0, 1000);
    if (item.status === "approved" || item.status === "done") item.progress = 100;
    item.updatedAt = new Date().toLocaleString("ru-RU");

    if (data.fileBase64) {
      try {
        const folderInfo = ensureProjectDriveFolder(sheet, rowIdx);
        const targetFolderId = (folderInfo.subFolders && folderInfo.subFolders.resultsId) || folderInfo.rootId;
        const folder = DriveApp.getFolderById(targetFolderId);
        const cleanName = (data.fileName || (item.title + ".pdf")).replace(/[\\/:*?"<>|]/g, "_").slice(0, 180);
        const bytes = Utilities.base64Decode(data.fileBase64);
        const blob = Utilities.newBlob(bytes, data.mimeType || "application/octet-stream", cleanName);
        const created = folder.createFile(blob);
        try { created.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
        item.fileUrl = created.getUrl();
        item.fileName = cleanName;
        item.driveFileId = created.getId();
        if (item.status === "pending" || item.status === "in_progress") {
          item.status = "review";
          if (item.progress < 85) item.progress = 85;
        }
      } catch (e) {
        return { status: "error", message: "Ошибка сохранения файла на Диск: " + e.toString() };
      }
    }

    patchDealState(sheet, rowIdx, { deliverables: list, needsAttention: false });
    appendPortalEvent(sheet, rowIdx, `Бюро обновило документ «${item.title}» (готовность ${item.progress}%)`);
    appendBotEventLog(kpNumber, "документ_выложен", `Документ «${item.title}» — готовность ${item.progress}%`, "Наталья");

    if (data.notifyClient) {
      patchDealState(sheet, rowIdx, { lastExtraQuestion: `Готов документ «${item.title}» (${item.progress}%). Пожалуйста, ознакомьтесь и подтвердите в вашем Кабинете.` });
      notifyClientAllChannels(sheet, rowIdx, "extra_question");
    }
    return { status: "ok", deliverables: list };
  }

  // 15. Руководитель (Директор) в 1 клик с сайта подписывает печатью и публикует КП или Договор клиенту (К2)
  if (act === "admin_sign_doc") {
    if (staffRole !== "director") return { status: "forbidden", message: "Право подписи печатью есть только у Директора Бюро" };

    const docType = data.docType === "kp" ? "kp" : "contract";
    if (docType === "kp") {
      const deal = readDealState(sheet, rowIdx);
      const variants = Array.isArray(deal.kpVariants) && deal.kpVariants.length ? deal.kpVariants : buildFinalKpVariants(sheet, rowIdx);
      const deadlineDate = formatDateRu(addWorkingDays(new Date(), 2));
      patchDealState(sheet, rowIdx, {
        kpVariants: variants,
        kpSentAt: new Date().toISOString(),
        kpSignedByAdmin: true,
        kpSignedAt: formatDateRu(new Date()),
        kpDeadlineText: deadlineDate,
        needsAttention: false
      });
      updateOrderStatus(sheet, rowIdx, STATUSES.FINAL_KP_SENT, "Наталья");
      appendBotEventLog(kpNumber, "кп_утверждено", "Наталья утвердила и подписала Финальное КП в Штабе/Кабинете", "Наталья");
      ensureProjectDriveFolder(sheet, rowIdx);
      const savedKp = generateAndSaveFinalKpDoc(sheet, rowIdx);
      appendPortalEvent(sheet, rowIdx, "Финальное КП подписано печатью ТОО «Метод и Ко» и опубликовано для Заказчика");
      notifyClientAllChannels(sheet, rowIdx, "final_kp");
      appendBotEventLog(kpNumber, "кп_отправлено", "Финальное КП с печатью открыто клиенту и отправлено на почту", "система");
      return { status: "ok", kpPdfUrl: savedKp.pdfUrl || "" };
    } else {
      patchDealState(sheet, rowIdx, {
        contractSignedByAdmin: true,
        contractSignedAt: formatDateRu(new Date()),
        needsAttention: false
      });
      updateOrderStatus(sheet, rowIdx, STATUSES.CONTRACT_SENT, "Наталья");
      ensureProjectDriveFolder(sheet, rowIdx);
      const savedContract = generateAndSaveContractDoc(sheet, rowIdx);
      appendPortalEvent(sheet, rowIdx, "Договор подписан печатью ТОО «Метод и Ко» и опубликован для Заказчика");
      appendBotEventLog(kpNumber, "договор_отправлен", "Договор подписан печатью ТОО в Штабе/Кабинете и направлен клиенту", "Наталья");
      notifyClientAllChannels(sheet, rowIdx, "contract");
      return { status: "ok", contractPdfUrl: savedContract.pdfUrl || "" };
    }
  }

  // 16. Смена статуса заказа руководителем из Штаба / Кабинета (вкл. «Отказ», «Пауза», ручное подтверждение оплаты — К3, К4)
  if (act === "admin_set_status") {
    if (!staffRole) return { status: "forbidden", message: "Требуются права сотрудника Бюро" };
    const statusCode = String(data.statusCode || "").trim();

    if (statusCode === "confirm_payment") {
      if (staffRole !== "director") return { status: "forbidden", message: "Подтверждать оплату может только Руководитель Бюро" };
      const holdUntil = formatDateRu(addWorkingDays(new Date(), 3));
      patchDealState(sheet, rowIdx, {
        paidAt: new Date().toISOString(),
        holdUntilText: holdUntil,
        remindedMat3d: false,
        needsAttention: false
      });
      updateOrderStatus(sheet, rowIdx, STATUSES.WAITING_MATERIALS, "Наталья", { force: true });
      appendPortalEvent(sheet, rowIdx, "Поступление 100% оплаты подтверждено руководителем Бюро");
      appendBotEventLog(kpNumber, "оплата_подтверждена", "Наталья подтвердила поступление 100% оплаты", "Наталья");
      recalculateQueueSheet();
      notifyClientAllChannels(sheet, rowIdx, "waiting_materials");
      return { status: "ok", newStatus: STATUSES.WAITING_MATERIALS };
    }

    let targetSt = STATUSES[statusCode] || statusCode;
    if (statusCode === "REJECTED" || statusCode.toLowerCase() === "отказ") targetSt = STATUSES.REJECTED;
    if (statusCode === "PAUSED" || statusCode.toLowerCase() === "пауза") targetSt = STATUSES.PAUSED;

    updateOrderStatus(sheet, rowIdx, targetSt, "Наталья", { force: true });
    recalculateQueueSheet();
    return { status: "ok", newStatus: targetSt };
  }

  return { status: "error", message: "Неизвестное действие" };
}

function chatIdOrAdmin(id) { return id; }

function saveRequisitesHelper(sheet, rowIdx, reqObj) {
  if (!reqObj || typeof reqObj !== "object") return;
  const parts = [
    reqObj.orgName ? `Организация: ${reqObj.orgName}` : "",
    reqObj.binIin ? `БИН/ИИН: ${reqObj.binIin}` : "",
    reqObj.signerName ? `Подписант: ${reqObj.signerName}${reqObj.signerBasis ? " (" + reqObj.signerBasis + ")" : ""}` : "",
    reqObj.legalAddress ? `Юр. адрес: ${reqObj.legalAddress}` : "",
    reqObj.bankName ? `Банк: ${reqObj.bankName}` : "",
    reqObj.iban ? `ИИК (IBAN): ${reqObj.iban}` : "",
    reqObj.bik ? `БИК: ${reqObj.bik}${reqObj.kbe ? ", КБе: " + reqObj.kbe : ""}` : "",
    reqObj.phone ? `Тел.: ${reqObj.phone}` : "",
    reqObj.email ? `Email: ${reqObj.email}` : ""
  ].filter(Boolean);
  const formatted = parts.join(" | ");
  if (formatted) {
    sheet.getRange(rowIdx, COL.REQUISITES).setValue(formatted);
  }
  if (reqObj.orgName && reqObj.orgName.trim()) {
    sheet.getRange(rowIdx, COL.ORG).setValue(reqObj.orgName.trim());
  }
  patchDealState(sheet, rowIdx, { requisitesObj: reqObj });
}

/**
 * =========================================================================
 * 7. АВТОМАТИЧЕСКИЕ ПАПКИ КЛИЕНТА И ГЕНЕРАЦИЯ ДОКУМЕНТОВ НА GOOGLE ДИСКЕ
 * =========================================================================
 */
function getOrCreateRootProjectsFolder() {
  const existingId = getSecret("ROOT_PROJECTS_FOLDER_ID");
  if (existingId) {
    try { return DriveApp.getFolderById(existingId); } catch (e) {}
  }
  const it = DriveApp.getFoldersByName(CONFIG.ROOT_FOLDER_NAME);
  if (it.hasNext()) {
    const f = it.next();
    setSecret("ROOT_PROJECTS_FOLDER_ID", f.getId());
    return f;
  }
  const created = DriveApp.createFolder(CONFIG.ROOT_FOLDER_NAME);
  setSecret("ROOT_PROJECTS_FOLDER_ID", created.getId());
  return created;
}

function ensureProjectDriveFolder(sheet, rowIdx) {
  try {
    const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const deal = parseJsonSafe(row[COL.DEAL_JSON - 1], {});
    if (deal.driveFolders && deal.driveFolders.rootId) {
      return deal.driveFolders;
    }

    const root = getOrCreateRootProjectsFolder();
    const kp = String(row[COL.KP - 1] || "MK");
    const name = String(row[COL.NAME - 1] || "Клиент").replace(/[\\/:*?"<>|]/g, "");
    const org = String(row[COL.ORG - 1] || "").replace(/[\\/:*?"<>|]/g, "");
    const folderTitle = org && org !== "—" ? `${kp} — ${name} (${org})` : `${kp} — ${name}`;

    const projectFolder = root.createFolder(folderTitle);
    const fBriefKp = projectFolder.createFolder("01_Бриф_и_КП");
    const fContract = projectFolder.createFolder("02_Договор_и_Реквизиты");
    const fMaterials = projectFolder.createFolder("03_Материалы_клиента");
    const fResults = projectFolder.createFolder("04_Наши_разработки_и_Сдача");

    const info = {
      rootId: projectFolder.getId(),
      rootUrl: projectFolder.getUrl(),
      subFolders: {
        briefKpId: fBriefKp.getId(),
        contractId: fContract.getId(),
        materialsId: fMaterials.getId(),
        resultsId: fResults.getId()
      }
    };

    sheet.getRange(rowIdx, COL.DRIVE_LINK).setValue(info.rootUrl);
    patchDealState(sheet, rowIdx, { driveFolders: info });
    return info;
  } catch (err) {
    Logger.log("ensureProjectDriveFolder warn: " + err.toString());
    return { rootId: "", rootUrl: "", subFolders: {} };
  }
}

function saveDocAndPdfToFolder(doc, folderId, pdfFileName) {
  const file = DriveApp.getFileById(doc.getId());
  if (folderId) {
    try {
      const targetFolder = DriveApp.getFolderById(folderId);
      file.moveTo(targetFolder);
      // Разрешаем просмотр по ссылке (только чтение), чтобы клиент мог открыть/скачать
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}

      // Удаляем старую PDF-копию с тем же именем, чтобы не плодить дубли при пересборке
      const oldPdfs = targetFolder.getFilesByName(pdfFileName);
      while (oldPdfs.hasNext()) {
        oldPdfs.next().setTrashed(true);
      }
      const pdfBlob = file.getAs(MimeType.PDF).setName(pdfFileName);
      const pdfFile = targetFolder.createFile(pdfBlob);
      try { pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
      return { docUrl: file.getUrl(), pdfUrl: pdfFile.getUrl(), docId: file.getId(), pdfId: pdfFile.getId() };
    } catch (e) {
      Logger.log("saveDocAndPdfToFolder warn: " + e);
    }
  }
  return { docUrl: file.getUrl(), pdfUrl: "", docId: file.getId(), pdfId: "" };
}

function generateAndSaveBriefDoc(sheet, rowIdx, fullBriefText, aiSummary) {
  try {
    const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const deal = parseJsonSafe(row[COL.DEAL_JSON - 1], {});
    const kp = String(row[COL.KP - 1]);
    const folderId = deal.driveFolders && deal.driveFolders.subFolders ? deal.driveFolders.subFolders.briefKpId : "";

    let doc;
    if (deal.briefDocId) {
      try { doc = DocumentApp.openById(deal.briefDocId); doc.getBody().clear(); } catch (e) { doc = null; }
    }
    if (!doc) doc = DocumentApp.create(`Бриф_и_Распаковка_${kp}`);

    const body = doc.getBody();
    body.appendParagraph(`БЮРО СТАНДАРТОВ «МЕТОДИКО» (ТОО «Метод и Ко»)`).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph(`КАРТОЧКА РАСПАКОВКИ И КОНТАКТОВ № ${kp}`).setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph(`Дата: ${row[COL.DATE - 1]} | Направление: ${row[COL.CATEGORY - 1]} | Язык материалов: ${row[COL.DEV_LANG - 1]}`);
    body.appendParagraph(`Заказчик: ${row[COL.NAME - 1]} (${row[COL.ORG - 1]})`);
    body.appendParagraph(`Контакты: Тел/WA: ${row[COL.PHONE - 1]} | Email: ${row[COL.EMAIL - 1]} | Telegram: ${row[COL.TG - 1]}`);
    body.appendParagraph(`Выбранные модули с сайта:\n${row[COL.MODULES - 1] || "—"}`);
    body.appendParagraph(`Предварительная смета: ${Number(row[COL.SITE_PRICE - 1] || 0).toLocaleString("ru-RU")} ₸ (${row[COL.DAYS - 1]} раб. дн.)`);
    body.appendHorizontalRule();
    body.appendParagraph(`ИИ-ВЫЖИМКА (Дилтс / ФКР / Ресурсы):`).setHeading(DocumentApp.ParagraphHeading.HEADING3);
    body.appendParagraph(aiSummary || "—");
    body.appendHorizontalRule();
    body.appendParagraph(`ПОЛНЫЕ ОТВЕТЫ КЛИЕНТА:`).setHeading(DocumentApp.ParagraphHeading.HEADING3);
    body.appendParagraph(fullBriefText || "—");
    doc.saveAndClose();

    const saved = saveDocAndPdfToFolder(doc, folderId, `Бриф_${kp}.pdf`);
    patchDealState(sheet, rowIdx, { briefDocId: saved.docId, briefDocUrl: saved.docUrl });
    return saved;
  } catch (e) {
    Logger.log("Brief doc error: " + e);
    return {};
  }
}

function generateAndSaveFinalKpDoc(sheet, rowIdx) {
  try {
    const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const deal = parseJsonSafe(row[COL.DEAL_JSON - 1], {});
    const kp = String(row[COL.KP - 1]);
    const variants = Array.isArray(deal.kpVariants) ? deal.kpVariants : [];
    const folderId = deal.driveFolders && deal.driveFolders.subFolders ? deal.driveFolders.subFolders.briefKpId : "";
    const isApproved = Boolean(deal.kpSignedByAdmin);

    let doc;
    if (deal.kpDocId) {
      try { doc = DocumentApp.openById(deal.kpDocId); doc.getBody().clear(); } catch (e) { doc = null; }
    }
    if (!doc) doc = DocumentApp.create(`Финальное_КП_${kp}`);

    const body = doc.getBody();
    body.appendParagraph(`ТОО «Метод и Ко» | Бюро стандартов «МЕТОДИКО»`).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph(`ФИНАЛЬНОЕ КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ № ${kp}${isApproved ? "" : " [ПРОЕКТ, БЕЗ ПЕЧАТИ]"}`).setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph(`Дата: ${formatDateRu(new Date())} | Срок действия условий: до ${deal.kpDeadlineText || "2 раб. дня"}`);
    body.appendParagraph(`Заказчик: ${row[COL.NAME - 1]} (${row[COL.ORG - 1]})`);
    body.appendParagraph(`Направление: ${row[COL.CATEGORY - 1]} | Язык разработки: ${row[COL.DEV_LANG - 1]}`);
    body.appendHorizontalRule();

    variants.forEach(v => {
      const isChosen = deal.chosenVariant && Number(deal.chosenVariant.id) === Number(v.id);
      body.appendParagraph(`${v.id}. ${v.title}${isChosen ? " [ВЫБРАН ЗАКАЗЧИКОМ]" : ""}`).setHeading(DocumentApp.ParagraphHeading.HEADING3);
      body.appendParagraph(`Стоимость: ${Number(v.price).toLocaleString("ru-RU")} ₸ (без НДС) | Срок: ${v.days} раб. дн.`);
      body.appendParagraph(`Состав работ: ${v.scope}`);
    });

    body.appendHorizontalRule();
    body.appendParagraph(`Условия работы: 100% предоплата. Отсчёт срока ведётся со следующего рабочего дня после поступления оплаты и полного комплекта исходных материалов. Формат: 100% дистанционно.`);
    body.appendParagraph(`Исполнитель: ТОО «Метод и Ко», БИН 231140018015, 050019, г. Алматы, Турксибский район, мкр. Кайрат, ул. Жетысай, дом 15/2, АО «Kaspi Bank», ИИК KZ54722S000031140138, БИК CASPKZKA, Директор Коденцева Н.М.`);

    // К2: Печать и подпись ставятся ТОЛЬКО после утверждения Натальей
    if (isApproved) {
      appendDirectorStampToDocBody(body, kp, deal.kpSignedAt || formatDateRu(new Date()));
    } else {
      body.appendParagraph(`📝 СТАТУС ДОКУМЕНТА: Проект, без печати (ожидает утверждения руководителем Бюро «МЕТОДИКО»).`);
    }
    doc.saveAndClose();

    const pdfName = isApproved ? `Финальное_КП_${kp}.pdf` : `Проект_КП_${kp}_без_печати.pdf`;
    const saved = saveDocAndPdfToFolder(doc, folderId, pdfName);
    patchDealState(sheet, rowIdx, { kpDocId: saved.docId, kpDocUrl: saved.docUrl, kpPdfUrl: saved.pdfUrl });
    return saved;
  } catch (e) {
    Logger.log("Final KP doc error: " + e);
    return {};
  }
}

function generateAndSaveContractDoc(sheet, rowIdx, isFinalAgreed) {
  try {
    const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const deal = parseJsonSafe(row[COL.DEAL_JSON - 1], {});
    const kp = String(row[COL.KP - 1]);
    const folderId = deal.driveFolders && deal.driveFolders.subFolders ? deal.driveFolders.subFolders.contractId : "";
    const templateId = getSecret("CONTRACT_TEMPLATE_ID");
    const isApprovedByDirector = Boolean(deal.contractSignedByAdmin);

    const req = deal.requisitesObj || {};
    const orgDisplay = req.orgName || row[COL.ORG - 1] || "________________________________________";
    const signerDisplay = req.signerName || row[COL.NAME - 1] || "_____________________";
    const signerBasis = req.signerBasis || "Устава / ИП";
    const reqBlock = [
      orgDisplay,
      `БИН/ИИН: ${req.binIin || "________________"}`,
      `Юр. адрес: ${req.legalAddress || "________________"}`,
      `Банк: ${req.bankName || "________________"}`,
      `ИИК (IBAN): ${req.iban || "________________"}`,
      `БИК: ${req.bik || "________"} КБе: ${req.kbe || "__"}`,
      `Тел.: ${req.phone || row[COL.PHONE - 1] || "—"} | Email: ${req.email || row[COL.EMAIL - 1] || "—"}`
    ].join("\n");

    const priceNum = Number(row[COL.AGREED_PRICE - 1] || row[COL.SITE_PRICE - 1] || 0);
    const daysNum = Number(row[COL.DAYS - 1] || 10);
    const chosen = deal.chosenVariant || {};
    const pkgText = chosen.title ? `${chosen.title} — ${chosen.scope || ""}` : (row[COL.MODULES - 1] || row[COL.CATEGORY - 1]);

    if (templateId && !deal.contractDocId) {
      const templateFile = DriveApp.getFileById(templateId);
      const copyFile = templateFile.makeCopy(`Договор_${kp}_${orgDisplay}`);
      const docT = DocumentApp.openById(copyFile.getId());
      const bodyT = docT.getBody();
      bodyT.replaceText("{{KP_NUMBER}}", kp);
      bodyT.replaceText("{{DATE}}", formatDateRu(new Date()));
      bodyT.replaceText("{{CLIENT_NAME}}", signerDisplay);
      bodyT.replaceText("{{CLIENT_ORG}}", orgDisplay);
      bodyT.replaceText("{{REQUISITES}}", row[COL.REQUISITES - 1] || reqBlock);
      bodyT.replaceText("{{TOTAL_PRICE}}", priceNum.toLocaleString("ru-RU"));
      bodyT.replaceText("{{TOTAL_DAYS}}", String(daysNum));
      bodyT.replaceText("{{CHOSEN_PACKAGE}}", pkgText);
      bodyT.replaceText("{{PAYMENT_TERMS}}", "100% предоплата; отсчёт срока со следующего рабочего дня после поступления оплаты И полного комплекта исходных материалов (п. 3.1)");
      docT.saveAndClose();
      const savedT = saveDocAndPdfToFolder(docT, folderId, isApprovedByDirector ? `Договор_${kp}.pdf` : `Проект_Договора_${kp}_без_печати.pdf`);
      updateCol22KeepingTgChat(sheet, rowIdx, savedT.docUrl);
      patchDealState(sheet, rowIdx, { contractDocId: savedT.docId, contractDocUrl: savedT.docUrl, contractPdfUrl: savedT.pdfUrl });
      return savedT;
    }

    let doc;
    if (deal.contractDocId) {
      try { doc = DocumentApp.openById(deal.contractDocId); doc.getBody().clear(); } catch (e) { doc = null; }
    }
    if (!doc) doc = DocumentApp.create(`Договор_авторского_заказа_${kp}`);

    const body = doc.getBody();
    const statusBadge = isFinalAgreed
      ? " [СОГЛАСОВАН СТОРОНАМИ]"
      : (isApprovedByDirector ? " [УТВЕРЖДЁН ИСПОЛНИТЕЛЕМ]" : " [ПРОЕКТ, БЕЗ ПЕЧАТИ]");
    body.appendParagraph(`ДОГОВОР АВТОРСКОГО ЗАКАЗА И УЧЕБНО-МЕТОДИЧЕСКОГО ПРОЕКТИРОВАНИЯ № ${kp}${statusBadge}`).setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph(`г. Алматы | Дата: ${formatDateRu(new Date())}`);
    body.appendParagraph(`Товарищество с ограниченной ответственностью «Метод и Ко» (Бюро стандартов «МЕТОДИКО»), именуемое в дальнейшем «Исполнитель», в лице Директора Коденцевой Натальи Михайловны, действующей на основании Устава, с одной стороны, и ${orgDisplay}, именуемое в дальнейшем «Заказчик», в лице ${signerDisplay}, действующего(ей) на основании ${signerBasis}, с другой стороны, заключили настоящий Договор о нижеследующем:`);

    const sections = getFullContractPlainTextSections(kp, priceNum, daysNum, pkgText, row[COL.CATEGORY - 1], row[COL.DEV_LANG - 1], deal.contractCustomNotes || "");
    sections.forEach(s => {
      body.appendParagraph(s.title).setHeading(DocumentApp.ParagraphHeading.HEADING3);
      s.paragraphs.forEach(p => body.appendParagraph(p));
    });

    body.appendHorizontalRule();
    body.appendParagraph(`10. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН`).setHeading(DocumentApp.ParagraphHeading.HEADING3);
    body.appendParagraph(`ИСПОЛНИТЕЛЬ:\nТОО «Метод и Ко» (Бюро «МЕТОДИКО»)\nБИН: 231140018015\nЮр. адрес: 050019, Республика Казахстан, г. Алматы, Турксибский район, мкр. Кайрат, ул. Жетысай, дом 15/2\nБанк: АО «Kaspi Bank» | ИИК: KZ54722S000031140138 | БИК: CASPKZKA | КБе: 17\nТел.: +7 (700) 077-35-66 | Сайт: metodico-kz.netlify.app\nДиректор: Коденцева Н.М.`);

    // К2: Печать и подпись со стороны ТОО ставятся ТОЛЬКО после утверждения Натальей
    if (isApprovedByDirector) {
      appendDirectorStampToDocBody(body, kp, deal.contractSignedAt || formatDateRu(new Date()));
    } else {
      body.appendParagraph(`📝 СТАТУС ДОКУМЕНТА: Проект, без печати (ожидает утверждения и подписания руководителем Бюро «МЕТОДИКО»).`);
    }

    body.appendParagraph(`\nЗАКАЗЧИК:\n${reqBlock}\nПодписант: ${signerDisplay}`);
    appendClientSignatureToDocBody(body, kp, orgDisplay, req.binIin || "", signerDisplay, deal, isFinalAgreed);
    doc.saveAndClose();

    const pdfName = isFinalAgreed
      ? `Договор_${kp}_СОГЛАСОВАН.pdf`
      : (isApprovedByDirector ? `Договор_${kp}.pdf` : `Проект_Договора_${kp}_без_печати.pdf`);
    const saved = saveDocAndPdfToFolder(doc, folderId, pdfName);
    updateCol22KeepingTgChat(sheet, rowIdx, saved.docUrl);
    patchDealState(sheet, rowIdx, { contractDocId: saved.docId, contractDocUrl: saved.docUrl, contractPdfUrl: saved.pdfUrl });
    return saved;
  } catch (err) {
    Logger.log("Contract doc error: " + err.toString());
    return {};
  }
}

function getFullContractPlainTextSections(kp, priceNum, daysNum, pkgText, category, devLang, customNotes) {
  const priceStr = Number(priceNum || 0).toLocaleString("ru-RU");
  const list = [
    {
      title: "1. ПРЕДМЕТ ДОГОВОРА",
      paragraphs: [
        "1.1. Исполнитель обязуется по заданию Заказчика оказать комплекс научно-методических, проектных и учебно-аналитических услуг («Работы») по разработке образовательных комплексов, учебно-методической документации, корпоративных регламентов или диалоговых тренажёров, а Заказчик обязуется принять результат надлежаще выполненных Работ и оплатить их.",
        `1.2. Направление проекта: ${category || "Методическая разработка"} | Язык материалов: ${devLang || "Русский"}.`,
        `1.3. Согласованный состав работ (Техническое задание / Приложение к № ${kp}): ${pkgText || "Согласно выбранной спецификации"}.`,
        "1.4. Формат оказания услуг: 100% дистанционный (удалённый). Передача результатов осуществляется в электронном виде (DOCX, XLSX, PDF, HTML) через Google Диск и электронную почту."
      ]
    },
    {
      title: "2. СТОИМОСТЬ РАБОТ И ПОРЯДОК РАСЧЕТОВ",
      paragraphs: [
        `2.1. Общая стоимость Работ по настоящему Договору составляет ${priceStr} (тенге) РК. НДС не облагается (Исполнитель не является плательщиком НДС).`,
        "2.2. Расчёты производятся в порядке 100% предоплаты в течение 3 (трёх) банковских дней с момента согласования Договора и выставления счёта на оплату (частичные/поэтапные схемы не применяются).",
        "2.3. Исполнитель выставляет электронный Акт выполненных работ (АВР) и ЭСФ в ИС ЭСФ в установленные законодательством РК сроки."
      ]
    },
    {
      title: "3. СРОКИ ВЫПОЛНЕНИЯ И ПРАВИЛА ПРАВОК",
      paragraphs: [
        `3.1. Срок выполнения Работ составляет ${daysNum} рабочих дней и начинает исчисляться со следующего рабочего дня после выполнения Заказчиком двух условий в совокупности: (1) поступление 100% предоплаты на расчётный счёт Исполнителя и (2) передача Заказчиком полного пакета согласованных исходных материалов.`,
        "3.2. Автоматическое продление сроков: при задержке Заказчиком предоставления исходных материалов или обратной связи более чем на 24 часа срок выполнения Работ автоматически сдвигается на количество дней задержки без штрафных санкций.",
        "3.3. Норматив правок: корректировки в рамках согласованного ТЗ осуществляются до сдачи материалов в пределах не более 3 (трёх) консолидированных итераций. Дополнительные работы после приемки или за пределами ТЗ оплачиваются отдельно по ставке 15 000 ₸/час."
      ]
    },
    {
      title: "4. ПОРЯДОК СДАЧИ И АВТОМАТИЧЕСКОЙ ПРИЕМКИ РАБОТ",
      paragraphs: [
        "4.1. По завершении Работ Исполнитель загружает готовые материалы в проектную папку Заказчика и направляет АВР.",
        "4.2. Заказчик в течение 3 (трёх) рабочих дней подписывает АВР либо направляет мотивированный письменный отказ с указанием несоответствий ТЗ. При отсутствии ответа в течение 3 рабочих дней Работы считаются принятыми автоматически в полном объёме (презумпция надлежащего исполнения)."
      ]
    },
    {
      title: "5. ИСКЛЮЧИТЕЛЬНЫЕ ПРАВА И КОНФИДЕНЦИАЛЬНОСТЬ (NDA)",
      paragraphs: [
        "5.1. Исключительные имущественные права на разработанные материалы переходят к Заказчику с момента приёмки и при условии полной 100% оплаты.",
        "5.2. Стороны обязуются соблюдать конфиденциальность коммерческой и методологической информации в течение 3 лет в соответствии со ст. 126 ГК РК.",
        "5.3. Ограничение ответственности: Исполнитель гарантирует соответствие материалов ТЗ и стандартам, но не несёт ответственности за коммерческие показатели продаж Заказчика и субъективные решения внешних комиссий. В соответствии со ст. 963 ГК РК возврат средств за качественно выполненные интеллектуальные работы не предусмотрен."
      ]
    },
    {
      title: "6. РАЗРЕШЕНИЕ СПОРОВ",
      paragraphs: [
        "6.1. Обязательный досудебный претензионный порядок (срок рассмотрения — 10 рабочих дней). При недостижении согласия спор рассматривается в СМЭС г. Алматы по праву РК.",
        "6.2. Сканированные и электронные копии настоящего Договора, Приложений и АВР имеют полную юридическую силу."
      ]
    }
  ];
  if (customNotes) {
    list.push({
      title: "7. ОСОБЫЕ УСЛОВИЯ И ДОПОЛНЕНИЯ СТОРОН",
      paragraphs: [customNotes]
    });
  }
  return list;
}

/**
 * =========================================================================
 * 8. АВТОМАТИЧЕСКИЕ EMAIL-УВЕДОМЛЕНИЯ КЛИЕНТУ (0 ₸ ЧЕРЕЗ GMAIL / MailApp)
 * =========================================================================
 */
function sendPortalLinkEmail(sheet, rowIdx, eventType) {
  try {
    const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const email = (row[COL.EMAIL - 1] || "").toString().trim();
    if (!email || !email.includes("@")) return { sent: false, reason: "no_email" };

    const kp = String(row[COL.KP - 1]);
    const name = String(row[COL.NAME - 1] || "Коллега");
    const deal = parseJsonSafe(row[COL.DEAL_JSON - 1], {});
    const lang = deal.chatLang === "kz" ? "kz" : "ru";

    let tab = "";
    let subject = "";
    let heading = "";
    let bodyHtml = "";
    let btnText = lang === "kz" ? "Жеке кабинетті ашу →" : "Открыть Личный кабинет заказа →";
    const attachments = [];

    if (eventType === "brief_received") {
      tab = "brief";
      subject = lang === "kz" ? `МЕТОДИКО: № ${kp} өтінімі қабылданды` : `МЕТОДИКО: Заявка № ${kp} принята на разбор`;
      heading = lang === "kz" ? `Рахмет, ${escapeHtml(name)}!` : `Спасибо, ${escapeHtml(name)}!`;
      bodyHtml = lang === "kz"
        ? `<p>Сіздің <b>№ ${kp}</b> жобаңыз бойынша мәліметтер Наталья Коденцеваға жеткізілді.</p><p>Осы сілтемені сақтап қойыңыз — сіздің жеке кабинетіңізде Қорытынды КП, Шарт және дайын материалдар пайда болады:</p>`
        : `<p>Ваша распаковка по заявке <b>№ ${kp}</b> передана руководителю Бюро Наталье Коденцевой.</p><p>Сохраните ссылку на ваш постоянный Личный кабинет — именно здесь появятся Финальное КП (PDF), Договор и статус проекта:</p>`;
    } else if (eventType === "extra_question") {
      tab = "brief";
      subject = `МЕТОДИКО: Уточняющий вопрос по заявке № ${kp}`;
      heading = `Уточняющий вопрос по проекту № ${kp}`;
      bodyHtml = `<p>Здравствуйте, ${escapeHtml(name)}! Для точной сборки Финального КП руководитель Бюро «МЕТОДИКО» Наталья Коденцева оставила вопрос в вашем кабинете:</p><blockquote style="background:#FFFBEB;border-left:4px solid #C9A227;padding:12px 16px;margin:12px 0;">${escapeHtml(deal.lastExtraQuestion || "")}</blockquote>`;
      btnText = "Ответить в Личном кабинете →";
    } else if (eventType === "final_kp") {
      tab = "kp";
      subject = lang === "kz" ? `МЕТОДИКО: № ${kp} Қорытынды КП дайын (3 нұсқа)` : `МЕТОДИКО: Ваше Финальное КП № ${kp} готово (3 варианта + PDF)`;
      heading = lang === "kz" ? `№ ${kp} Қорытынды КП дайын!` : `Финальное КП по проекту № ${kp} готово!`;
      const variants = Array.isArray(deal.kpVariants) ? deal.kpVariants : [];
      const listHtml = variants.map(v => `<li><b>${v.id}. ${escapeHtml(v.title)}</b> — <b>${Number(v.price).toLocaleString("ru-RU")} ₸</b> (${v.days} раб. дн.)<br><span style="color:#475569;font-size:13px;">${escapeHtml(v.scope)}</span></li>`).join("");
      bodyHtml = `<p>Здравствуйте, ${escapeHtml(name)}! Подготовили 3 варианта комплектации под ваш проект (предложение действует до <b>${escapeHtml(deal.kpDeadlineText || "2 раб. дней")}</b>):</p><ul>${listHtml}</ul><p>Откройте Кабинет, чтобы просмотреть полный бланк А4, скачать PDF и выбрать удобный вариант:</p>`;
      btnText = "Открыть Финальное КП и выбрать вариант →";
      tryAttachDrivePdf(deal.kpPdfUrl || "", deal.kpDocId || "", `Финальное_КП_${kp}.pdf`, attachments);
    } else if (eventType === "contract") {
      tab = "contract";
      subject = lang === "kz" ? `МЕТОДИКО: № ${kp} Шарт жобасы келісуге дайын` : `МЕТОДИКО: Договор по проекту № ${kp} готов к согласованию`;
      heading = `Договор по заявке № ${kp}`;
      const priceStr = Number(row[COL.AGREED_PRICE - 1] || row[COL.SITE_PRICE - 1] || 0).toLocaleString("ru-RU");
      bodyHtml = `<p>Здравствуйте, ${escapeHtml(name)}! Подготовили Договор авторского заказа (сумма: <b>${priceStr} ₸</b>, срок: <b>${row[COL.DAYS - 1]} раб. дн.</b>, 100% предоплата).</p><p>В вашем Кабинете вы можете прочитать полный текст Договора А4, при необходимости дописать/исправить реквизиты прямо в документе, скачать PDF и нажать кнопку «Договор согласован»:</p>`;
      btnText = "Открыть и согласовать Договор →";
      tryAttachDrivePdf(deal.contractPdfUrl || "", deal.contractDocId || "", `Договор_${kp}.pdf`, attachments);
    } else if (eventType === "contract_agreed") {
      tab = "contract";
      subject = `МЕТОДИКО: Договор по № ${kp} согласован`;
      heading = `Договор № ${kp} согласован`;
      bodyHtml = `<p>Здравствуйте, ${escapeHtml(name)}! Мы зафиксировали согласование Договора. Ожидайте счёт на оплату (100% предоплата). Подписанный экземпляр также доступен для скачивания в вашем Кабинете.</p>`;
    } else if (eventType === "waiting_materials") {
      tab = "materials";
      subject = `МЕТОДИКО: Оплата получена — передайте материалы по № ${kp}`;
      heading = `Оплата получена! Готовы принимать исходники по № ${kp}`;
      bodyHtml = `<p>Здравствуйте, ${escapeHtml(name)}! 100% оплата зафиксирована. Мы забронировали для вас окно в Графике до <b>${escapeHtml(deal.holdUntilText || "3 раб. дней")}</b>.</p><p>Перейдите в Кабинет, чтобы прикрепить ссылку на Google Диск или загрузить исходные файлы:</p>`;
      btnText = "Передать материалы в Кабинете →";
    } else if (eventType === "project_started") {
      tab = "materials";
      subject = `МЕТОДИКО: Проект № ${kp} запущен в работу!`;
      heading = `Проект № ${kp} официально в работе!`;
      bodyHtml = `<p>Здравствуйте, ${escapeHtml(name)}! Материалы приняты в полном объёме.</p><p>• <b>Дата старта:</b> ${escapeHtml(row[COL.START_DATE - 1])}<br>• <b>Плановая дата сдачи:</b> ${escapeHtml(row[COL.END_DATE - 1])}</p>`;
    } else if (eventType === "project_done") {
      tab = "materials";
      subject = `МЕТОДИКО: Проект № ${kp} выполнен`;
      heading = `Проект № ${kp} завершён!`;
      bodyHtml = `<p>Здравствуйте, ${escapeHtml(name)}! Благодарим за сотрудничество с Бюро стандартов «МЕТОДИКО». Все материалы и история заявки всегда доступны в вашем Кабинете.</p>`;
    } else if (eventType === "reminder_kp") {
      tab = "kp";
      subject = `Напоминание: Финальное КП по № ${kp} ждёт выбора`;
      heading = `Финальное КП по проекту № ${kp}`;
      bodyHtml = `<p>Здравствуйте, ${escapeHtml(name)}! Напоминаем, что в вашем Кабинете опубликованы 3 варианта Финального КП. Если есть вопросы по составу или смете — напишите комментарий прямо на странице.</p>`;
    } else if (eventType === "reminder_materials") {
      tab = "materials";
      subject = `Напоминание: ждём исходные материалы по проекту № ${kp}`;
      heading = `Материалы по проекту № ${kp}`;
      bodyHtml = `<p>Здравствуйте, ${escapeHtml(name)}! Чтобы запустить счётчик срока разработки, передайте исходные файлы или ссылку на Google Диск в вашем Кабинете.</p>`;
    } else {
      return { sent: false, reason: "unknown_event" };
    }

    const portalUrl = getClientPortalUrl(kp, tab);
    const fullHtml = `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;color:#1E293B;">
        <div style="background:#152238;color:#FFFFFF;padding:18px 24px;border-bottom:3px solid #C9A227;">
          <div style="font-size:18px;font-weight:700;letter-spacing:0.5px;">МЕТОДИКО <span style="color:#E8C547;font-size:13px;font-weight:600;">ТОО «Метод и Ко»</span></div>
        </div>
        <div style="padding:24px;line-height:1.6;font-size:15px;">
          <h2 style="color:#152238;margin-top:0;">${heading}</h2>
          ${bodyHtml}
          <p style="margin:24px 0;">
            <a href="${portalUrl}" style="display:inline-block;background:#C9A227;color:#0D1624;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:8px;font-size:15px;">${btnText}</a>
          </p>
          <p style="font-size:12px;color:#64748B;">Если кнопка не открывается, скопируйте ссылку в браузер:<br>${portalUrl}</p>
        </div>
        <div style="background:#F8FAFC;padding:14px 24px;font-size:12px;color:#64748B;border-top:1px solid #E2E8F0;">
          Бюро стандартов «МЕТОДИКО» · г. Алматы · +7 (700) 077-35-66 · ${CONFIG.SITE_URL}
        </div>
      </div>`;

    const mailOpts = { htmlBody: fullHtml, name: "Бюро стандартов «МЕТОДИКО»" };
    if (attachments.length) mailOpts.attachments = attachments;

    MailApp.sendEmail(email, subject, `${heading}\n\nПерейдите в Личный кабинет: ${portalUrl}`, mailOpts);
    return { sent: true, to: email };
  } catch (err) {
    Logger.log("sendPortalLinkEmail error: " + err.toString());
    return { sent: false, reason: err.toString() };
  }
}

function tryAttachDrivePdf(pdfUrl, docId, fileName, attachments) {
  try {
    if (docId) {
      const f = DriveApp.getFileById(docId);
      attachments.push(f.getAs(MimeType.PDF).setName(fileName));
    }
  } catch (e) {}
}

function sendClientTelegramNotice(sheet, rowIdx, eventType) {
  try {
    const clientToken = getSecret("CLIENT_BOT_TOKEN");
    if (!clientToken) return { sent: false, reason: "no_client_bot_token" };

    const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const deal = parseJsonSafe(row[COL.DEAL_JSON - 1], {});
    const tgChatId = extractTgChatId(row, deal);
    if (!tgChatId) return { sent: false, reason: "tg_not_connected" };

    const kp = String(row[COL.KP - 1]);
    const name = String(row[COL.NAME - 1] || "Коллега");
    const lang = deal.chatLang === "kz" ? "kz" : "ru";

    let tab = "";
    let text = "";
    let btnText = lang === "kz" ? "🌐 Жеке кабинетті ашу →" : "🌐 Открыть Личный кабинет →";

    if (eventType === "brief_received") {
      tab = "brief";
      text = lang === "kz"
        ? `✅ <b>№ ${escapeHtml(kp)} өтінімі қабылданды!</b>\nНаталья Коденцева деректерді талдауға кірісті. Қорытынды КП дайын болғанда бірден хабар беремін.`
        : `✅ <b>Распаковка по № ${escapeHtml(kp)} принята!</b>\nНаталья Коденцева уже изучает ваш проект. Как только Финальное КП будет готово, я сразу пришлю вам сигнал сюда.`;
    } else if (eventType === "extra_question") {
      tab = "brief";
      text = `🟠 <b>Уточняющий вопрос по заявке № ${escapeHtml(kp)}</b>\n\nНаталья Коденцева оставила короткий вопрос для точной сборки КП:\n<i>«${escapeHtml(deal.lastExtraQuestion || "")}»</i>\n\nОтветьте прямо в Кабинете по кнопке ниже 👇`;
      btnText = "✍️ Ответить в Кабинете на сайте →";
    } else if (eventType === "final_kp") {
      tab = "kp";
      const variants = Array.isArray(deal.kpVariants) ? deal.kpVariants : [];
      const vLines = variants.map(v => `• <b>${v.id}. ${escapeHtml(v.title)}</b> — ${Number(v.price).toLocaleString("ru-RU")} ₸ (${v.days} раб. дн.)`).join("\n");
      text = lang === "kz"
        ? `💼 <b>№ ${escapeHtml(kp)} Қорытынды КП дайын!</b>\n\n${vLines}\n\nА4 бланкін ашу, PDF жүктеу және нұсқаны таңдау үшін төмендегі батырманы басыңыз 👇`
        : `💼 <b>Ваше Финальное КП № ${escapeHtml(kp)} готово!</b>\n\n${vLines}\n\n⏳ Предложение действует до <b>${escapeHtml(deal.kpDeadlineText || "2 раб. дн.")}</b>. Откройте бланк А4 и выберите вариант на сайте 👇`;
      btnText = lang === "kz" ? "💼 Қорытынды КП-ны ашу →" : "💼 Открыть Финальное КП (А4) →";
    } else if (eventType === "contract") {
      tab = "contract";
      const priceStr = Number(row[COL.AGREED_PRICE - 1] || row[COL.SITE_PRICE - 1] || 0).toLocaleString("ru-RU");
      text = lang === "kz"
        ? `📄 <b>№ ${escapeHtml(kp)} Шарт жобасы дайын!</b>\nСомасы: <b>${priceStr} ₸</b> | Мерзімі: <b>${row[COL.DAYS - 1]} жұм. күн</b>.\n\nРеквизиттерді тексеріп, Шартты сайтта келісіңіз 👇`
        : `📄 <b>Договор по заявке № ${escapeHtml(kp)} готов к согласованию!</b>\nСумма: <b>${priceStr} ₸</b> (100% предоплата) | Срок: <b>${row[COL.DAYS - 1]} раб. дн.</b>\n\nОткройте А4, при необходимости допишите реквизиты и нажмите «Договор согласован» 👇`;
      btnText = lang === "kz" ? "📄 Шартты ашу және келісу →" : "📄 Открыть и согласовать Договор →";
    } else if (eventType === "contract_agreed") {
      tab = "contract";
      text = `✍️ <b>Договор по № ${escapeHtml(kp)} согласован!</b>\nОжидайте счёт на 100% предоплату. После оплаты в Кабинете откроется загрузка материалов.`;
    } else if (eventType === "waiting_materials") {
      tab = "materials";
      text = `⏳ <b>Оплата по № ${escapeHtml(kp)} получена!</b>\nМы забронировали слот в графике до <b>${escapeHtml(deal.holdUntilText || "3 раб. дн.")}</b>.\n\nЗагрузите исходные файлы или вставьте ссылку на Google Диск в Кабинете 👇`;
      btnText = "📂 Передать материалы в Кабинете →";
    } else if (eventType === "project_started") {
      tab = "materials";
      text = `🚀 <b>Проект № ${escapeHtml(kp)} официально в работе!</b>\n• Старт работ: <b>${escapeHtml(row[COL.START_DATE - 1])}</b>\n• Плановая дата сдачи: <b>${escapeHtml(row[COL.END_DATE - 1])}</b>`;
    } else if (eventType === "project_done") {
      tab = "materials";
      text = `✅ <b>Проект № ${escapeHtml(kp)} завершён!</b>\nБлагодарим за сотрудничество с Бюро стандартов «МЕТОДИКО». Все документы доступны в Кабинете.`;
    } else if (eventType === "reminder_kp") {
      tab = "kp";
      text = `⏰ <b>Напоминание по № ${escapeHtml(kp)}:</b>\nЗдравствуйте, ${escapeHtml(name)}! В вашем Кабинете ждут выбора 3 варианта Финального КП 👇`;
      btnText = "💼 Выбрать вариант КП →";
    } else if (eventType === "reminder_materials") {
      tab = "materials";
      text = `⏰ <b>Напоминание по № ${escapeHtml(kp)}:</b>\nЗдравствуйте, ${escapeHtml(name)}! Чтобы запустить отсчёт срока разработки, загрузите материалы в Кабинете 👇`;
      btnText = "📂 Загрузить материалы →";
    } else {
      return { sent: false, reason: "unknown_event" };
    }

    const portalUrl = getClientPortalUrl(kp, tab);
    const resp = sendTelegramApi(clientToken, "sendMessage", {
      chat_id: tgChatId,
      text: text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: btnText, url: portalUrl }]] }
    });
    if (!resp) return { sent: false, reason: "empty_response" };
    const code = resp.getResponseCode();
    const json = parseJsonSafe(resp.getContentText(), {});
    if (code === 200 && json.ok) {
      return { sent: true, chatId: tgChatId };
    }
    return { sent: false, reason: (json && json.description) ? json.description : ("HTTP " + code) };
  } catch (err) {
    Logger.log("sendClientTelegramNotice error: " + err.toString());
    return { sent: false, reason: err.toString() };
  }
}

function notifyClientAllChannels(sheet, rowIdx, eventType) {
  const tgRes = sendClientTelegramNotice(sheet, rowIdx, eventType);
  const emailRes = sendPortalLinkEmail(sheet, rowIdx, eventType);
  return {
    tgSent: Boolean(tgRes && tgRes.sent),
    tgChatId: (tgRes && tgRes.chatId) || "",
    tgReason: (tgRes && tgRes.reason) || "",
    emailSent: Boolean(emailRes && emailRes.sent),
    emailTo: (emailRes && emailRes.to) || "",
    emailReason: (emailRes && emailRes.reason) || ""
  };
}

function formatDeliveryNoteHtml(title, delivery, clientEmailCell, portalUrl) {
  const tgLine = delivery.tgSent
    ? `✈️ <b>Telegram-колокольчик:</b> ✅ доставлено клиенту (ID <code>${escapeHtml(delivery.tgChatId)}</code>)`
    : `✈️ <b>Telegram-колокольчик:</b> ⚪ клиент ещё не нажал «Уведомления в ТГ»`;

  const emailDisplay = escapeHtml(clientEmailCell || "не указан");
  const emailLine = delivery.emailSent
    ? `📧 <b>Email-дубль (${emailDisplay}):</b> ✅ отправлено`
    : `📧 <b>Email-дубль (${emailDisplay}):</b> ⚪ не отправлено`;

  const header = (delivery.tgSent || delivery.emailSent)
    ? `✅ <b>${escapeHtml(title)} опубликовано на сайте и отправлено клиенту!</b>`
    : `⚠️ <b>${escapeHtml(title)} опубликовано на сайте</b> (у клиента ещё не подключён ТГ-колокольчик и не сработал Email).`;

  let out = `${header}\n\n${tgLine}\n${emailLine}`;
  if (!delivery.tgSent && !delivery.emailSent && portalUrl) {
    out += `\n\n🔗 Ссылка на Кабинет (если нужно передать вручную):\n<code>${portalUrl}</code>`;
  }
  return out;
}

/**
 * =========================================================================
 * 9. GEMINI API + 3 ВАРИАНТА КП + ФОРМАТИРОВАНИЕ КАРТОЧЕК
 * =========================================================================
 */
function callGeminiContent(parts) {
  const apiKey = getSecret("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY не задан");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const resp = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ contents: [{ parts: parts }] }),
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  const body = resp.getContentText();
  const json = JSON.parse(body);
  if (code !== 200 || json.error) {
    throw new Error(`HTTP ${code}: ${json.error ? json.error.message : body.slice(0, 120)}`);
  }
  return json.candidates[0].content.parts[0].text;
}

function buildFinalKpVariants(sheet, rowIdx) {
  const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
  const deal = readDealState(sheet, rowIdx);
  const lang = deal.chatLang || "ru";
  const category = row[COL.CATEGORY - 1] || "Методическая разработка";
  const devLang = row[COL.DEV_LANG - 1] || "Русский";
  let basePrice = Number(row[COL.AGREED_PRICE - 1] || row[COL.SITE_PRICE - 1] || 0);
  if (basePrice <= 0) {
    const catKey = resolveBranchKeyFromCategory(category);
    basePrice = catKey === "school" ? 350000 : (catKey === "edtech" ? 550000 : (catKey === "b2b" ? 650000 : 450000));
  }
  const baseDays = Math.max(5, parseInt(row[COL.DAYS - 1] || 12, 10));
  const round5k = (n) => Math.max(50000, Math.round(n / 5000) * 5000);

  const p1 = round5k(basePrice * 0.68);
  const p2 = round5k(basePrice);
  const p3 = round5k(basePrice * 1.40);
  const d1 = Math.max(4, Math.ceil(baseDays * 0.65));
  const d2 = baseDays;
  const d3 = Math.ceil(baseDays * 1.35);

  const fallback = lang === "kz"
    ? [
        { id: 1, title: "Базалық (Экспресс)", price: p1, days: d1, scope: "Негізгі әдістемелік қаңқа және бастапқы материалдар жиынтығы" },
        { id: 2, title: "Оңтайлы (Ұсынылады)", price: p2, days: d2, scope: "Сұхбат қорытындысы бойынша толық жинақ, стандарттар мен тапсырмалар" },
        { id: 3, title: "Флагман (Толық цикл)", price: p3, days: d3, scope: "Толық іске қосу, қосымша модульдер, тестілеу және авторлық сүйемелдеу" }
      ]
    : [
        { id: 1, title: "Экспресс (Базовый)", price: p1, days: d1, scope: "Базовая архитектура и ключевой комплект документации под задачу" },
        { id: 2, title: "Оптимум (Рекомендуемый)", price: p2, days: d2, scope: "Полный согласованный комплект под ключ по итогам вашей распаковки" },
        { id: 3, title: "Флагман (Максимум)", price: p3, days: d3, scope: "Расширенный цикл: дополнительные практические модули, вычитка и методический надзор" }
      ];

  const apiKey = getSecret("GEMINI_API_KEY");
  if (!apiKey) return fallback;

  try {
    const prompt = `Ты — главный методолог Бюро «МЕТОДИКО». На основе брифа клиента составь 3 варианта Финального КП на языке: ${lang === "kz" ? "КАЗАХСКИЙ" : "РУССКИЙ"}.
Категория: ${category} | Язык продукта: ${devLang}
Ориентир цен (цифры оставь точно):
1) Вариант 1: ${p1} тг, ${d1} раб. дн.
2) Вариант 2: ${p2} тг, ${d2} раб. дн.
3) Вариант 3: ${p3} тг, ${d3} раб. дн.

Выжимка брифа: ${row[COL.SUMMARY - 1] || row[COL.BRIEF - 1] || "Стандартный запрос"}

Верни СТРОГО JSON-массив из 3 объектов без markdown:
[{"id":1,"title":"...","price":${p1},"days":${d1},"scope":"конкретный состав работ до 260 знаков"}, ...]`;

    const raw = callGeminiContent([{ text: prompt }]).replace(/```json|```/g, "").trim();
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(arrMatch ? arrMatch[0] : raw);
    if (Array.isArray(parsed) && parsed.length === 3) {
      return parsed.map((v, idx) => ({
        id: idx + 1,
        title: String(v.title || fallback[idx].title),
        price: Number(v.price) || fallback[idx].price,
        days: Number(v.days) || fallback[idx].days,
        scope: String(v.scope || fallback[idx].scope)
      }));
    }
  } catch (e) {
    Logger.log("KP variants fallback: " + e.toString());
  }
  return fallback;
}

function analyzeBriefWithGemini(input) {
  const apiKey = getSecret("GEMINI_API_KEY");
  if (!apiKey) {
    return {
      summary: "Gemini API ключ пока не задан — сохранены сырые ответы клиента.",
      transcript: "",
      requisites: ""
    };
  }

  const prompt = `Ты — старший методолог Бюро стандартов «МЕТОДИКО» (ТОО «Метод и Ко»).
Проанализируй ответы клиента по заявке ${input.kpNumber} (направление: ${input.category}, язык диалога: ${input.lang}).
Если приложено аудио — сначала точно расшифруй его.
Верни ответ СТРОГО в формате JSON без markdown-обертки со следующими полями на русском языке:
{
  "transcript": "полная расшифровка аудио (или пустая строка, если аудио не было)",
  "summary": "краткая структурная выжимка (до 900 знаков): 1) Цель и критерии по Дилтсу; 2) ФКР и специфика; 3) Ресурсы на руках; 4) Готовность бюджета/сроков; 5) Риск или чего не хватает",
  "requisites": "выделенные реквизиты организации для договора (название, БИН/ИИН, ИИК, БИК, подписант) или 'Не предоставлены'"
}

Сырые ответы клиента:
${input.rawText}`;

  const parts = [{ text: prompt }];
  if (input.audioBase64) {
    parts.push({ inline_data: { mime_type: input.audioMimeType || "audio/webm", data: input.audioBase64 } });
  }

  try {
    const rawOut = callGeminiContent(parts).replace(/```json|```/g, "").trim();
    const jsonMatch = rawOut.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : rawOut);
  } catch (err) {
    return {
      summary: "Авторазбор временно недоступен (" + err.toString() + "). См. сырой бриф.",
      transcript: "",
      requisites: ""
    };
  }
}

function formatKp3VariantsPreview(kp, variants) {
  let msg = `📋 <b>ЧЕРНОВИК ФИНАЛЬНОГО КП (3 варианта) по ${kp}:</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
  variants.forEach(v => {
    msg += `\n<b>${v.id}. ${escapeHtml(v.title)}</b> — <b>${Number(v.price).toLocaleString("ru-RU")} ₸</b> (${v.days} раб. дн.)\n<i>${escapeHtml(v.scope)}</i>\n`;
  });
  msg += `\n💳 Оплата: <b>100% предоплата</b>, старт на след. раб. день после оплаты и материалов.\n⏳ Окно выбора для клиента: <b>2 раб. дня</b>.`;
  return msg;
}

function notifyAdminKpAccepted(sheet, rowIdx, chosen, needsReq) {
  const token = getSecret("ADMIN_BOT_TOKEN");
  const adminChatId = getSecret("ADMIN_CHAT_ID");
  if (!token || !adminChatId) return;
  const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
  const kp = row[COL.KP - 1];
  sendTelegramApi(token, "sendMessage", {
    chat_id: adminChatId,
    text: `🤝 <b>КЛИЕНТ ПРИНЯЛ ФИНАЛЬНОЕ КП: ${kp}</b>\n👤 ${escapeHtml(row[COL.NAME - 1])} (${escapeHtml(row[COL.ORG - 1])})\n📦 Вариант: <b>${escapeHtml(chosen.title)}</b>\n💰 Сумма: <b>${Number(chosen.price).toLocaleString("ru-RU")} ₸</b> | ⏱ ${chosen.days} раб. дн.\n🏦 Реквизиты: ${needsReq ? "<i>пока не указаны (клиент сможет вписать в Договор А4)</i>" : escapeHtml(row[COL.REQUISITES - 1])}`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📄 Собрать и проверить Договор (А4)", callback_data: `approve_${kp}` }],
        [{ text: "👁️ Открыть Кабинет сделки", url: getAdminPortalUrl(kp, "contract") }]
      ]
    }
  });
}

function notifyAdminContractAgreed(sheet, rowIdx) {
  const token = getSecret("ADMIN_BOT_TOKEN");
  const adminChatId = getSecret("ADMIN_CHAT_ID");
  if (!token || !adminChatId) return;
  const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
  const kp = row[COL.KP - 1];
  const deal = parseJsonSafe(row[COL.DEAL_JSON - 1], {});
  const kb = [
    [{ text: "💰 Подписано + 100% оплачено (Ждем материалы)", callback_data: `paid_${kp}` }],
    [{ text: "👁️ Открыть согласованный Договор (А4)", url: getAdminPortalUrl(kp, "contract") }]
  ];
  if (deal.contractPdfUrl) kb.push([{ text: "📄 Скачать PDF Договора с Диска", url: deal.contractPdfUrl }]);

  sendTelegramApi(token, "sendMessage", {
    chat_id: adminChatId,
    text: `✍️ <b>ДОГОВОР СОГЛАСОВАН КЛИЕНТОМ: ${kp}!</b>\n👤 ${escapeHtml(row[COL.NAME - 1])} (${escapeHtml(row[COL.ORG - 1])})\n💰 ${Number(row[COL.AGREED_PRICE - 1] || row[COL.SITE_PRICE - 1]).toLocaleString("ru-RU")} ₸\n\nПосле подписания и поступления 100% оплаты нажмите кнопку ниже:`,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: kb }
  });
}

/**
 * =========================================================================
 * 10. ВСПОМОГАТЕЛЬНЫЕ ХЕЛПЕРЫ
 * =========================================================================
 */
function buildWaQuickLink(phone, text) {
  const clean = normalizePhone(phone).replace(/[^\d]/g, "");
  if (clean.length < 10) return "";
  return `https://wa.me/${clean}?text=${encodeURIComponent(text || "")}`;
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  if (digits.length === 11 && digits.startsWith("8")) return "+7" + digits.slice(1);
  if (digits.length === 11 && digits.startsWith("7")) return "+" + digits;
  if (digits.length === 10) return "+7" + digits;
  return phone ? String(phone).trim() : "";
}

function getDevLangLabel(code) {
  if (code === "kz") return "Только казахский (+10% цена и срок)";
  if (code === "both") return "На двух языках RU+KZ (+25% цена)";
  return "Только русский (база)";
}

function inferDevLangCode(label) {
  const s = (label || "").toLowerCase();
  if (s.includes("двух") || s.includes("ru+kz") || s.includes("both")) return "both";
  if (s.includes("казах")) return "kz";
  return "ru";
}

function calculateLoadPoints(days, devLang, selectedItems) {
  let base = 2;
  if (days <= 7) base = 1;
  else if (days >= 15 || (selectedItems && selectedItems.length >= 3)) base = 3;
  if (devLang === "kz") return base + 0.5;
  if (devLang === "both") return base + 1;
  return base;
}

function detectKazakhSentence(text) {
  if (!text) return false;
  const cleaned = text.toString().replace(/ұстаз/gi, "");
  return /[әіңғүұқөһӘІҢҒҮҰҚӨҺ]/.test(cleaned);
}

function detectBranchKey(text) {
  const c = (text || "").toLowerCase();
  if (!c) return "";
  if (/(edtech|онлайн-школ|онлайн школ|онлайн-курс|онлайн курс|онлайн-мектеп|доходимост|cor|эдтех)/.test(c)) return "edtech";
  if (/(универ|колледж|умкд|силлабус|platonus|moodle|ects|кредит|вуз|жоо|оәк|госо|мжмбс)/.test(c)) return "vuz";
  if (/(ұстаз|устаз|аттестац|аттестат|модератор|сарапшы|зерттеуші|шебер|комикс|школ|мектеп|34 час|68 час)/.test(c)) return "school";
  if (/(корпорац|корпоратив|тренаж|отдел продаж|менеджер|стаж[её]р|b2b|битрикс|колл-центр)/.test(c)) return "b2b";
  return "";
}

function resolveBranchKeyFromCategory(category) {
  return detectBranchKey(category) || "b2b";
}

function addWorkingDays(startDate, daysToAdd) {
  const date = new Date(startDate.getTime());
  let added = 0;
  while (added < daysToAdd) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return date;
}

function countWorkingDaysBetween(startDt, endDt) {
  const cur = new Date(startDt.getTime());
  let count = 0;
  while (cur < endDt) {
    cur.setDate(cur.getDate() + 1);
    const d = cur.getDay();
    if (d !== 0 && d !== 6 && cur <= endDt) count++;
  }
  return count;
}

function formatDateRu(d) {
  return Utilities.formatDate(d, "Asia/Almaty", "dd.MM.yyyy");
}

function parseDateRu(str) {
  if (!str) return null;
  if (str instanceof Date) return str;
  const parts = str.toString().split(".");
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
}

function findRowByKp(sheet, kpNumber) {
  if (!sheet || !kpNumber || sheet.getLastRow() < 2) return -1;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(kpNumber).trim()) return i + 2;
  }
  return -1;
}

function paintStatusCell(sheet, rowIdx, statusText) {
  const cell = sheet.getRange(rowIdx, COL.STATUS);
  const s = String(statusText || "");
  let bg = "#F1F5F9";
  if (s.includes("🟡")) bg = "#FEF9C3";
  else if (s.includes("🟣")) bg = "#F3E8FF";
  else if (s.includes("🔵")) bg = "#DBEAFE";
  else if (s.includes("🟠")) bg = "#FFEDD5";
  else if (s.includes("💼")) bg = "#E0E7FF";
  else if (s.includes("🤝")) bg = "#D1FAE5";
  else if (s.includes("📄")) bg = "#E2E8F0";
  else if (s.includes("✍️")) bg = "#BAE6FD";
  else if (s.includes("⏳")) bg = "#FEF3C7";
  else if (s.includes("🟢")) bg = "#DCFCE7";
  else if (s.includes("📅")) bg = "#FDE68A";
  else if (s.includes("✅")) bg = "#BBF7D0";
  else if (isRejectedStatus(s)) bg = "#E2E8F0";
  else if (isPausedStatus(s)) bg = "#F3F4F6";
  cell.setBackground(bg).setFontWeight("bold");
}

function parseJsonSafe(str, fallback) {
  try { return str ? JSON.parse(str.toString()) : fallback; } catch (e) { return fallback; }
}

function readDealState(sheet, rowIdx) {
  if (!sheet || rowIdx === -1) return {};
  return parseJsonSafe(sheet.getRange(rowIdx, COL.DEAL_JSON).getValue(), {});
}

function patchDealState(sheet, rowIdx, patchObj) {
  if (!sheet || rowIdx === -1) return {};
  const cur = readDealState(sheet, rowIdx);
  const next = Object.assign({}, cur, patchObj);
  sheet.getRange(rowIdx, COL.DEAL_JSON).setValue(JSON.stringify(next));
  return next;
}

function getClientTgDeepLink(kpNumber) {
  return `https://t.me/${CONFIG.CLIENT_BOT_USERNAME}?start=${encodeURIComponent(String(kpNumber || "").trim())}`;
}

function extractTgChatId(row, deal) {
  if (deal && deal.clientTgChatId) return String(deal.clientTgChatId).trim();
  const col22 = (row && row[COL.META_DOC - 1]) ? String(row[COL.META_DOC - 1]) : "";
  const m = col22.match(/tg_chat:(-?\d+)/);
  return m ? m[1] : "";
}

function setCol22TgChat(sheet, rowIdx, chatId) {
  if (!sheet || rowIdx === -1 || !chatId) return;
  const cell = sheet.getRange(rowIdx, COL.META_DOC);
  const existing = (cell.getValue() || "").toString().trim();
  const cleaned = existing.replace(/tg_chat:-?\d+\s*\|?\s*/g, "").replace(/^\|\s*|\s*\|$/g, "").trim();
  cell.setValue(cleaned ? `tg_chat:${chatId} | ${cleaned}` : `tg_chat:${chatId}`);
}

function saveClientTgChat(sheet, rowIdx, chatId, tgUsername) {
  if (!sheet || rowIdx === -1 || !chatId) return;
  setCol22TgChat(sheet, rowIdx, chatId);
  patchDealState(sheet, rowIdx, {
    clientTgChatId: String(chatId),
    clientTgUsername: tgUsername || "",
    tgConnectedAt: new Date().toISOString()
  });
  if (tgUsername) {
    const curTg = (sheet.getRange(rowIdx, COL.TG).getValue() || "").toString().trim();
    if (!curTg || curTg === "—") {
      sheet.getRange(rowIdx, COL.TG).setValue(tgUsername);
    }
  }
  SpreadsheetApp.flush();
}

function findRowByTgChatId(sheet, chatId) {
  if (!sheet || !chatId || sheet.getLastRow() < 2) return -1;
  const target = String(chatId).trim();
  const cols = sheet.getRange(2, COL.META_DOC, sheet.getLastRow() - 1, 3).getValues();
  for (let i = cols.length - 1; i >= 0; i--) {
    const meta = String(cols[i][0] || "");
    const deal = parseJsonSafe(cols[i][2], {});
    if ((deal && String(deal.clientTgChatId || "") === target) || meta.includes(`tg_chat:${target}`)) {
      return i + 2;
    }
  }
  return -1;
}

function findRowByTgUsername(sheet, tgUsername) {
  if (!sheet || !tgUsername || sheet.getLastRow() < 2) return -1;
  const norm = String(tgUsername).trim().replace(/^@/, "").toLowerCase();
  if (!norm) return -1;
  const vals = sheet.getRange(2, COL.TG, sheet.getLastRow() - 1, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    const cellNorm = String(vals[i][0] || "").trim().replace(/^@/, "").toLowerCase();
    if (cellNorm && cellNorm === norm) return i + 2;
  }
  return -1;
}

function updateCol22KeepingTgChat(sheet, rowIdx, noteOrUrl) {
  if (!sheet || rowIdx === -1) return;
  const cell = sheet.getRange(rowIdx, COL.META_DOC);
  const existing = (cell.getValue() || "").toString();
  const m = existing.match(/tg_chat:-?\d+/);
  const cleanNote = (noteOrUrl || "").toString().trim();
  if (m && cleanNote) cell.setValue(`${m[0]} | ${cleanNote}`);
  else if (m) cell.setValue(m[0]);
  else cell.setValue(cleanNote);
}

function extractDocUrlFromCol22(val) {
  const m = (val || "").toString().match(/https:\/\/docs\.google\.com\/[^\s|]+/);
  return m ? m[0] : "";
}

function setAdminPendingAction(chatId, actionObj) {
  actionObj.expiresAt = Date.now() + 1800000;
  PropertiesService.getScriptProperties().setProperty("ADMIN_PENDING_" + chatId, JSON.stringify(actionObj));
}

function getAdminPendingAction(chatId) {
  const raw = PropertiesService.getScriptProperties().getProperty("ADMIN_PENDING_" + chatId);
  if (!raw) return null;
  const obj = parseJsonSafe(raw, null);
  if (!obj || (obj.expiresAt && Date.now() > obj.expiresAt)) {
    clearAdminPendingAction(chatId);
    return null;
  }
  return obj;
}

function clearAdminPendingAction(chatId) {
  PropertiesService.getScriptProperties().deleteProperty("ADMIN_PENDING_" + chatId);
}

function sendTelegramApi(token, method, payload) {
  if (!token) return null;
  return UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function escapeHtml(text) {
  if (!text) return "";
  return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}


/**
 * =========================================================================
 * 11. ВХОД КЛИЕНТА ПО НОМЕРУ ТЕЛЕФОНА, ШТАБ БЮРО, ПРОГРЕСС % И СВОДКИ (v7.0)
 * =========================================================================
 */
function findOrdersByPhoneApi(rawPhone) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  if (!sheet || sheet.getLastRow() < 2) {
    return { status: "not_found", message: "Проверьте введённый номер телефона или оформите смету на главной странице." };
  }

  // К1 + В3: Вход по кодовым словам («ШТАБ», «НАТАЛЬЯ», «ДИРЕКТОР») и по номеру КП (MK-...) полностью удалён.
  // Ввод телефона руководителя больше не выдаёт ссылку на Штаб и никак не выделяется.
  const cleanDigits = String(rawPhone || "").replace(/[^\d]/g, "");
  const tail10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : "";

  if (tail10.length !== 10) {
    return { status: "error", message: "Введите корректный номер телефона (10–11 цифр)." };
  }

  if (!checkRateLimit("phone_login", tail10, 12, 900)) {
    return { status: "error", message: "Слишком много попыток входа. Пожалуйста, подождите 15 минут." };
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, COL.DEAL_JSON).getValues();
  const matches = [];

  for (let i = data.length - 1; i >= 0; i--) {
    const r = data[i];
    const kp = String(r[COL.KP - 1] || "").trim();
    if (!kp) continue;
    const st = String(r[COL.STATUS - 1] || "");
    if (isRejectedStatus(st)) continue;

    const rowDigits = String(r[COL.PHONE - 1] || "").replace(/[^\d]/g, "");
    const rowTail10 = rowDigits.length >= 10 ? rowDigits.slice(-10) : "";

    if (tail10 && rowTail10 && tail10 === rowTail10) {
      const deal = parseJsonSafe(r[COL.DEAL_JSON - 1], {});
      const deliverables = ensureDeliverablesList(r, deal);
      matches.push({
        kpNumber: kp,
        date: String(r[COL.DATE - 1] || ""),
        clientName: String(r[COL.NAME - 1] || ""),
        clientOrg: String(r[COL.ORG - 1] || ""),
        category: String(r[COL.CATEGORY - 1] || ""),
        crmStatus: st,
        agreedPrice: Number(r[COL.AGREED_PRICE - 1] || r[COL.SITE_PRICE - 1] || 0),
        progressPercent: computeOrderProgress(st, deal, deliverables),
        portalToken: generatePortalToken(kp),
        portalUrl: getClientPortalUrl(kp)
      });
      if (matches.length >= 5) break;
    }
  }

  if (matches.length === 0) {
    return {
      status: "not_found",
      message: "Проверьте введённый номер телефона или оформите расчёт сметы на главной странице."
    };
  }

  return {
    status: "ok",
    orders: matches,
    primaryOrder: matches[0] || null
  };
}

function ensureDeliverablesList(row, deal) {
  if (deal && Array.isArray(deal.deliverables) && deal.deliverables.length > 0) {
    return deal.deliverables;
  }
  const items = [];
  const chosen = deal && deal.chosenVariant;
  const sel = (deal && Array.isArray(deal.selectedItems)) ? deal.selectedItems : [];
  const crmStatus = String((row && row[COL.STATUS - 1]) || "");
  const isDone = crmStatus.includes("✅");
  const isWork = crmStatus.includes("🟢") || crmStatus.includes("📅");

  if (sel.length > 0) {
    sel.forEach((it, idx) => {
      items.push({
        id: "mod_" + (idx + 1),
        title: it.name || ("Раздел проекта №" + (idx + 1)),
        status: isDone ? "approved" : (isWork ? "in_progress" : "pending"),
        progress: isDone ? 100 : (isWork ? 35 : 0),
        fileUrl: "",
        fileName: "",
        staffNote: "",
        clientComment: "",
        updatedAt: ""
      });
    });
  } else if (chosen && chosen.title) {
    items.push({
      id: "pkg_1",
      title: chosen.title + (chosen.scope ? " (" + chosen.scope.slice(0, 70) + ")" : ""),
      status: isDone ? "approved" : (isWork ? "in_progress" : "pending"),
      progress: isDone ? 100 : (isWork ? 35 : 0),
      fileUrl: "",
      fileName: "",
      staffNote: "",
      clientComment: "",
      updatedAt: ""
    });
  } else {
    const cat = (row && row[COL.CATEGORY - 1]) || "Методический комплект";
    items.push({
      id: "doc_main_1",
      title: "Основной комплект разработки (" + cat + ")",
      status: isDone ? "approved" : (isWork ? "in_progress" : "pending"),
      progress: isDone ? 100 : (isWork ? 30 : 0),
      fileUrl: "",
      fileName: "",
      staffNote: "",
      clientComment: "",
      updatedAt: ""
    });
  }

  items.push({
    id: "doc_avr",
    title: "Итоговый пакет сдачи и Акт выполненных работ (АВР)",
    status: isDone ? "approved" : "pending",
    progress: isDone ? 100 : 0,
    fileUrl: "",
    fileName: "",
    staffNote: "",
    clientComment: "",
    updatedAt: ""
  });

  return items;
}

function computeOrderProgress(crmStatus, deal, deliverables) {
  const s = String(crmStatus || "");
  if (s.includes("✅")) return 100;
  if (isRejectedStatus(s)) return 0;

  let base = 10;
  if (s.includes("🟣") || s.includes("🔵") || s.includes("🟠") || (deal && deal.briefAnswers)) base = 22;
  if (s.includes("💼") || (deal && deal.kpSignedByAdmin)) base = 35;
  if (s.includes("🤝")) base = 42;
  if (s.includes("📄") || (deal && deal.contractSignedByAdmin)) base = 50;
  if (s.includes("✍️") || (deal && (deal.clientSignedOnline || (deal.signedContractFiles && deal.signedContractFiles.length)))) base = 60;
  if (s.includes("⏳")) base = 68;
  if (s.includes("🟢") || s.includes("📅")) base = 75;

  const list = Array.isArray(deliverables) ? deliverables : [];
  if (list.length > 0 && base >= 60) {
    const avgDoc = list.reduce((acc, d) => acc + Number(d.progress || 0), 0) / list.length;
    return Math.min(99, Math.round(60 + (avgDoc * 0.40)));
  }
  return base;
}

function listReadyFilesFromDrive(deal) {
  const out = [];
  try {
    const resultsId = deal && deal.driveFolders && deal.driveFolders.subFolders && deal.driveFolders.subFolders.resultsId;
    if (!resultsId) return out;
    const folder = DriveApp.getFolderById(resultsId);
    const files = folder.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      if (f.isTrashed()) continue;
      out.push({
        name: f.getName(),
        url: f.getUrl(),
        updatedAt: Utilities.formatDate(f.getLastUpdated(), "Asia/Almaty", "dd.MM.yyyy HH:mm")
      });
    }
  } catch (e) {}
  return out;
}

function appendPortalEvent(sheet, rowIdx, text) {
  if (!sheet || rowIdx === -1 || !text) return;
  const deal = readDealState(sheet, rowIdx);
  const log = Array.isArray(deal.eventsLog) ? deal.eventsLog : [];
  log.unshift({
    at: Utilities.formatDate(new Date(), "Asia/Almaty", "dd.MM.yyyy HH:mm"),
    text: text
  });
  patchDealState(sheet, rowIdx, { eventsLog: log.slice(0, 40) });
}

function getStaffDashboardState(staffKey) {
  const role = resolveStaffRole("", staffKey);
  if (!role) {
    return { status: "forbidden", message: "Недействительный или устаревший секретный ключ Штаба Бюро." };
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  ensureExtendedColumns(sheet);
  const qInfo = getPublicQueueStatus();
  if (!sheet || sheet.getLastRow() < 2) {
    return { status: "ok", role: role, queue: qInfo, orders: [] };
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, COL.CLIENT_TYPE).getValues();
  const orders = [];
  for (let i = data.length - 1; i >= 0; i--) {
    const rowIdx = i + 2;
    const r = data[i];
    const kp = String(r[COL.KP - 1] || "").trim();
    if (!kp) continue;
    const deal = parseJsonSafe(r[COL.DEAL_JSON - 1], {});
    const crmStatus = healLaggingOrderStatus(sheet, rowIdx, r, deal) || String(r[COL.STATUS - 1] || "");
    const rejected = isRejectedStatus(crmStatus);
    const deliverables = ensureDeliverablesList(r, deal);
    const prog = computeOrderProgress(crmStatus, deal, deliverables);
    const t = encodeURIComponent(generatePortalToken(kp));
    const sig = encodeURIComponent(role === "director" ? generateAdminToken(kp) : generateAssistantToken(kp));

    orders.push({
      kpNumber: kp,
      portalToken: generatePortalToken(kp),
      adminToken: role === "director" ? generateAdminToken(kp) : generateAssistantToken(kp),
      date: String(r[COL.DATE - 1] || ""),
      clientName: String(r[COL.NAME - 1] || ""),
      clientOrg: String(r[COL.ORG - 1] || ""),
      clientPhone: String(r[COL.PHONE - 1] || ""),
      clientEmail: String(r[COL.EMAIL - 1] || ""),
      category: String(r[COL.CATEGORY - 1] || ""),
      clientType: String(r[COL.CLIENT_TYPE - 1] || mapCategoryToClientType(r[COL.CATEGORY - 1])),
      devLanguage: String(r[COL.DEV_LANG - 1] || ""),
      crmStatus: crmStatus,
      isRejected: rejected,
      kpSignedByAdmin: Boolean(deal.kpSignedByAdmin),
      contractSignedByAdmin: Boolean(deal.contractSignedByAdmin),
      agreedPrice: Number(r[COL.AGREED_PRICE - 1] || r[COL.SITE_PRICE - 1] || 0),
      totalDays: Number(r[COL.DAYS - 1] || 10),
      startDate: String(r[COL.START_DATE - 1] || ""),
      endDate: String(r[COL.END_DATE - 1] || ""),
      progressPercent: prog,
      // К4: Заказы в статусе «Отказ» никогда не показываются в «Ждут нашего ответа», но остаются в таблице
      needsAttention: rejected ? false : Boolean(deal.needsAttention),
      uploadedCount: (deal.uploadedMaterials ? deal.uploadedMaterials.length : 0) + (deal.signedContractFiles ? deal.signedContractFiles.length : 0) + (deal.paymentReceiptFiles ? deal.paymentReceiptFiles.length : 0),
      messagesCount: deal.messages ? deal.messages.length : 0,
      deliverables: deliverables,
      driveFolderUrl: role === "director" ? String(r[COL.DRIVE_LINK - 1] || "") : "",
      openCabinetUrl: `${CONFIG.SITE_URL}/client.html?kp=${encodeURIComponent(kp)}&t=${t}&admin=${sig}`
    });
  }

  return {
    status: "ok",
    role: role,
    assistantHubUrl: role === "director" ? getStaffHubUrl("assistant") : "",
    queue: qInfo,
    orders: orders
  };
}

function sendStaffSummaryReportToAdmin(targetChatId) {
  const token = getSecret("ADMIN_BOT_TOKEN");
  const chatId = targetChatId || getSecret("ADMIN_CHAT_ID");
  if (!token || !chatId) return;

  const state = getStaffDashboardState(getOrCreateStaffSecretKey("director"));
  const orders = state.orders || [];
  const active = orders.filter(o => !o.crmStatus.includes("✅") && !o.isRejected);
  const doneCount = orders.filter(o => o.crmStatus.includes("✅")).length;

  let msg = `🏛️ <b>ШТАБНАЯ СВОДКА БЮРО «МЕТОДИКО»</b>\n`;
  msg += `⚖️ Загрузка: <b>${state.queue.usedPoints} / ${CONFIG.MAX_CAPACITY_POINTS} баллов</b> | Ближайшее окно: <b>${state.queue.nextFreeWindow}</b>\n`;
  msg += `📂 Всего заказов: <b>${orders.length}</b> (в работе и согласовании: <b>${active.length}</b>, завершено: <b>${doneCount}</b>)\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;

  if (active.length === 0) {
    msg += `<i>Сейчас нет активных незавершённых заявок.</i>\n`;
  } else {
    active.slice(0, 12).forEach((o, idx) => {
      const fire = o.needsAttention ? "🔥 " : "";
      const docsSummary = (o.deliverables || []).map(d => {
        const ic = d.status === "approved" ? "✅" : (d.status === "review" ? "🟠" : (d.status === "in_progress" ? "🔨" : "⏳"));
        return `${ic} ${escapeHtml(d.title.slice(0, 28))} (${d.progress || 0}%)`;
      }).join("; ");
      msg += `\n<b>${idx + 1}. ${fire}${escapeHtml(o.kpNumber)} — ${escapeHtml(o.clientName)}</b> (${escapeHtml(o.clientOrg)})\n`;
      msg += `   • Статус: ${escapeHtml(o.crmStatus)} | <b>Готовность: ${o.progressPercent}%</b>\n`;
      msg += `   • Сумма: ${Number(o.agreedPrice).toLocaleString("ru-RU")} ₸${o.endDate ? " | Сдача до: " + escapeHtml(o.endDate) : ""}\n`;
      if (docsSummary) msg += `   • Документы: <i>${docsSummary}</i>\n`;
    });
  }

  msg += `\n🔐 <b>Доступ в Штаб защищён секретным ключом (в Свойствах скрипта):</b>\n`;
  msg += `• 👑 Вход для Руководителя и Куратора — по кнопкам ниже.`;

  sendTelegramApi(token, "sendMessage", {
    chat_id: chatId,
    text: msg,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "👑 Открыть Штаб всех заказов (Режим Руководителя)", url: getStaffHubUrl("director") }],
        [{ text: "👩‍💼 Открыть Штаб (Режим Куратора)", url: getStaffHubUrl("assistant") }],
        [{ text: "🔑 Показать / Сменить секретные ключи Штаба", callback_data: "show_staff_keys" }],
        [{ text: "🔄 Обновить сводку", callback_data: "staff_report" }]
      ]
    }
  });
}

// К2: Получение изображения печати ТОЛЬКО из закрытой папки Натальи на Google Диске (никогда с публичного сайта)
function getStampBlobFromPrivateDrive() {
  try {
    let fileId = String(getSecret("STAMP_FILE_ID") || "").trim();
    if (fileId) {
      try {
        return DriveApp.getFileById(fileId).getBlob();
      } catch (e) {
        fileId = "";
      }
    }
    const it = DriveApp.getFilesByName("metodico_stamp_sign.png");
    while (it.hasNext()) {
      const f = it.next();
      if (!f.isTrashed()) {
        setSecret("STAMP_FILE_ID", f.getId());
        return f.getBlob();
      }
    }
  } catch (err) {
    Logger.log("getStampBlobFromPrivateDrive warn: " + err.toString());
  }
  return null;
}

function appendDirectorStampToDocBody(body, kp, signedAtStr) {
  try {
    const stampBlob = getStampBlobFromPrivateDrive();
    if (stampBlob) {
      const img = body.appendImage(stampBlob);
      img.setWidth(190);
      img.setHeight(138);
    }
  } catch (e) {
    Logger.log("Stamp image insert warn: " + e);
  }
  const dt = signedAtStr || formatDateRu(new Date());
  body.appendParagraph(`✅ ПОДПИСАНО И УТВЕРЖДЕНО ИСПОЛНИТЕЛЕМ: ТОО «Метод и Ко» (БИН 231140018015), Директор Коденцева Н.М. | Дата: ${dt} | Реестровый № ${kp} (${CONFIG.SITE_URL})`);
}

function appendClientSignatureToDocBody(body, kp, orgDisplay, binIin, signerDisplay, deal, isFinalAgreed) {
  const signedOnline = Boolean(isFinalAgreed || (deal && deal.clientSignedOnline));
  const signedFiles = (deal && Array.isArray(deal.signedContractFiles)) ? deal.signedContractFiles : [];
  if (deal && deal.clientSignatureDataUrl && deal.clientSignatureDataUrl.indexOf("base64,") !== -1) {
    try {
      const b64 = deal.clientSignatureDataUrl.split("base64,")[1];
      const sigBlob = Utilities.newBlob(Utilities.base64Decode(b64), "image/png", "client_signature.png");
      const sigImg = body.appendImage(sigBlob);
      sigImg.setWidth(150);
      sigImg.setHeight(45);
    } catch (e) {}
  }
  if (signedOnline || signedFiles.length > 0) {
    const dt = (deal && deal.clientSignedAt) || new Date().toLocaleString("ru-RU");
    body.appendParagraph(`✅ ДОКУМЕНТ ПОДПИСАН И АКЦЕПТОВАН ЗАКАЗЧИКОМ ЭЛЕКТРОННО В ЛИЧНОМ КАБИНЕТЕ (п. 2 ст. 152, п. 3 ст. 396 ГК РК)\nОрганизация: ${orgDisplay} (БИН/ИИН: ${binIin || "—"})\nПодписант: ${signerDisplay} | Дата и время акцепта: ${dt} | Код верификации: ${kp}`);
  } else {
    body.appendParagraph(`Подпись Заказчика: ____________________ / ${signerDisplay} /   М.П.`);
  }
}
