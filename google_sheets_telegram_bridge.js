/**
 * =========================================================================
 * ТОО «Метод и Ко» | Бюро стандартов «МЕТОДИКО»
 * УМНЫЙ ОБЛАЧНЫЙ МОСТ v4.0:
 * САЙТ (index.html + brief.html + client.html) ➔ GOOGLE ТАБЛИЦА ➔ 2 БОТА + GEMINI
 * =========================================================================
 * Секретные ключи хранятся ТОЛЬКО в «Настройки проекта -> Свойства скрипта»:
 *   - ADMIN_BOT_TOKEN      : токен личного пульта (@metodico_sait_zayavki_bot)
 *   - ADMIN_CHAT_ID        : ваш личный Telegram ID
 *   - CLIENT_BOT_TOKEN     : токен клиентского бота (@metodico_brif_bot)
 *   - GEMINI_API_KEY       : ключ из Google AI Studio
 *   - CONTRACT_TEMPLATE_ID : ID Google Документа шаблона договора (опционально)
 *   - PORTAL_SECRET        : секрет для подписей клиентских ссылок (опционально)
 * =========================================================================
 */

const CONFIG = {
  SHEET_LEADS: "Заявки МЕТОДИКО",
  SHEET_QUEUE: "График и Очередь",
  SHEET_MEMORY: "Память диалогов",
  COMPANY_NAME: "ТОО «Метод и Ко» | Бюро «МЕТОДИКО»",
  SITE_URL: "https://metodico-kz.netlify.app",
  MAX_CAPACITY_POINTS: 10, // Потолок одновременной загрузки (5-7 активных проектов)
  GEMINI_MODEL: "gemini-3.5-flash-lite"
};

// Карта столбцов листа «Заявки МЕТОДИКО» (1-based)
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
  DEAL_JSON: 24
};

const STATUSES = {
  DRAFT_KP: "🟡 1. Черновик КП (с сайта)",
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
  DONE: "✅ 12. Сдано / АВР подписан"
};

function getSecret(key, fallback) {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(key) || fallback || "";
}

/**
 * =========================================================================
 * 1. ПЕРВИЧНАЯ НАСТРОЙКА ВСЕХ 3 ЛИСТОВ ТАБЛИЦЫ (БЕЗОПАСНО ДЛЯ ТЕКУЩИХ ДАННЫХ)
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
    "Ссылка на Договор / tg_chat",    // V (22)
    "Папка материалов (Google Диск)", // W (23)
    "Состояние сделки (JSON)"         // X (24)
  ];

  leadsSheet.getRange(1, 1, 1, leadHeaders.length).setValues([leadHeaders]);
  leadsSheet.getRange(1, 1, 1, leadHeaders.length)
    .setFontWeight("bold")
    .setBackground("#152238")
    .setFontColor("#FFFFFF")
    .setWrap(true);
  leadsSheet.setFrozenRows(1);

  let queueSheet = ss.getSheetByName(CONFIG.SHEET_QUEUE);
  if (!queueSheet) queueSheet = ss.insertSheet(CONFIG.SHEET_QUEUE);
  setupQueueSheetLayout(queueSheet);

  let memSheet = ss.getSheetByName(CONFIG.SHEET_MEMORY);
  if (!memSheet) memSheet = ss.insertSheet(CONFIG.SHEET_MEMORY);
  const memHeaders = ["Chat ID", "ID КП", "Категория", "Язык общения", "Шаг", "Собранные ответы (JSON)", "Обновлено"];
  memSheet.getRange(1, 1, 1, memHeaders.length).setValues([memHeaders]);
  memSheet.getRange(1, 1, 1, memHeaders.length).setFontWeight("bold").setBackground("#1E293B").setFontColor("#FFFFFF");
  memSheet.setFrozenRows(1);

  recalculateQueueSheet();
}

function ensureExtendedColumns(sheet) {
  if (!sheet) return;
  if (!sheet.getRange(1, COL.DRIVE_LINK).getValue()) {
    sheet.getRange(1, COL.DRIVE_LINK).setValue("Папка материалов (Google Диск)")
      .setFontWeight("bold").setBackground("#152238").setFontColor("#FFFFFF").setWrap(true);
  }
  if (!sheet.getRange(1, COL.DEAL_JSON).getValue()) {
    sheet.getRange(1, COL.DEAL_JSON).setValue("Состояние сделки (JSON)")
      .setFontWeight("bold").setBackground("#152238").setFontColor("#FFFFFF").setWrap(true);
  }
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
 * 2. ОБРАБОТКА ВХОДЯЩИХ ЗАПРОСОВ: GET (ОЧЕРЕДЬ + ПОРТАЛ КЛИЕНТА) И POST
 * =========================================================================
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = params.action || "";

    if (action === "queue_status") {
      return jsonResponse(getPublicQueueStatus());
    }
    if (action === "client_portal") {
      return jsonResponse(getClientPortalState(params.kp || "", params.t || ""));
    }
    return jsonResponse({ status: "ok", service: "METODIKO Bridge v4.0" });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
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

    // 1. Клиентский Telegram-бот (?bot=client)
    if (botType === "client") {
      return handleClientBotUpdate(data);
    }

    // 2. Кнопки в Пульте руководителя (Админ-бот)
    if (data.callback_query) {
      return handleAdminCallback(data.callback_query);
    }

    // 3. Текстовое сообщение в Пульте руководителя (Reply ИЛИ активное ожидание ввода)
    if (data.message) {
      const adminChatId = getSecret("ADMIN_CHAT_ID");
      if (adminChatId && data.message.chat && String(data.message.chat.id) === String(adminChatId)) {
        return handleAdminMessage(data.message);
      }
      return ContentService.createTextOutput("OK");
    }

    // 4. Honeypot-фильтр от спам-ботов с сайта
    if (data.hp || data.company_fax_code) {
      return jsonResponse({ status: "ignored_bot" });
    }

    // 5. Действие с клиентского веб-портала (client.html)
    if (data.type === "client_portal_action") {
      return jsonResponse(handleClientPortalPost(data));
    }

    // 6. Заявка с веб-распаковщика (brief.html)
    if (data.type === "web_brief") {
      return jsonResponse(processWebBriefSubmission(data));
    }

    // 7. Первичная заявка с калькулятора сайта (index.html)
    return jsonResponse(processNewWebsiteLead(data));

  } catch (error) {
    Logger.log("doPost error: " + error.toString());
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * =========================================================================
 * 3. ПЕРВИЧНАЯ ЗАЯВКА С КАЛЬКУЛЯТОРА САЙТА И ВЕБ-РАСПАКОВЩИК
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

  let itemsSummary = "";
  if (Array.isArray(lead.selectedItems)) {
    itemsSummary = lead.selectedItems
      .map((item, idx) => `${idx + 1}. ${item.name} (${Number(item.price).toLocaleString("ru-RU")} ₸, ${item.days} дн.)`)
      .join("\n");
  }

  const kpNumber = lead.kpNumber || ("MK-" + new Date().getFullYear() + "-" + Math.floor(100 + Math.random() * 900));
  const devLangLabel = getDevLangLabel(lead.devLanguage || "ru");
  const loadPoints = calculateLoadPoints(lead.totalDays || 10, lead.devLanguage || "ru", lead.selectedItems || []);
  const chatLang = (lead.interfaceLang === "kz" || detectKazakhSentence(lead.audienceCategory)) ? "kz" : "ru";

  const dealInit = { chatLang: chatLang, devLanguageCode: lead.devLanguage || "ru" };

  const rowData = [
    kpNumber,
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
    "", // V: Договор / tg_chat
    "", // W: Папка Google Диск
    JSON.stringify(dealInit) // X: Deal state
  ];

  sheet.appendRow(rowData);
  const rowIdx = sheet.getLastRow();
  paintStatusCell(sheet, rowIdx, STATUSES.DRAFT_KP);

  const portalToken = generatePortalToken(kpNumber);
  const portalUrl = getClientPortalUrl(kpNumber);
  sendAdminCard(lead, kpNumber, itemsSummary, devLangLabel, loadPoints, portalUrl);
  return { status: "success", kpNumber: kpNumber, portalToken: portalToken, portalUrl: portalUrl };
}

function processWebBriefSubmission(payload) {
  const kpNumber = payload.kpNumber || ("MK-WEB-" + Math.floor(1000 + Math.random() * 9000));
  const chatLang = payload.interfaceLang === "kz" ? "kz" : "ru";
  const category = payload.audienceCategory || "Не указано";

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
    lang: chatLang,
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
  ensureExtendedColumns(sheet);

  let rowIdx = findRowByKp(sheet, kpNumber);
  const fullBriefText = aiAnalysis.transcript
    ? rawAnswersText + "\n\n[РАСШИФРОВКА ГОЛОСОВОГО СООБЩЕНИЯ]:\n" + aiAnalysis.transcript
    : rawAnswersText;
  const devCode = payload.devLanguage || "ru";

  if (rowIdx === -1) {
    const newRow = [
      kpNumber,
      new Date().toLocaleString("ru-RU"),
      payload.clientName || "Клиент с сайта",
      payload.clientOrg || "—",
      payload.clientPhone || "—",
      payload.clientEmail || "—",
      payload.clientTg || "—",
      category,
      getDevLangLabel(devCode),
      "Заявка через веб-распаковщик",
      payload.totalPrice || 0,
      payload.totalDays || 10,
      "Стандарт",
      STATUSES.FOR_APPROVAL,
      payload.totalPrice || 0,
      calculateLoadPoints(payload.totalDays || 10, devCode, []),
      aiAnalysis.summary,
      fullBriefText,
      aiAnalysis.requisites || payload.q8_requisites || "—",
      "", "", "",
      (payload.driveLink || "").trim(),
      JSON.stringify({ chatLang: chatLang, devLanguageCode: devCode })
    ];
    sheet.appendRow(newRow);
    rowIdx = sheet.getLastRow();
  } else {
    if (category && category !== "Не указано") {
      sheet.getRange(rowIdx, COL.CATEGORY).setValue(category);
    }
    sheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.FOR_APPROVAL);
    sheet.getRange(rowIdx, COL.SUMMARY).setValue(aiAnalysis.summary);
    sheet.getRange(rowIdx, COL.BRIEF).setValue(fullBriefText);
    if (aiAnalysis.requisites || payload.q8_requisites) {
      sheet.getRange(rowIdx, COL.REQUISITES).setValue(aiAnalysis.requisites || payload.q8_requisites);
    }
    if (payload.driveLink) {
      sheet.getRange(rowIdx, COL.DRIVE_LINK).setValue(payload.driveLink.trim());
    }
    patchDealState(sheet, rowIdx, { chatLang: chatLang });
  }
  paintStatusCell(sheet, rowIdx, STATUSES.FOR_APPROVAL);

  sendBriefReadyCardToAdmin(sheet, rowIdx, aiAnalysis);

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
 * 4. КЛИЕНТСКИЙ TELEGRAM-БОТ (БОТ №1) — РАСПАКОВКА + КП + ДОГОВОР + ДИСК
 * =========================================================================
 */
function handleClientBotUpdate(update) {
  const clientToken = getSecret("CLIENT_BOT_TOKEN");
  if (!clientToken) return ContentService.createTextOutput("OK");

  if (update.callback_query) {
    handleClientCallbackQuery(clientToken, update.callback_query);
    return ContentService.createTextOutput("OK");
  }

  const msg = update.message;
  if (!msg || !msg.chat) return ContentService.createTextOutput("OK");

  const chatId = msg.chat.id.toString();
  const text = (msg.text || "").trim();

  if (text.startsWith("/start")) {
    const kpParam = text.replace("/start", "").trim();
    startClientBriefDialog(clientToken, chatId, msg.from, kpParam);
    return ContentService.createTextOutput("OK");
  }

  processClientDialogTurn(clientToken, chatId, msg);
  return ContentService.createTextOutput("OK");
}

