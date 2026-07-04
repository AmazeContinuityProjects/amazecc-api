"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Server,
  ExternalLink,
  CheckCircle,
  XCircle,
  Loader2,
  Sun,
  Moon,
} from "lucide-react";
import { Card, Badge } from "@amazecontinuityprojects/amazeui";

type OpenApiSpec = {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: { url: string; description?: string }[];
  paths?: Record<string, Record<string, EndpointMethod>>;
  tags?: { name: string; description?: string }[];
};

type EndpointMethod = {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: {
    name: string;
    in: "query" | "path" | "header";
    required?: boolean;
    schema?: { type: string };
    description?: string;
  }[];
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: object }>;
  };
  responses?: Record<string, { description: string; content?: Record<string, { schema?: object }> }>;
};

const methodBadgeClasses: Record<string, string> = {
  get: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  post: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  put: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  patch: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  delete: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${methodBadgeClasses[method] || "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20"}`}
    >
      {method.toUpperCase()}
    </span>
  );
}

const categoryGroup: Record<string, string> = {
  "/api/login": "Auth",
  "/api/login-history": "Auth",
  "/api/student": "Student Profile",
  "/api/credentials": "Student Profile",
  "/api/profile-images": "Student Profile",
  "/api/change-password": "Student Profile",
  "/api/update-loginid": "Student Profile",
  "/api/grades": "Academics",
  "/api/all-grades": "Academics",
  "/api/attendance": "Academics",
  "/api/marks/stats": "Academics",
  "/api/marks/sync": "Academics",
  "/api/timetable": "Academics",
  "/api/schedule": "Academics",
  "/api/curriculum": "Academics",
  "/api/curriculum/syllabus": "Academics",
  "/api/curriculum/download": "Academics",
  "/api/course-page": "Academics",
  "/api/course-completion": "Academics",
  "/api/registration-schedule": "Registration",
  "/api/registration-status": "Registration",
  "/api/course-option-change": "Registration",
  "/api/course-withdraw": "Registration",
  "/api/course-withdraw-view": "Registration",
  "/api/coursework-reg": "Registration",
  "/api/sem-request": "Registration",
  "/api/compre-exam": "Examinations",
  "/api/compre-info": "Examinations",
  "/api/paper-see-rev": "Examinations",
  "/api/question-preview": "Examinations",
  "/api/special-arrear": "Examinations",
  "/api/arrear-details": "Examinations",
  "/api/arrear-grade": "Examinations",
  "/api/arrear-paper-see": "Examinations",
  "/api/arrear-reg": "Examinations",
  "/api/arrear-schedule": "Examinations",
  "/api/reexam": "Examinations",
  "/api/makeup-exam": "Examinations",
  "/api/makeup-schedule": "Examinations",
  "/api/ept-schedule": "Examinations",
  "/api/hostel": "Hostel & Mess",
  "/api/hostel-attendance": "Hostel & Mess",
  "/api/hostel-counselling": "Hostel & Mess",
  "/api/hostel-leave": "Hostel & Mess",
  "/api/late-hour": "Hostel & Mess",
  "/api/dayboarder": "Hostel & Mess",
  "/api/mess-feedback": "Hostel & Mess",
  "/api/mess-selection": "Hostel & Mess",
  "/api/caterer-change": "Hostel & Mess",
  "/api/transport": "Transport",
  "/api/transport/track": "Transport",
  "/api/buses": "Transport",
  "/api/cabshare/auth": "CabShare",
  "/api/cabshare/blocks": "CabShare",
  "/api/cabshare/hubs": "CabShare",
  "/api/cabshare/match": "CabShare",
  "/api/cabshare/notifications": "CabShare",
  "/api/cabshare/ratings": "CabShare",
  "/api/cabshare/stats": "CabShare",
  "/api/cabshare/trips": "CabShare",
  "/api/cabshare/waitlist": "CabShare",
  "/api/events/login": "Events",
  "/api/events/preview": "Events",
  "/api/events/register": "Events",
  "/api/events/profile": "Events",
  "/api/events/paynow": "Events",
  "/api/events/download": "Events",
  "/api/clubs/details": "Clubs",
  "/api/club-enrollment": "Clubs",
  "/api/club-admin/details": "Clubs",
  "/api/club-admin/feed": "Clubs",
  "/api/club-admin/landing-page": "Clubs",
  "/api/club-admin/reps": "Clubs",
  "/api/library-due": "Library",
  "/api/library-keys": "Library",
  "/api/library-scanning": "Library",
  "/api/book-recommendation": "Library",
  "/api/koha/availability": "Library",
  "/api/koha/detail": "Library",
  "/api/koha/patron": "Library",
  "/api/koha/search": "Library",
  "/api/research-attendance": "Research & Thesis",
  "/api/research-award": "Research & Thesis",
  "/api/research-docs": "Research & Thesis",
  "/api/research-letters": "Research & Thesis",
  "/api/research-profile": "Research & Thesis",
  "/api/research-templates": "Research & Thesis",
  "/api/thesis-status": "Research & Thesis",
  "/api/thesis-submission": "Research & Thesis",
  "/api/scholar-leave": "Scholar",
  "/api/scholar-verification": "Scholar",
  "/api/meeting-info": "Scholar",
  "/api/internship": "Projects & Internship",
  "/api/project": "Projects & Internship",
  "/api/project-course": "Projects & Internship",
  "/api/project-file-upload": "Projects & Internship",
  "/api/capstone": "Projects & Internship",
  "/api/payments": "Finance",
  "/api/payment-receipts": "Finance",
  "/api/receipt-download": "Finance",
  "/api/wallet": "Finance",
  "/api/fees-intimation": "Finance",
  "/api/fine-upload": "Finance",
  "/api/bonafide": "Certificates",
  "/api/certificate": "Certificates",
  "/api/transcript": "Certificates",
  "/api/faculty-info": "Faculty & Mentorship",
  "/api/hod-dean": "Faculty & Mentorship",
  "/api/proctor": "Faculty & Mentorship",
  "/api/proctor-messages": "Faculty & Mentorship",
  "/api/class-messages": "Faculty & Mentorship",
  "/api/circulars": "Circulars",
  "/api/circulars/download": "Circulars",
  "/api/contact": "Student Services",
  "/api/faq": "Student Services",
  "/api/fresher-resources": "Student Services",
  "/api/achievements": "Student Services",
  "/api/acknowledgement": "Student Services",
  "/api/additional-learning": "Student Services",
  "/api/apaarid": "Student Services",
  "/api/bank-info": "Student Services",
  "/api/biometric": "Student Services",
  "/api/student-withdraw": "Student Services",
  "/api/programme-migration": "Student Services",
  "/api/online-transfer": "Student Services",
  "/api/feedback-status": "Feedback & Outcomes",
  "/api/slo-feedback": "Feedback & Outcomes",
  "/api/outcome-set": "Feedback & Outcomes",
  "/api/regulation": "Feedback & Outcomes",
  "/api/sap-info": "SAP",
  "/api/sap-project": "SAP",
  "/api/mooc-registration": "MOOCs & SWF",
  "/api/mooc-upload": "MOOCs & SWF",
  "/api/swf-attendance": "MOOCs & SWF",
  "/api/swf-registration": "MOOCs & SWF",
  "/api/swf-requisition": "MOOCs & SWF",
  "/api/eca-upload": "MOOCs & SWF",
  "/api/exc-registration": "MOOCs & SWF",
  "/api/extra-curricular": "MOOCs & SWF",
  "/api/fdp-certificate": "FDP",
  "/api/fdp-registration": "FDP",
  "/api/lms-data": "External LMS",
  "/api/vitol-data": "External LMS",
  "/api/admin/auth": "Admin",
  "/api/admin/migrate": "Admin",
  "/api/admin/stats": "Admin",
  "/api/admin/storage": "Admin",
  "/api/admin/users": "Admin",
  "/api/admin/buses": "Admin",
  "/api/admin/clubs": "Admin",
  "/api/admin/fresher-resources": "Admin",
  "/api/admin/faculty-directories": "Admin",
  "/api/admin/push": "Admin",
  "/api/admin/ocr": "Admin",
  "/api/qbank/courses": "QBank",
  "/api/qbank/papers": "QBank",
  "/api/qbank/questions": "QBank",
  "/api/qbank/upload": "QBank",
  "/api/qbank/admin/ocr": "QBank",
  "/api/qbank/admin/publish": "QBank",
  "/api/qbank/admin/reject": "QBank",
  "/api/qbank/admin/queue": "QBank",
  "/api/qbank/admin/questions": "QBank",
  "/api/qbank/admin/import-to-storage": "QBank",
  "/api/status": "System",
  "/api/stats": "System",
  "/api/docs": "System",
  "/api/notifications/subscribe": "Notifications",
  "/api/notifications/unsubscribe": "Notifications",
  "/api/notifications/status": "Notifications",
  "/api/cron/reminders": "Cron",
};

const categoryIcons: Record<string, string> = {
  "Auth": "🔐",
  "Student Profile": "👤",
  "Academics": "📚",
  "Registration": "📝",
  "Examinations": "📋",
  "Hostel & Mess": "🏠",
  "Transport": "🚌",
  "CabShare": "🚕",
  "Events": "🎉",
  "Clubs": "🎯",
  "Library": "📖",
  "Research & Thesis": "🔬",
  "Scholar": "🎓",
  "Projects & Internship": "💼",
  "Finance": "💰",
  "Certificates": "📜",
  "Faculty & Mentorship": "👨‍🏫",
  "Circulars": "📢",
  "Student Services": "🛠️",
  "Feedback & Outcomes": "⭐",
  "SAP": "📊",
  "MOOCs & SWF": "🌐",
  "FDP": "📈",
  "External LMS": "💻",
  "Admin": "⚙️",
  "QBank": "📄",
  "System": "🔌",
  "Notifications": "🔔",
  "Cron": "⏰",
};

const categoryOrder = [
  "Auth", "Student Profile", "Academics", "Registration",
  "Examinations", "Hostel & Mess", "Transport", "CabShare",
  "Events", "Clubs", "Library", "Research & Thesis",
  "Scholar", "Projects & Internship", "Finance", "Certificates",
  "Faculty & Mentorship", "Circulars", "Student Services",
  "Feedback & Outcomes", "SAP", "MOOCs & SWF", "FDP",
  "External LMS", "Admin", "QBank", "System", "Notifications", "Cron",
];

function getCategory(path: string): string {
  for (const [prefix, category] of Object.entries(categoryGroup)) {
    if (path.startsWith(prefix)) return category;
  }

  if (path.startsWith("/api/events")) return "Events";
  if (path.startsWith("/api/cabshare")) return "CabShare";
  if (path.startsWith("/api/club-admin")) return "Clubs";
  if (path.startsWith("/api/koha")) return "Library";
  if (path.startsWith("/api/admin/cabshare")) return "Admin";
  if (path.startsWith("/api/admin")) return "Admin";
  if (path.startsWith("/api/qbank")) return "QBank";
  if (path.startsWith("/api/notifications")) return "Notifications";
  if (path.startsWith("/api/cron")) return "Cron";
  return "General";
}

export default function BetaDocsPage() {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("beta-docs-theme");
    const preferDark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setIsDark(preferDark);
    document.documentElement.classList.toggle("dark", preferDark);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("beta-docs-theme", next ? "dark" : "light");
  };

  useEffect(() => {
    fetch("/api/docs")
      .then((r) => r.json())
      .then((data) => {
        setSpec(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const groupedEndpoints = useMemo(() => {
    if (!spec?.paths) return {};
    const groups: Record<string, { path: string; method: string; details: EndpointMethod }[]> = {};
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, details] of Object.entries(methods)) {
        const category = getCategory(path);
        if (!groups[category]) groups[category] = [];
        groups[category].push({ path, method, details });
      }
    }
    return groups;
  }, [spec]);

  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) {
      return categoryOrder.filter(
        (cat) => groupedEndpoints[cat]?.length && (!selectedTag || cat === selectedTag)
      );
    }
    const q = searchQuery.toLowerCase();
    return Object.entries(groupedEndpoints)
      .filter(([, endpoints]) =>
        endpoints.some(
          (ep) =>
            ep.path.toLowerCase().includes(q) ||
            ep.details.summary?.toLowerCase().includes(q) ||
            ep.details.description?.toLowerCase().includes(q)
        )
      )
      .map(([tag]) => tag)
      .filter((tag) => !selectedTag || tag === selectedTag);
  }, [searchQuery, groupedEndpoints, selectedTag]);

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [tag, endpoints] of Object.entries(groupedEndpoints)) {
      counts[tag] = endpoints.length;
    }
    return counts;
  }, [groupedEndpoints]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#03060F] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Loading API documentation...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#03060F] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
          <XCircle className="w-12 h-12 text-red-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Failed to load API docs
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#03060F]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">
                {spec?.info?.title || "API Documentation"}
              </h1>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                v{spec?.info?.version} &middot; OpenAPI {spec?.openapi}
              </p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors shrink-0"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {spec?.info?.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-2xl">
            {spec.info.description}
          </p>
        )}

        {spec?.servers && spec.servers.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            {spec.servers.map((server, i) => (
              <a
                key={i}
                href={server.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <Server className="w-3.5 h-3.5" />
                {server.description || server.url}
                <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        )}

        {/* Search + Tag filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search endpoints by path, name, or description..."
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          {selectedTag && (
            <button
              onClick={() => setSelectedTag(null)}
              className="px-3 py-2.5 text-xs font-bold rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
            >
              Clear filter
            </button>
          )}
        </div>

        {/* Tag navigation */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categoryOrder
            .filter((cat) => groupedEndpoints[cat]?.length)
            .map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedTag === tag
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                    : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                {tag}
                <span className="opacity-60">({tagCounts[tag] || groupedEndpoints[tag]?.length || 0})</span>
              </button>
            ))}
        </div>

        {/* Endpoints by category */}
        <div className="space-y-8">
          {filteredTags.map((tag) => {
            const endpoints = groupedEndpoints[tag] || [];
            const icon = categoryIcons[tag] || "📌";

            return (
              <section key={tag}>
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200 dark:border-gray-800">
                  <span className="text-lg">{icon}</span>
                  <h2 className="text-xl font-black text-gray-900 dark:text-gray-100">
                    {tag}
                  </h2>
                  <span className="text-xs font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                    {endpoints.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {endpoints
                    .sort((a, b) => a.path.localeCompare(b.path))
                    .map((ep, idx) => {
                      const key = `${ep.method}-${ep.path}-${idx}`;
                      const isExpanded = expandedPath === key;
                      const bodySchema = ep.details.requestBody?.content?.["application/json"]?.schema;
                      const responseSchema =
                        ep.details.responses?.["200"]?.content?.["application/json"]?.schema;
                      const hasDetails = ep.details.parameters?.length || bodySchema || responseSchema;
                      const endpointEntries = ep.details.responses
                        ? Object.entries(ep.details.responses)
                        : [];

                      return (
                        <Card
                          key={key}
                          className="overflow-hidden"
                          hover
                          onClick={() => setExpandedPath(isExpanded ? null : key)}
                        >
                          <div className="p-4">
                            <div className="flex items-center gap-3">
                              <MethodBadge method={ep.method} />
                              <code className="flex-1 text-xs sm:text-sm font-mono font-semibold text-gray-800 dark:text-gray-200 truncate">
                                {ep.path}
                              </code>
                              {ep.details.summary && (
                                <span className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                  {ep.details.summary}
                                </span>
                              )}
                              {hasDetails ? (
                                isExpanded ? (
                                  <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />
                                )
                              ) : (
                                <Badge variant="default" size="sm" className="rounded-md">GET</Badge>
                              )}
                            </div>
                          </div>

                          {isExpanded && hasDetails && (
                            <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-4 space-y-4 animate-fadeIn">
                              {ep.details.summary && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {ep.details.summary}
                                </p>
                              )}

                              {ep.details.parameters && ep.details.parameters.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    Parameters
                                  </h4>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-800">
                                          <th className="text-left py-1.5 pr-4 font-semibold text-gray-500">Name</th>
                                          <th className="text-left py-1.5 pr-4 font-semibold text-gray-500">In</th>
                                          <th className="text-left py-1.5 pr-4 font-semibold text-gray-500">Type</th>
                                          <th className="text-left py-1.5 font-semibold text-gray-500">Required</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {ep.details.parameters.map((param, i) => (
                                          <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50">
                                            <td className="py-1.5 pr-4 font-mono font-medium text-gray-800 dark:text-gray-200">
                                              {param.name}
                                            </td>
                                            <td className="py-1.5 pr-4 text-gray-500">{param.in}</td>
                                            <td className="py-1.5 pr-4 text-gray-500">
                                              {param.schema?.type || "string"}
                                            </td>
                                            <td className="py-1.5">
                                              {param.required ? (
                                                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                              ) : (
                                                <XCircle className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {bodySchema && (
                                <div>
                                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    Request Body
                                  </h4>
                                  <pre className="text-xs bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 overflow-x-auto text-gray-700 dark:text-gray-300 font-mono leading-relaxed">
                                    {JSON.stringify(bodySchema, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {responseSchema && (
                                <div>
                                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    Response Schema
                                  </h4>
                                  <pre className="text-xs bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 overflow-x-auto text-gray-700 dark:text-gray-300 font-mono leading-relaxed">
                                    {JSON.stringify(responseSchema, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {endpointEntries.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    Responses
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {endpointEntries.map(([code, resp]) => (
                                      <Badge
                                        key={code}
                                        variant={
                                          code.startsWith("2")
                                                ? "success"
                                                : code.startsWith("4")
                                                  ? "warning"
                                                  : "danger"
                                        }
                                        size="sm"
                                        className="rounded-lg"
                                      >
                                        {code} &middot; {resp.description}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                </div>
              </section>
            );
          })}
        </div>

        {filteredTags.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-500 dark:text-gray-400">
              No endpoints found
            </h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Try a different search query or clear the filter
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            AmazeCC API Documentation &middot; Built with AmazeUI
          </p>
        </div>
      </div>
    </div>
  );
}
