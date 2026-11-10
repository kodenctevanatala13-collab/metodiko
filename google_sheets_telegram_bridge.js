/**
 * =========================================================================
 * ТОО «Метод и Ко» | Бюро стандартов «МЕТОДИКО»
 * АВТОМАТИЧЕСКИЙ МОСТ: САЙТ ➔ GOOGLE ТАБЛИЦА ➔ TELEGRAM БОТ
 * =========================================================================
 * 
 * Данный скрипт устанавливается в Google Таблицу (Расширения -> Apps Script).
 * Он принимает заявки с сайта, фиксирует 14 параметров в таблицу
 * и мгновенно отправляет вам в Telegram карточку заявки с кнопками.
 *
 * ИНСТРУКЦИЯ ПО НАСТРОЙКЕ (занимает 3 минуты):
 * 1. Создайте Telegram-бота у @BotFather в Telegram, скопируйте TELEGRAM_BOT_TOKEN.
 * 2. Узнайте свой Telegram Chat ID (напишите боту @userinfobot), скопируйте TELEGRAM_CHAT_ID.
 * 3. Вставьте их ниже в блок НАСТРОЙКИ.
 * 4. Нажмите «Развернуть» -> «Новое развертывание» -> Тип «Веб-приложение».
 *    - Доступ: «Все» (Anyone).
 * 5. Скопируйте полученный URL веб-приложения и вставьте в настройку на сайте!
 * =========================================================================
 */

// ==================== НАСТРОЙКИ (ЗАПОЛНИТЕ ВАШИ ДАННЫЕ) ====================
const CONFIG = {
  TELEGRAM_BOT_TOKEN: "ВАШ_ТОКЕН_БОТА_ОТ_BOTFATHER",  // например: "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
  TELEGRAM_CHAT_ID: "ВАШ_CHAT_ID",                   // например: "987654321" или ID группы
  SHEET_NAME: "Заявки МЕТОДИКО",
  COMPANY_NAME: "ТОО «Метод и Ко» | Бюро «МЕТОДИКО»"
};

/**
 * Инициализация шапки Google Таблицы (запустите 1 раз вручную)
 */
function setupSheetHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  const headers = [
    "ID заявки",
    "Дата и время",
    "Имя заказчика",
    "Организация / Должность",
    "Телефон (WhatsApp)",
    "Email",
    "Telegram",
    "Направление ЦА",
    "Выбранные модули и часы",
    "Смета (₸)",
    "Срок (раб. дн)",
    "Режим",
    "Вопрос заказчика",
    "Статус",
    "Согласованная сумма (₸)",
    "Комментарий методолога"
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#152238").setFontColor("#FFFFFF");
  sheet.setFrozenRows(1);
}

/**
 * Обработка входящих запросов с сайта (POST)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No data" })).setMimeType(ContentService.MimeType.JSON);
    }

    const data = JSON.parse(e.postData.contents);

    // Если это callback-запрос от Telegram (нажатие инлайн-кнопки в телефоне)
    if (data.callback_query) {
      return handleTelegramCallback(data.callback_query);
    }

    // Если это текстовое сообщение в Telegram-боте от Натальи (например, скорректированная цена)
    if (data.message && data.message.text && data.message.reply_to_message) {
      return handleTelegramPriceReply(data.message);
    }

    // Иначе это новая заявка с сайта
    const result = processNewWebsiteLead(data);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Обработка новой заявки с сайта
 */