function getMotivationIntro(lang) {
  return lang === "kz"
    ? "💡 <i>Мақсатыңызды, нақты сандарды және бар материалдарды неғұрлым толық әрі егжей-тегжейлі сипаттасаңыз, соғұрлым қорытынды бағдарлама мен нәтиже дәл әрі тиімді болады (дауыспен немесе толық мәтінмен жауап бере аласыз).</i>"
    : "💡 <i>Чем подробнее и полнее вы расскажете о задаче, цифрах и материалах, тем точнее и эффективнее получится итоговый стандарт и программа под ваши цели (удобно отвечать голосом или развёрнутым текстом).</i>";
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
  ensureExtendedColumns(leadsSheet);

  let category = "";
  let categoryConfirmed = false;
  let dialogLang = "ru";
  let devLanguage = "ru";
  let clientName = (fromUser && fromUser.first_name) ? fromUser.first_name : "Коллега";

  if (kpNumber) {
    const r = findRowByKp(leadsSheet, kpNumber);
    if (r !== -1) {
      const vals = leadsSheet.getRange(r, 1, 1, COL.DEAL_JSON).getValues()[0];
      clientName = vals[COL.NAME - 1] || clientName;
      category = (vals[COL.CATEGORY - 1] || "").toString();
      categoryConfirmed = Boolean(category && category !== "—");
      devLanguage = inferDevLangCode(vals[COL.DEV_LANG - 1]);

      const deal = parseJsonSafe(vals[COL.DEAL_JSON - 1], {});
      // Язык общения берём из языка интерфейса сайта, а НЕ из языка разработки!
      dialogLang = deal.chatLang || (detectKazakhSentence(category) ? "kz" : "ru");
      if (deal.devLanguageCode) devLanguage = deal.devLanguageCode;

      leadsSheet.getRange(r, COL.STATUS).setValue(STATUSES.IN_BRIEF);
      ensureTgChatInCol22(leadsSheet, r, chatId);
      paintStatusCell(leadsSheet, r, STATUSES.IN_BRIEF);
    } else {
      kpNumber = "";
    }
  }

  // Прямой вход в @metodico_brif_bot без калькулятора сайта
  if (!kpNumber) {
    kpNumber = "MK-TG-" + Math.floor(1000 + Math.random() * 9000);
    const tgHandle = (fromUser && fromUser.username) ? "@" + fromUser.username : ("id:" + chatId);
    leadsSheet.appendRow([
      kpNumber, new Date().toLocaleString("ru-RU"),
      clientName, "—", "—", "—", tgHandle,
      "Уточняется направление...", "Уточняется...",
      "Прямой вход в Telegram-бота", 0, 10, "Стандарт",
      STATUSES.IN_BRIEF, 0, 2, "", "", "", "", "", "tg_chat:" + chatId, "",
      JSON.stringify({ chatLang: "ru", devLanguageCode: "" })
    ]);
    paintStatusCell(leadsSheet, leadsSheet.getLastRow(), STATUSES.IN_BRIEF);

    saveDialogState(memSheet, chatId, {
      kpNumber: kpNumber,
      category: "",
      categoryConfirmed: false,
      lang: "ru",
      step: 0,
      answers: {}
    });

    sendCategoryChoiceMessage(token, chatId, clientName, kpNumber, "ru", null);
    return;
  }

  saveDialogState(memSheet, chatId, {
    kpNumber: kpNumber,
    category: category,
    categoryConfirmed: categoryConfirmed,
    lang: dialogLang,
    step: 1,
    answers: {}
  });

  const q1 = getClientQuestionPrompt(1, category, dialogLang);
  const intro = getMotivationIntro(dialogLang);
  const welcome = dialogLang === "kz"
    ? `Сәлеметсіз бе, ${escapeHtml(clientName)}! Мен «МЕТОДИКО» стандарттар бюросының ассистентімін.\n\nӨтініміңіз № <b>${kpNumber}</b> (${escapeHtml(category)}) тіркелді. Бір-бірден 6 негізгі сұрақ қоямын.\n${intro}\n\n${q1}`
    : `Здравствуйте, ${escapeHtml(clientName)}! Я ассистент Бюро стандартов «МЕТОДИКО».\n\nВаша заявка № <b>${kpNumber}</b> (${escapeHtml(category)}) принята. Задам 6 ключевых вопросов по одному за раз.\n${intro}\n\n${q1}`;

  const langSwitchKb = {
    inline_keyboard: [[
      dialogLang === "kz"
        ? { text: "🇷🇺 Переключить общение на русский", callback_data: "cl_chatlang:ru" }
        : { text: "🇰🇿 Қазақ тілінде сөйлесу", callback_data: "cl_chatlang:kz" }
    ]]
  };

  sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: welcome, parse_mode: "HTML", reply_markup: langSwitchKb });
}

function sendCategoryChoiceMessage(token, chatId, clientName, kpNumber, lang, editMessageId) {
  const safeName = escapeHtml(clientName || "Коллега");
  const intro = getMotivationIntro(lang);
  const text = lang === "kz"
    ? `Сәлеметсіз бе, ${safeName}! Мен «МЕТОДИКО» стандарттар бюросының ассистентімін.\n\nӨтініміңіз № <b>${kpNumber}</b> ашылды. Бір-бірден 6 негізгі сұрақ қоямын.\n${intro}\n\n<b>Дәл сұрақтарды таңдау үшін жоба бағытын көрсетіңіз:</b>`
    : `Здравствуйте, ${safeName}! Я ассистент Бюро стандартов «МЕТОДИКО».\n\nВаша заявка № <b>${kpNumber}</b> открыта. Задам 6 ключевых вопросов по одному за раз.\n${intro}\n\n<b>Выберите направление вашего проекта, чтобы я задал точные вопросы:</b>`;

  const keyboard = lang === "kz"
    ? [
        [{ text: "🎓 ЖОО және Колледждер (ОӘК / МЖМБС)", callback_data: "cl_cat:vuz" }],
        [{ text: "💼 Корпорациялар және B2B (Тренажерлер)", callback_data: "cl_cat:b2b" }],
        [{ text: "🏫 Мектептер және педагог аттестациясы («Ұстаз»)", callback_data: "cl_cat:school" }],
        [{ text: "💻 EdTech және Онлайн-курстар", callback_data: "cl_cat:edtech" }],
        [{ text: "🇷🇺 Переключить общение на русский", callback_data: "cl_lang:ru" }]
      ]
    : [
        [{ text: "🎓 ВУЗы и Колледжи (УМКД / ГОСО)", callback_data: "cl_cat:vuz" }],
        [{ text: "💼 Корпорации и B2B (Тренажёры)", callback_data: "cl_cat:b2b" }],
        [{ text: "🏫 Школы и Аттестация педагогов («Ұстаз»)", callback_data: "cl_cat:school" }],
        [{ text: "💻 EdTech и Онлайн-школы", callback_data: "cl_cat:edtech" }],
        [{ text: "🇰🇿 Қазақ тілінде сөйлесу", callback_data: "cl_lang:kz" }]
      ];

  const method = editMessageId ? "editMessageText" : "sendMessage";
  const payload = { chat_id: chatId, text: text, parse_mode: "HTML", reply_markup: { inline_keyboard: keyboard } };
  if (editMessageId) payload.message_id = editMessageId;
  sendTelegramApi(token, method, payload);
}

function sendDevLangChoiceMessage(token, chatId, category, dialogLang, editMessageId) {
  const text = dialogLang === "kz"
    ? `✅ Бағыт таңдалды: <b>${escapeHtml(category)}</b>\n\nЕнді негізгі сұрақтар алдында маңызды нақтылау:\n<b>Дайын оқу материалдарының өзі (УМКД / курс / жаттықтырғыш) қай тілде әзірленуі керек?</b>\n<i>(Сұхбат тілі қазақша болып қала береді — бұл тек қорытынды өнімнің тілі.)</i>`
    : `✅ Направление выбрано: <b>${escapeHtml(category)}</b>\n\nКороткое уточнение перед началом вопросов:\n<b>На каком языке нужно разработать сами итоговые материалы (УМКД / курс / тренажёр)?</b>\n<i>(Язык нашего общения останется прежним — здесь выбираем только язык готового продукта.)</i>`;

  const kb = dialogLang === "kz"
    ? [
        [{ text: "🇷🇺 Тек орыс тілінде (база)", callback_data: "cl_devlang:ru" }],
        [{ text: "🇰🇿 Тек қазақ тілінде (+10% мерзім мен баға)", callback_data: "cl_devlang:kz" }],
        [{ text: "🌐 Екі тілде RU+KZ (+25% баға, +20% мерзім)", callback_data: "cl_devlang:both" }]
      ]
    : [
        [{ text: "🇷🇺 Только на русском (база)", callback_data: "cl_devlang:ru" }],
        [{ text: "🇰🇿 Только на казахском (+10% цена и срок)", callback_data: "cl_devlang:kz" }],
        [{ text: "🌐 На двух языках RU+KZ (+25% цена, +20% срок)", callback_data: "cl_devlang:both" }]
      ];

  const method = editMessageId ? "editMessageText" : "sendMessage";
  const payload = { chat_id: chatId, text: text, parse_mode: "HTML", reply_markup: { inline_keyboard: kb } };
  if (editMessageId) payload.message_id = editMessageId;
  sendTelegramApi(token, method, payload);
}

function handleClientCallbackQuery(token, cb) {
  sendTelegramApi(token, "answerCallbackQuery", { callback_query_id: cb.id });
  const data = cb.data || "";
  const chatId = cb.message && cb.message.chat ? cb.message.chat.id.toString() : "";
  const messageId = cb.message ? cb.message.message_id : null;
  if (!chatId) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const memSheet = ss.getSheetByName(CONFIG.SHEET_MEMORY);
  const leadsSheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  let state = loadDialogState(memSheet, chatId);
  if (!state) return;

  const rowIdx = findRowByKp(leadsSheet, state.kpNumber);
  const clientName = (cb.from && cb.from.first_name) ? cb.from.first_name : "Коллега";

  // 1. Переключение ТОЛЬКО языка общения в стартовом экране (не меняет столбец I «Язык разработки»!)
  if (data.startsWith("cl_lang:")) {
    const newLang = data.split(":")[1] === "kz" ? "kz" : "ru";
    state.lang = newLang;
    saveDialogState(memSheet, chatId, state);
    if (rowIdx !== -1) patchDealState(leadsSheet, rowIdx, { chatLang: newLang });
    sendCategoryChoiceMessage(token, chatId, clientName, state.kpNumber, newLang, messageId);
    return;
  }

  // Переключение языка общения во время Шага 1 (если зашёл с сайта)
  if (data.startsWith("cl_chatlang:")) {
    const newLang = data.split(":")[1] === "kz" ? "kz" : "ru";
    state.lang = newLang;
    saveDialogState(memSheet, chatId, state);
    if (rowIdx !== -1) patchDealState(leadsSheet, rowIdx, { chatLang: newLang });
    const q1 = getClientQuestionPrompt(1, state.category, newLang);
    const switchedTxt = newLang === "kz"
      ? `✅ Сұхбат тілі қазақшаға ауыстырылды.\n\n${q1}`
      : `✅ Язык общения переключён на русский.\n\n${q1}`;
    sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: switchedTxt, parse_mode: "HTML" });
    return;
  }

  // 2. Выбор направления на прямом старте -> переходим к выбору языка САМИХ МАТЕРИАЛОВ (step = 0.5)
  if (data.startsWith("cl_cat:")) {
    const branchKey = data.split(":")[1] || "b2b";
    const canonicalCat = getCanonicalBranchName(branchKey, state.lang);
    state.category = canonicalCat;
    state.categoryConfirmed = true;
    state.step = 0.5;
    saveDialogState(memSheet, chatId, state);

    if (rowIdx !== -1) {
      leadsSheet.getRange(rowIdx, COL.CATEGORY).setValue(canonicalCat);
    }
    sendDevLangChoiceMessage(token, chatId, canonicalCat, state.lang, messageId);
    return;
  }

  // 3. Выбор языка разработки самих материалов (прямой вход) -> старт Вопроса 1
  if (data.startsWith("cl_devlang:")) {
    const devCode = data.split(":")[1] || "ru";
    const devLabel = getDevLangLabel(devCode);
    const baseDays = devCode === "kz" ? 11 : (devCode === "both" ? 12 : 10);
    const pts = calculateLoadPoints(baseDays, devCode, []);

    state.step = 1;
    saveDialogState(memSheet, chatId, state);

    if (rowIdx !== -1) {
      leadsSheet.getRange(rowIdx, COL.DEV_LANG).setValue(devLabel);
      leadsSheet.getRange(rowIdx, COL.DAYS).setValue(baseDays);
      leadsSheet.getRange(rowIdx, COL.POINTS).setValue(pts);
      leadsSheet.getRange(rowIdx, COL.MODULES).setValue("Прямой вход в Telegram-бота (с учетом языка)");
      patchDealState(leadsSheet, rowIdx, { chatLang: state.lang, devLanguageCode: devCode });
    }

    if (messageId) {
      const doneTxt = state.lang === "kz"
        ? `✅ Жоба бағыты: <b>${escapeHtml(state.category)}</b>\n🌐 Материал тілі: <b>${escapeHtml(devLabel)}</b>`
        : `✅ Направление: <b>${escapeHtml(state.category)}</b>\n🌐 Язык материалов: <b>${escapeHtml(devLabel)}</b>`;
      sendTelegramApi(token, "editMessageText", { chat_id: chatId, message_id: messageId, text: doneTxt, parse_mode: "HTML" });
    }

    const q1 = getClientQuestionPrompt(1, state.category, state.lang);
    sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: q1, parse_mode: "HTML" });
    return;
  }

  // 4. Клиент выбирает один из 3 вариантов Финального КП
  if (data.startsWith("cl_kp_pick:")) {
    const parts = data.split(":");
    const varIdx = parseInt(parts[1], 10);
    const kpNum = parts[2] || state.kpNumber;
    const r = findRowByKp(leadsSheet, kpNum);
    if (r === -1) return;

    const deal = readDealState(leadsSheet, r);
    const variants = Array.isArray(deal.kpVariants) ? deal.kpVariants : [];
    const chosen = variants.find(v => Number(v.id) === varIdx) || variants[varIdx - 1];
    if (!chosen) return;

    leadsSheet.getRange(r, COL.AGREED_PRICE).setValue(chosen.price);
    leadsSheet.getRange(r, COL.DAYS).setValue(chosen.days);
    leadsSheet.getRange(r, COL.STATUS).setValue(STATUSES.KP_ACCEPTED);
    paintStatusCell(leadsSheet, r, STATUSES.KP_ACCEPTED);
    patchDealState(leadsSheet, r, { chosenVariant: chosen });

    const reqText = (leadsSheet.getRange(r, COL.REQUISITES).getValue() || "").toString().trim();
    const needsReq = !reqText || reqText === "—" || reqText.toLowerCase().includes("не предостав");

    if (messageId) {
      const conf = state.lang === "kz"
        ? `🤝 <b>Таңдауыңыз қабылданды: ${escapeHtml(chosen.title)}</b> (${Number(chosen.price).toLocaleString("ru-RU")} ₸, ${chosen.days} жұм. күні)`
        : `🤝 <b>Выбор принят: ${escapeHtml(chosen.title)}</b> (${Number(chosen.price).toLocaleString("ru-RU")} ₸, ${chosen.days} раб. дн.)`;
      sendTelegramApi(token, "editMessageText", { chat_id: chatId, message_id: messageId, text: conf, parse_mode: "HTML" });
    }

    if (needsReq) {
      state.step = 55;
      saveDialogState(memSheet, chatId, state);
      const askReq = state.lang === "kz"
        ? "Шарт жобасын дайындау үшін ұйымыңыздың деректемелерін (БСН/ЖСН, атауы, ИИК, БИК, қол қоюшы) жіберіңіз немесе жеке тұлға ретінде ЖСН жазыңыз:"
        : "Чтобы мы подготовили предварительный договор, пришлите, пожалуйста, реквизиты организации (Название, БИН/ИИН, ИИК, БИК, ФИО подписанта) одним сообщением:";
      sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: askReq });
    } else {
      state.step = 56;
      saveDialogState(memSheet, chatId, state);
      const okMsg = state.lang === "kz"
        ? "Рахмет! Сіздің таңдауыңыз Наталья Коденцеваға жіберілді. Жақын арада тексеруге алдын ала шарт пен жоспарлы басталу күнін жібереміз."
        : "Спасибо! Ваш выбор передан Наталье Коденцевой. Скоро направим предварительный договор на согласование и ориентировочное окно старта.";
      sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: okMsg });
    }

    notifyAdminKpAccepted(leadsSheet, r, chosen, needsReq);
    return;
  }

  // 5. Клиент согласовал предварительный договор (или просит правку)
  if (data.startsWith("cl_contract_ok:")) {
    const kpNum = data.split(":")[1] || state.kpNumber;
    const r = findRowByKp(leadsSheet, kpNum);
    if (r === -1) return;

    leadsSheet.getRange(r, COL.STATUS).setValue(STATUSES.CONTRACT_AGREED);
    paintStatusCell(leadsSheet, r, STATUSES.CONTRACT_AGREED);
    state.step = 58;
    saveDialogState(memSheet, chatId, state);

    if (messageId) {
      const agreedTxt = state.lang === "kz"
        ? `✅ <b>№ ${kpNum} шартының мәтіні келісілді!</b>\nҚол қою және шот төлеу үшін Наталья Коденцеваға хабар берілді.`
        : `✅ <b>Условия договора по № ${kpNum} согласованы!</b>\nПередали Наталье Коденцевой для финального подписания и выставления счёта (100% предоплата).`;
      sendTelegramApi(token, "editMessageText", { chat_id: chatId, message_id: messageId, text: agreedTxt, parse_mode: "HTML" });
    }
    notifyAdminContractAgreed(leadsSheet, r);
    return;
  }

  if (data.startsWith("cl_contract_fix:")) {
    state.step = 57;
    saveDialogState(memSheet, chatId, state);
    const askFix = state.lang === "kz"
      ? "Шарт бойынша түзетуіңізді немесе сұрағыңызды бір хабарламамен жазыңыз — біз бірден Натальяға жеткіземіз:"
      : "Напишите ваши правки или вопрос по договору одним сообщением — сразу передадим Наталье:";
    sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: askFix });
  }
}

