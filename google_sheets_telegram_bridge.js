/**
 * =========================================================================
 * ТОО «Метод и Ко» | Бюро стандартов «МЕТОДИКО»
 * УМНЫЙ ОБЛАЧНЫЙ МОСТ v5.0:
 * САЙТ (Единый Кабинет client.html + index.html + brief.html)
 *   ➔ GOOGLE ТАБЛИЦА + GOOGLE ДИСК (Папки клиентов, Документы КП и Договора)
 *   ➔ АВТО-EMAIL КЛИЕНТУ (0 ₸)
 *   ➔ ЛИЧНЫЙ ПУЛЬТ РУКОВОДИТЕЛЯ (@metodico_sait_zayavki_bot) + GEMINI
 * =========================================================================
 * Секретные ключи хранятся ТОЛЬКО в «Настройки проекта -> Свойства скрипта»:
 *   - ADMIN_BOT_TOKEN          : токен личного пульта (@metodico_sait_zayavki_bot)
 *   - ADMIN_CHAT_ID            : ваш личный Telegram ID
 *   - GEMINI_API_KEY           : ключ из Google AI Studio
 *   - PORTAL_SECRET            : секрет для подписей клиентских и админских ссылок (опционально)
 *   - ROOT_PROJECTS_FOLDER_ID  : ID корневой папки проектов на Диске (создаётся сам при 1-м запуске)
 *   - CONTRACT_TEMPLATE_ID     : (необязательно) ID шаблона Google Docs, если хотите использовать свой шаблон
 * =========================================================================
 */

const CONFIG = {
  SHEET_LEADS: "Заявки МЕТОДИКО",
  SHEET_QUEUE: "График и Очередь",
  SHEET_MEMORY: "Память диалогов",
  COMPANY_NAME: "ТОО «Метод и Ко» | Бюро «МЕТОДИКО»",
  SITE_URL: "https://metodico-kz.netlify.app",
  ROOT_FOLDER_NAME: "МЕТОДИКО — Проекты клиентов",
  MAX_CAPACITY_POINTS: 10, // Потолок одновременной загрузки (5-7 активных проектов)
  GEMINI_MODEL: "gemini-3.5-flash-lite"
};

// Карта столбцов листа «Заявки МЕТОДИКО» (1-based, совместима с v4.0)
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
  DONE: "✅ 12. Сдано / АВР подписан"
};

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
  try { getOrCreateRootProjectsFolder(); } catch (e) { Logger.log("Root folder init: " + e); }
  try { MailApp.getRemainingDailyQuota(); } catch (e) { Logger.log("MailApp quota check: " + e); }
}