function processNewWebsiteLead(lead) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    setupSheetHeaders();
    sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  }

  const cleanPhone = (lead.clientPhone || "").replace(/[^\d+]/g, "");
  const waLink = cleanPhone ? "https://wa.me/" + cleanPhone.replace("+", "") : "";
  const tgUsername = (lead.clientTg || "").replace("@", "").trim();
  const tgLink = tgUsername ? "https://t.me/" + tgUsername : "";

  // Формируем список модулей текстом
  let itemsSummary = "";
  if (Array.isArray(lead.selectedItems)) {
    itemsSummary = lead.selectedItems.map((item, idx) => `${idx + 1}. ${item.name} (${item.price.toLocaleString("ru-RU")} ₸, ${item.days} дн)`).join("\n");
  }

  // 1. Запись в Google Таблицу
  const rowData = [
    lead.kpNumber || "MK-" + new Date().getFullYear(),
    new Date().toLocaleString("ru-RU"),
    lead.clientName || "—",
    lead.clientOrg || "—",
    lead.clientPhone || "—",
    lead.clientEmail || "—",
    lead.clientTg || "—",
    lead.audienceCategory || "—",
    itemsSummary,
    lead.totalPrice || 0,
    lead.totalDays || 0,
    lead.isUrgent ? "Срочно (+20%)" : "Стандарт",
    lead.clientQuestion || "Без вопроса",
    "Новая (на утверждении)",
    lead.totalPrice || 0,
    ""
  ];

  sheet.appendRow(rowData);

  // 2. Отправка карточки в Telegram
  sendTelegramCard(lead, waLink, tgLink, itemsSummary);

  return { status: "success", kpNumber: lead.kpNumber };
}

/**
 * Отправка сообщения с кнопками в Telegram
 */
function sendTelegramCard(lead, waLink, tgLink, itemsSummary) {
  if (!CONFIG.TELEGRAM_BOT_TOKEN || CONFIG.TELEGRAM_BOT_TOKEN.indexOf("ВАШ_ТОКЕН") !== -1) {
    return; // Токен еще не настроен
  }

  const urgentBadge = lead.isUrgent ? "⚡ <b>СРОЧНЫЙ ТАРИФ (+20%)</b>\n" : "";

  let msgText = `🔔 <b>НОВАЯ ЗАЯВКА НА МЕТОДОЛОГИЮ: № ${lead.kpNumber}</b>\n`;
  msgText += `━━━━━━━━━━━━━━━━━━━━\n`;
  msgText += `👤 <b>Заказчик:</b> ${escapeHtml(lead.clientName)}\n`;
  msgText += `🏢 <b>Организация:</b> ${escapeHtml(lead.clientOrg)}\n`;
  msgText += `📞 <b>Телефон:</b> <code>${lead.clientPhone}</code>\n`;
  if (lead.clientEmail && lead.clientEmail !== "—") msgText += `✉️ <b>Email:</b> ${lead.clientEmail}\n`;
  if (lead.clientTg && lead.clientTg !== "—") msgText += `💬 <b>Telegram:</b> @${lead.clientTg.replace("@", "")}\n`;
  msgText += `\n`;
  msgText += `🎯 <b>Направление:</b> ${escapeHtml(lead.audienceCategory)}\n`;
  msgText += `${urgentBadge}`;
  msgText += `📋 <b>Выбранные модули и объемы:</b>\n${escapeHtml(itemsSummary)}\n\n`;
  msgText += `💰 <b>Предварительная смета:</b> <b>${Number(lead.totalPrice).toLocaleString("ru-RU")} ₸</b>\n`;
  msgText += `⏱️ <b>Срок разработки:</b> <b>${lead.totalDays} раб. дней</b>\n`;
  msgText += `━━━━━━━━━━━━━━━━━━━━\n`;

  if (lead.clientQuestion && lead.clientQuestion !== "Вопрос не указан") {
    msgText += `❓ <b>ВОПРОС ОТ ЗАКАЗЧИКА:</b>\n`;
    msgText += `<i>«${escapeHtml(lead.clientQuestion)}»</i>\n`;
    msgText += `━━━━━━━━━━━━━━━━━━━━\n`;
  }

  msgText += `<i>Статус: На утверждении у Натальи Коденцевой</i>`;

  // Кнопки действий
  const inlineKeyboard = [
    [
      { text: "✅ Утвердить КП без правок", callback_data: `approve_${lead.kpNumber}` },
      { text: "✏️ Скорректировать смету", callback_data: `edit_${lead.kpNumber}` }
    ]
  ];

  const contactRow = [];
  if (waLink) contactRow.push({ text: "📱 WhatsApp", url: waLink });
  if (tgLink) contactRow.push({ text: "💬 Telegram", url: tgLink });
  if (contactRow.length > 0) inlineKeyboard.push(contactRow);

  const payload = {
    chat_id: CONFIG.TELEGRAM_CHAT_ID,
    text: msgText,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: inlineKeyboard }
  };

  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