function processClientDialogTurn(token, chatId, msg) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const memSheet = ss.getSheetByName(CONFIG.SHEET_MEMORY);
  const leadsSheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  const state = loadDialogState(memSheet, chatId);

  if (!state || state.step >= 99) {
    startClientBriefDialog(token, chatId, msg.from, "");
    return;
  }

  let userContent = (msg.text || msg.caption || "").trim();

  if (msg.voice || msg.audio) {
    const fileId = (msg.voice || msg.audio).file_id;
    const waitTxt = state.lang === "kz" ? "⏳ Дауыстық хабарлама өңделуде..." : "⏳ Принял голосовое, расшифровываю...";
    sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: waitTxt });
    const audioData = downloadTelegramFileAsBase64(token, fileId);
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

  let rowIdx = findRowByKp(leadsSheet, state.kpNumber);

  // --- СПЕЦ-РЕЖИМ 50: Ответ клиента на дополнительный вопрос Натальи ---
  if (state.step === 50) {
    handleClientPostBriefReply(token, chatId, state, rowIdx, userContent, "extra", memSheet, leadsSheet);
    return;
  }

  // --- СПЕЦ-РЕЖИМ 52: Клиент написал вопрос вместо нажатия кнопки КП ---
  if (state.step === 52) {
    handleClientPostBriefReply(token, chatId, state, rowIdx, userContent, "kp_question", memSheet, leadsSheet);
    return;
  }

  // --- СПЕЦ-РЕЖИМ 55: Досылка реквизитов после выбора КП ---
  if (state.step === 55) {
    if (rowIdx !== -1) {
      leadsSheet.getRange(rowIdx, COL.REQUISITES).setValue(userContent);
      const oldBrief = (leadsSheet.getRange(rowIdx, COL.BRIEF).getValue() || "").toString();
      leadsSheet.getRange(rowIdx, COL.BRIEF).setValue(oldBrief + "\n\n[РЕКВИЗИТЫ ОТ КЛИЕНТА]: " + userContent);
    }
    state.step = 56;
    saveDialogState(memSheet, chatId, state);
    const thanks = state.lang === "kz"
      ? "✅ Деректемелер қабылданды! Наталья Коденцева шарт жобасын дайындауда."
      : "✅ Реквизиты приняты и сохранены! Наталья Коденцева уже готовит проект договора.";
    sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: thanks });
    notifyAdminRequisitesReceived(leadsSheet, rowIdx, userContent);
    return;
  }

  // --- СПЕЦ-РЕЖИМ 57: Правка / комментарий по предварительному договору ---
  if (state.step === 57) {
    handleClientPostBriefReply(token, chatId, state, rowIdx, userContent, "contract_comment", memSheet, leadsSheet);
    return;
  }

  // --- СПЕЦ-РЕЖИМ 60: Клиент отправил ссылку на папку Google Диска с исходниками ---
  if (state.step === 60) {
    handleClientMaterialsMessage(token, chatId, state, rowIdx, userContent, memSheet, leadsSheet);
    return;
  }

  // Автоопределение казахского языка общения (ТОЛЬКО chatLang, НЕ язык разработки!)
  if (state.kpNumber && state.kpNumber.startsWith("MK-TG-") && state.lang !== "kz" && detectKazakhSentence(userContent)) {
    state.lang = "kz";
    if (rowIdx !== -1) patchDealState(leadsSheet, rowIdx, { chatLang: "kz" });
  }

  // Если клиент пропустил кнопки выбора направления (step === 0 или 0.5) и сразу написал текст/голос
  if (state.step < 1) {
    if (!state.categoryConfirmed) {
      const detectedKey = detectBranchKey(userContent);
      if (detectedKey) {
        state.category = getCanonicalBranchName(detectedKey, state.lang);
        state.categoryConfirmed = true;
        if (rowIdx !== -1) leadsSheet.getRange(rowIdx, COL.CATEGORY).setValue(state.category);
      }
    }
    state.step = 1;
  }

  const currentQLabel = getClientQuestionLabel(state.step);
  state.answers["step_" + state.step] = `${currentQLabel}: ${userContent}`;

  // Если клиент пропустил кнопки языка материалов — проверим ответы или уточним
  if (!state.categoryConfirmed) {
    const combinedSoFar = Object.values(state.answers).join("\n");
    const detectedKey = detectBranchKey(combinedSoFar);
    if (detectedKey) {
      state.category = getCanonicalBranchName(detectedKey, state.lang);
      state.categoryConfirmed = true;
      if (rowIdx !== -1) leadsSheet.getRange(rowIdx, COL.CATEGORY).setValue(state.category);
    }
  }

  // Страховка прямо перед Вопросом 4
  if (state.step === 3 && (!state.categoryConfirmed || !state.category)) {
    const combinedBeforeQ4 = Object.values(state.answers).join("\n");
    const aiBranchKey = classifyBranchWithGemini(combinedBeforeQ4) || "b2b";
    state.category = getCanonicalBranchName(aiBranchKey, state.lang);
    state.categoryConfirmed = true;
    if (rowIdx !== -1) leadsSheet.getRange(rowIdx, COL.CATEGORY).setValue(state.category);
  }

  if (rowIdx !== -1) {
    leadsSheet.getRange(rowIdx, COL.BRIEF).setValue(Object.values(state.answers).join("\n\n"));
  }

  if (state.step < 6) {
    state.step += 1;
    saveDialogState(memSheet, chatId, state);
    const nextQ = getClientQuestionPrompt(state.step, state.category || getCanonicalBranchName("b2b", state.lang), state.lang);
    sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: nextQ, parse_mode: "HTML" });
    return;
  }

  // Финал (Вопрос 6 пройден) — анализ и передача Наталье
  const finalCategory = state.category || getCanonicalBranchName("b2b", state.lang);
  const fullRaw = Object.values(state.answers).join("\n\n---\n\n");
  const aiAnalysis = analyzeBriefWithGemini({
    kpNumber: state.kpNumber,
    category: finalCategory,
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
      finalCategory, "Уточняется...",
      "Бриф через Telegram-бота", 0, 10, "Стандарт",
      STATUSES.FOR_APPROVAL, 0, 2, aiAnalysis.summary, fullRaw, aiAnalysis.requisites || "—",
      "", "", "tg_chat:" + chatId, "", JSON.stringify({ chatLang: state.lang })
    ]);
    rowIdx = leadsSheet.getLastRow();
  } else {
    if (state.kpNumber && state.kpNumber.startsWith("MK-TG-")) {
      leadsSheet.getRange(rowIdx, COL.CATEGORY).setValue(finalCategory);
    }
    leadsSheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.FOR_APPROVAL);
    leadsSheet.getRange(rowIdx, COL.SUMMARY).setValue(aiAnalysis.summary);
    leadsSheet.getRange(rowIdx, COL.BRIEF).setValue(fullRaw);
    leadsSheet.getRange(rowIdx, COL.REQUISITES).setValue(aiAnalysis.requisites || "—");
    ensureTgChatInCol22(leadsSheet, rowIdx, chatId);
  }
  paintStatusCell(leadsSheet, rowIdx, STATUSES.FOR_APPROVAL);

  sendBriefReadyCardToAdmin(leadsSheet, rowIdx, aiAnalysis);

  const bye = state.lang === "kz"
    ? `✅ Рахмет! Барлық 6 жауап Наталья Коденцеваға жіберілді.\n\nЖобаны талдағаннан кейін сізге таңдауға арналған 3 нұсқасы бар қорытынды КП немесе нақтылау сұрақтары жіберіледі.`
    : `✅ Благодарим! Все 6 ответов переданы руководителю Бюро Наталье Коденцевой.\n\nПосле разбора мы пришлём сюда либо уточняющий вопрос, либо Финальное КП с 3 вариантами комплектации под ваш проект.`;
  sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: bye });

  state.step = 51; // Бриф завершён, ждём разбор Натальи (НЕ 99, чтобы доп. вопросы не сбрасывали заявку!)
  saveDialogState(memSheet, chatId, state);
}

