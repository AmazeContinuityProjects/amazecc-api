import axios, { AxiosInstance } from "axios";
import https from "https";

const agent = new https.Agent({ rejectUnauthorized: false });

/**
 * VTOP base URL, overridable per deployment/campus via env.
 * Defaults to VIT Chennai.
 */
export function getVtopBaseUrl(): string {
  const raw = process.env.VTOP_BASE_URL || "https://vtopcc.vit.ac.in";
  return raw.replace(/\/+$/, "");
}

export function getVtopReferer(): string {
  return `${getVtopBaseUrl()}/vtop/open/page`;
}

const ChennaiClient: AxiosInstance = axios.create({
  baseURL: getVtopBaseUrl(),
  headers: {
    "User-Agent": "Mozilla/5.0 ...",
    Accept: "text/html,application/xhtml+xml",
  },
  httpsAgent: agent,
  withCredentials: true,
  timeout: 20000,
});

export default function VTOPClient(): AxiosInstance {
  return ChennaiClient;
}