/**
 * Обработка нажатий кнопок в Telegram
 */
function handleTelegramCallback(callbackQuery) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;

  if (data.startsWith("approve_")) {
    const kpNumber = data.replace("approve_", "");
    updateLeadStatus(kpNumber, "Утверждено Натальей", null);

    const answerPayload = {
      callback_query_id: callbackQuery.id,
      text: `✅ КП ${kpNumber} официально утверждено!`
    };
    sendTelegramRequest("answerCallbackQuery", answerPayload);

    // Обновляем сообщение в чате
    const editPayload = {
      chat_id: chatId,
      message_id: messageId,
      text: callbackQuery.message.text + `\n\n🟢 <b>УТВЕРЖДЕНО РУКОВОДИТЕЛЕМ (${new Date().toLocaleTimeString("ru-RU")})</b>\nГотово к отправке клиенту.`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📄 Открыть карточку в Google Таблице", url: SpreadsheetApp.getActiveSpreadsheet().getUrl() }]
        ]
      }
    };
    sendTelegramRequest("editMessageText", editPayload);

  } else if (data.startsWith("edit_")) {
    const kpNumber = data.replace("edit_", "");
    
    const promptText = `✏️ <b>Корректировка сметы для ${kpNumber}</b>\n\nОтветьте на это сообщение (Reply) новой согласованной суммой и комментарием в формате:\n<code>450000 Убрали тесты, добавили 1 дисциплину</code>`;
    
    sendTelegramRequest("sendMessage", {
      chat_id: chatId,
      text: promptText,
      parse_mode: "HTML",
      reply_to_message_id: messageId
    });
  }

  return ContentService.createTextOutput("OK");
}

/**
 * Обработка текстового ответа с новой ценой после звонка
 */
function handleTelegramPriceReply(msg) {
  const text = msg.text.trim();
  const matchPrice = text.match(/^(\d+)(.*)/);

  if (matchPrice) {
    const newPrice = parseInt(matchPrice[1], 10);
    const comment = matchPrice[2].trim();

    // Ищем номер КП в цитируемом сообщении
    const replyText = msg.reply_to_message.text || "";
    const matchKp = replyText.match(/MK-\d{4}-\d+/);
    const kpNumber = matchKp ? matchKp[0] : "";

    if (kpNumber) {
      updateLeadStatus(kpNumber, "Скорректировано после звонка", newPrice, comment);

      sendTelegramRequest("sendMessage", {
        chat_id: msg.chat.id,
        text: `✅ <b>КП ${kpNumber} обновлено!</b>\n\n💰 Новая согласованная смета: <b>${newPrice.toLocaleString("ru-RU")} ₸</b>\n📝 Комментарий: <i>${comment || "Без комментария"}</i>\n\nШтамп «Утверждено» обновлен в базе.`,
        parse_mode: "HTML"
      });
    }
  }

  return ContentService.createTextOutput("OK");
}

/**
 * Обновление статуса и цены в Google Таблице
 */
function updateLeadStatus(kpNumber, status, newPrice, comment) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === kpNumber) {
      sheet.getRange(i + 1, 14).setValue(status); // Столбец N: Статус
      if (newPrice !== null && newPrice !== undefined) {
        sheet.getRange(i + 1, 15).setValue(newPrice); // Столбец O: Согласованная сумма
      }
      if (comment) {
        sheet.getRange(i + 1, 16).setValue(comment); // Столбец P: Комментарий
      }
      break;
    }
  }
}

/**
 * Вспомогательный вызов API Telegram
 */
function sendTelegramRequest(method, payload) {
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/${method}`;
  return UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function escapeHtml(text) {
  if (!text) return "";
  return text.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