function handleClientPostBriefReply(token, chatId, state, rowIdx, userContent, mode, memSheet, leadsSheet) {
  if (rowIdx === -1) return;

  const oldBrief = (leadsSheet.getRange(rowIdx, COL.BRIEF).getValue() || "").toString();
  const tagMap = {
    extra: "[ОТВЕТ КЛИЕНТА НА ДОП. ВОПРОС]",
    kp_question: "[ВОПРОС КЛИЕНТА ПО ФИНАЛЬНОМУ КП]",
    contract_comment: "[ПРАВКА / КОММЕНТАРИЙ ПО ДОГОВОРУ]"
  };
  const updatedBrief = oldBrief + `\n\n${tagMap[mode] || "[СООБЩЕНИЕ КЛИЕНТА]"}:\n${userContent}`;
  leadsSheet.getRange(rowIdx, COL.BRIEF).setValue(updatedBrief);

  // Если прислана ссылка на Google Диск — сразу сохраняем и в столбец W
  const urlMatch = userContent.match(/https?:\/\/[^\s]+/);
  if (urlMatch && urlMatch[0].includes("drive.google")) {
    leadsSheet.getRange(rowIdx, COL.DRIVE_LINK).setValue(urlMatch[0]);
  }

  const aiAnalysis = analyzeBriefWithGemini({
    kpNumber: state.kpNumber,
    category: state.category || "Общий",
    lang: state.lang,
    rawText: updatedBrief,
    audioBase64: "",
    audioMimeType: ""
  });
  leadsSheet.getRange(rowIdx, COL.SUMMARY).setValue(aiAnalysis.summary);
  if (aiAnalysis.requisites && !aiAnalysis.requisites.toLowerCase().includes("не предостав")) {
    leadsSheet.getRange(rowIdx, COL.REQUISITES).setValue(aiAnalysis.requisites);
  }

  if (mode === "extra") {
    leadsSheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.FOR_APPROVAL);
    paintStatusCell(leadsSheet, rowIdx, STATUSES.FOR_APPROVAL);
    patchDealState(leadsSheet, rowIdx, { lastExtraQuestion: "" });
    state.step = 51;
    saveDialogState(memSheet, chatId, state);
    sendBriefReadyCardToAdmin(leadsSheet, rowIdx, aiAnalysis, "🔄 КЛИЕНТ ОТВЕТИЛ НА ДОП. ВОПРОС");
  } else {
    patchDealState(leadsSheet, rowIdx, { contractComment: mode === "contract_comment" ? userContent : "" });
    const adminToken = getSecret("ADMIN_BOT_TOKEN");
    const adminChatId = getSecret("ADMIN_CHAT_ID");
    if (adminToken && adminChatId) {
      const row = leadsSheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
      sendTelegramApi(adminToken, "sendMessage", {
        chat_id: adminChatId,
        text: `💬 <b>Сообщение от клиента по ${state.kpNumber}</b> (${escapeHtml(row[2])}):\n\n${escapeHtml(userContent)}`,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "❓ Ответить клиенту", callback_data: `ask_${state.kpNumber}` }]] }
      });
    }
  }

  const ack = state.lang === "kz"
    ? "✅ Рахмет! Жауабыңыз Наталья Коденцеваға жеткізілді."
    : "✅ Спасибо! Ваш ответ передан Наталье Коденцевой.";
  sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: ack });
}

function handleClientMaterialsMessage(token, chatId, state, rowIdx, userContent, memSheet, leadsSheet) {
  if (rowIdx === -1) return;
  const urlMatch = userContent.match(/https?:\/\/[^\s]+/);
  if (urlMatch) {
    leadsSheet.getRange(rowIdx, COL.DRIVE_LINK).setValue(urlMatch[0]);
  }
  const oldBrief = (leadsSheet.getRange(rowIdx, COL.BRIEF).getValue() || "").toString();
  leadsSheet.getRange(rowIdx, COL.BRIEF).setValue(oldBrief + `\n\n[ССЫЛКА / КОММЕНТАРИЙ ПО МАТЕРИАЛАМ]: ${userContent}`);

  const adminToken = getSecret("ADMIN_BOT_TOKEN");
  const adminChatId = getSecret("ADMIN_CHAT_ID");
  if (adminToken && adminChatId) {
    const row = leadsSheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    sendTelegramApi(adminToken, "sendMessage", {
      chat_id: adminChatId,
      text: `📂 <b>КЛИЕНТ СДАЛ МАТЕРИАЛЫ ПО ${state.kpNumber}!</b>\n👤 ${escapeHtml(row[2])} (${escapeHtml(row[3])})\n\n🔗 ${escapeHtml(userContent)}\n\n<i>Проверьте, всё ли на месте. Как будете готовы — нажмите кнопку ниже, чтобы включить счётчик срока и занять слот в Графике:</i>`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Материалы приняты — СТАРТ В РАБОТУ", callback_data: `start_work_${state.kpNumber}` }],
          [{ text: "❓ Запросить недостающее", callback_data: `ask_${state.kpNumber}` }]
        ]
      }
    });
  }

  const reply = state.lang === "kz"
    ? "✅ Материалдар сілтемесі Наталья Коденцеваға жіберілді! Тексеруден кейін бірден басталу және тапсыру күндерін бекітеміз."
    : "✅ Ссылка и комментарий по материалам переданы Наталье Коденцевой! После короткой проверки зафиксируем точную дату старта и сдачи в Графике.";
  sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: reply });
}

/**
 * =========================================================================
 * 5. ПУЛЬТ РУКОВОДИТЕЛЯ (БОТ №2): КНОПКИ, ДОП.ВОПРОСЫ, 3 ВАРИАНТА КП, ДОГОВОР, ГРАФИК
 * =========================================================================
 */
