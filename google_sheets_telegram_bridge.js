/**
 * =========================================================================
 * ТОО «Метод и Ко» | Бюро стандартов «МЕТОДИКО»
 * УМНЫЙ ОБЛАЧНЫЙ МОСТ v3.0:
 * САЙТ (index.html + brief.html) ➔ GOOGLE ТАБЛИЦА (CRM + ОЧЕРЕДЬ) ➔ 2 TELEGRAM-БОТА + GEMINI API
 * =========================================================================
 * Секретные ключи НЕ хранятся в открытом коде. Они задаются один раз в
 * «Настройки проекта -> Свойства скрипта» (Script Properties):
 *   - ADMIN_BOT_TOKEN     : токен вашего личного пульта (@metodico_sait_zayavki_bot)
 *   - ADMIN_CHAT_ID       : ваш личный Telegram ID
 *   - CLIENT_BOT_TOKEN    : токен нового клиентского бота-распаковщика (после создания)
 *   - GEMINI_API_KEY      : бесплатный ключ из Google AI Studio (для голоса и разбора)
 *   - CONTRACT_TEMPLATE_ID: ID Google-документа с шаблоном Договора (опционально)
 * =========================================================================
 */

const CONFIG = {
  SHEET_LEADS: "Заявки МЕТОДИКО",
  SHEET_QUEUE: "График и Очередь",
  SHEET_MEMORY: "Память диалогов",
  COMPANY_NAME: "ТОО «Метод и Ко» | Бюро «МЕТОДИКО»",
  MAX_CAPACITY_POINTS: 10, // Потолок одновременной загрузки (5-7 проектов)
  GEMINI_MODEL: "gemini-2.5-flash"
};

const STATUSES = {
  DRAFT_KP: "🟡 1. Черновик КП (с сайта)",
  IN_BRIEF: "🟣 2. В опроснике (идет распаковка)",
  FOR_APPROVAL: "🔵 3. На утверждении у Натальи",
  EXTRA_QUESTION: "🟠 4. Доп. вопрос / Правка сметы",
  CONTRACT_SENT: "⚪ 5. Договор отправлен (ожидает 100% оплату)",
  IN_WORK: "🟢 6. В РАБОТЕ (Активный слот)",
  IN_QUEUE: "📅 7. В ОЧЕРЕДИ (Забронирована дата)",
  DONE: "✅ 8. Сдано / АВР подписан"
};

function getSecret(key, fallback) {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(key) || fallback || "";
}

/**
 * =========================================================================
 * 1. ПЕРВИЧНАЯ НАСТРОЙКА ВСЕХ 3 ЛИСТОВ ТАБЛИЦЫ (ЗАПУСТИТЬ 1 РАЗ ВРУЧНУЮ)
 * =========================================================================
 */
function setupMetodikoCRM() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- ЛИСТ 1: ЗАЯВКИ И ПРОЕКТЫ ---
  let leadsSheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  if (!leadsSheet) leadsSheet = ss.insertSheet(CONFIG.SHEET_LEADS);

  const leadHeaders = [
    "ID КП",                   // A (1)
    "Дата заявки",             // B (2)
    "Имя заказчика",           // C (3)
    "Организация / Должность", // D (4)
    "Телефон (WhatsApp)",      // E (5)
    "Email",                   // F (6)
    "Telegram",                // G (7)
    "Направление ЦА",          // H (8)
    "Язык разработки",         // I (9)
    "Выбранные модули",        // J (10)
    "Смета с сайта (₸)",       // K (11)
    "Срок (раб. дн)",          // L (12)
    "Режим срочности",         // M (13)
    "Статус (Маркер)",         // N (14)
    "Согласованная сумма (₸)", // O (15)
    "Баллы нагрузки",          // P (16)
    "ИИ-выжимка (Дилтс/ФКР)",  // Q (17)
    "Полный бриф и доп.вопрос",// R (18)
    "Реквизиты для договора",  // S (19)
    "Дата старта",             // T (20)
    "Плановая дата сдачи",     // U (21)
    "Ссылка на Договор / Комментарий" // V (22)
  ];

  leadsSheet.getRange(1, 1, 1, leadHeaders.length).setValues([leadHeaders]);
  leadsSheet.getRange(1, 1, 1, leadHeaders.length)
    .setFontWeight("bold")
    .setBackground("#152238")
    .setFontColor("#FFFFFF")
    .setWrap(true);
  leadsSheet.setFrozenRows(1);

  // --- ЛИСТ 2: ГРАФИК И ОЧЕРЕДЬ ---
  let queueSheet = ss.getSheetByName(CONFIG.SHEET_QUEUE);
  if (!queueSheet) queueSheet = ss.insertSheet(CONFIG.SHEET_QUEUE);
  setupQueueSheetLayout(queueSheet);

  // --- ЛИСТ 3: ПАМЯТЬ ДИАЛОГОВ БОТА ---
  let memSheet = ss.getSheetByName(CONFIG.SHEET_MEMORY);
  if (!memSheet) memSheet = ss.insertSheet(CONFIG.SHEET_MEMORY);
  const memHeaders = ["Chat ID", "ID КП", "Категория", "Язык", "Шаг", "Собранные ответы (JSON)", "Обновлено"];
  memSheet.getRange(1, 1, 1, memHeaders.length).setValues([memHeaders]);
  memSheet.getRange(1, 1, 1, memHeaders.length).setFontWeight("bold").setBackground("#1E293B").setFontColor("#FFFFFF");
  memSheet.setFrozenRows(1);

  recalculateQueueSheet();
}

