import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Open API: any origin may call it. Auth travels in the Authorization header
  // or the body, never in cookies, so we use "*" and do NOT send
  // Access-Control-Allow-Credentials. Browsers then refuse to attach cookies to
  // cross-origin calls, so adding cookie auth later can't be abused from other
  // sites. (Reflecting Origin + Allow-Credentials: true would allow that.)
  const allowedOrigin = "*";

  if (request.method === "OPTIONS") {
    const preflightHeaders = new Headers();
    preflightHeaders.set("Access-Control-Allow-Origin", allowedOrigin);
    preflightHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    preflightHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version, X-Club-Id");
    preflightHeaders.set("Access-Control-Max-Age", "86400");
    return new NextResponse(null, { status: 200, headers: preflightHeaders });
  }

  const response = NextResponse.next();

  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version, X-Club-Id");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
}

export const config = {
  matcher: "/api/:path*",
};