function sendAdminCard(lead, kpNumber, itemsSummary, devLangLabel, loadPoints, portalUrl) {
  const token = getSecret("ADMIN_BOT_TOKEN");
  const adminChatId = getSecret("ADMIN_CHAT_ID");
  if (!token || !adminChatId) return;

  const cleanPhone = (lead.clientPhone || "").replace(/[^\d+]/g, "");
  const waLink = cleanPhone ? "https://wa.me/" + cleanPhone.replace("+", "") : "";
  const urgentBadge = lead.isUrgent ? "⚡ <b>СРОЧНЫЙ РЕЖИМ (+20%)</b>\n" : "";

  let msgText = `🔔 <b>НОВАЯ ЗАЯВКА С КАЛЬКУЛЯТОРА: ${kpNumber}</b>\n`;
  msgText += `━━━━━━━━━━━━━━━━━━━━\n`;
  msgText += `👤 <b>Заказчик:</b> ${escapeHtml(lead.clientName)}\n`;
  msgText += `🏢 <b>Организация:</b> ${escapeHtml(lead.clientOrg)}\n`;
  msgText += `📞 <b>Телефон:</b> <code>${escapeHtml(lead.clientPhone)}</code>\n`;
  msgText += `🎯 <b>Направление:</b> ${escapeHtml(lead.audienceCategory)}\n`;
  msgText += `🌐 <b>Язык материалов:</b> ${escapeHtml(devLangLabel)} (вес: ${loadPoints} б.)\n`;
  msgText += `${urgentBadge}`;
  msgText += `📋 <b>Модули:</b>\n${escapeHtml(itemsSummary)}\n\n`;
  msgText += `💰 <b>Предв. смета:</b> <b>${Number(lead.totalPrice).toLocaleString("ru-RU")} ₸</b> | ⏱ <b>${lead.totalDays} раб. дн.</b>\n`;
  msgText += `<i>Статус: Ожидает распаковки в боте или веб-анкете</i>`;

  const keyboard = [];
  if (waLink) keyboard.push([{ text: "📱 Написать в WhatsApp", url: waLink }]);
  if (portalUrl) keyboard.push([{ text: "🔗 Портал клиента (без TG)", url: portalUrl }]);
  keyboard.push([{ text: "📄 Открыть Google Таблицу", url: SpreadsheetApp.getActiveSpreadsheet().getUrl() }]);

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
  const cleanPhone = (row[COL.PHONE - 1] || "").toString().replace(/[^\d+]/g, "");
  const waLink = cleanPhone ? "https://wa.me/" + cleanPhone.replace("+", "") : "";
  const portalUrl = getClientPortalUrl(kpNumber);

  const hdr = customHeader || "🟣➡️🔵 БРИФ ПРОЙДЕН! НА РАЗБОРЕ";
  let text = `<b>${hdr}: ${kpNumber}</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `👤 <b>${escapeHtml(row[COL.NAME - 1])}</b> (${escapeHtml(row[COL.ORG - 1])})\n`;
  text += `🎯 ${escapeHtml(row[COL.CATEGORY - 1])} | 🌐 ${escapeHtml(row[COL.DEV_LANG - 1])}\n`;
  text += `💰 Смета: <b>${Number(row[COL.AGREED_PRICE - 1] || row[COL.SITE_PRICE - 1]).toLocaleString("ru-RU")} ₸</b> | ⏱ ${row[COL.DAYS - 1]} раб. дн. | ⚖️ ${row[COL.POINTS - 1]} б.\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `<b>📌 ВЫЖИМКА (Дилтс / ФКР / Ресурсы):</b>\n${escapeHtml(aiAnalysis.summary)}\n\n`;
  text += `<b>🏦 РЕКВИЗИТЫ ДЛЯ ДОГОВОРА:</b>\n${escapeHtml(aiAnalysis.requisites || row[COL.REQUISITES - 1] || "Не указаны")}\n`;
  text += `\n🔗 <i>Портал клиента:</i> ${portalUrl}`;

  const kb = [
    [
      { text: "📋 Собрать Финальное КП (3 варианта)", callback_data: `prep_kp_${kpNumber}` }
    ],
    [
      { text: "❓ Задать доп. вопрос", callback_data: `ask_${kpNumber}` },
      { text: "✏️ Изменить сумму/срок", callback_data: `edit_${kpNumber}` }
    ],
    [
      { text: "📄 Сразу к Договору", callback_data: `approve_${kpNumber}` },
      { text: "💰 100% оплачено", callback_data: `paid_${kpNumber}` }
    ]
  ];
  if (waLink) kb.push([{ text: "📱 WhatsApp клиента", url: waLink }]);

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

  // 1. Запрос дополнительного вопроса клиенту (работает БЕЗ Reply!)
  if (data.startsWith("ask_")) {
    const kp = data.replace("ask_", "");
    setAdminPendingAction(chatId, { type: "ask", kp: kp });
    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `❓ <b>Доп. вопрос по заявке ${kp}</b>\nПросто напишите ваш вопрос следующим сообщением в этот чат (без свайпа Reply) — я сразу передам его клиенту.`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "❌ Отмена", callback_data: "admin_cancel" }]] }
    });
    return ContentService.createTextOutput("OK");
  }

  // 2. Изменение суммы и/или срока (работает БЕЗ Reply!)
  if (data.startsWith("edit_")) {
    const kp = data.replace("edit_", "");
    setAdminPendingAction(chatId, { type: "edit", kp: kp });
    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `✏️ <b>Корректировка суммы/срока по ${kp}</b>\nПросто напишите следующим сообщением новую сумму (и при желании комментарий):\n<code>480000 Сделали скидку за 2 модуля</code>`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "❌ Отмена", callback_data: "admin_cancel" }]] }
    });
    return ContentService.createTextOutput("OK");
  }

  // 3. Сборка черновика Финального КП с 3 вариантами
  if (data.startsWith("prep_kp_")) {
    const kp = data.replace("prep_kp_", "");
    const rowIdx = findRowByKp(sheet, kp);
    if (rowIdx === -1) return ContentService.createTextOutput("OK");

    const variants = buildFinalKpVariants(sheet, rowIdx);
    patchDealState(sheet, rowIdx, { kpVariants: variants });

    const preview = formatKp3VariantsPreview(kp, variants);
    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: preview,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📤 Отправить Финальное КП клиенту (срок 2 раб. дн.)", callback_data: `send_kp_${kp}` }],
          [{ text: "✏️ Поправить цены 3 вариантов", callback_data: `edit_kp3_${kp}` }],
          [{ text: "🔗 Открыть портал клиента", url: getClientPortalUrl(kp) }]
        ]
      }
    });
    return ContentService.createTextOutput("OK");
  }

  // 4. Ручная правка цен 3 вариантов КП (формат: 350000 550000 850000)
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

  // 5. Отправка Финального КП клиенту в @metodico_brif_bot (+ на сайт)
  if (data.startsWith("send_kp_")) {
    const kp = data.replace("send_kp_", "");
    const rowIdx = findRowByKp(sheet, kp);
    if (rowIdx === -1) return ContentService.createTextOutput("OK");

    const deal = readDealState(sheet, rowIdx);
    const variants = Array.isArray(deal.kpVariants) && deal.kpVariants.length ? deal.kpVariants : buildFinalKpVariants(sheet, rowIdx);
    const deadlineDate = formatDateRu(addWorkingDays(new Date(), 2));

    sheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.FINAL_KP_SENT);
    paintStatusCell(sheet, rowIdx, STATUSES.FINAL_KP_SENT);
    patchDealState(sheet, rowIdx, {
      kpVariants: variants,
      kpSentAt: new Date().toISOString(),
      kpDeadlineText: deadlineDate,
      remindedKp2d: false
    });

    const tgChatId = resolveClientTgChatId(ss, sheet, rowIdx, kp);
    const portalUrl = getClientPortalUrl(kp);
    const clientToken = getSecret("CLIENT_BOT_TOKEN");
    const chatLang = deal.chatLang || "ru";

    if (tgChatId && clientToken) {
      updateClientMemStep(ss, tgChatId, kp, 52);
      const clientMsg = formatKp3VariantsForClient(kp, variants, deadlineDate, chatLang);
      const kb = variants.map(v => ([{
        text: `${v.id}. ${v.title} — ${Number(v.price).toLocaleString("ru-RU")} ₸`,
        callback_data: `cl_kp_pick:${v.id}:${kp}`
      }]));
      sendTelegramApi(clientToken, "sendMessage", {
        chat_id: tgChatId,
        text: clientMsg,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: kb }
      });
      sendTelegramApi(token, "sendMessage", {
        chat_id: chatId,
        text: `✅ <b>Финальное КП по ${kp} отправлено клиенту в Telegram!</b>\nЖдём выбор варианта до <b>${deadlineDate}</b> (2 раб. дн.).\n\n🔗 Ссылка-дубль на сайт: ${portalUrl}`,
        parse_mode: "HTML"
      });
    } else {
      sendTelegramApi(token, "sendMessage", {
        chat_id: chatId,
        text: `💼 <b>Финальное КП по ${kp} опубликовано на персональной странице!</b>\nКлиент оформлял заявку с сайта (без TG). Отправьте ему эту ссылку (WhatsApp / Email):\n\n<code>Здравствуйте! Ваше Финальное КП № ${kp} с 3 вариантами готово: ${portalUrl} (актуально до ${deadlineDate}).</code>`,
        parse_mode: "HTML"
      });
    }
    return ContentService.createTextOutput("OK");
  }

  // 6. Сборка предварительного Договора (Наталья проверяет перед отправкой!)
  if (data.startsWith("approve_")) {
    const kp = data.replace("approve_", "");
    const rowIdx = findRowByKp(sheet, kp);
    if (rowIdx === -1) return ContentService.createTextOutput("OK");

    const docUrl = tryGenerateContractDoc(sheet, rowIdx);
    const qInfo = getPublicQueueStatus();
    const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const price = Number(row[COL.AGREED_PRICE - 1] || row[COL.SITE_PRICE - 1] || 0).toLocaleString("ru-RU");

    const replyTxt = docUrl
      ? `📄 <b>Черновик договора по ${kp} готов к вашей проверке!</b>\n💰 Сумма: <b>${price} ₸</b> (100% предоплата) | ⏱ ${row[COL.DAYS - 1]} раб. дн.\n📅 Ближайшее окно старта: <b>${qInfo.nextFreeWindow}</b>\n\n🔗 <b>Документ:</b> ${docUrl}`
      : `📄 <b>Подготовка договора по ${kp}:</b>\n💰 Сумма: <b>${price} ₸</b> | ⏱ ${row[COL.DAYS - 1]} раб. дн.\n📅 Ближайшее окно старта: <b>${qInfo.nextFreeWindow}</b>\n<i>(Чтобы Google Документ создавался сам, добавьте CONTRACT_TEMPLATE_ID в Свойства скрипта. Можете отправить клиенту согласование условий и окно старта прямо сейчас.)</i>`;

    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: replyTxt,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📤 Отправить Договор клиенту на согласование", callback_data: `send_contract_${kp}` }],
          [{ text: "💰 Подписано + 100% оплачено", callback_data: `paid_${kp}` }]
        ]
      }
    });
    return ContentService.createTextOutput("OK");
  }

  // 7. Отправка предварительного Договора + окна старта клиенту на согласование
  if (data.startsWith("send_contract_")) {
    const kp = data.replace("send_contract_", "");
    const rowIdx = findRowByKp(sheet, kp);
    if (rowIdx === -1) return ContentService.createTextOutput("OK");

    sheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.CONTRACT_SENT);
    paintStatusCell(sheet, rowIdx, STATUSES.CONTRACT_SENT);

    const deal = readDealState(sheet, rowIdx);
    const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const docUrl = extractDocUrlFromCol22(row[COL.META_DOC - 1]);
    const qInfo = getPublicQueueStatus();
    const portalUrl = getClientPortalUrl(kp);
    const tgChatId = resolveClientTgChatId(ss, sheet, rowIdx, kp);
    const clientToken = getSecret("CLIENT_BOT_TOKEN");
    const lang = deal.chatLang || "ru";
    const priceStr = Number(row[COL.AGREED_PRICE - 1] || row[COL.SITE_PRICE - 1] || 0).toLocaleString("ru-RU");

    if (tgChatId && clientToken) {
      updateClientMemStep(ss, tgChatId, kp, 57);
      const cText = lang === "kz"
        ? `📄 <b>№ ${kp} жобасы бойынша алдын ала шарт келісуге дайын!</b>\n\n• Жалпы сомасы: <b>${priceStr} ₸</b> (100% алдын ала төлем)\n• Орындау мерзімі: <b>${row[COL.DAYS - 1]} жұмыс күні</b>\n• Графиктегі жақын бос терезе: <b>${qInfo.nextFreeWindow}</b>\n<i>(Жұмыс 100% төлем түскеннен және барлық материалдар берілгеннен кейін келесі жұмыс күні басталады.)</i>\n${docUrl ? `\n📎 <b>Шарт жобасы:</b> ${docUrl}\n` : ""}\nТөмендегі батырма арқылы шартты тексеріп, келісіміңізді растаңыз:`
        : `📄 <b>Предварительный договор по проекту № ${kp} готов к согласованию!</b>\n\n• Итоговая стоимость: <b>${priceStr} ₸</b> (100% предоплата)\n• Срок разработки: <b>${row[COL.DAYS - 1]} раб. дн.</b>\n• Ориентировочное окно старта в Графике: <b>${qInfo.nextFreeWindow}</b>\n<i>(Согласно п. 3.1 Договора отсчёт срока идёт со следующего рабочего дня после 100% оплаты И передачи полного пакета исходных материалов.)</i>\n${docUrl ? `\n📎 <b>Ссылка на договор:</b> ${docUrl}\n` : ""}\nПроверьте условия и подтвердите согласование кнопкой ниже:`;

      const kb = lang === "kz"
        ? [
            [{ text: "✅ Шарт келісілді", callback_data: `cl_contract_ok:${kp}` }],
            [{ text: "✏️ Түзету / сұрақ бар", callback_data: `cl_contract_fix:${kp}` }]
          ]
        : [
            [{ text: "✅ Договор согласован", callback_data: `cl_contract_ok:${kp}` }],
            [{ text: "✏️ Есть правка / вопрос", callback_data: `cl_contract_fix:${kp}` }]
          ];

      sendTelegramApi(clientToken, "sendMessage", { chat_id: tgChatId, text: cText, parse_mode: "HTML", reply_markup: { inline_keyboard: kb } });
      sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: `✅ Договор по <b>${kp}</b> отправлен клиенту в Telegram! Ждём нажатия «Договор согласован».`, parse_mode: "HTML" });
    } else {
      sendTelegramApi(token, "sendMessage", {
        chat_id: chatId,
        text: `📄 Статус по <b>${kp}</b> обновлён. Клиент без Telegram — отправьте ему персональную ссылку для согласования договора:\n<code>${portalUrl}</code>${docUrl ? `\n(Договор: ${docUrl})` : ""}`,
        parse_mode: "HTML"
      });
    }
    return ContentService.createTextOutput("OK");
  }

  // 8. Подписано + 100% оплачено ➔ Ждём материалы на Google Диске (мягкая бронь 3 раб. дня!)
  if (data.startsWith("paid_")) {
    const kp = data.replace("paid_", "");
    const rowIdx = findRowByKp(sheet, kp);
    if (rowIdx === -1) return ContentService.createTextOutput("OK");

    const holdUntil = formatDateRu(addWorkingDays(new Date(), 3));
    sheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.WAITING_MATERIALS);
    paintStatusCell(sheet, rowIdx, STATUSES.WAITING_MATERIALS);
    patchDealState(sheet, rowIdx, {
      paidAt: new Date().toISOString(),
      holdUntilText: holdUntil,
      remindedMat3d: false
    });
    recalculateQueueSheet();

    const deal = readDealState(sheet, rowIdx);
    const tgChatId = resolveClientTgChatId(ss, sheet, rowIdx, kp);
    const clientToken = getSecret("CLIENT_BOT_TOKEN");
    const portalUrl = getClientPortalUrl(kp);
    const lang = deal.chatLang || "ru";
    const driveInstruction = getGoogleDriveInstructionText(kp, holdUntil, lang);

    if (tgChatId && clientToken) {
      updateClientMemStep(ss, tgChatId, kp, 60);
      sendTelegramApi(clientToken, "sendMessage", { chat_id: tgChatId, text: driveInstruction, parse_mode: "HTML" });
    }

    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `💰 <b>По ${kp} зафиксированы подпись и 100% оплата!</b>\nСтатус: <i>${STATUSES.WAITING_MATERIALS}</i>\nМягкая бронь окна: до <b>${holdUntil}</b> (3 раб. дн.).\n\n${tgChatId ? "✅ Клиенту отправлена пошаговая инструкция про папку Google Диска." : "🔗 Клиент без TG — инструкция ждёт на портале: " + portalUrl}\n\nКак только клиент пришлёт материалы/ссылку и вы проверите комплект — нажмите кнопку запуска:`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Материалы приняты — СТАРТ В РАБОТУ", callback_data: `start_work_${kp}` }],
          [{ text: "🔗 Открыть портал клиента", url: portalUrl }]
        ]
      }
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

  // 10. Уведомление клиента в Telegram о точном старте и дате сдачи
  if (data.startsWith("notify_start_")) {
    const kp = data.replace("notify_start_", "");
    const rowIdx = findRowByKp(sheet, kp);
    if (rowIdx === -1) return ContentService.createTextOutput("OK");
    const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const deal = readDealState(sheet, rowIdx);
    const tgChatId = resolveClientTgChatId(ss, sheet, rowIdx, kp);
    const clientToken = getSecret("CLIENT_BOT_TOKEN");
    const lang = deal.chatLang || "ru";

    if (tgChatId && clientToken) {
      updateClientMemStep(ss, tgChatId, kp, 65);
      const notice = lang === "kz"
        ? `🚀 <b>${row[COL.NAME - 1]}, жобаңыз ресми түрде іске қосылды!</b>\n\nӨтінім № <b>${kp}</b>\n• Материалдар толық қабылданды\n• Жұмыс басталуы: <b>${row[COL.START_DATE - 1]}</b>\n• Жоспарлы тапсыру күні: <b>${row[COL.END_DATE - 1]}</b>`
        : `🚀 <b>${escapeHtml(row[COL.NAME - 1])}, ваш проект официально принят в работу!</b>\n\nЗаявка № <b>${kp}</b>\n• Оплата 100% и исходные материалы получены в полном объёме\n• Дата начала работ: <b>${row[COL.START_DATE - 1]}</b>\n• Плановая дата сдачи: <b>${row[COL.END_DATE - 1]}</b>`;
      sendTelegramApi(clientToken, "sendMessage", { chat_id: tgChatId, text: notice, parse_mode: "HTML" });
      sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: `✅ Клиент по ${kp} уведомлён о старте (${row[COL.START_DATE - 1]} ➔ ${row[COL.END_DATE - 1]})!` });
    } else {
      sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: `🔗 У клиента нет TG — даты старта уже обновились на портале: ${getClientPortalUrl(kp)}` });
    }
    return ContentService.createTextOutput("OK");
  }

  // 11. Закрытие проекта и освобождение слота
  if (data.startsWith("done_")) {
    const kp = data.replace("done_", "");
    const rowIdx = findRowByKp(sheet, kp);
    if (rowIdx !== -1) {
      sheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.DONE);
      paintStatusCell(sheet, rowIdx, STATUSES.DONE);
      const tgChatId = resolveClientTgChatId(ss, sheet, rowIdx, kp);
      if (tgChatId) updateClientMemStep(ss, tgChatId, kp, 99);
      recalculateQueueSheet();
      sendTelegramApi(token, "sendMessage", {
        chat_id: chatId,
        text: `✅ Проект <b>${kp}</b> переведён в статус «Сдано», баллы в графике освобождены.`,
        parse_mode: "HTML"
      });
    }
  }

  return ContentService.createTextOutput("OK");
}

/**
 * Обработка текстовых команд Натальи в Пульте (как по Reply, так и простым сообщением после нажатия кнопки!)
 */