function setupQueueSheetLayout(queueSheet) {
  queueSheet.clear();
  queueSheet.getRange("A1:G1").merge()
    .setValue("📊 ПРОИЗВОДСТВЕННЫЙ ГРАФИК И ОЧЕРЕДЬ ЗАГРУЗКИ БЮРО «МЕТОДИКО» (Потолок: " + CONFIG.MAX_CAPACITY_POINTS + " баллов)")
    .setFontWeight("bold").setFontSize(12).setBackground("#152238").setFontColor("#D4AF37");

  queueSheet.getRange("A2:D2").setValues([["Занято баллов сейчас:", 0, "Свободно баллов:", CONFIG.MAX_CAPACITY_POINTS]]);
  queueSheet.getRange("E2:G2").setValues([["Ближайшее свободное окно:", formatDateRu(addWorkingDays(new Date(), 1)), "Правило: 100% оплата -> старт след. раб. день"]]);
  queueSheet.getRange("A2:G2").setFontWeight("bold").setBackground("#F8FAFC");

  const qHeaders = ["№ п/п", "ID КП", "Заказчик / Организация", "Направление и Язык", "Баллы", "Статус слота", "Старт ➔ Сдача"];
  queueSheet.getRange(4, 1, 1, qHeaders.length).setValues([qHeaders]);
  queueSheet.getRange(4, 1, 1, qHeaders.length).setFontWeight("bold").setBackground("#334155").setFontColor("#FFFFFF");
  queueSheet.setFrozenRows(4);
}

/**
 * =========================================================================
 * 2. ОБРАБОТКА ВХОДЯЩИХ ЗАПРОСОВ: GET (ДЛЯ СТАТУСА ОЧЕРЕДИ) И POST
 * =========================================================================
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";
    if (action === "queue_status") {
      const info = getPublicQueueStatus();
      return ContentService.createTextOutput(JSON.stringify(info)).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "ok", service: "METODIKO Bridge v3.0" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error" })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
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

    // 1. Входящее сообщение от Клиентского бота (?bot=client)
    if (botType === "client") {
      return handleClientBotUpdate(data);
    }

    // 2. Нажатие кнопок в Пульте руководителя (Админ-бот)
    if (data.callback_query) {
      return handleAdminCallback(data.callback_query);
    }

    // 3. Ответ руководителя (свайп/Reply на сообщение бота для вопроса клиенту или смены суммы)
    if (data.message && data.message.reply_to_message) {
      return handleAdminReply(data.message);
    }

    // 4. Honeypot-фильтр от спам-ботов с сайта
    if (data.hp || data.company_fax_code) {
      return ContentService.createTextOutput(JSON.stringify({ status: "ignored_bot" })).setMimeType(ContentService.MimeType.JSON);
    }

    // 5. Заявка с веб-распаковщика (brief.html)
    if (data.type === "web_brief") {
      const res = processWebBriefSubmission(data);
      return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
    }

    // 6. Первичная заявка с калькулятора сайта (index.html)
    const leadRes = processNewWebsiteLead(data);
    return ContentService.createTextOutput(JSON.stringify(leadRes)).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("doPost error: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * =========================================================================
 * 3. ПЕРВИЧНАЯ ЗАЯВКА С КАЛЬКУЛЯТОРА САЙТА
 * =========================================================================
 */
function processNewWebsiteLead(lead) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  if (!sheet) {
    setupMetodikoCRM();
    sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  }

  let itemsSummary = "";
  if (Array.isArray(lead.selectedItems)) {
    itemsSummary = lead.selectedItems
      .map((item, idx) => `${idx + 1}. ${item.name} (${Number(item.price).toLocaleString("ru-RU")} ₸, ${item.days} дн.)`)
      .join("\n");
  }

  const devLangLabel = getDevLangLabel(lead.devLanguage || "ru");
  const loadPoints = calculateLoadPoints(lead.totalDays || 10, lead.devLanguage || "ru", lead.selectedItems || []);

  const rowData = [
    lead.kpNumber || "MK-" + new Date().getFullYear(),
    new Date().toLocaleString("ru-RU"),
    lead.clientName || "—",
    lead.clientOrg || "—",
    lead.clientPhone || "—",
    lead.clientEmail || "—",
    lead.clientTg || "—",
    lead.audienceCategory || "—",
    devLangLabel,
    itemsSummary,
    lead.totalPrice || 0,
    lead.totalDays || 0,
    lead.isUrgent ? "Срочно (+20%)" : "Стандарт",
    STATUSES.DRAFT_KP,
    lead.totalPrice || 0,
    loadPoints,
    "", // Q: ИИ-выжимка
    "", // R: Полный бриф
    "", // S: Реквизиты
    "", // T: Дата старта
    "", // U: Плановая дата сдачи
    ""  // V: Ссылка на договор / комментарий
  ];

  sheet.appendRow(rowData);
  paintStatusCell(sheet, sheet.getLastRow(), STATUSES.DRAFT_KP);

  sendAdminCard(lead, itemsSummary, devLangLabel, loadPoints, null);
  return { status: "success", kpNumber: lead.kpNumber };
}

/**
 * =========================================================================
 * 4. ОБРАБОТКА ВЕБ-РАСПАКОВЩИКА (brief.html ДЛЯ РФ И КЛИЕНТОВ БЕЗ TELEGRAM)
 * =========================================================================
 */