function ensureExtendedColumns(sheet) {
  if (!sheet) return;
  if (!sheet.getRange(1, COL.DRIVE_LINK).getValue()) {
    sheet.getRange(1, COL.DRIVE_LINK).setValue("Папка проекта (Google Диск)")
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
 * 2. ОБРАБОТКА ВХОДЯЩИХ ЗАПРОСОВ: GET (ОЧЕРЕДЬ + КАБИНЕТ) И POST
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
      return jsonResponse(getClientPortalState(params.kp || "", params.t || "", params.admin || ""));
    }
    return jsonResponse({ status: "ok", service: "METODIKO Bridge v5.0" });
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

    // Старый клиентский бот (?bot=client) переводит на сайт
    if (botType === "client") {
      return handleDeprecatedClientBot(data);
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

    // Honeypot-фильтр от спам-ботов с сайта
    if (data.hp || data.company_fax_code) {
      return jsonResponse({ status: "ignored_bot" });
    }

    // Действия из Единого Кабинета Клиента / Админ-просмотра А4 (client.html)
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

function handleDeprecatedClientBot(update) {
  const clientToken = getSecret("CLIENT_BOT_TOKEN");
  if (clientToken && update && update.message && update.message.chat) {
    sendTelegramApi(clientToken, "sendMessage", {
      chat_id: update.message.chat.id,
      text: `Здравствуйте! Бюро «МЕТОДИКО» перенесло расчёт, распаковку, КП и договоры в удобный Личный кабинет на сайте:\n${CONFIG.SITE_URL}/#calculator`
    });
  }
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

  const dealInit = {
    chatLang: chatLang,
    devLanguageCode: lead.devLanguage || "ru",
    selectedItems: Array.isArray(lead.selectedItems) ? lead.selectedItems : [],
    crmMeta: {
      source: lead.utm_source || "website",
      utm_medium: lead.utm_medium || "",
      utm_campaign: lead.utm_campaign || "",
      referrer: lead.referrer || "",
      city: lead.clientCity || "",
      phoneNormalized: normalizePhone(lead.clientPhone || ""),
      createdAtIso: new Date().toISOString()
    }
  };

  const rowData = [
    kpNumber,
    new Date().toLocaleString("ru-RU"),
    lead.clientName || "—",
    lead.clientOrg || "—",
    normalizePhone(lead.clientPhone) || lead.clientPhone || "—",
    (lead.clientEmail || "").toString().trim() || "—",
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
    "", // V: Договор
    "", // W: Папка Google Диск
    JSON.stringify(dealInit) // X: Deal state
  ];

  sheet.appendRow(rowData);
  const rowIdx = sheet.getLastRow();
  paintStatusCell(sheet, rowIdx, STATUSES.DRAFT_KP);
  SpreadsheetApp.flush();

  // Автоматически создаём именную папку клиента на Google Диске
  const folderInfo = ensureProjectDriveFolder(sheet, rowIdx);

  const portalToken = generatePortalToken(kpNumber);
  const portalUrl = getClientPortalUrl(kpNumber);
  const adminPortalUrl = getAdminPortalUrl(kpNumber);

  // Уведомляем Наталью в личный пульт (спокойное уведомление: клиент перешёл к Шагу 2)
  sendAdminStep1Notice(lead, kpNumber, rowIdx, itemsSummary, devLangLabel, loadPoints, portalUrl, adminPortalUrl, folderInfo.rootUrl);

  return {
    status: "success",
    kpNumber: kpNumber,
    portalToken: portalToken,
    portalUrl: portalUrl,
    driveFolderUrl: folderInfo.rootUrl || ""
  };
}

function processWebBriefSubmission(payload) {
  const kpNumber = payload.kpNumber || ("MK-WEB-" + Math.floor(1000 + Math.random() * 9000));
  const chatLang = payload.interfaceLang === "kz" ? "kz" : "ru";
  const category = payload.audienceCategory || "Не указано";

  const structuredAnswers = {
    q1: payload.q1_goal || "",
    q2: payload.q2_criteria || "",
    q3: payload.q3_resources || "",
    q4: payload.q4_team || "",
    q5: payload.q5_budget || "",
    q6: payload.q6_fkr_branch || "",
    q7: payload.q7_extra || "",
    q8: payload.q8_requisites || "",
    city: payload.clientCity || ""
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
    const dealObj = {
      chatLang: chatLang,
      devLanguageCode: devCode,
      briefAnswers: structuredAnswers,
      transcript: aiAnalysis.transcript || "",
      crmMeta: {
        source: payload.utm_source || "web_brief",
        city: payload.clientCity || "",
        phoneNormalized: normalizePhone(payload.clientPhone || ""),
        createdAtIso: new Date().toISOString()
      }
    };
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
      aiAnalysis.requisites || structuredAnswers.q8 || "—",
      "", "", "", "",
      JSON.stringify(dealObj)
    ];
    sheet.appendRow(newRow);
    rowIdx = sheet.getLastRow();
  } else {
    if (category && category !== "Не указано") {
      sheet.getRange(rowIdx, COL.CATEGORY).setValue(category);
    }
    if (payload.clientEmail && payload.clientEmail !== "—") {
      sheet.getRange(rowIdx, COL.EMAIL).setValue(payload.clientEmail.trim());
    }
    if (payload.clientTg && payload.clientTg !== "—") {
      sheet.getRange(rowIdx, COL.TG).setValue(payload.clientTg.trim());
    }
    if (payload.clientPhone && payload.clientPhone !== "—") {
      sheet.getRange(rowIdx, COL.PHONE).setValue(payload.clientPhone.trim());
    }
    if (payload.clientOrg && payload.clientOrg !== "—") {
      sheet.getRange(rowIdx, COL.ORG).setValue(payload.clientOrg.trim());
    }
    sheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.FOR_APPROVAL);
    sheet.getRange(rowIdx, COL.SUMMARY).setValue(aiAnalysis.summary);
    sheet.getRange(rowIdx, COL.BRIEF).setValue(fullBriefText);
    if (aiAnalysis.requisites || structuredAnswers.q8) {
      sheet.getRange(rowIdx, COL.REQUISITES).setValue(aiAnalysis.requisites || structuredAnswers.q8);
    }
    patchDealState(sheet, rowIdx, {
      chatLang: chatLang,
      briefAnswers: structuredAnswers,
      transcript: aiAnalysis.transcript || ""
    });
  }

  paintStatusCell(sheet, rowIdx, STATUSES.FOR_APPROVAL);
  SpreadsheetApp.flush();

  // Создаём папку проекта на Диске и сохраняем туда файл Брифа
  ensureProjectDriveFolder(sheet, rowIdx);
  generateAndSaveBriefDoc(sheet, rowIdx, fullBriefText, aiAnalysis.summary);

  // Уведомляем Наталью в личный бот + отправляем клиенту письмо со ссылкой на его Кабинет
  sendBriefReadyCardToAdmin(sheet, rowIdx, aiAnalysis);
  sendPortalLinkEmail(sheet, rowIdx, "brief_received");

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
    [{ text: "👁️ Проверить / Редактировать в Кабинете", url: adminPortalUrl }]
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

  // 3. Сборка черновика Финального КП + создание Документа А4 и файла на Диске
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
      text: preview + (kpDoc && kpDoc.docUrl ? `\n\n📂 <i>Копия КП уже сохранена в папку клиента на Диске.</i>` : ""),
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

  // 5. Отправка Финального КП клиенту (публикуется в Кабинете + авто-Email + PDF)
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
    SpreadsheetApp.flush();

    ensureProjectDriveFolder(sheet, rowIdx);
    generateAndSaveFinalKpDoc(sheet, rowIdx);

    const emailRes = sendPortalLinkEmail(sheet, rowIdx, "final_kp");
    const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const portalUrl = getClientPortalUrl(kp, "kp");
    const adminKpUrl = getAdminPortalUrl(kp, "kp");

    const emailNote = emailRes.sent
      ? `✅ <b>Финальное КП автоматически отправлено клиенту на Email</b> (${escapeHtml(emailRes.to)}) и открыто в его Кабинете!`
      : `⚠️ <b>Финальное КП опубликовано в Кабинете, но письмо не ушло</b> (${escapeHtml(row[COL.EMAIL - 1] || "пусто")} | причина: ${escapeHtml(emailRes.reason || "нет Email")}).\nСсылка для клиента:\n<code>${portalUrl}</code>`;

    const kb = [[{ text: "👁️ Открыть КП в Кабинете", url: adminKpUrl }]];
    if (!emailRes.sent) {
      const wa = buildWaQuickLink(row[COL.PHONE - 1], `Здравствуйте! Ваше Финальное КП № ${kp} с 3 вариантами и PDF готово: ${portalUrl}`);
      if (wa) kb.push([{ text: "📱 Передать в WhatsApp (запасной канал)", url: wa }]);
    }

    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `${emailNote}\n\n⏳ Ждём выбор варианта до <b>${deadlineDate}</b> (2 раб. дн.).`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: kb }
    });
    return ContentService.createTextOutput("OK");
  }

  // 6. Сборка предварительного Договора (создаёт/обновляет Google Док + PDF в папке клиента и даёт ссылку А4 на проверку)
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

    const replyTxt = `📄 <b>Черновик Договора по ${kp} готов к вашей проверке!</b>\n`
      + `💰 Сумма: <b>${price} ₸</b> (100% предоплата) | ⏱ ${row[COL.DAYS - 1]} раб. дн.\n`
      + `📅 Ближайшее окно старта: <b>${qInfo.nextFreeWindow}</b>\n`
      + (docRes.docUrl ? `\n📂 <i>Сохранено в папку клиента на Диске.</i>` : "");

    const kb = [
      [{ text: "👁️ Прочитать / Отредактировать Договор (А4 на сайте)", url: adminContractUrl }],
      [{ text: "✅ Согласовано мной ➔ Отправить Договор клиенту", callback_data: `send_contract_${kp}` }],
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

  // 7. Отправка Договора клиенту (публикуется в Кабинете + авто-Email + PDF)
  if (data.startsWith("send_contract_")) {
    const kp = data.replace("send_contract_", "");
    const rowIdx = findRowByKp(sheet, kp);
    if (rowIdx === -1) return ContentService.createTextOutput("OK");

    sheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.CONTRACT_SENT);
    paintStatusCell(sheet, rowIdx, STATUSES.CONTRACT_SENT);
    SpreadsheetApp.flush();

    ensureProjectDriveFolder(sheet, rowIdx);
    generateAndSaveContractDoc(sheet, rowIdx);

    const emailRes = sendPortalLinkEmail(sheet, rowIdx, "contract");
    const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
    const portalUrl = getClientPortalUrl(kp, "contract");
    const adminContractUrl = getAdminPortalUrl(kp, "contract");

    const emailNote = emailRes.sent
      ? `✅ <b>Договор по ${kp} автоматически отправлен клиенту на Email</b> (${escapeHtml(emailRes.to)}) и открыт в его Кабинете!`
      : `⚠️ <b>Договор по ${kp} опубликован в Кабинете, но письмо не ушло</b> (${escapeHtml(row[COL.EMAIL - 1] || "пусто")} | причина: ${escapeHtml(emailRes.reason || "нет Email")}):\n<code>${portalUrl}</code>`;

    const kb = [[{ text: "👁️ Открыть Договор в Кабинете", url: adminContractUrl }]];
    if (!emailRes.sent) {
      const wa = buildWaQuickLink(row[COL.PHONE - 1], `Здравствуйте! Договор по проекту № ${kp} готов к проверке и согласованию: ${portalUrl}`);
      if (wa) kb.push([{ text: "📱 Передать в WhatsApp (запасной канал)", url: wa }]);
    }

    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `${emailNote}\n\nЖдём подтверждения или правок от клиента.`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: kb }
    });
    return ContentService.createTextOutput("OK");
  }

  // 8. Подписано + 100% оплачено ➔ Ждём материалы (авто-Email с инструкцией!)
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

    const emailRes = sendPortalLinkEmail(sheet, rowIdx, "waiting_materials");
    const adminMatUrl = getAdminPortalUrl(kp, "materials");
    const driveUrl = sheet.getRange(rowIdx, COL.DRIVE_LINK).getValue();

    const kb = [
      [{ text: "🚀 Материалы приняты — СТАРТ В РАБОТУ", callback_data: `start_work_${kp}` }],
      [{ text: "👁️ Открыть Кабинет клиента", url: adminMatUrl }]
    ];
    if (driveUrl) kb.push([{ text: "📂 Папка проекта на Диске", url: driveUrl }]);

    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `💰 <b>По ${kp} зафиксированы подпись и 100% оплата!</b>\nМягкая бронь окна: до <b>${holdUntil}</b> (3 раб. дн.).\n\n${emailRes.sent ? `✅ Клиенту автоматически отправлено письмо на ${escapeHtml(emailRes.to)} со ссылкой на загрузку материалов.` : "🔗 Клиент может загрузить материалы в Кабинете: " + getClientPortalUrl(kp, "materials")}`,
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
    const emailRes = sendPortalLinkEmail(sheet, rowIdx, "project_started");

    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `🚀 Даты по <b>${kp}</b> (${row[COL.START_DATE - 1]} ➔ ${row[COL.END_DATE - 1]}) обновлены в Кабинете!${emailRes.sent ? `\n✅ Письмо клиенту отправлено на ${escapeHtml(emailRes.to)}.` : ""}`,
      parse_mode: "HTML"
    });
    return ContentService.createTextOutput("OK");
  }

  // 11. Закрытие проекта и освобождение слота
  if (data.startsWith("done_")) {
    const kp = data.replace("done_", "");
    const rowIdx = findRowByKp(sheet, kp);
    if (rowIdx !== -1) {
      sheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.DONE);
      paintStatusCell(sheet, rowIdx, STATUSES.DONE);
      recalculateQueueSheet();
      sendPortalLinkEmail(sheet, rowIdx, "project_done");
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
    sheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.EXTRA_QUESTION);
    paintStatusCell(sheet, rowIdx, STATUSES.EXTRA_QUESTION);
    const oldBrief = (sheet.getRange(rowIdx, COL.BRIEF).getValue() || "").toString();
    sheet.getRange(rowIdx, COL.BRIEF).setValue(oldBrief + "\n\n[ДОП. ВОПРОС ОТ НАТАЛЬИ]: " + userText);
    patchDealState(sheet, rowIdx, { lastExtraQuestion: userText });

    const emailRes = sendPortalLinkEmail(sheet, rowIdx, "extra_question");
    const portalUrl = getClientPortalUrl(kp);

    sendTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `🟠 Вопрос по <b>${kp}</b> опубликован в Кабинете клиента!${emailRes.sent ? `\n✅ Письмо отправлено на ${escapeHtml(emailRes.to)}.` : `\n🔗 Ссылка на Кабинет: <code>${portalUrl}</code>`}`,
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

  sheet.getRange(rowIdx, COL.STATUS).setValue(newStatus);
  sheet.getRange(rowIdx, COL.START_DATE).setValue(startStr);
  sheet.getRange(rowIdx, COL.END_DATE).setValue(endStr);
  paintStatusCell(sheet, rowIdx, newStatus);
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
    const st = r[COL.STATUS - 1];
    const deal = parseJsonSafe(r[COL.DEAL_JSON - 1], {});

    if (st === STATUSES.FINAL_KP_SENT && deal.kpSentAt && !deal.remindedKp2d) {
      if (countWorkingDaysBetween(new Date(deal.kpSentAt), now) >= 2) {
        patchDealState(sheet, rowIdx, { remindedKp2d: true });
        sendPortalLinkEmail(sheet, rowIdx, "reminder_kp");
        if (adminToken && adminChatId) {
          sendTelegramApi(adminToken, "sendMessage", {
            chat_id: adminChatId,
            text: `⏰ <b>Прошло 2 раб. дня по Финальному КП ${kp}</b> (${escapeHtml(r[COL.NAME - 1])}).\nКлиенту отправлено вежливое напоминание на Email.`,
            parse_mode: "HTML"
          });
        }
      }
    }

    if (st === STATUSES.WAITING_MATERIALS && deal.paidAt && !deal.remindedMat3d && !deal.clientMaterialsUrl && !deal.uploadedMaterialsCount) {
      if (countWorkingDaysBetween(new Date(deal.paidAt), now) >= 3) {
        patchDealState(sheet, rowIdx, { remindedMat3d: true });
        sendPortalLinkEmail(sheet, rowIdx, "reminder_materials");
        if (adminToken && adminChatId) {
          sendTelegramApi(adminToken, "sendMessage", {
            chat_id: adminChatId,
            text: `⏳ <b>Прошло 3 раб. дня ожидания материалов по ${kp}</b> (${escapeHtml(r[COL.NAME - 1])}).\nНапоминание отправлено на Email.`,
            parse_mode: "HTML"
          });
        }
      }
    }
  }
}

