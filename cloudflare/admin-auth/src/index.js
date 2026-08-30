const encoder = new TextEncoder();

const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self' https://fonts.gstatic.com",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "upgrade-insecure-requests",
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

async function digest(value) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
}

async function safeEqual(left, right) {
  const [leftHash, rightHash] = await Promise.all([
    digest(left),
    digest(right),
  ]);

  return crypto.subtle.timingSafeEqual(leftHash, rightHash);
}

function secureResponse(response, extraHeaders = {}) {
  const secured = new Response(response.body, response);

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    secured.headers.set(name, value);
  }
  for (const [name, value] of Object.entries(extraHeaders)) {
    secured.headers.set(name, value);
  }

  return secured;
}

function textResponse(message, status, extraHeaders = {}) {
  return secureResponse(
    new Response(message, {
      status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }),
    extraHeaders,
  );
}

function unauthorized() {
  return textResponse("Acceso restringido", 401, {
    "WWW-Authenticate": 'Basic realm="Panel administrativo", charset="UTF-8"',
  });
}

async function proxySheets(requestUrl, env) {
  if (!env.SHEETS_ENDPOINT || !env.SHEETS_ACCESS_TOKEN) {
    return textResponse("Fuente de datos no configurada", 503);
  }

  const book = requestUrl.searchParams.get("book");
  if (book !== "admin" && book !== "operacion") {
    return textResponse("Parámetro book inválido", 400);
  }

  const upstreamUrl = new URL(env.SHEETS_ENDPOINT);
  upstreamUrl.searchParams.set("token", env.SHEETS_ACCESS_TOKEN);
  upstreamUrl.searchParams.set("book", book);

  const upstreamResponse = await fetch(upstreamUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
    redirect: "follow",
  });

  return secureResponse(
    new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: {
        "Content-Type": upstreamResponse.headers.get("Content-Type") ||
          "application/json; charset=utf-8",
      },
    }),
  );
}

async function proxyReadings(request, requestUrl, env) {
  if (!env.READINGS_ENDPOINT) {
    return textResponse("Registro de lecturas no configurado", 503);
  }

  const upstreamUrl = new URL(env.READINGS_ENDPOINT);
  const init = {
    method: request.method,
    headers: { Accept: "application/json" },
    redirect: "follow",
  };

  if (request.method === "GET") {
    upstreamUrl.searchParams.set("action", "obtener");
  } else if (request.method === "POST") {
    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > 262144) {
      return textResponse("Solicitud demasiado grande", 413);
    }
    const body = await request.arrayBuffer();
    if (body.byteLength > 262144) {
      return textResponse("Solicitud demasiado grande", 413);
    }
    init.headers["Content-Type"] = "application/json";
    init.body = body;
  } else {
    return textResponse("Método no permitido", 405, { Allow: "GET, POST" });
  }

  const upstreamResponse = await fetch(upstreamUrl, init);
  return secureResponse(
    new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: {
        "Content-Type": upstreamResponse.headers.get("Content-Type") ||
          "application/json; charset=utf-8",
      },
    }),
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isAdminPath =
      url.pathname === "/admin" || url.pathname.startsWith("/admin/");

    // La ruta de Cloudflare usa /admin*; no se bloquean rutas parecidas.
    if (!isAdminPath) {
      return fetch(request);
    }

    if (url.protocol !== "https:") {
      url.protocol = "https:";
      return secureResponse(Response.redirect(url.toString(), 308));
    }

    if (!env.BASIC_USER || !env.BASIC_PASSWORD) {
      return textResponse("Acceso no configurado", 503);
    }

    const authorization = request.headers.get("Authorization") || "";

    let expectedAuthorization;
    try {
      expectedAuthorization = `Basic ${btoa(`${env.BASIC_USER}:${env.BASIC_PASSWORD}`)}`;
    } catch {
      return textResponse("Configuración de acceso inválida", 500);
    }

    if (!(await safeEqual(authorization, expectedAuthorization))) {
      return unauthorized();
    }

    try {
      if (url.pathname === "/admin/api/sheets") {
        if (request.method !== "GET") {
          return textResponse("Método no permitido", 405, { Allow: "GET" });
        }
        return await proxySheets(url, env);
      }

      if (url.pathname === "/admin/api/readings") {
        return await proxyReadings(request, url, env);
      }

      // No reenviar las credenciales al origen de GitHub Pages.
      const originHeaders = new Headers(request.headers);
      originHeaders.delete("Authorization");
      const originRequest = new Request(request, { headers: originHeaders });
      const originResponse = await fetch(originRequest);
      return secureResponse(originResponse);
    } catch (error) {
      console.error(JSON.stringify({
        message: "admin request failed",
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
      }));
      return textResponse("Error interno", 500);
    }
  },
};