function processWebBriefSubmission(payload) {
  const kpNumber = payload.kpNumber || ("MK-WEB-" + Math.floor(1000 + Math.random() * 9000));
  const lang = payload.interfaceLang || "ru";
  const category = payload.audienceCategory || "Не указано";

  // Собираем текст анкеты и при наличии — голосовое аудио с микрофона
  const rawAnswersText = [
    `1. Главная задача и эффект (Дилтс): ${payload.q1_goal || "—"}`,
    `2. Критерии результата: ${payload.q2_criteria || "—"}`,
    `3. Исходные материалы на руках: ${payload.q3_resources || "—"}`,
    `4. Команда и время со стороны заказчика: ${payload.q4_team || "—"}`,
    `5. Комфортность бюджета/сроков и дата старта: ${payload.q5_budget || "—"}`,
    `6. Специфика направления (ФКР и стандарты): ${payload.q6_fkr_branch || "—"}`,
    `7. Доп. информация и оставшиеся вопросы: ${payload.q7_extra || "—"}`,
    `8. Форма оплаты и реквизиты: ${payload.q8_requisites || "—"}`
  ].join("\n");

  const aiAnalysis = analyzeBriefWithGemini({
    kpNumber: kpNumber,
    category: category,
    lang: lang,
    rawText: rawAnswersText,
    audioBase64: payload.audioBase64 || "",
    audioMimeType: payload.audioMimeType || "audio/webm"
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  if (!sheet) {
    setupMetodikoCRM();
    sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  }

  let rowIdx = findRowByKp(sheet, kpNumber);
  const fullBriefText = aiAnalysis.transcript
    ? rawAnswersText + "\n\n[РАСШИФРОВКА ГОЛОСОВОГО СООБЩЕНИЯ]:\n" + aiAnalysis.transcript
    : rawAnswersText;

  if (rowIdx === -1) {
    // Если клиент открыл brief.html напрямую без калькулятора — создаем строку
    const newRow = [
      kpNumber,
      new Date().toLocaleString("ru-RU"),
      payload.clientName || "Клиент с сайта",
      payload.clientOrg || "—",
      payload.clientPhone || "—",
      payload.clientEmail || "—",
      payload.clientTg || "—",
      category,
      getDevLangLabel(payload.devLanguage || "ru"),
      "Заявка через веб-распаковщик",
      payload.totalPrice || 0,
      payload.totalDays || 10,
      "Стандарт",
      STATUSES.FOR_APPROVAL,
      payload.totalPrice || 0,
      calculateLoadPoints(payload.totalDays || 10, payload.devLanguage || "ru", []),
      aiAnalysis.summary,
      fullBriefText,
      aiAnalysis.requisites || payload.q8_requisites || "—",
      "", "", ""
    ];
    sheet.appendRow(newRow);
    rowIdx = sheet.getLastRow();
  } else {
    sheet.getRange(rowIdx, 14).setValue(STATUSES.FOR_APPROVAL);
    sheet.getRange(rowIdx, 17).setValue(aiAnalysis.summary);
    sheet.getRange(rowIdx, 18).setValue(fullBriefText);
    if (aiAnalysis.requisites || payload.q8_requisites) {
      sheet.getRange(rowIdx, 19).setValue(aiAnalysis.requisites || payload.q8_requisites);
    }
  }
  paintStatusCell(sheet, rowIdx, STATUSES.FOR_APPROVAL);

  // Отправляем Наталье полную карточку распаковки в Пульт
  sendBriefReadyCardToAdmin(sheet, rowIdx, aiAnalysis);

  return { status: "success", kpNumber: kpNumber };
}

/**
 * =========================================================================
 * 5. КЛИЕНТСКИЙ TELEGRAM-БОТ (БОТ №1) — ВЕДЕТ ОПРОС «МАТРЕШКА»
 * =========================================================================
 */
function handleClientBotUpdate(update) {
  const clientToken = getSecret("CLIENT_BOT_TOKEN");
  if (!clientToken) return ContentService.createTextOutput("OK");

  const msg = update.message;
  if (!msg || !msg.chat) return ContentService.createTextOutput("OK");

  const chatId = msg.chat.id.toString();
  const text = (msg.text || "").trim();

  // Старт по диплинку с сайта: /start MK-2026-123
  if (text.startsWith("/start")) {
    const kpParam = text.replace("/start", "").trim();
    startClientBriefDialog(clientToken, chatId, msg.from, kpParam);
    return ContentService.createTextOutput("OK");
  }

  // Продолжение диалога (текст, голосовое или фото реквизитов)
  processClientDialogTurn(clientToken, chatId, msg);
  return ContentService.createTextOutput("OK");
}

function startClientBriefDialog(token, chatId, fromUser, kpNumber) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let memSheet = ss.getSheetByName(CONFIG.SHEET_MEMORY);
  let leadsSheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  if (!memSheet || !leadsSheet) {
    setupMetodikoCRM();
    memSheet = ss.getSheetByName(CONFIG.SHEET_MEMORY);
    leadsSheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  }

  let category = "Корпорации и B2B";
  let lang = "ru";
  let clientName = (fromUser && fromUser.first_name) ? fromUser.first_name : "Коллега";

  if (kpNumber) {
    const r = findRowByKp(leadsSheet, kpNumber);
    if (r !== -1) {
      const vals = leadsSheet.getRange(r, 1, 1, 15).getValues()[0];
      clientName = vals[2] || clientName;
      category = vals[7] || category;
      if ((vals[8] || "").toLowerCase().includes("казах")) lang = "kz";
      leadsSheet.getRange(r, 14).setValue(STATUSES.IN_BRIEF);
      leadsSheet.getRange(r, 22).setValue("tg_chat:" + chatId);
      paintStatusCell(leadsSheet, r, STATUSES.IN_BRIEF);
    } else {
      kpNumber = "";
    }
  }

  if (!kpNumber) {
    kpNumber = "MK-TG-" + Math.floor(1000 + Math.random() * 9000);
    const tgHandle = (fromUser && fromUser.username) ? "@" + fromUser.username : ("id:" + chatId);
    leadsSheet.appendRow([
      kpNumber, new Date().toLocaleString("ru-RU"),
      clientName, "—", "—", "—", tgHandle,
      category, "Русский (из Telegram)",
      "Прямой вход в Telegram-бота", 0, 10, "Стандарт",
      STATUSES.IN_BRIEF, 0, 2, "", "", "", "", "", "tg_chat:" + chatId
    ]);
    paintStatusCell(leadsSheet, leadsSheet.getLastRow(), STATUSES.IN_BRIEF);
  }

  saveDialogState(memSheet, chatId, {
    kpNumber: kpNumber,
    category: category,
    lang: lang,
    step: 1,
    answers: {}
  });

  const q1 = getClientQuestionPrompt(1, category, lang);
  const welcome = lang === "kz"
    ? `Сәлеметсіз бе, ${escapeHtml(clientName)}! Мен «МЕТОДИКО» стандарттар бюросының ассистентімін.\n\nӨтініміңіз № <b>${kpNumber}</b> тіркелді. Бір-бірден 6 қысқа сұрақ қоямын — <b>дауыспен</b> де, мәтінмен де жауап бере аласыз.\n\n${q1}`
    : `Здравствуйте, ${escapeHtml(clientName)}! Я ассистент Бюро стандартов «МЕТОДИКО».\n\nВаша заявка № <b>${kpNumber}</b> принята. Задам 6 коротких вопросов по одному за раз — отвечать можно <b>голосом</b> или текстом.\n\n${q1}`;

  sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: welcome, parse_mode: "HTML" });
}

