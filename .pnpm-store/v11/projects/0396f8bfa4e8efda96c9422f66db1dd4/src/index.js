const encoder = new TextEncoder();

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

function unauthorized() {
  return new Response("Acceso restringido", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "WWW-Authenticate": 'Basic realm="Panel administrativo", charset="UTF-8"',
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isAdminPath =
      url.pathname === "/admin" || url.pathname.startsWith("/admin/");

    // La ruta de Cloudflare usa /admin* para incluir consultas en /admin.
    // Si coincidiera con otra ruta parecida, no se bloquea contenido ajeno.
    if (!isAdminPath) {
      return fetch(request);
    }

    if (url.protocol !== "https:") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 308);
    }

    if (!env.BASIC_USER || !env.BASIC_PASSWORD) {
      return new Response("Acceso no configurado", {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
      });
    }

    const authorization = request.headers.get("Authorization") || "";

    let expectedAuthorization;
    try {
      expectedAuthorization = `Basic ${btoa(`${env.BASIC_USER}:${env.BASIC_PASSWORD}`)}`;
    } catch {
      return new Response("Configuración de acceso inválida", {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (!(await safeEqual(authorization, expectedAuthorization))) {
      return unauthorized();
    }

    // No reenviar las credenciales al origen de GitHub Pages.
    const originHeaders = new Headers(request.headers);
    originHeaders.delete("Authorization");
    const originRequest = new Request(request, { headers: originHeaders });
    const originResponse = await fetch(originRequest);
    const response = new Response(originResponse.body, originResponse);

    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");

    return response;
  },
};