function handleAdminMessage(msg) {
  const token = getSecret("ADMIN_BOT_TOKEN");
  const clientToken = getSecret("CLIENT_BOT_TOKEN");
  const chatId = msg.chat.id.toString();
  const userText = (msg.text || "").trim();
  if (!userText) return ContentService.createTextOutput("OK");

  const pending = getAdminPendingAction(chatId);
  let mode = pending ? pending.type : "";
  let kp = pending ? pending.kp : "";

  // Поддержка классического Reply как запасного канала
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
    sheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.EXTRA_QUESTION);
    paintStatusCell(sheet, rowIdx, STATUSES.EXTRA_QUESTION);
    const oldBrief = (sheet.getRange(rowIdx, COL.BRIEF).getValue() || "").toString();
    sheet.getRange(rowIdx, COL.BRIEF).setValue(oldBrief + "\n\n[ДОП. ВОПРОС ОТ НАТАЛЬИ]: " + userText);
    patchDealState(sheet, rowIdx, { lastExtraQuestion: userText });

    const tgChatId = resolveClientTgChatId(ss, sheet, rowIdx, kp);
    const deal = readDealState(sheet, rowIdx);
    const lang = deal.chatLang || "ru";
    const portalUrl = getClientPortalUrl(kp);

    if (tgChatId && clientToken) {
      updateClientMemStep(ss, tgChatId, kp, 50);
      const qMsg = lang === "kz"
        ? `💬 <b>Наталья Коденцевадан № ${kp} жобасы бойынша нақтылау сұрағы:</b>\n\n${escapeHtml(userContentSafe(userText))}\n\n<i>Осы чатқа мәтінмен немесе дауыспен жауап жіберіңіз.</i>`
        : `💬 <b>Уточнение от Натальи Коденцевой по проекту № ${kp}:</b>\n\n${escapeHtml(userText)}\n\n<i>Отправьте ответ прямо сюда текстом или голосовым сообщением.</i>`;
      sendTelegramApi(clientToken, "sendMessage", { chat_id: tgChatId, text: qMsg, parse_mode: "HTML" });
      sendTelegramApi(token, "sendMessage", { chat_id: chatId, text: `✅ Вопрос по <b>${kp}</b> отправлен клиенту в Telegram (статус: «Доп. вопрос»). Как ответит — пришлю обновлённую карточку!`, parse_mode: "HTML" });
    } else {
      sendTelegramApi(token, "sendMessage", {
        chat_id: chatId,
        text: `🟠 Вопрос по <b>${kp}</b> сохранён в таблице и опубликован на персональной странице клиента!\nОтправьте ему эту ссылку (WhatsApp / Email):\n<code>${portalUrl}</code>`,
        parse_mode: "HTML"
      });
    }
    return ContentService.createTextOutput("OK");
  }

  // Б) Корректировка согласованной суммы
  if (mode === "edit") {
    const matchPrice = userText.match(/^(\d+)(.*)/);
    if (matchPrice) {
      const newPrice = parseInt(matchPrice[1], 10);
      const comment = matchPrice[2].trim();
      sheet.getRange(rowIdx, COL.AGREED_PRICE).setValue(newPrice);
      if (comment) updateCol22KeepingTgChat(sheet, rowIdx, comment);
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

    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: formatKp3VariantsPreview(kp, variants),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📤 Отправить Финальное КП клиенту", callback_data: `send_kp_${kp}` }],
          [{ text: "✏️ Ещё поправить цены", callback_data: `edit_kp3_${kp}` }]
        ]
      }
    });
  }

  return ContentService.createTextOutput("OK");
}

function userContentSafe(txt) { return txt || ""; }

/**
 * =========================================================================
 * 6. СИСТЕМА ОЧЕРЕДНОСТИ И ГРАФИКА ЗАГРУЗКИ (ПОТОЛОК 10 БАЛЛОВ + МЯГКАЯ БРОНЬ)
 * =========================================================================
 */
function scheduleProjectIntoQueue(kpNumber) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  const rowIdx = findRowByKp(sheet, kpNumber);
  if (rowIdx === -1) return { adminMessage: "❌ Заявка " + kpNumber + " не найдена." };

  const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
  const devLang = (row[COL.DEV_LANG - 1] || "Русский").toString();
  const modulesCol = (row[COL.MODULES - 1] || "").toString();
  let days = parseInt(row[COL.DAYS - 1] || 10, 10);

  const isDirect = modulesCol.includes("Telegram") || modulesCol.includes("веб-распаковщик");
  if (isDirect && devLang.toLowerCase().includes("казах") && !modulesCol.includes("с учетом языка")) {
    days = Math.ceil(days * 1.1);
    sheet.getRange(rowIdx, COL.DAYS).setValue(days);
    sheet.getRange(rowIdx, COL.MODULES).setValue(modulesCol + " (с учетом языка)");
  }

  const projectPoints = parseFloat(row[COL.POINTS - 1] || 2);
  const queueInfo = getPublicQueueStatus();

  let startDate = addWorkingDays(new Date(), 1);
  let newStatus = STATUSES.IN_WORK;

  if (queueInfo.usedPoints + projectPoints > CONFIG.MAX_CAPACITY_POINTS) {
    newStatus = STATUSES.IN_QUEUE;
    startDate = queueInfo.nextFreeDateObj;
  }

  const endDate = addWorkingDays(startDate, days);
  sheet.getRange(rowIdx, COL.STATUS).setValue(newStatus);
  sheet.getRange(rowIdx, COL.START_DATE).setValue(formatDateRu(startDate));
  sheet.getRange(rowIdx, COL.END_DATE).setValue(formatDateRu(endDate));
  paintStatusCell(sheet, rowIdx, newStatus);

  recalculateQueueSheet();

  return {
    adminMessage: `🚀 <b>Проект ${kpNumber} запущен в график!</b>\nСтатус: ${newStatus}\nВес: ${projectPoints} б. | Срок: ${days} раб. дн.\nСтарт: <b>${formatDateRu(startDate)}</b> ➔ Сдача: <b>${formatDateRu(endDate)}</b>\n\nНажмите кнопку ниже, чтобы отправить клиенту официальное уведомление с датами.`
  };
}

function getPublicQueueStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  if (!sheet || sheet.getLastRow() < 2) {
    const tomorrow = addWorkingDays(new Date(), 1);
    return { usedPoints: 0, freePoints: CONFIG.MAX_CAPACITY_POINTS, activeCount: 0, nextFreeWindow: formatDateRu(tomorrow), nextFreeDateObj: tomorrow };
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

/**
 * Ежедневный тихий будильник (по желанию подключается 1 раз в Триггеры раз в день):
 * проверяет дедлайн 2 раб. дня по Финальному КП и 3 раб. дня по сдаче материалов.
 */
function checkDeadlinesTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  if (!sheet || sheet.getLastRow() < 2) return;
  ensureExtendedColumns(sheet);

  const adminToken = getSecret("ADMIN_BOT_TOKEN");
  const adminChatId = getSecret("ADMIN_CHAT_ID");
  const clientToken = getSecret("CLIENT_BOT_TOKEN");
  const now = new Date();
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, COL.DEAL_JSON).getValues();

  for (let i = 0; i < data.length; i++) {
    const rowIdx = i + 2;
    const r = data[i];
    const kp = r[COL.KP - 1];
    const st = r[COL.STATUS - 1];
    const deal = parseJsonSafe(r[COL.DEAL_JSON - 1], {});
    const tgChatId = resolveClientTgChatId(ss, sheet, rowIdx, kp);

    if (st === STATUSES.FINAL_KP_SENT && deal.kpSentAt && !deal.remindedKp2d) {
      if (countWorkingDaysBetween(new Date(deal.kpSentAt), now) >= 2) {
        patchDealState(sheet, rowIdx, { remindedKp2d: true });
        if (tgChatId && clientToken) {
          const msgC = deal.chatLang === "kz"
            ? `⏰ Сәлеметсіз бе! № <b>${kp}</b> жобасы бойынша жіберілген КП нұсқаларын қарап үлгердіңіз бе? Қандай да бір сұрағыңыз болса, осында жаза аласыз.`
            : `⏰ Здравствуйте! Подскажите, удалось ли рассмотреть 3 варианта Финального КП по заявке № <b>${kp}</b>? Если нужно скорректировать состав или есть вопросы — напишите прямо сюда.`;
          sendTelegramApi(clientToken, "sendMessage", { chat_id: tgChatId, text: msgC, parse_mode: "HTML" });
        }
        if (adminToken && adminChatId) {
          sendTelegramApi(adminToken, "sendMessage", {
            chat_id: adminChatId,
            text: `⏰ <b>Прошло 2 раб. дня по Финальному КП ${kp}</b> (${escapeHtml(r[COL.NAME - 1])}).\nКлиенту ушло вежливое напоминание.`,
            parse_mode: "HTML"
          });
        }
      }
    }

    if (st === STATUSES.WAITING_MATERIALS && deal.paidAt && !deal.remindedMat3d && !r[COL.DRIVE_LINK - 1]) {
      if (countWorkingDaysBetween(new Date(deal.paidAt), now) >= 3) {
        patchDealState(sheet, rowIdx, { remindedMat3d: true });
        if (tgChatId && clientToken) {
          const msgM = deal.chatLang === "kz"
            ? `⏰ Еске саламыз: № <b>${kp}</b> жобасын бастау үшін Google Диск бумасының сілтемесін күтеміз. Сілтемені осында жіберсеңіз, бірден келесі жұмыс күнінен іске қосамыз.`
            : `⏰ Напоминание по проекту № <b>${kp}</b>: чтобы мы запустили работу, ждём от вас ссылку на папку Google Диска с материалами. Пришлите её сюда — и мы сразу зафиксируем дату старта.`;
          sendTelegramApi(clientToken, "sendMessage", { chat_id: tgChatId, text: msgM, parse_mode: "HTML" });
        }
        if (adminToken && adminChatId) {
          sendTelegramApi(adminToken, "sendMessage", {
            chat_id: adminChatId,
            text: `⏳ <b>Прошло 3 раб. дня ожидания материалов по ${kp}</b> (${escapeHtml(r[COL.NAME - 1])}).\nНапоминание отправлено. Мягкая бронь окна истекла — после сдачи файлов поставим в ближайшее свободное окно.`,
            parse_mode: "HTML"
          });
        }
      }
    }
  }
}

/**
 * =========================================================================
 * 7. КЛИЕНТСКИЙ ВЕБ-ПОРТАЛ (client.html) ДЛЯ ЗАКАЗЧИКОВ БЕЗ TELEGRAM И WHATSAPP
 * =========================================================================
 */
function generatePortalToken(kpNumber) {
  const secret = getSecret("PORTAL_SECRET") || (SpreadsheetApp.getActiveSpreadsheet().getId() + "_MK_SEC_2026");
  const sigBytes = Utilities.computeHmacSha256Signature(String(kpNumber), secret);
  return sigBytes.map(b => ("0" + ((b & 0xff).toString(16))).slice(-2)).join("").slice(0, 16);
}

function verifyPortalToken(kpNumber, token) {
  if (!kpNumber || !token) return false;
  return generatePortalToken(kpNumber) === String(token).trim();
}

function getClientPortalUrl(kpNumber) {
  return `${CONFIG.SITE_URL}/client.html?kp=${encodeURIComponent(kpNumber)}&t=${encodeURIComponent(generatePortalToken(kpNumber))}`;
}