function processClientDialogTurn(token, chatId, msg) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const memSheet = ss.getSheetByName(CONFIG.SHEET_MEMORY);
  const state = loadDialogState(memSheet, chatId);

  if (!state || state.step >= 99) {
    startClientBriefDialog(token, chatId, msg.from, "");
    return;
  }

  let userContent = (msg.text || msg.caption || "").trim();
  let audioData = null;

  // Если клиент прислал голосовое сообщение в Telegram
  if (msg.voice || msg.audio) {
    const fileId = (msg.voice || msg.audio).file_id;
    const waitTxt = state.lang === "kz" ? "⏳ Дауыстық хабарлама өңделуде..." : "⏳ Принял голосовое, расшифровываю...";
    sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: waitTxt });
    audioData = downloadTelegramFileAsBase64(token, fileId);
    if (audioData) {
      const transcribed = transcribeAudioWithGemini(audioData.base64, audioData.mimeType);
      userContent = (userContent ? userContent + "\n" : "") + transcribed;
    } else {
      userContent = (userContent ? userContent + "\n" : "") + "[Голосовое получено, не удалось скачать файл]";
    }
  }

  if (!userContent) {
    const askText = state.lang === "kz"
      ? "Жауабыңызды мәтінмен немесе дауыстық хабарламамен жіберіңіз."
      : "Пожалуйста, отправьте ответ текстом или голосовым сообщением.";
    sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: askText });
    return;
  }

  const currentQLabel = getClientQuestionLabel(state.step);
  state.answers["step_" + state.step] = `${currentQLabel}: ${userContent}`;

  const leadsSheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  let rowIdx = findRowByKp(leadsSheet, state.kpNumber);

  // Сохраняем промежуточные ответы в столбец R сразу после каждого шага
  if (rowIdx !== -1) {
    leadsSheet.getRange(rowIdx, 18).setValue(Object.values(state.answers).join("\n\n"));
  }

  // Переходим к следующему одиночному вопросу (всего 6 вопросов)
  if (state.step < 6) {
    state.step += 1;
    saveDialogState(memSheet, chatId, state);
    const nextQ = getClientQuestionPrompt(state.step, state.category, state.lang);
    sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: nextQ, parse_mode: "HTML" });
    return;
  }

  // Финал (Вопрос 6 пройден) — анализируем весь диалог и передаем Наталье
  const fullRaw = Object.values(state.answers).join("\n\n---\n\n");
  const aiAnalysis = analyzeBriefWithGemini({
    kpNumber: state.kpNumber,
    category: state.category,
    lang: state.lang,
    rawText: fullRaw,
    audioBase64: "",
    audioMimeType: ""
  });

  if (rowIdx === -1) {
    leadsSheet.appendRow([
      state.kpNumber, new Date().toLocaleString("ru-RU"),
      (msg.from && msg.from.first_name) || "Клиент TG", "—", "—", "—",
      msg.from && msg.from.username ? "@" + msg.from.username : chatId,
      state.category, state.lang === "kz" ? "Казахский (+10%)" : "Русский",
      "Бриф через Telegram-бота", 0, 10, "Стандарт",
      STATUSES.FOR_APPROVAL, 0, 2, aiAnalysis.summary, fullRaw, aiAnalysis.requisites || "—", "", "", "tg_chat:" + chatId
    ]);
    rowIdx = leadsSheet.getLastRow();
  } else {
    leadsSheet.getRange(rowIdx, 14).setValue(STATUSES.FOR_APPROVAL);
    leadsSheet.getRange(rowIdx, 17).setValue(aiAnalysis.summary);
    leadsSheet.getRange(rowIdx, 18).setValue(fullRaw);
    leadsSheet.getRange(rowIdx, 19).setValue(aiAnalysis.requisites || "—");
    leadsSheet.getRange(rowIdx, 22).setValue("tg_chat:" + chatId);
  }
  paintStatusCell(leadsSheet, rowIdx, STATUSES.FOR_APPROVAL);

  sendBriefReadyCardToAdmin(leadsSheet, rowIdx, aiAnalysis);

  const bye = state.lang === "kz"
    ? `✅ Рахмет! Барлық 6 жауап Наталья Коденцеваға жіберілді. Тексеруден кейін сізге нақты ТЖ мен шарт жіберіледі.`
    : `✅ Благодарим! Все 6 ответов переданы руководителю Бюро Наталье Коденцевой. После проверки вы получите итоговое ТЗ и договор.`;
  sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: bye });

  state.step = 99;
  saveDialogState(memSheet, chatId, state);
}

/**
 * =========================================================================
 * 6. ПУЛЬТ РУКОВОДИТЕЛЯ (БОТ №2): КАРТОЧКИ, КНОПКИ, ДОП.ВОПРОСЫ, ОЧЕРЕДЬ, ДОГОВОР
 * =========================================================================
 */
