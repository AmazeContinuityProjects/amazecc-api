import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";

  // Since this is an open API, we allow all origins.
  // Because we support credentials (Authorization headers), we must echo the request's origin
  // dynamically instead of using the wildcard "*".
  const allowedOrigin = origin || "*";

  if (request.method === "OPTIONS") {
    const preflightHeaders = new Headers();
    preflightHeaders.set("Access-Control-Allow-Origin", allowedOrigin);
    preflightHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    preflightHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version, X-Club-Id");
    preflightHeaders.set("Access-Control-Allow-Credentials", "true");
    preflightHeaders.set("Access-Control-Max-Age", "86400");
    return new NextResponse(null, { status: 200, headers: preflightHeaders });
  }

  const response = NextResponse.next();

  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version, X-Club-Id");
  response.headers.set("Access-Control-Allow-Credentials", "true");
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