function getClientPortalState(kpNumber, token) {
  if (!verifyPortalToken(kpNumber, token)) {
    return { status: "forbidden", message: "Неверная или устаревшая ссылка заявки." };
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  const rowIdx = findRowByKp(sheet, kpNumber);
  if (rowIdx === -1) return { status: "not_found", message: "Заявка не найдена." };

  const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
  const deal = parseJsonSafe(row[COL.DEAL_JSON - 1], {});
  const qInfo = getPublicQueueStatus();

  return {
    status: "ok",
    kpNumber: kpNumber,
    clientName: row[COL.NAME - 1],
    clientOrg: row[COL.ORG - 1],
    category: row[COL.CATEGORY - 1],
    devLanguage: row[COL.DEV_LANG - 1],
    chatLang: deal.chatLang || "ru",
    crmStatus: row[COL.STATUS - 1],
    agreedPrice: Number(row[COL.AGREED_PRICE - 1] || row[COL.SITE_PRICE - 1] || 0),
    totalDays: Number(row[COL.DAYS - 1] || 10),
    requisites: row[COL.REQUISITES - 1] || "",
    contractUrl: extractDocUrlFromCol22(row[COL.META_DOC - 1]),
    driveFolderUrl: row[COL.DRIVE_LINK - 1] || "",
    startDate: row[COL.START_DATE - 1] || "",
    endDate: row[COL.END_DATE - 1] || "",
    nextFreeWindow: qInfo.nextFreeWindow,
    deal: {
      lastExtraQuestion: deal.lastExtraQuestion || "",
      kpVariants: deal.kpVariants || [],
      chosenVariant: deal.chosenVariant || null,
      kpDeadlineText: deal.kpDeadlineText || "",
      holdUntilText: deal.holdUntilText || ""
    }
  };
}

function handleClientPortalPost(data) {
  const kpNumber = data.kpNumber || "";
  if (!verifyPortalToken(kpNumber, data.token || "")) {
    return { status: "forbidden", message: "Ошибка проверки ссылки." };
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  ensureExtendedColumns(sheet);
  const rowIdx = findRowByKp(sheet, kpNumber);
  if (rowIdx === -1) return { status: "not_found" };

  const act = data.action || "";
  const adminToken = getSecret("ADMIN_BOT_TOKEN");
  const adminChatId = getSecret("ADMIN_CHAT_ID");
  const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];

  if (act === "answer_extra") {
    const ans = (data.text || "").trim();
    if (!ans) return { status: "error", message: "Пустой ответ" };
    const oldBrief = (row[COL.BRIEF - 1] || "").toString();
    const updated = oldBrief + "\n\n[ОТВЕТ КЛИЕНТА С ПОРТАЛА НА ДОП. ВОПРОС]:\n" + ans;
    sheet.getRange(rowIdx, COL.BRIEF).setValue(updated);
    sheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.FOR_APPROVAL);
    paintStatusCell(sheet, rowIdx, STATUSES.FOR_APPROVAL);
    patchDealState(sheet, rowIdx, { lastExtraQuestion: "" });

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
    sendBriefReadyCardToAdmin(sheet, rowIdx, aiAnalysis, "🌐 КЛИЕНТ ОТВЕТИЛ С САЙТА");
    return { status: "ok" };
  }

  if (act === "select_kp_variant") {
    const varId = parseInt(data.variantId, 10);
    const deal = readDealState(sheet, rowIdx);
    const variants = Array.isArray(deal.kpVariants) ? deal.kpVariants : [];
    const chosen = variants.find(v => Number(v.id) === varId);
    if (!chosen) return { status: "error", message: "Вариант не найден" };

    sheet.getRange(rowIdx, COL.AGREED_PRICE).setValue(chosen.price);
    sheet.getRange(rowIdx, COL.DAYS).setValue(chosen.days);
    if (data.requisites && data.requisites.trim()) {
      sheet.getRange(rowIdx, COL.REQUISITES).setValue(data.requisites.trim());
    }
    sheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.KP_ACCEPTED);
    paintStatusCell(sheet, rowIdx, STATUSES.KP_ACCEPTED);
    patchDealState(sheet, rowIdx, { chosenVariant: chosen });

    notifyAdminKpAccepted(sheet, rowIdx, chosen, !sheet.getRange(rowIdx, COL.REQUISITES).getValue());
    return { status: "ok" };
  }

  if (act === "agree_contract") {
    sheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.CONTRACT_AGREED);
    paintStatusCell(sheet, rowIdx, STATUSES.CONTRACT_AGREED);
    notifyAdminContractAgreed(sheet, rowIdx);
    return { status: "ok" };
  }

  if (act === "contract_comment") {
    const comment = (data.text || "").trim();
    if (!comment) return { status: "error" };
    const oldBrief = (row[COL.BRIEF - 1] || "").toString();
    sheet.getRange(rowIdx, COL.BRIEF).setValue(oldBrief + "\n\n[ПРАВКА ПО ДОГОВОРУ С ПОРТАЛА]: " + comment);
    patchDealState(sheet, rowIdx, { contractComment: comment });
    if (adminToken && adminChatId) {
      sendTelegramApi(adminToken, "sendMessage", {
        chat_id: adminChatId,
        text: `✏️ <b>Правка/вопрос по договору ${kpNumber} (с портала):</b>\n${escapeHtml(comment)}`,
        parse_mode: "HTML"
      });
    }
    return { status: "ok" };
  }

  if (act === "submit_materials_link") {
    const url = (data.driveLink || "").trim();
    const note = (data.note || "").trim();
    if (!url) return { status: "error", message: "Укажите ссылку на папку" };
    sheet.getRange(rowIdx, COL.DRIVE_LINK).setValue(url);
    if (note) {
      const oldBrief = (row[COL.BRIEF - 1] || "").toString();
      sheet.getRange(rowIdx, COL.BRIEF).setValue(oldBrief + "\n\n[КОММЕНТАРИЙ К МАТЕРИАЛАМ]: " + note);
    }
    if (adminToken && adminChatId) {
      sendTelegramApi(adminToken, "sendMessage", {
        chat_id: adminChatId,
        text: `📂 <b>КЛИЕНТ ЗАГРУЗИЛ ССЫЛКУ НА ПАПКУ GOOGLE ДИСКА (${kpNumber}):</b>\n👤 ${escapeHtml(row[COL.NAME - 1])}\n🔗 ${escapeHtml(url)}${note ? `\n💬 ${escapeHtml(note)}` : ""}`,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🚀 Материалы приняты — СТАРТ В РАБОТУ", callback_data: `start_work_${kpNumber}` }]] }
      });
    }
    return { status: "ok" };
  }

  return { status: "error", message: "Неизвестное действие" };
}

/**
 * =========================================================================
 * 8. GEMINI API + ГЕНЕРАЦИЯ 3 ВАРИАНТОВ ФИНАЛЬНОГО КП + ДОГОВОР GOOGLE DOCS
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

function classifyBranchWithGemini(rawText) {
  try {
    const apiKey = getSecret("GEMINI_API_KEY");
    if (!apiKey || !rawText) return "";
    const out = callGeminiContent([{
      text: `Определи направление бюро «МЕТОДИКО» (верни ТОЛЬКО одно слово: vuz, school, edtech или b2b):\n${rawText}`
    }]).toLowerCase().trim();
    if (out.includes("edtech")) return "edtech";
    if (out.includes("vuz")) return "vuz";
    if (out.includes("school")) return "school";
    if (out.includes("b2b")) return "b2b";
    return "";
  } catch (e) {
    return "";
  }
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
Ориентир цен (можешь слегка адаптировать только текст, цифры оставь точно):
1) Вариант 1: ${p1} тг, ${d1} раб. дн.
2) Вариант 2: ${p2} тг, ${d2} раб. дн.
3) Вариант 3: ${p3} тг, ${d3} раб. дн.

Выжимка брифа: ${row[COL.SUMMARY - 1] || row[COL.BRIEF - 1] || "Стандартный запрос"}

Верни СТРОГО JSON-массив из 3 объектов без markdown:
[{"id":1,"title":"...","price":${p1},"days":${d1},"scope":"краткий конкретный состав работ до 160 знаков"}, ...]`;

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

function transcribeAudioWithGemini(base64Audio, mimeType) {
  const apiKey = getSecret("GEMINI_API_KEY");
  if (!apiKey || !base64Audio) return "[Аудио получено, но GEMINI_API_KEY не задан]";
  try {
    return callGeminiContent([
      { text: "Расшифруй это голосовое сообщение дословно на том языке, на котором говорит клиент (русский или казахский), сохраняя смысл и термины." },
      { inline_data: { mime_type: mimeType || "audio/ogg", data: base64Audio } }
    ]).trim();
  } catch (e) {
    return "[Ошибка распознавания голоса: " + e.toString() + "]";
  }
}

function tryGenerateContractDoc(sheet, rowIdx) {
  const templateId = getSecret("CONTRACT_TEMPLATE_ID");
  if (!templateId) return "";

  try {
    const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const deal = readDealState(sheet, rowIdx);
    const chosen = deal.chosenVariant || {};
    const templateFile = DriveApp.getFileById(templateId);
    const copyFile = templateFile.makeCopy(`Договор_${row[COL.KP - 1]}_${row[COL.ORG - 1] || row[COL.NAME - 1]}`);
    const doc = DocumentApp.openById(copyFile.getId());
    const body = doc.getBody();

    body.replaceText("{{KP_NUMBER}}", row[COL.KP - 1] || "");
    body.replaceText("{{DATE}}", formatDateRu(new Date()));
    body.replaceText("{{CLIENT_NAME}}", row[COL.NAME - 1] || "");
    body.replaceText("{{CLIENT_ORG}}", row[COL.ORG - 1] || "");
    body.replaceText("{{REQUISITES}}", row[COL.REQUISITES - 1] || "");
    body.replaceText("{{TOTAL_PRICE}}", Number(row[COL.AGREED_PRICE - 1] || row[COL.SITE_PRICE - 1] || 0).toLocaleString("ru-RU"));
    body.replaceText("{{TOTAL_DAYS}}", String(row[COL.DAYS - 1] || 14));
    body.replaceText("{{CHOSEN_PACKAGE}}", chosen.title ? `${chosen.title}: ${chosen.scope || ""}` : (row[COL.MODULES - 1] || ""));
    body.replaceText("{{PAYMENT_TERMS}}", "100% предоплата; отсчёт срока со следующего рабочего дня после поступления оплаты И полного комплекта исходных материалов (п. 3.1)");
    doc.saveAndClose();

    const url = copyFile.getUrl();
    updateCol22KeepingTgChat(sheet, rowIdx, url);
    return url;
  } catch (err) {
    Logger.log("Contract gen error: " + err.toString());
    return "";
  }
}

/**
 * =========================================================================
 * 9. ФОРМАТИРОВАНИЕ КАРТОЧЕК, ИНСТРУКЦИИ GOOGLE ДИСКА И ВСПОМОГАТЕЛЬНЫЕ ХЕЛПЕРЫ
 * =========================================================================
 */