function sendAdminCard(lead, itemsSummary, devLangLabel, loadPoints) {
  const token = getSecret("ADMIN_BOT_TOKEN");
  const adminChatId = getSecret("ADMIN_CHAT_ID");
  if (!token || !adminChatId) return;

  const cleanPhone = (lead.clientPhone || "").replace(/[^\d+]/g, "");
  const waLink = cleanPhone ? "https://wa.me/" + cleanPhone.replace("+", "") : "";
  const urgentBadge = lead.isUrgent ? "⚡ <b>СРОЧНЫЙ РЕЖИМ (+20%)</b>\n" : "";

  let msgText = `🔔 <b>НОВАЯ ЗАЯВКА С КАЛЬКУЛЯТОРА: ${lead.kpNumber}</b>\n`;
  msgText += `━━━━━━━━━━━━━━━━━━━━\n`;
  msgText += `👤 <b>Заказчик:</b> ${escapeHtml(lead.clientName)}\n`;
  msgText += `🏢 <b>Организация:</b> ${escapeHtml(lead.clientOrg)}\n`;
  msgText += `📞 <b>Телефон:</b> <code>${escapeHtml(lead.clientPhone)}</code>\n`;
  msgText += `🎯 <b>Направление:</b> ${escapeHtml(lead.audienceCategory)}\n`;
  msgText += `🌐 <b>Язык материалов:</b> ${escapeHtml(devLangLabel)} (вес: ${loadPoints} б.)\n`;
  msgText += `${urgentBadge}`;
  msgText += `📋 <b>Модули:</b>\n${escapeHtml(itemsSummary)}\n\n`;
  msgText += `💰 <b>Смета:</b> <b>${Number(lead.totalPrice).toLocaleString("ru-RU")} ₸</b> | ⏱ <b>${lead.totalDays} раб. дн.</b>\n`;
  msgText += `<i>Статус: Ожидает прохождения брифа клиентом</i>`;

  const keyboard = [];
  if (waLink) keyboard.push([{ text: "📱 Написать в WhatsApp", url: waLink }]);
  keyboard.push([{ text: "📄 Открыть Google Таблицу", url: SpreadsheetApp.getActiveSpreadsheet().getUrl() }]);

  sendTelegramApi(token, "sendMessage", {
    chat_id: adminChatId,
    text: msgText,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: keyboard }
  });
}

function sendBriefReadyCardToAdmin(sheet, rowIdx, aiAnalysis) {
  const token = getSecret("ADMIN_BOT_TOKEN");
  const adminChatId = getSecret("ADMIN_CHAT_ID");
  if (!token || !adminChatId) return;

  const row = sheet.getRange(rowIdx, 1, 1, 22).getValues()[0];
  const kpNumber = row[0];
  const cleanPhone = (row[4] || "").toString().replace(/[^\d+]/g, "");
  const waLink = cleanPhone ? "https://wa.me/" + cleanPhone.replace("+", "") : "";

  let text = `🟣➡️🔵 <b>БРИФ ПРОЙДЕН! НА УТВЕРЖДЕНИИ: ${kpNumber}</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `👤 <b>${escapeHtml(row[2])}</b> (${escapeHtml(row[3])})\n`;
  text += `🎯 ${escapeHtml(row[7])} | 🌐 ${escapeHtml(row[8])}\n`;
  text += `💰 Смета: <b>${Number(row[14] || row[10]).toLocaleString("ru-RU")} ₸</b> | ⏱ ${row[11]} раб. дн. | ⚖️ ${row[15]} б.\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `<b>📌 ВЫЖИМКА (Дилтс / ФКР / Ресурсы):</b>\n${escapeHtml(aiAnalysis.summary)}\n\n`;
  text += `<b>🏦 РЕКВИЗИТЫ ДЛЯ ДОГОВОРА:</b>\n${escapeHtml(aiAnalysis.requisites || row[18] || "Не указаны")}`;

  const kb = [
    [
      { text: "✅ Утвердить + Собрать Договор", callback_data: `approve_${kpNumber}` },
      { text: "❓ Задать доп. вопрос", callback_data: `ask_${kpNumber}` }
    ],
    [
      { text: "💰 100% оплачено — В ГРАФИК", callback_data: `paid_${kpNumber}` },
      { text: "✏️ Изменить сумму", callback_data: `edit_${kpNumber}` }
    ]
  ];
  if (waLink) kb.push([{ text: "📱 Открыть WhatsApp клиента", url: waLink }]);

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
  const chatId = callbackQuery.message.chat.id;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);

  if (data.startsWith("approve_")) {
    const kp = data.replace("approve_", "");
    const rowIdx = findRowByKp(sheet, kp);
    if (rowIdx !== -1) {
      sheet.getRange(rowIdx, 14).setValue(STATUSES.CONTRACT_SENT);
      paintStatusCell(sheet, rowIdx, STATUSES.CONTRACT_SENT);
      const docUrl = tryGenerateContractDoc(sheet, rowIdx);
      const replyTxt = docUrl
        ? `✅ <b>КП ${kp} утверждено!</b>\nСтатус изменен на: <i>${STATUSES.CONTRACT_SENT}</i>\n\n📄 <b>Черновик договора (100% предоплата) готов:</b>\n${docUrl}`
        : `✅ <b>КП ${kp} утверждено!</b>\nСтатус изменен на: <i>${STATUSES.CONTRACT_SENT}</i>\n<i>(Чтобы договор собирался автоматически в Google Docs, добавьте CONTRACT_TEMPLATE_ID в настройки скрипта).</i>`;
      sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: replyTxt, parse_mode: "HTML" });
    }
  } else if (data.startsWith("paid_")) {
    const kp = data.replace("paid_", "");
    const result = scheduleProjectIntoQueue(kp);
    sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: result.adminMessage, parse_mode: "HTML" });
  } else if (data.startsWith("ask_")) {
    const kp = data.replace("ask_", "");
    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `❓ <b>Доп. вопрос по ${kp}</b>\nСделайте Reply (Ответить) на это сообщение и напишите текст вопроса для клиента.`,
      parse_mode: "HTML"
    });
  } else if (data.startsWith("edit_")) {
    const kp = data.replace("edit_", "");
    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `✏️ <b>Корректировка суммы по ${kp}</b>\nСделайте Reply (Ответить) на это сообщение в формате:\n<code>420000 Убрали 1 модуль, согласовали скидку</code>`,
      parse_mode: "HTML"
    });
  }

  return ContentService.createTextOutput("OK");
}

