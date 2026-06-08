import { NextRequest } from "next/server";
import { getDbPool } from "./db";
import { maskIP } from "./mask";

function getDailyUserId(req: NextRequest) {
    const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
        "unknown";

    const ua = req.headers.get("user-agent") || "unknown";

    const day = new Date().toISOString().slice(0, 10);
    return maskIP(ip + ua + day);
}

function normalizeRoute(url: string) {
    const path = url.split("?")[0] || "undefined";

    if (path.startsWith("/api/files/")) {
        const parts = path.split("/").filter(Boolean);
        if (parts.length === 4) {
            return `/api/files/${parts[2]}/:userID`;
        }
        if (parts.length === 5) {
            return `/api/files/${parts[2]}/:userID/:fileID`;
        }
        return `/api/files/${parts[2]}`;
    }

    return path
        .replace(/[a-f0-9]{24}/gi, ":id")
        .replace(/\b\d+\b/g, ":id")
        .replace(/\b[A-Z]{2}\d{5,}\b/g, ":userID");
}

function getSourceDomain(req: NextRequest): string {
    const origin = req.headers.get("origin");
    if (origin) {
        try {
            return new URL(origin).hostname;
        } catch { }
    }

    const referer = req.headers.get("referer");
    if (referer) {
        try {
            return new URL(referer).hostname;
        } catch { }
    }

    return "unknown";
}

const routes = ["/api/calendar", "/api/login", "/api/hostel", "/api/grades", "/api/schedule", "/api/attendance",
    "/api/all-grades", "/api/files/upload/:userID", "/api/files/delete/:userID/:fileID", "/api/files/download/:userID/:fileID",
    "/api/lms-data", "/api/files/mail/send"];

export async function logRouteAndVisitor(req: NextRequest) {
    try {
        const path = new URL(req.url).pathname;
        if (path === "/favicon.ico") return;

        let normalizedRoute = normalizeRoute(path);
        const sourceDomain = getSourceDomain(req);

        if (!routes.includes(normalizedRoute)) {
            normalizedRoute = "unknown"
        }

        const pool = getDbPool();
        
        await pool.query(
            `INSERT INTO api_route_logs (method, route, source) VALUES ($1, $2, $3)`,
            [req.method, normalizedRoute, sourceDomain]
        );

        const dailyUserId = getDailyUserId(req);
        
        await pool.query(
            `INSERT INTO visitor_logs (source, hashed_ip) VALUES ($1, $2)`,
            [sourceDomain, dailyUserId]
        );
    } catch (err) {
        console.error("Route/Visitor log failed:", err);
    }
}