function formatKp3VariantsPreview(kp, variants) {
  let msg = `📋 <b>ЧЕРНОВИК ФИНАЛЬНОГО КП (3 варианта) по ${kp}:</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
  variants.forEach(v => {
    msg += `\n<b>${v.id}. ${escapeHtml(v.title)}</b> — <b>${Number(v.price).toLocaleString("ru-RU")} ₸</b> (${v.days} раб. дн.)\n<i>${escapeHtml(v.scope)}</i>\n`;
  });
  msg += `\n💳 Условия оплаты: <b>100% предоплата</b>, старт на следующий рабочий день после оплаты и получения материалов.\n⏳ Окно выбора для клиента: <b>2 рабочих дня</b>.`;
  return msg;
}

function formatKp3VariantsForClient(kp, variants, deadlineDate, lang) {
  if (lang === "kz") {
    let t = `💼 <b>№ ${kp} өтінімі бойынша Қорытынды коммерциялық ұсыныс (3 нұсқа):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
    variants.forEach(v => {
      t += `\n<b>${v.id}. ${escapeHtml(v.title)}</b> — <b>${Number(v.price).toLocaleString("ru-RU")} ₸</b> (${v.days} жұм. күні)\n<i>${escapeHtml(v.scope)}</i>\n`;
    });
    t += `\n💳 Төлем шарты: <b>100% алдын ала төлем</b> (материалдарды алғаннан кейінгі келесі жұмыс күнінен басталады).\n⏰ Осы шарттар мен сметаны <b>2 жұмыс күні ішінде (дейін: ${deadlineDate})</b> сақтаймыз.\n\nТөмендегі батырмалардан өзіңізге қолайлы нұсқаны таңдаңыз:`;
    return t;
  }
  let t = `💼 <b>Финальное коммерческое предложение по проекту № ${kp}:</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
  variants.forEach(v => {
    t += `\n<b>${v.id}. ${escapeHtml(v.title)}</b> — <b>${Number(v.price).toLocaleString("ru-RU")} ₸</b> (${v.days} раб. дн.)\n<i>${escapeHtml(v.scope)}</i>\n`;
  });
  t += `\n💳 Оплата: <b>100% предоплата</b>, старт на следующий рабочий день после оплаты и передачи исходных материалов.\n⏰ Мы держим эти условия и расчёт <b>в течение 2 рабочих дней (до ${deadlineDate})</b>.\n\nВыберите подходящий вариант кнопкой ниже (или задайте вопрос сюда же):`;
  return t;
}

function getGoogleDriveInstructionText(kp, holdUntil, lang) {
  if (lang === "kz") {
    return `✅ <b>Шарт пен 100% төлем расталды! № ${kp} жобасын бастауға дайынбыз.</b>\n\n📂 <b>Бастапқы материалдарды (құжаттар, презентациялар, аудио/видео жазбалар) 3 жұмыс күні ішінде (дейін: ${holdUntil}) қалай жіберуге болады:</b>\n\n1️⃣ Өзіңіздің <b>Google Дискіңізді</b> (drive.google.com) ашыңыз.\n2️⃣ <b>«+ Создать / Жаңа бума»</b> батырмасы арқылы жаңа бума жасаңыз (мысалы: <code>МЕТОДИКО ${kp}</code>).\n3️⃣ Барлық бастапқы материалдарды (Word, PDF, силлабус, аудио) сол бумаға жүктеңіз.\n4️⃣ Буманы оң жақ түймемен басып ➔ <b>«Поделиться / Бөлісу»</b> ➔ <b>«Сілтеме арқылы кез келген адам — Редактор (немесе Оқушы)»</b> таңдап, сілтемені көшіріңіз.\n5️⃣ Сол сілтемені осы чатқа жіберіңіз!\n\n<i>Дайын нәтижені де осы бумаға жүктеп, өзіңізге тапсырамыз.</i>`;
  }
  return `✅ <b>Договор и 100% оплата зафиксированы! Готовы принимать материалы по № ${kp}.</b>\n⏳ На период до <b>${holdUntil}</b> (3 раб. дн.) придерживаем ваше окно в Графике.\n\n📂 <b>Как за 2 минуты передать все исходники (документы, силлабусы, записи, аудио):</b>\n\n1️⃣ Откройте свой <b>Google Диск</b> (drive.google.com).\n2️⃣ Нажмите <b>«+ Создать» ➔ «Новую папку»</b> (назовите её, например: <code>МЕТОДИКО ${kp}</code>).\n3️⃣ Перетащите туда все нужные файлы и аудиозаписи (любого объёма).\n4️⃣ Нажмите на папку правой кнопкой ➔ <b>«Поделиться» ➔ «Доступ по ссылке»</b> ➔ выберите <b>«Редактор»</b> (чтобы мы могли и скачать исходники, и загрузить в эту же папку готовые результаты для вас) и нажмите <b>«Копировать ссылку»</b>.\n5️⃣ Пришлите скопированную ссылку прямо сюда в ответном сообщении!\n\n<i>После проверки комплекта мы сразу включим рабочий отсчёт и пришлём точные даты старта и сдачи.</i>`;
}

function notifyAdminKpAccepted(sheet, rowIdx, chosen, needsReq) {
  const token = getSecret("ADMIN_BOT_TOKEN");
  const adminChatId = getSecret("ADMIN_CHAT_ID");
  if (!token || !adminChatId) return;
  const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
  const kp = row[COL.KP - 1];
  sendTelegramApi(token, "sendMessage", {
    chat_id: adminChatId,
    text: `🤝 <b>КЛИЕНТ ПРИНЯЛ ФИНАЛЬНОЕ КП: ${kp}</b>\n👤 ${escapeHtml(row[COL.NAME - 1])} (${escapeHtml(row[COL.ORG - 1])})\n📦 Вариант: <b>${escapeHtml(chosen.title)}</b>\n💰 Сумма: <b>${Number(chosen.price).toLocaleString("ru-RU")} ₸</b> | ⏱ ${chosen.days} раб. дн.\n🏦 Реквизиты: ${needsReq ? "<i>запросили у клиента, ждём</i>" : escapeHtml(row[COL.REQUISITES - 1])}`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "📄 Собрать и проверить Договор", callback_data: `approve_${kp}` }]]
    }
  });
}

function notifyAdminRequisitesReceived(sheet, rowIdx, reqText) {
  const token = getSecret("ADMIN_BOT_TOKEN");
  const adminChatId = getSecret("ADMIN_CHAT_ID");
  if (!token || !adminChatId || rowIdx === -1) return;
  const kp = sheet.getRange(rowIdx, COL.KP).getValue();
  sendTelegramApi(token, "sendMessage", {
    chat_id: adminChatId,
    text: `🏦 <b>Реквизиты получены по ${kp}:</b>\n<code>${escapeHtml(reqText)}</code>`,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "📄 Собрать и проверить Договор", callback_data: `approve_${kp}` }]] }
  });
}

function notifyAdminContractAgreed(sheet, rowIdx) {
  const token = getSecret("ADMIN_BOT_TOKEN");
  const adminChatId = getSecret("ADMIN_CHAT_ID");
  if (!token || !adminChatId) return;
  const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
  const kp = row[COL.KP - 1];
  sendTelegramApi(token, "sendMessage", {
    chat_id: adminChatId,
    text: `✍️ <b>ДОГОВОР СОГЛАСОВАН КЛИЕНТОМ: ${kp}!</b>\n👤 ${escapeHtml(row[COL.NAME - 1])} (${escapeHtml(row[COL.ORG - 1])})\n💰 ${Number(row[COL.AGREED_PRICE - 1] || row[COL.SITE_PRICE - 1]).toLocaleString("ru-RU")} ₸\n\nПосле подписания и поступления 100% оплаты нажмите кнопку ниже, чтобы отправить клиенту инструкцию по передаче материалов и забронировать окно:`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "💰 Подписано + 100% оплачено (Ждем материалы)", callback_data: `paid_${kp}` }]]
    }
  });
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
      1: "<b>6-дан 1-сұрақ.</b> Бұл жоба қандай басты міндетті шешуі керек және 3–6 айдан кейін не өзгеруі тиіс?",
      2: "<b>6-дан 2-сұрақ.</b> Жобаның 100% сәтті іске асқанын қандай нақты сандар мен нәтижелер бойынша бағалайсыз?",
      3: "<b>6-дан 3-сұрақ.</b> Қолыңызда қандай дайын материалдар бар (презентация, силлабус, аудио/видео) және сіздің тарапыңыздан командаға кім қатысады?",
      4: getBranchQuestionText(category, "kz"),
      5: "<b>6-дан 5-сұрақ.</b> Жобаны қашан бастау ыңғайлы және тағы нені ескеруіміз маңызды?",
      6: "<b>6-дан 6-сұрақ.</b> Төлемді қалай жоспарлайсыз (ЖШС / ЖК / жеке тұлға)? Шарт үшін деректемелерді жазыңыз (немесе «кейін жіберемін» деңіз)."
    };
    return mapKz[step] || mapKz[6];
  }
  const mapRu = {
    1: "<b>Вопрос 1 из 6.</b> Какую главную задачу должен решить проект и что изменится после внедрения?",
    2: "<b>Вопрос 2 из 6.</b> По каким конкретным цифрам или действиям вы поймёте, что проект сработал на 100%?",
    3: "<b>Вопрос 3 из 6.</b> Какие материалы уже есть на руках (презентации, силлабусы, записи звонков/лекций) и кто будет в команде с вашей стороны?",
    4: getBranchQuestionText(category, "ru"),
    5: "<b>Вопрос 5 из 6.</b> Когда вам комфортно стартовать и что ещё нам важно знать о проекте?",
    6: "<b>Вопрос 6 из 6.</b> Как планируете оплату (ТОО / ИП / физлицо)? Напишите реквизиты организации для договора (или «отправлю позже»)."
  };
  return mapRu[step] || mapRu[6];
}

function detectKazakhSentence(text) {
  if (!text) return false;
  const cleaned = text.toString().replace(/ұстаз/gi, "");
  return /[әіңғүұқөһӘІҢҒҮҰҚӨҺ]/.test(cleaned);
}

function detectBranchKey(text) {
  const c = (text || "").toLowerCase();
  if (!c) return "";
  const wb = "(?:^|[^a-zа-яёәіңғүұқөһ])";
  const wa = "(?:$|[^a-zа-яёәіңғүұқөһ])";
  const hasWord = (words) => new RegExp(wb + "(" + words + ")" + wa).test(c);

  if (/(edtech|онлайн-школ|онлайн школ|онлайн-курс|онлайн курс|онлайн-мектеп|доходимост|геткурс|getcourse|вебинар|продюсер|инфокурс|аяқтау көрсеткіш)/.test(c) || hasWord("cor|эдтех")) {
    return "edtech";
  }
  if (/(универ|колледж|умкд|силлабус|platonus|moodle|ects|кредит|бакалавр|магистр|кафедр|госо|мжмбс)/.test(c) || hasWord("вуз|вузы|вуза|вузу|вузов|жоо|оәк|пән|пәні|пәннің")) {
    return "vuz";
  }
  if (/(ұстаз|устаз|аттестац|аттестат|модератор|сарапшы|зерттеуші|шебер|комикс|школ|мектеп|34 час|68 час|34 сағат|68 сағат)/.test(c) || hasWord("ктп|қмж|ктж|бжб|тжб|сор|соч|фо")) {
    return "school";
  }
  if (/(корпорац|корпоратив|тренаж|отдел продаж|менеджер|стаж[её]р|скрипт|битрикс|bitrix|колл-центр|қызметкер)/.test(c) || hasWord("b2b|битуби|crm|срм|роп|ропа|ропу|сату")) {
    return "b2b";
  }
  return "";
}

function resolveBranchKeyFromCategory(category) {
  return detectBranchKey(category) || "b2b";
}

function getCanonicalBranchName(branchKey, lang) {
  if (lang === "kz") {
    const mapKz = {
      vuz: "ЖОО және Колледждер (МЖМБС 2026)",
      b2b: "Корпорациялар және B2B (Тренажерлер)",
      school: "Мектептер және «Ұстаз»",
      edtech: "EdTech және Онлайн-курстар"
    };
    return mapKz[branchKey] || mapKz.b2b;
  }
  const mapRu = {
    vuz: "ВУЗы и Колледжи (ГОСО 2026)",
    b2b: "Корпорации и B2B (Тренажеры)",
    school: "Школы и «Ұстаз»",
    edtech: "EdTech и Онлайн-школы"
  };
  return mapRu[branchKey] || mapRu.b2b;
}

function getBranchQuestionText(category, lang) {
  const branchKey = resolveBranchKeyFromCategory(category);
  if (lang === "kz") {
    if (branchKey === "edtech") {
      return "<b>6-дан 4-сұрақ (EdTech / Курстар).</b> Бұл қолданыстағы курсты жандандыру ма (қазіргі COR % қандай?) әлде аудиодан жаңа курс құрастыру ма?";
    }
    if (branchKey === "vuz") {
      return "<b>6-дан 4-сұрақ (ЖОО / Колледж).</b> Пән атауын, кредит санын және қандай LMS (Platonus/Moodle) қолданатыныңызды жазыңыз.";
    }
    if (branchKey === "school") {
      return "<b>6-дан 4-сұрақ (Мектеп / «Ұстаз»).</b> Пәнді, сыныпты, сағат көлемін (34 немесе 68 сағат) және педагог растайтын санатты (педагог-модератор, сарапшы, зерттеуші, шебер) көрсетіңіз.";
    }
    return "<b>6-дан 4-сұрақ (Корпоративтік B2B).</b> Кімді оқытамыз (стажер, менеджер, басшы) және сатылым қай кезеңде жиі үзіледі?";
  }

  if (branchKey === "edtech") {
    return "<b>Вопрос 4 из 6 (EdTech и курсы).</b> Это реанимация действующего курса (какой сейчас % доходимости COR?) или сборка с нуля из аудиозаписей?";
  }
  if (branchKey === "vuz") {
    return "<b>Вопрос 4 из 6 (ВУЗ / Колледж).</b> Напишите название дисциплины, количество кредитов ECTS и используемую платформу (Platonus/Moodle).";
  }
  if (branchKey === "school") {
    return "<b>Вопрос 4 из 6 (Школа / Аттестация).</b> Укажите предмет, класс, объём (34 или 68 часов) и подтверждаемую категорию педагога (педагог-модератор, эксперт, исследователь, мастер).";
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
  let bg = "#F1F5F9";
  if (statusText.includes("🟡")) bg = "#FEF9C3";
  else if (statusText.includes("🟣")) bg = "#F3E8FF";
  else if (statusText.includes("🔵")) bg = "#DBEAFE";
  else if (statusText.includes("🟠")) bg = "#FFEDD5";
  else if (statusText.includes("💼")) bg = "#E0E7FF";
  else if (statusText.includes("🤝")) bg = "#D1FAE5";
  else if (statusText.includes("📄")) bg = "#E2E8F0";
  else if (statusText.includes("✍️")) bg = "#BAE6FD";
  else if (statusText.includes("⏳")) bg = "#FEF3C7";
  else if (statusText.includes("🟢")) bg = "#DCFCE7";
  else if (statusText.includes("📅")) bg = "#FDE68A";
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
      const parsedStep = parseFloat(data[i][4]);
      return {
        kpNumber: data[i][1],
        category: data[i][2],
        categoryConfirmed: Boolean(data[i][2]),
        lang: data[i][3] || "ru",
        step: isNaN(parsedStep) ? 1 : parsedStep,
        answers: parseJsonSafe(data[i][5], {})
      };
    }
  }
  return null;
}

function updateClientMemStep(ss, chatId, kpNumber, newStep) {
  const memSheet = ss.getSheetByName(CONFIG.SHEET_MEMORY);
  if (!memSheet) return;
  const state = loadDialogState(memSheet, chatId);
  if (state && String(state.kpNumber) === String(kpNumber)) {
    state.step = newStep;
    saveDialogState(memSheet, chatId, state);
  }
}

function parseJsonSafe(str, fallback) {
  try {
    return str ? JSON.parse(str.toString()) : fallback;
  } catch (e) {
    return fallback;
  }
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

function ensureTgChatInCol22(sheet, rowIdx, chatId) {
  if (!sheet || rowIdx === -1 || !chatId) return;
  const cell = sheet.getRange(rowIdx, COL.META_DOC);
  const existing = (cell.getValue() || "").toString().trim();
  const tag = "tg_chat:" + chatId;
  if (existing.includes(tag)) return;
  if (/tg_chat:\d+/.test(existing)) {
    cell.setValue(existing.replace(/tg_chat:\d+/, tag));
  } else {
    cell.setValue(existing ? `${tag} | ${existing}` : tag);
  }
}

function updateCol22KeepingTgChat(sheet, rowIdx, noteOrUrl) {
  if (!sheet || rowIdx === -1) return;
  const cell = sheet.getRange(rowIdx, COL.META_DOC);
  const existing = (cell.getValue() || "").toString();
  const m = existing.match(/tg_chat:\d+/);
  const cleanNote = (noteOrUrl || "").toString().trim();
  if (m && cleanNote) {
    cell.setValue(`${m[0]} | ${cleanNote}`);
  } else if (m) {
    cell.setValue(m[0]);
  } else {
    cell.setValue(cleanNote);
  }
}

function extractDocUrlFromCol22(val) {
  const m = (val || "").toString().match(/https:\/\/docs\.google\.com\/[^\s|]+/);
  return m ? m[0] : "";
}

function resolveClientTgChatId(ss, leadsSheet, rowIdx, kpNumber) {
  if (leadsSheet && rowIdx !== -1) {
    const meta = (leadsSheet.getRange(rowIdx, COL.META_DOC).getValue() || "").toString();
    const m = meta.match(/tg_chat:(\d+)/);
    if (m) return m[1];
  }
  const memSheet = ss.getSheetByName(CONFIG.SHEET_MEMORY);
  if (!memSheet || !kpNumber) return "";
  const memData = memSheet.getDataRange().getValues();
  for (let i = 1; i < memData.length; i++) {
    if (String(memData[i][1]) === String(kpNumber) && memData[i][0]) {
      return String(memData[i][0]);
    }
  }
  return "";
}

function setAdminPendingAction(chatId, actionObj) {
  const props = PropertiesService.getScriptProperties();
  actionObj.expiresAt = Date.now() + 1800000; // 30 минут
  props.setProperty("ADMIN_PENDING_" + chatId, JSON.stringify(actionObj));
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