function handleAdminReply(msg) {
  const token = getSecret("ADMIN_BOT_TOKEN");
  const clientToken = getSecret("CLIENT_BOT_TOKEN");
  const replyText = (msg.reply_to_message && msg.reply_to_message.text) ? msg.reply_to_message.text : "";
  const matchKp = replyText.match(/MK-[A-Z0-9-]+/);
  if (!matchKp) return ContentService.createTextOutput("OK");

  const kp = matchKp[0];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  const rowIdx = findRowByKp(sheet, kp);
  if (rowIdx === -1) return ContentService.createTextOutput("OK");

  const userText = (msg.text || "").trim();

  // Вариант 1: Ответили на запрос доп. вопроса клиенту
  if (replyText.includes("Доп. вопрос по")) {
    sheet.getRange(rowIdx, 14).setValue(STATUSES.EXTRA_QUESTION);
    paintStatusCell(sheet, rowIdx, STATUSES.EXTRA_QUESTION);
    const oldBrief = sheet.getRange(rowIdx, 18).getValue() || "";
    sheet.getRange(rowIdx, 18).setValue(oldBrief + "\n\n[ДОП. ВОПРОС ОТ НАТАЛЬИ]: " + userText);

    const meta = (sheet.getRange(rowIdx, 22).getValue() || "").toString();
    const matchTgChat = meta.match(/tg_chat:(\d+)/);
    if (matchTgChat && clientToken) {
      sendTelegramApi(clientToken, "sendMessage", {
        chat_id: matchTgChat[1],
        text: `💬 <b>Уточнение от Натальи Коденцевой по проекту ${kp}:</b>\n\n${escapeHtml(userText)}`,
        parse_mode: "HTML"
      });
      sendTelegramApi(token, "sendMessage", { chat_id: msg.chat.id, text: `✅ Вопрос отправлен клиенту по ${kp} в Telegram!` });
    } else {
      sendTelegramApi(token, "sendMessage", {
        chat_id: msg.chat.id,
        text: `📋 Клиент оформлял заявку через сайт (без Telegram-бота). Скопируйте и отправьте ему в WhatsApp:\n\n<code>Здравствуйте! По вашему проекту ${kp} уточнение от Натальи Коденцевой: ${escapeHtml(userText)}</code>`,
        parse_mode: "HTML"
      });
    }
    return ContentService.createTextOutput("OK");
  }

  // Вариант 2: Корректировка сметы
  const matchPrice = userText.match(/^(\d+)(.*)/);
  if (matchPrice) {
    const newPrice = parseInt(matchPrice[1], 10);
    const comment = matchPrice[2].trim();
    sheet.getRange(rowIdx, 15).setValue(newPrice);
    if (comment) sheet.getRange(rowIdx, 22).setValue(comment);
    sendTelegramApi(token, "sendMessage", {
      chat_id: msg.chat.id,
      text: `✅ Смета по <b>${kp}</b> обновлена: <b>${newPrice.toLocaleString("ru-RU")} ₸</b>`,
      parse_mode: "HTML"
    });
  }

  return ContentService.createTextOutput("OK");
}

/**
 * =========================================================================
 * 7. СИСТЕМА ОЧЕРЕДНОСТИ И ГРАФИКА ЗАГРУЗКИ (ПОТОЛОК 10 БАЛЛОВ)
 * =========================================================================
 */
function scheduleProjectIntoQueue(kpNumber) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  const rowIdx = findRowByKp(sheet, kpNumber);
  if (rowIdx === -1) return { adminMessage: "❌ Заявка " + kpNumber + " не найдена." };

  const row = sheet.getRange(rowIdx, 1, 1, 22).getValues()[0];
  const devLang = row[8] || "Русский";
  let days = parseInt(row[11] || 10, 10);
  if (devLang.toLowerCase().includes("казах") && !row[9].toString().includes("с учетом языка")) {
    // Страховка: +10% времени на вычитку казаховеда
    days = Math.ceil(days * 1.1);
    sheet.getRange(rowIdx, 12).setValue(days);
  }

  const projectPoints = parseFloat(row[15] || 2);
  const queueInfo = getPublicQueueStatus();

  let startDate = addWorkingDays(new Date(), 1); // Строго следующий рабочий день
  let newStatus = STATUSES.IN_WORK;

  if (queueInfo.usedPoints + projectPoints > CONFIG.MAX_CAPACITY_POINTS) {
    newStatus = STATUSES.IN_QUEUE;
    startDate = queueInfo.nextFreeDateObj;
  }

  const endDate = addWorkingDays(startDate, days);
  sheet.getRange(rowIdx, 14).setValue(newStatus);
  sheet.getRange(rowIdx, 20).setValue(formatDateRu(startDate));
  sheet.getRange(rowIdx, 21).setValue(formatDateRu(endDate));
  paintStatusCell(sheet, rowIdx, newStatus);

  recalculateQueueSheet();

  const clientNotice = `Здравствуйте, ${row[2]}! 100% оплата и исходные материалы получены. Ваш проект № ${kpNumber} включен в производственный график Бюро «МЕТОДИКО».\n• Статус: ${newStatus === STATUSES.IN_WORK ? "В работе (активный слот)" : "В очереди (забронирована дата старта)"}\n• Дата начала работ: ${formatDateRu(startDate)}\n• Плановая дата сдачи: ${formatDateRu(endDate)}`;

  return {
    adminMessage: `📅 <b>Проект ${kpNumber} поставлен в график!</b>\nСтатус: ${newStatus}\nВес: ${projectPoints} б. | Срок: ${days} раб. дн.\nСтарт: <b>${formatDateRu(startDate)}</b> ➔ Сдача: <b>${formatDateRu(endDate)}</b>\n\n<b>Готовое уведомление для клиента (можно переслать):</b>\n<code>${escapeHtml(clientNotice)}</code>`
  };
}

function getPublicQueueStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  if (!sheet || sheet.getLastRow() < 2) {
    const tomorrow = addWorkingDays(new Date(), 1);
    return { usedPoints: 0, freePoints: CONFIG.MAX_CAPACITY_POINTS, activeCount: 0, nextFreeWindow: formatDateRu(tomorrow), nextFreeDateObj: tomorrow };
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 22).getValues();
  let usedPoints = 0;
  let activeCount = 0;
  let earliestEnd = null;

  data.forEach(r => {
    const st = r[13] || "";
    if (st === STATUSES.IN_WORK || st === STATUSES.IN_QUEUE) {
      usedPoints += parseFloat(r[15] || 2);
      activeCount++;
      const endDt = parseDateRu(r[20]);
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
  let queueSheet = ss.getSheetByName(CONFIG.SHEET_QUEUE);
  if (!queueSheet || !leadsSheet) return;

  setupQueueSheetLayout(queueSheet);
  if (leadsSheet.getLastRow() < 2) return;

  const data = leadsSheet.getRange(2, 1, leadsSheet.getLastRow() - 1, 22).getValues();
  const rows = [];
  let usedPoints = 0;

  data.forEach(r => {
    const st = r[13] || "";
    if (st === STATUSES.IN_WORK || st === STATUSES.IN_QUEUE) {
      const pts = parseFloat(r[15] || 2);
      usedPoints += pts;
      rows.push([
        rows.length + 1,
        r[0],
        `${r[2]} (${r[3]})`,
        `${r[7]} | ${r[8]}`,
        pts,
        st,
        `${r[19] || "—"} ➔ ${r[20] || "—"}`
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

/**
 * =========================================================================
 * 8. GEMINI API: ГОЛОС + РАЗБОР ПО ДИЛТСУ И ФКР + РЕКВИЗИТЫ
 * =========================================================================
 */
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
Проанализируй ответы клиента по заявке ${input.kpNumber} (направление: ${input.category}, язык интерфейса: ${input.lang}).
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
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const resp = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ contents: [{ parts: parts }] }),
      muteHttpExceptions: true
    });
    const json = JSON.parse(resp.getContentText());
    const rawOut = json.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
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

function transcribeAudioWithGemini(base64Audio, mimeType) {
  const apiKey = getSecret("GEMINI_API_KEY");
  if (!apiKey || !base64Audio) return "[Аудио получено, но GEMINI_API_KEY не задан]";
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const resp = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        contents: [{
          parts: [
            { text: "Расшифруй это голосовое сообщение дословно на том языке, на котором говорит клиент (русский или казахский), сохраняя смысл и термины." },
            { inline_data: { mime_type: mimeType || "audio/ogg", data: base64Audio } }
          ]
        }]
      }),
      muteHttpExceptions: true
    });
    const json = JSON.parse(resp.getContentText());
    return json.candidates[0].content.parts[0].text.trim();
  } catch (e) {
    return "[Ошибка распознавания голоса: " + e.toString() + "]";
  }
}

/**
 * =========================================================================
 * 9. АВТОСБОРКА ЧЕРНОВИКА ДОГОВОРА В GOOGLE DOCS (ОПЦИОНАЛЬНО ПО TEMPLATE_ID)
 * =========================================================================
 */
function tryGenerateContractDoc(sheet, rowIdx) {
  const templateId = getSecret("CONTRACT_TEMPLATE_ID");
  if (!templateId) return "";

  try {
    const row = sheet.getRange(rowIdx, 1, 1, 22).getValues()[0];
    const templateFile = DriveApp.getFileById(templateId);
    const copyFile = templateFile.makeCopy(`Договор_${row[0]}_${row[3] || row[2]}`);
    const doc = DocumentApp.openById(copyFile.getId());
    const body = doc.getBody();

    body.replaceText("{{KP_NUMBER}}", row[0] || "");
    body.replaceText("{{DATE}}", formatDateRu(new Date()));
    body.replaceText("{{CLIENT_NAME}}", row[2] || "");
    body.replaceText("{{CLIENT_ORG}}", row[3] || "");
    body.replaceText("{{REQUISITES}}", row[18] || "");
    body.replaceText("{{TOTAL_PRICE}}", Number(row[14] || row[10] || 0).toLocaleString("ru-RU"));
    body.replaceText("{{TOTAL_DAYS}}", String(row[11] || 14));
    body.replaceText("{{PAYMENT_TERMS}}", "100% предоплата до начала работ, старт на следующий рабочий день");
    doc.saveAndClose();

    const url = copyFile.getUrl();
    sheet.getRange(rowIdx, 22).setValue(url);
    return url;
  } catch (err) {
    Logger.log("Contract gen error: " + err.toString());
    return "";
  }
}

/**
 * =========================================================================
 * 10. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (ДАТЫ, БАЛЛЫ, ЦВЕТА, ЯЗЫКИ, TELEGRAM)
 * =========================================================================
 */
function getDevLangLabel(code) {
  if (code === "kz") return "Только казахский (+10% цена и срок)";
  if (code === "both") return "На двух языках RU+KZ (+25% цена)";
  return "Только русский (база)";
}

function calculateLoadPoints(days, devLang, selectedItems) {
  let base = 2;
  if (days <= 7) base = 1;
  else if (days >= 15 || (selectedItems && selectedItems.length >= 3)) base = 3;

  if (devLang === "kz") return base + 0.5;
  if (devLang === "both") return base + 1;
  return base;
}

function getClientQuestionLabel(step) {
  const labels = {
    1: "1. Главная задача (Дилтс)",
    2: "2. Критерии результата",
    3: "3. Материалы и команда",
    4: "4. Отраслевая специфика (ФКР)",
    5: "5. Сроки и доп. вопросы",
    6: "6. Оплата и реквизиты"
  };
  return labels[step] || ("Вопрос " + step);
}

