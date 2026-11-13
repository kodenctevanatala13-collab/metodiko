const GAS_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbzjPyBVs_o-rvviKsJtxmSQkx_NUdy7Ijnp5q6wA2WMYUbz18WZDVLZ6MWTFROu5E_U/exec";

export default async (req, context) => {
  if (req.method === "GET") {
    return new Response("METODIKO Telegram Webhook Proxy OK", { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let bodyText = "";
  try {
    bodyText = await req.text();
  } catch (e) {
    return new Response("OK", { status: 200 });
  }

  const reqUrl = new URL(req.url);
  const botParam = reqUrl.searchParams.get("bot") || "default";
  const targetUrl = `${GAS_WEBHOOK_URL}?bot=${encodeURIComponent(botParam)}`;

  // Отвечаем Telegram мгновенным 200 OK (без 302 редиректа Google Apps Script),
  // а пересылку в Google Таблицу выполняем в фоне через context.waitUntil.
  const forwardPromise = fetch(targetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyText,
    redirect: "follow",
  }).catch((err) => {
    console.error("GAS forward error:", err);
  });

  if (context && typeof context.waitUntil === "function") {
    context.waitUntil(forwardPromise);
  } else {
    await forwardPromise;
  }

  return new Response("OK", { status: 200 });
};
