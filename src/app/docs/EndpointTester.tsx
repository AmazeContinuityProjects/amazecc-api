"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { Play, Loader2, Code, List, Clock, Zap, BookOpen, Terminal } from "lucide-react";
import {
  Badge, Input, Textarea, Tabs, TabsList, TabsTrigger, TabsContent,
  Alert
} from "@amazecontinuityprojects/amazeui";

export const methodBadgeClasses: Record<string, string> = {
  get: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  post: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  put: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  patch: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  delete: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

export function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${methodBadgeClasses[method.toLowerCase()] || "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20"}`}
    >
      {method.toUpperCase()}
    </span>
  );
}

export interface EndpointTesterProps {
  path: string;
  method: string;
  details: Record<string, unknown> | undefined;
  vtopAuth?: { cookies: string; csrf: string; authorizedID: string } | null;
  moodleAuth?: { username: string; pass: string } | null;
  adminToken?: string;
  clubToken?: string;
}

export function EndpointTester({ 
  path, method, details, 
  vtopAuth, moodleAuth, adminToken, clubToken 
}: EndpointTesterProps) {
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [requestBody, setRequestBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{
    status: number;
    statusText: string;
    data: unknown;
    headers: Record<string, string>;
    time: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Infer prerequisites
  const isVtop = useMemo(() => {
    const schema = (details as unknown as { requestBody?: { content?: { "application/json"?: { schema?: { properties?: Record<string, unknown> } } } } })?.requestBody?.content?.["application/json"]?.schema?.properties;
    return !!(schema?.authorizedID && schema?.cookies && schema?.csrf);
  }, [details]);
  const isAdmin = path.startsWith("/api/admin");
  const isClub = path.startsWith("/api/club-admin");
  const isMoodle = path.startsWith("/api/lms-data") || path.startsWith("/api/vitol-data");

  // Initialize request body template if JSON schema is present
  useEffect(() => {
    const bodySchema = (details as unknown as { requestBody?: { content?: { "application/json"?: { schema?: unknown } } } })?.requestBody?.content?.["application/json"]?.schema as Record<string, unknown>;
    if (bodySchema && !requestBody) {
        if (bodySchema.example) {
            setRequestBody(JSON.stringify(bodySchema.example, null, 2));
        } else if (bodySchema.type === 'object' && typeof bodySchema.properties === 'object' && bodySchema.properties !== null) {
            const template: Record<string, unknown> = {};
            const props = bodySchema.properties as Record<string, { type?: string }>;
            for (const key in props) {
                // Don't auto-fill auth fields, we inject them
                if (isVtop && ["cookies", "csrf", "authorizedID"].includes(key)) continue;
                if (isMoodle && ["username", "pass"].includes(key)) continue;

                template[key] = props[key].type === 'string' ? '' 
                              : props[key].type === 'number' ? 0 
                              : props[key].type === 'boolean' ? false 
                              : null;
            }
            setRequestBody(JSON.stringify(template, null, 2));
        } else {
             setRequestBody("{\n  \n}");
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details, path, method]);

  const { previewBody, previewHeaders } = useMemo(() => {
    let body = requestBody;
    const hdrs: Record<string, string> = {
      "Accept": "application/json"
    };

    if (isVtop && vtopAuth && ["post", "put", "patch"].includes(method.toLowerCase())) {
      try {
        const parsed = body ? JSON.parse(body) : {};
        body = JSON.stringify({ ...parsed, cookies: "<injected_cookies>", csrf: "<injected_csrf>", authorizedID: "<injected_id>" }, null, 2);
      } catch {}
    }

    if (isMoodle && moodleAuth && ["post", "put", "patch"].includes(method.toLowerCase())) {
      try {
        const parsed = body ? JSON.parse(body) : {};
        body = JSON.stringify({ ...parsed, username: moodleAuth.username, pass: "********" }, null, 2);
      } catch {}
    }

    if (isAdmin && adminToken) {
      hdrs["Authorization"] = `Bearer ${adminToken.substring(0, 5)}...`;
    }
    if (isClub && clubToken) {
      hdrs["Authorization"] = `Bearer ${clubToken.substring(0, 5)}...`;
    }
    
    if (["post", "put", "patch"].includes(method.toLowerCase()) && body) {
       hdrs["Content-Type"] = "application/json";
    }

    return { previewBody: body, previewHeaders: hdrs };
  }, [requestBody, isVtop, vtopAuth, isMoodle, moodleAuth, isAdmin, adminToken, isClub, clubToken, method]);


  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      let finalPath = path;
      const queryParams = new URLSearchParams();
      const headers: Record<string, string> = {
          "Accept": "application/json"
      };

      if (isAdmin && adminToken) {
        headers["Authorization"] = `Bearer ${adminToken}`;
      }
      if (isClub && clubToken) {
        headers["Authorization"] = `Bearer ${clubToken}`;
      }

      let finalBody = requestBody;

      // Auto-inject VTOP credentials if needed
      if (isVtop && vtopAuth && ["post", "put", "patch"].includes(method.toLowerCase())) {
        try {
          const parsedBody = finalBody ? JSON.parse(finalBody) : {};
          finalBody = JSON.stringify({ ...parsedBody, ...vtopAuth });
        } catch {}
      }

      // Auto-inject Moodle credentials if needed
      if (isMoodle && moodleAuth && ["post", "put", "patch"].includes(method.toLowerCase())) {
        try {
          const parsedBody = finalBody ? JSON.parse(finalBody) : {};
          finalBody = JSON.stringify({ ...parsedBody, ...moodleAuth });
        } catch {}
      }

      if (["post", "put", "patch"].includes(method.toLowerCase()) && finalBody) {
          headers["Content-Type"] = "application/json";
      }

      // Process parameters
      if (details && (details as unknown as { parameters?: Array<Record<string, unknown>> }).parameters) {
        for (const param of ((details as unknown as { parameters?: Array<Record<string, unknown>> }).parameters ?? [] as Array<Record<string, unknown>>)) {
          const name = String(param.name);
          const val = paramValues[name];
          if (val === undefined || val === "") {
             if (param.required) throw new Error(`Missing required parameter: ${name}`);
             continue;
          }

          if (param.in === "path") {
            finalPath = finalPath.replace(`{${name}}`, encodeURIComponent(val));
          } else if (param.in === "query") {
            queryParams.append(name, val);
          } else if (param.in === "header") {
            headers[name] = val;
          }
        }
      }

      const queryString = queryParams.toString();
      const url = `${finalPath}${queryString ? `?${queryString}` : ""}`;

      const options: RequestInit = {
        method: method.toUpperCase(),
        headers,
      };

      if (["post", "put", "patch"].includes(method.toLowerCase()) && finalBody) {
         options.body = finalBody;
      }

      const startTime = performance.now();
      const res = await fetch(url, options);
      const endTime = performance.now();

      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
         data = await res.json();
      } else {
         data = await res.text();
      }

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
         responseHeaders[key] = value;
      });

      setResponse({
        status: res.status,
        statusText: res.statusText,
        data,
        headers: responseHeaders,
        time: Math.round(endTime - startTime)
      });
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || "An error occurred while making the request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col xl:flex-row bg-white dark:bg-[#03060F]">
      {/* Left Column: Documentation */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
         <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <MethodBadge method={method} />
              <h2 className="text-xl font-mono font-bold text-gray-900 dark:text-gray-100 break-all">
                {path}
              </h2>
            </div>
            
            {Boolean((details as unknown as { summary?: string }).summary) && (
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                {String((details as unknown as { summary?: string }).summary)}
              </h3>
            )}
            
            {Boolean((details as unknown as { description?: string }).description) && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                {String((details as unknown as { description?: string }).description)}
              </p>
            )}

            <div className="flex flex-wrap gap-2 mb-6">
              {isVtop && <Badge variant="warning" className="text-[10px]">Requires VTOP Auth</Badge>}
              {isMoodle && <Badge variant="info" className="text-[10px]">Requires LMS Auth</Badge>}
              {isAdmin && <Badge variant="danger" className="text-[10px]">Requires Admin Auth</Badge>}
              {isClub && <Badge variant="purple" className="text-[10px]">Requires Club Auth</Badge>}
            </div>
         </div>

          {/* Parameters */}
          {Boolean((details as unknown as { parameters?: Array<Record<string, unknown>> }).parameters?.length) && (
           <div className="mb-8">
             <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">
               <List className="w-4 h-4 text-accent" /> Parameters
             </h4>
             <div className="space-y-4">
               {((details as unknown as { parameters?: Array<Record<string, unknown>> }).parameters as Record<string, unknown>[]).map((param, i) => (
                 <div key={i} className="p-4 rounded-xl bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-900 shadow-sm">
                   <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200">{String(param.name)}</span>
                        {Boolean(param.required) && <Badge variant="danger" className="text-[9px]">Required</Badge>}
                      </div>
                      <span className="text-xs text-gray-500 font-mono bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded">{String(param.in)}</span>
                   </div>
                   {Boolean(param.description) && (
                     <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{String(param.description)}</p>
                   )}
                   <Input 
                     placeholder={`Enter ${param.name}...`}
                     value={paramValues[String(param.name)] || ""}
                     onChange={(e) => setParamValues({...paramValues, [String(param.name)]: e.target.value})}
                     className="bg-white dark:bg-[#111] text-xs h-9"
                   />
                 </div>
               ))}
             </div>
           </div>
         )}

         {/* Request Area */}
         <div className="mb-8">
           <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">
             <Code className="w-4 h-4 text-accent" /> Request Payload
           </h4>
           
           {["post", "put", "patch"].includes(method.toLowerCase()) ? (
             <Textarea 
               value={requestBody}
               onChange={(e) => setRequestBody(e.target.value)}
               className="min-h-[250px] font-mono text-sm border-0 focus:ring-0 rounded-xl bg-gray-50 dark:bg-[#0a0a0a] text-gray-800 dark:text-gray-200 resize-y p-4 shadow-sm border border-gray-100 dark:border-gray-900"
               placeholder="{}"
             />
           ) : (
             <div className="min-h-[100px] flex items-center justify-center rounded-xl bg-gray-50 dark:bg-[#0a0a0a] text-gray-500 text-sm font-mono border border-gray-100 dark:border-gray-900 shadow-sm">
                No payload required for {method.toUpperCase()}
             </div>
           )}
         </div>

         <div className="mb-8">
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">
              <Terminal className="w-4 h-4 text-accent" /> cURL Preview
            </h4>
            
            {/* Floating Terminal Redesign */}
            <div className="p-5 overflow-x-auto custom-scrollbar bg-[#0f111a] rounded-2xl shadow-lg border border-gray-800/50 mb-8 relative group transform transition-transform duration-300 hover:scale-[1.01]">
              {/* MacOS style window controls */}
              <div className="flex gap-2 mb-4 opacity-75">
                <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-inner"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-inner"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80 shadow-inner"></div>
              </div>
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
                <span className="text-pink-400 font-bold">curl</span> -X {method.toUpperCase()} \
                <br/>  <span className="text-accent">{`${window.location.origin}${path}`}</span> \
                {Object.entries(previewHeaders).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <br/>  -H <span className="text-green-400">"{k}: {v}"</span> \
                  </React.Fragment>
                ))}
                {previewBody && (
                  <>
                    <br/>  -d <span className="text-yellow-400">'{previewBody.replace(/'/g, "'\\''")}'</span>
                  </>
                )}
              </pre>
            </div>
            
            <div className="relative overflow-hidden group mb-4">
              <button 
                onClick={handleExecute} 
                disabled={loading}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold py-4 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center text-sm"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2" />}
                {loading ? "Executing Request..." : "Send Request"}
              </button>
            </div>

           {error && (
             <Alert variant="error" className="mt-4 shadow-md rounded-xl">
               {error}
             </Alert>
           )}
         </div>

          {/* Standard Responses */}
          {Boolean((details as unknown as { responses?: Record<string, unknown> }).responses) && Object.keys((details as unknown as { responses?: Record<string, unknown> }).responses ?? {}).length > 0 && (
           <div className="mb-8">
             <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">
               <BookOpen className="w-4 h-4 text-accent" /> Standard Responses
             </h4>
             <div className="space-y-3">
                {Object.entries((details as unknown as { responses?: Record<string, unknown> }).responses as Record<string, Record<string, unknown>>).map(([statusCode, resp]: [string, Record<string, unknown>]) => (
                 <div key={statusCode} className="p-3 rounded-xl bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-900 shadow-sm flex items-start gap-3">
                    <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold font-mono shadow-sm mt-0.5 ${
                        statusCode.startsWith('2') ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                        statusCode.startsWith('4') || statusCode.startsWith('5') ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20' :
                        'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-700'
                    }`}>
                        {statusCode}
                    </span>
                    <div className="flex-1">
                      <span className="text-xs text-gray-700 dark:text-gray-300 font-semibold block mb-1">{String((resp.description as string | undefined) || 'Response')}</span>
                    </div>
                 </div>
               ))}
             </div>
           </div>
         )}
         
      </div>

      {/* Right Column: Interactive Terminal & Output */}
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-[#060813] text-gray-100 border-l border-gray-200 dark:border-gray-800 relative min-h-0">
         
         {/* Floating Response Area */}
         <div className="flex-1 flex flex-col p-6 relative overflow-hidden bg-gray-100 dark:bg-[#03060F] min-h-0">
            <div className="flex-1 flex flex-col bg-white dark:bg-[#0a0a0a] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.3)] relative overflow-hidden min-h-0">
               <div className="px-5 py-3 bg-gray-50/80 dark:bg-[#111]/80 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between backdrop-blur-md z-10">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Zap className="w-3 h-3 text-accent" /> Response Output
                  </h4>
                  {response && (
                     <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono shadow-sm ${
                          response.status >= 200 && response.status < 300 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                          response.status >= 400 ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20' :
                          'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-700'
                        }`}>
                          {response.status} {response.statusText}
                        </span>
                        <span className="text-[10px] font-medium text-gray-500 flex items-center gap-1 bg-gray-100 dark:bg-gray-900 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-800">
                          <Clock className="w-3 h-3 text-gray-400" /> {response.time}ms
                        </span>
                     </div>
                  )}
               </div>
               
               <div className="flex-1 relative bg-white dark:bg-[#0a0a0a] min-h-0">
                 {!response && !loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-50 to-white dark:from-[#111] dark:to-[#0a0a0a]">
                       <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center mb-4 shadow-inner border border-gray-200 dark:border-gray-800">
                         <Play className="w-8 h-8 opacity-50 text-gray-500 ml-1" />
                       </div>
                       <p className="text-xs font-medium tracking-wider uppercase opacity-70">Awaiting Execution</p>
                    </div>
                 )}
                 {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-accent bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm z-20">
                       <Loader2 className="w-10 h-10 animate-spin mb-4 drop-shadow-[0_0_15px_rgba(var(--accent),0.5)]" />
                       <p className="text-xs font-bold animate-pulse tracking-widest uppercase">Processing...</p>
                    </div>
                 )}
                 {response && (
                    <Tabs defaultValue="body" className="flex flex-col h-full w-full min-h-0">
                      <div className="px-5 pt-2 bg-gray-50/50 dark:bg-[#111]/50 border-b border-gray-200 dark:border-gray-800">
                        <TabsList className="bg-transparent h-9 w-full justify-start gap-6 rounded-none pb-0">
                          <TabsTrigger value="body" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-gray-900 dark:data-[state=active]:text-white text-gray-500 rounded-none px-0 pb-2 text-xs">Body</TabsTrigger>
                          <TabsTrigger value="headers" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-gray-900 dark:data-[state=active]:text-white text-gray-500 rounded-none px-0 pb-2 text-xs">Headers</TabsTrigger>
                        </TabsList>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                        <TabsContent value="body" className="m-0 h-full">
                           <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">
                              {typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : String(response.data || '')}
                           </pre>
                        </TabsContent>
                        <TabsContent value="headers" className="m-0 h-full">
                           <div className="space-y-3">
                             {Object.entries(response.headers).map(([k, v]) => (
                                <div key={k} className="text-xs font-mono flex items-start p-2 rounded bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-gray-900">
                                  <span className="font-bold text-gray-500 w-1/3 break-all pr-2">{k}:</span>
                                  <span className="text-gray-800 dark:text-gray-200 flex-1 break-all">{v}</span>
                                </div>
                             ))}
                           </div>
                        </TabsContent>
                      </div>
                    </Tabs>
                 )}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