/**
 * =========================================================================
 * 6. ЕДИНЫЙ КАБИНЕТ КЛИЕНТА И АДМИН-РЕЖИМ А4 (client.html)
 * =========================================================================
 */
function generatePortalToken(kpNumber) {
  const secret = getSecret("PORTAL_SECRET") || (SpreadsheetApp.getActiveSpreadsheet().getId() + "_MK_SEC_2026");
  const sigBytes = Utilities.computeHmacSha256Signature(String(kpNumber), secret);
  return sigBytes.map(b => ("0" + ((b & 0xff).toString(16))).slice(-2)).join("").slice(0, 16);
}

function generateAdminToken(kpNumber) {
  const secret = (getSecret("PORTAL_SECRET") || (SpreadsheetApp.getActiveSpreadsheet().getId() + "_MK_SEC_2026")) + "_ADMIN_MK";
  const sigBytes = Utilities.computeHmacSha256Signature("ADM:" + String(kpNumber), secret);
  return sigBytes.map(b => ("0" + ((b & 0xff).toString(16))).slice(-2)).join("").slice(0, 16);
}

function verifyPortalToken(kpNumber, token) {
  if (!kpNumber || !token) return false;
  return generatePortalToken(kpNumber) === String(token).trim();
}

function verifyAdminToken(kpNumber, adminSig) {
  if (!kpNumber || !adminSig) return false;
  return generateAdminToken(kpNumber) === String(adminSig).trim();
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
  const isAdmin = verifyAdminToken(kpNumber, adminSig);
  const crmStatus = row[COL.STATUS - 1] || "";

  // Разрешаем видеть Финальное КП: админу всегда если собрано, клиенту — с момента отправки (и дальше в архиве!)
  const kpPublished = crmStatus.includes("💼") || crmStatus.includes("🤝") || crmStatus.includes("📄") || crmStatus.includes("✍️") || crmStatus.includes("⏳") || crmStatus.includes("🟢") || crmStatus.includes("📅") || crmStatus.includes("✅");
  const contractPublished = crmStatus.includes("📄") || crmStatus.includes("✍️") || crmStatus.includes("⏳") || crmStatus.includes("🟢") || crmStatus.includes("📅") || crmStatus.includes("✅");

  return {
    status: "ok",
    isAdmin: isAdmin,
    kpNumber: kpNumber,
    branchKey: resolveBranchKeyFromCategory(row[COL.CATEGORY - 1]),
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
    startDate: row[COL.START_DATE - 1] || "",
    endDate: row[COL.END_DATE - 1] || "",
    nextFreeWindow: qInfo.nextFreeWindow,
    kpPublished: kpPublished,
    contractPublished: contractPublished,
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
  const kpNumber = data.kpNumber || "";
  if (!verifyPortalToken(kpNumber, data.token || "")) {
    return { status: "forbidden", message: "Ошибка проверки ссылки." };
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_LEADS);
  ensureExtendedColumns(sheet);
  const rowIdx = findRowByKp(sheet, kpNumber);
  if (rowIdx === -1) return { status: "not_found", message: "Заявка не найдена." };

  const act = data.action || "";
  const adminToken = getSecret("ADMIN_BOT_TOKEN");
  const adminChatId = getSecret("ADMIN_CHAT_ID");
  const row = sheet.getRange(rowIdx, 1, 1, COL.DEAL_JSON).getValues()[0];
  const isAdmin = verifyAdminToken(kpNumber, data.admin || "");

  // 1. Отправка распаковки прямо из Кабинета (client.html)
  if (act === "submit_brief") {
    const ans = data.answers || {};
    const category = data.audienceCategory || row[COL.CATEGORY - 1] || "Не указано";
    const chatLang = data.interfaceLang === "kz" ? "kz" : "ru";

    const rawAnswersText = [
      `1. Главная задача и эффект (Дилтс): ${ans.q1 || "—"}`,
      `2. Критерии результата: ${ans.q2 || "—"}`,
      `3. Исходные материалы на руках: ${ans.q3 || "—"}`,
      `4. Команда и время со стороны заказчика: ${ans.q4 || "—"}`,
      `5. Комфортность бюджета/сроков и дата старта: ${ans.q5 || "—"}`,
      `6. Специфика направления (ФКР и стандарты): ${ans.q6 || "—"}`,
      `7. Доп. информация и оставшиеся вопросы: ${ans.q7 || "—"}`,
      `8. Форма оплаты и реквизиты: ${ans.q8 || "—"}`,
      ans.city ? `9. Город / Страна: ${ans.city}` : ""
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

    if (category && category !== "Не указано") sheet.getRange(rowIdx, COL.CATEGORY).setValue(category);
    if (data.clientName && data.clientName.trim()) sheet.getRange(rowIdx, COL.NAME).setValue(data.clientName.trim());
    if (data.clientOrg && data.clientOrg.trim()) sheet.getRange(rowIdx, COL.ORG).setValue(data.clientOrg.trim());
    if (data.clientPhone && data.clientPhone.trim()) sheet.getRange(rowIdx, COL.PHONE).setValue(data.clientPhone.trim());
    if (data.clientEmail && data.clientEmail.trim()) sheet.getRange(rowIdx, COL.EMAIL).setValue(data.clientEmail.trim());
    if (data.clientTg && data.clientTg.trim()) sheet.getRange(rowIdx, COL.TG).setValue(data.clientTg.trim());

    sheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.FOR_APPROVAL);
    paintStatusCell(sheet, rowIdx, STATUSES.FOR_APPROVAL);
    sheet.getRange(rowIdx, COL.SUMMARY).setValue(aiAnalysis.summary);
    sheet.getRange(rowIdx, COL.BRIEF).setValue(fullBriefText);

    const reqFinal = (aiAnalysis.requisites && !aiAnalysis.requisites.toLowerCase().includes("не предостав"))
      ? aiAnalysis.requisites
      : (ans.q8 || row[COL.REQUISITES - 1] || "");
    if (reqFinal) sheet.getRange(rowIdx, COL.REQUISITES).setValue(reqFinal);

    patchDealState(sheet, rowIdx, {
      chatLang: chatLang,
      briefAnswers: ans,
      transcript: aiAnalysis.transcript || ""
    });

    ensureProjectDriveFolder(sheet, rowIdx);
    generateAndSaveBriefDoc(sheet, rowIdx, fullBriefText, aiAnalysis.summary);
    sendBriefReadyCardToAdmin(sheet, rowIdx, aiAnalysis);
    sendPortalLinkEmail(sheet, rowIdx, "brief_received");

    return { status: "ok", message: "Распаковка передана руководителю!" };
  }

  // 2. Ответ на дополнительный вопрос
  if (act === "answer_extra") {
    const ansText = (data.text || "").trim();
    if (!ansText) return { status: "error", message: "Введите текст ответа" };
    const oldBrief = (row[COL.BRIEF - 1] || "").toString();
    const updated = oldBrief + "\n\n[ОТВЕТ КЛИЕНТА ИЗ КАБИНЕТА НА ДОП. ВОПРОС]:\n" + ansText;
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
      sheet.getRange(rowIdx, COL.REQUISITES).setValue(data.requisites.trim());
    }
    sheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.KP_ACCEPTED);
    paintStatusCell(sheet, rowIdx, STATUSES.KP_ACCEPTED);
    patchDealState(sheet, rowIdx, { chosenVariant: chosen });

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
      patch.contractCustomNotes = data.contractCustomNotes.trim();
    }
    if (typeof data.contractCustomBodyHtml === "string") {
      patch.contractCustomBodyHtml = data.contractCustomBodyHtml;
    }
    if (typeof data.clientOrg === "string" && data.clientOrg.trim()) {
      sheet.getRange(rowIdx, COL.ORG).setValue(data.clientOrg.trim());
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

  // 5. Согласование Договора клиентом
  if (act === "agree_contract") {
    if (data.requisitesObj) {
      saveRequisitesHelper(sheet, rowIdx, data.requisitesObj);
    }
    if (typeof data.contractCustomNotes === "string" && data.contractCustomNotes.trim()) {
      patchDealState(sheet, rowIdx, { contractCustomNotes: data.contractCustomNotes.trim() });
    }
    if (typeof data.contractCustomBodyHtml === "string" && data.contractCustomBodyHtml.trim()) {
      patchDealState(sheet, rowIdx, { contractCustomBodyHtml: data.contractCustomBodyHtml });
    }

    sheet.getRange(rowIdx, COL.STATUS).setValue(STATUSES.CONTRACT_AGREED);
    paintStatusCell(sheet, rowIdx, STATUSES.CONTRACT_AGREED);
    patchDealState(sheet, rowIdx, { contractAgreedAt: new Date().toISOString() });

    ensureProjectDriveFolder(sheet, rowIdx);
    generateAndSaveContractDoc(sheet, rowIdx, true);

    notifyAdminContractAgreed(sheet, rowIdx);
    sendPortalLinkEmail(sheet, rowIdx, "contract_agreed");
    return { status: "ok" };
  }

  // 6. Комментарий / правка по договору
  if (act === "contract_comment") {
    const comment = (data.text || "").trim();
    if (!comment) return { status: "error", message: "Введите текст правки" };
    const oldBrief = (row[COL.BRIEF - 1] || "").toString();
    sheet.getRange(rowIdx, COL.BRIEF).setValue(oldBrief + "\n\n[ПРАВКА ПО ДОГОВОРУ С ПОРТАЛА]: " + comment);
    patchDealState(sheet, rowIdx, { contractComment: comment });

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
    const url = (data.driveLink || "").trim();
    const note = (data.note || "").trim();
    if (!url) return { status: "error", message: "Укажите ссылку на папку" };

    patchDealState(sheet, rowIdx, { clientMaterialsUrl: url, clientMaterialsNote: note });
    const oldBrief = (row[COL.BRIEF - 1] || "").toString();
    sheet.getRange(rowIdx, COL.BRIEF).setValue(oldBrief + `\n\n[ССЫЛКА НА МАТЕРИАЛЫ КЛИЕНТА]: ${url}${note ? " — " + note : ""}`);

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
    const fileName = (data.fileName || ("material_" + Date.now())).replace(/[\\/:*?"<>|]/g, "_");
    const mimeType = data.mimeType || "application/octet-stream";
    const fileBase64 = data.fileBase64 || "";
    if (!fileBase64) return { status: "error", message: "Файл пустой" };

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
      patchDealState(sheet, rowIdx, { uploadedMaterials: list, uploadedMaterialsCount: list.length });

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
      contractCustomNotes: typeof data.contractCustomNotes === "string" ? data.contractCustomNotes : "",
      contractCustomBodyHtml: typeof data.contractCustomBodyHtml === "string" ? data.contractCustomBodyHtml : ""
    });
    ensureProjectDriveFolder(sheet, rowIdx);
    const docRes = generateAndSaveContractDoc(sheet, rowIdx);
    return { status: "ok", contractUrl: docRes.docUrl || "", contractPdfUrl: docRes.pdfUrl || "" };
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

    let doc;
    if (deal.kpDocId) {
      try { doc = DocumentApp.openById(deal.kpDocId); doc.getBody().clear(); } catch (e) { doc = null; }
    }
    if (!doc) doc = DocumentApp.create(`Финальное_КП_${kp}`);

    const body = doc.getBody();
    body.appendParagraph(`ТОО «Метод и Ко» | Бюро стандартов «МЕТОДИКО»`).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph(`ФИНАЛЬНОЕ КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ № ${kp}`).setHeading(DocumentApp.ParagraphHeading.HEADING1);
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
    body.appendParagraph(`Исполнитель: ТОО «Метод и Ко», БИН 231140018015, г. Алматы, АО «Kaspi Bank», ИИК KZ54722S000031140138, БИК CASPKZKA, Директор Коденцева Н.М.`);
    doc.saveAndClose();

    const saved = saveDocAndPdfToFolder(doc, folderId, `Финальное_КП_${kp}.pdf`);
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

    // Если пользователь явно задал свой Google Docs шаблон — используем его, иначе создаём полный Договор автоматически!
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
      const savedT = saveDocAndPdfToFolder(docT, folderId, `Договор_${kp}.pdf`);
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
    const statusBadge = isFinalAgreed ? " [СОГЛАСОВАН СТОРОНАМИ]" : " [ПРОЕКТ ДЛЯ СОГЛАСОВАНИЯ]";
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
    body.appendParagraph(`ИСПОЛНИТЕЛЬ:\nТОО «Метод и Ко» (Бюро «МЕТОДИКО»)\nБИН: 231140018015\nЮр. адрес: 050019, г. Алматы, Турксибский р-н, мкр. Кайрат, ул. Жетысай, дом 15/2\nБанк: АО «Kaspi Bank» | ИИК: KZ54722S000031140138 | БИК: CASPKZKA | КБе: 17\nТел.: +7 (700) 077-35-66 | Сайт: metodico-kz.netlify.app\nДиректор: ____________________ / Коденцева Н.М. /`);
    body.appendParagraph(`ЗАКАЗЧИК:\n${reqBlock}\nПодписант: ____________________ / ${signerDisplay} /`);
    doc.saveAndClose();

    const pdfName = isFinalAgreed ? `Договор_${kp}_СОГЛАСОВАН.pdf` : `Договор_${kp}_проект.pdf`;
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

function updateCol22KeepingTgChat(sheet, rowIdx, noteOrUrl) {
  if (!sheet || rowIdx === -1) return;
  const cell = sheet.getRange(rowIdx, COL.META_DOC);
  const existing = (cell.getValue() || "").toString();
  const m = existing.match(/tg_chat:\d+/);
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
