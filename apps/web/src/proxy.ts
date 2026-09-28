import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Always generate a fresh ID; never forward a visitor's identifier into render diagnostics.
  const requestId = crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = { matcher: ["/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml).*)"] };
