const GAS_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbzjPyBVs_o-rvviKsJtxmSQkx_NUdy7Ijnp5q6wA2WMYUbz18WZDVLZ6MWTFROu5E_U/exec";

const CORS_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const targetUrl = `${GAS_WEBHOOK_URL}${url.search}`;
      const resp = await fetch(targetUrl, { method: "GET", redirect: "follow" });
      const text = await resp.text();
      return new Response(text, { status: resp.ok ? 200 : resp.status, headers: CORS_HEADERS });
    }

    if (req.method === "POST") {
      const bodyText = await req.text();
      const resp = await fetch(GAS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyText,
        redirect: "follow"
      });
      const text = await resp.text();
      return new Response(text, { status: resp.ok ? 200 : resp.status, headers: CORS_HEADERS });
    }

    return new Response(JSON.stringify({ status: "error", message: "Method Not Allowed" }), {
      status: 405,
      headers: CORS_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: "error", message: String(err) }), {
      status: 502,
      headers: CORS_HEADERS
    });
  }
};