function getClientQuestionPrompt(step, category, lang) {
  if (lang === "kz") {
    const mapKz = {
      1: "<b>6-дан 1-сұрақ.</b> Бұл жоба қандай басты міндетті шешуі керек?",
      2: "<b>6-дан 2-сұрақ.</b> Жобаның 100% сәтті іске асқанын қандай нақты нәтижелер бойынша бағалайсыз?",
      3: "<b>6-дан 3-сұрақ.</b> Қолыңызда қандай дайын материалдар бар (презентация, аудио/видео, бағдарлама) және жобаға сіздің тарапыңыздан кім қатысады?",
      4: getBranchQuestionText(category, "kz"),
      5: "<b>6-дан 5-сұрақ.</b> Жобаны қашан бастау ыңғайлы және тағы нені ескеруіміз керек (қалған сұрақтарыңыз болса жазыңыз)?",
      6: "<b>6-дан 6-сұрақ.</b> Төлемді қалай жоспарлайсыз (ЖШС / ЖК / жеке тұлға)? Шарт үшін деректемелерді жіберіңіз (немесе «кейін жіберемін» деп жазыңыз)."
    };
    return mapKz[step] || mapKz[6];
  }
  const mapRu = {
    1: "<b>Вопрос 1 из 6.</b> Какую главную задачу должен решить этот проект?",
    2: "<b>Вопрос 2 из 6.</b> По каким конкретным результатам вы поймете, что проект сработал на 100%?",
    3: "<b>Вопрос 3 из 6.</b> Какие материалы уже есть на руках (презентации, записи, программы) и кто будет в команде с вашей стороны?",
    4: getBranchQuestionText(category, "ru"),
    5: "<b>Вопрос 5 из 6.</b> Когда вам комфортно стартовать и что ещё нам важно знать о проекте (опишите оставшиеся вопросы)?",
    6: "<b>Вопрос 6 из 6.</b> Как планируете оплату (ТОО / ИП / физлицо)? Напишите реквизиты организации для договора (или «отправлю позже»)."
  };
  return mapRu[step] || mapRu[6];
}

function getBranchQuestionText(category, lang) {
  const c = (category || "").toLowerCase();
  if (lang === "kz") {
    if (c.includes("жоо") || c.includes("вуз") || c.includes("колледж")) {
      return "<b>6-дан 4-сұрақ (ЖОО / Колледж).</b> Пән атауын, кредит санын және қандай LMS (Platonus/Moodle) қолданатыныңызды жазыңыз.";
    }
    if (c.includes("мектеп") || c.includes("школ") || c.includes("ұстаз")) {
      return "<b>6-дан 4-сұрақ (Мектеп / «Ұстаз»).</b> Пәнді, сыныпты, сағат көлемін (34 немесе 68 сағат) және педагог растайтын санатты (педагог-модератор, сарапшы, зерттеуші, шебер) көрсетіңіз.";
    }
    if (c.includes("edtech") || c.includes("онлайн")) {
      return "<b>6-дан 4-сұрақ (EdTech / Курстар).</b> Бұл қолданыстағы курсты жандандыру ма (қазіргі COR % қандай?) әлде аудиодан жаңа курс құрастыру ма?";
    }
    return "<b>6-дан 4-сұрақ (Корпоративтік B2B).</b> Кімді оқытамыз (стажер, менеджер, басшы) және сатылым қай кезеңде жиі үзіледі?";
  }

  if (c.includes("вуз") || c.includes("колледж")) {
    return "<b>Вопрос 4 из 6 (ВУЗ / Колледж).</b> Напишите название дисциплины, количество кредитов ECTS и используемую платформу (Platonus/Moodle).";
  }
  if (c.includes("школ") || c.includes("ұстаз")) {
    return "<b>Вопрос 4 из 6 (Школа / Аттестация).</b> Укажите предмет, класс, объём (34 или 68 часов) и подтверждаемую категорию педагога (педагог-модератор, эксперт, исследователь, мастер).";
  }
  if (c.includes("edtech") || c.includes("онлайн")) {
    return "<b>Вопрос 4 из 6 (EdTech и курсы).</b> Это реанимация действующего курса (какой сейчас % доходимости COR?) или сборка с нуля из аудиозаписей?";
  }
  return "<b>Вопрос 4 из 6 (Корпоративный B2B).</b> Кого именно обучаем (стажёры, менеджеры, руководители) и на каком этапе чаще всего теряются сделки?";
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
    if (ids[i][0] === kpNumber) return i + 2;
  }
  return -1;
}

function paintStatusCell(sheet, rowIdx, statusText) {
  const cell = sheet.getRange(rowIdx, 14);
  let bg = "#F1F5F9";
  if (statusText.includes("🟡")) bg = "#FEF9C3";
  else if (statusText.includes("🟣")) bg = "#F3E8FF";
  else if (statusText.includes("🔵")) bg = "#DBEAFE";
  else if (statusText.includes("🟠")) bg = "#FFEDD5";
  else if (statusText.includes("🟢")) bg = "#DCFCE7";
  else if (statusText.includes("📅")) bg = "#FEF3C7";
  else if (statusText.includes("✅")) bg = "#BBF7D0";
  cell.setBackground(bg).setFontWeight("bold");
}

function saveDialogState(memSheet, chatId, state) {
  if (!memSheet) return;
  const data = memSheet.getDataRange().getValues();
  const rowVals = [chatId, state.kpNumber, state.category, state.lang, state.step, JSON.stringify(state.answers), new Date().toLocaleString("ru-RU")];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(chatId)) {
      memSheet.getRange(i + 1, 1, 1, 7).setValues([rowVals]);
      return;
    }
  }
  memSheet.appendRow(rowVals);
}

function loadDialogState(memSheet, chatId) {
  if (!memSheet) return null;
  const data = memSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(chatId)) {
      return {
        kpNumber: data[i][1],
        category: data[i][2],
        lang: data[i][3],
        step: parseInt(data[i][4], 10) || 1,
        answers: JSON.parse(data[i][5] || "{}")
      };
    }
  }
  return null;
}

function downloadTelegramFileAsBase64(token, fileId) {
  try {
    const fileMetaResp = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const meta = JSON.parse(fileMetaResp.getContentText());
    if (!meta.ok) return null;
    const filePath = meta.result.file_path;
    const blob = UrlFetchApp.fetch(`https://api.telegram.org/file/bot${token}/${filePath}`).getBlob();
    return {
      base64: Utilities.base64Encode(blob.getBytes()),
      mimeType: filePath.endsWith(".ogg") || filePath.endsWith(".oga") ? "audio/ogg" : (blob.getContentType() || "audio/ogg")
    };
  } catch (e) {
    return null;
  }
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
