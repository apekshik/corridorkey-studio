import { route } from "@fal-ai/server-proxy/nextjs";
import { withAuth } from "@workos-inc/authkit-nextjs";

/**
 * Forwards browser-initiated fal API calls (uploads, queue.submit, status,
 * etc.) to fal with our server-side FAL_KEY. The browser never sees the key.
 *
 * @fal-ai/server-proxy/nextjs expects a single handler at /api/fal/proxy
 * by default; we mount it at /api/fal-proxy. On the client:
 *   fal.config({ proxyUrl: "/api/fal-proxy" })
 *
 * We gate every call on an authenticated WorkOS session.
 */

async function guard() {
  const { user } = await withAuth();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

async function logRequest(request: Request, label: string) {
  const targetUrl = request.headers.get("x-fal-target-url");
  console.log(`[fal-proxy ${label}] target=${targetUrl ?? "(none)"}`);
  if (label === "POST" && targetUrl && !targetUrl.includes("/storage/upload")) {
    try {
      const cloned = request.clone();
      const body = await cloned.text();
      console.log(
        `[fal-proxy ${label}] body=${body.length > 500 ? body.slice(0, 500) + "…" : body}`
      );
    } catch {
      /* ignore body read failures */
    }
  }
}

export async function GET(request: Request) {
  const err = await guard();
  if (err) return err;
  await logRequest(request, "GET");
  return route.GET(request);
}

export async function POST(request: Request) {
  const err = await guard();
  if (err) return err;
  await logRequest(request, "POST");
  return route.POST(request);
}

export async function PUT(request: Request) {
  const err = await guard();
  if (err) return err;
  await logRequest(request, "PUT");
  return route.PUT(request);
}
