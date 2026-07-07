"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Play, Loader2, Code, List, Clock, Zap, BookOpen } from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle,
  Badge, Button, Input, Textarea, Tabs, TabsList, TabsTrigger, TabsContent,
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

export function EndpointTester({ path, method, details, authToken }: { path: string, method: string, details: Record<string, unknown> | undefined, authToken?: string }) {
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

  const responses = (details as any)?.responses;

  // Initialize request body template if JSON schema is present
  useEffect(() => {
    const bodySchema = (details as Record<string, Record<string, Record<string, Record<string, unknown>>>>)?.requestBody?.content?.["application/json"]?.schema;
    if (bodySchema && !requestBody) {
        if (bodySchema.example) {
            setRequestBody(JSON.stringify(bodySchema.example, null, 2));
        } else if (bodySchema.type === 'object' && typeof bodySchema.properties === 'object' && bodySchema.properties !== null) {
            const template: Record<string, unknown> = {};
            const props = bodySchema.properties as Record<string, { type?: string }>;
            for (const key in props) {
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

      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      if (["post", "put", "patch"].includes(method.toLowerCase()) && requestBody) {
          headers["Content-Type"] = "application/json";
      }

      // Process parameters
      if (details && (details as Record<string, unknown>).parameters) {
        for (const param of (details as Record<string, unknown>).parameters as Record<string, unknown>[]) {
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

      const url = `${window.location.origin}${finalPath}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const startTime = performance.now();
      const res = await fetch(url, {
        method: method.toUpperCase(),
        headers,
        body: ["post", "put", "patch"].includes(method.toLowerCase()) && requestBody ? requestBody : undefined,
      });
      const endTime = performance.now();

      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      const resHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        resHeaders[key] = value;
      });

      setResponse({
        status: res.status,
        statusText: res.statusText,
        data,
        headers: resHeaders,
        time: Math.round(endTime - startTime),
      });

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "success";
    if (status >= 400 && status < 500) return "warning";
    return "danger";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_450px] xl:grid-cols-[minmax(0,1fr)_550px] min-h-full animate-in fade-in duration-500">
      
      {/* Left Column: Documentation & Parameters */}
      <div className="p-6 md:p-10 lg:p-12 space-y-12 overflow-y-auto custom-scrollbar">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <MethodBadge method={method} />
             <h2 className="text-2xl font-bold font-mono tracking-tight text-gray-900 dark:text-gray-100 break-all">{path}</h2>
          </div>
          {details?.summary && (
            <p className="text-xl text-gray-700 dark:text-gray-200 font-medium">{String((details as Record<string, unknown>).summary)}</p>
          )}
          {details?.description && (
            <p className="text-base text-gray-500 dark:text-gray-400 max-w-3xl leading-relaxed">{String((details as Record<string, unknown>).description)}</p>
          )}
        </div>

        <div className="space-y-6">
           <h3 className="text-lg font-bold flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
              <List className="w-5 h-5 text-accent" /> Parameters
           </h3>
           {(!details || !(details as Record<string, unknown>)?.parameters || ((details as Record<string, unknown>)?.parameters as unknown[])?.length === 0) ? (
               <p className="text-sm text-gray-500 italic">No parameters required for this endpoint.</p>
           ) : (
              <div className="space-y-4">
                {((details as Record<string, unknown>)?.parameters as Record<string, unknown>[]).map((param) => (
                  <div key={param.name} className="flex flex-col gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
                    <label className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                       <span>
                         {String(param.name)} 
                         {param.required && <span className="text-red-500 ml-1">*</span>}
                       </span>
                       <Badge variant="default" size="sm" className="font-mono uppercase tracking-widest text-[9px] bg-gray-200 dark:bg-gray-800">{String(param.in)}</Badge>
                    </label>
                    {param.description && <p className="text-xs text-gray-500 dark:text-gray-400">{String(param.description)}</p>}
                    <Input 
                      value={paramValues[String(param.name)] || ""}
                      onChange={(e) => setParamValues(p => ({...p, [String(param.name)]: e.target.value}))}
                      placeholder={(param.schema as Record<string, string>)?.type || "string"}
                      className="text-sm font-mono mt-1 bg-white dark:bg-[#03060F]"
                    />
                  </div>
                ))}
              </div>
           )}
        </div>

        {responses && Object.keys(responses).length > 0 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
              <BookOpen className="w-5 h-5 text-purple-500" /> Expected Responses
            </h3>
            <div className="space-y-4">
               {Object.entries(responses).map(([status, resData]: [string, any]) => (
                 <div key={status} className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                       <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            status.startsWith('2') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            status.startsWith('4') || status.startsWith('5') ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }`}>
                            {status}
                          </span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{resData.description}</span>
                       </div>
                    </div>
                    {resData.content?.["application/json"]?.schema && (
                       <div className="p-4 overflow-x-auto bg-white dark:bg-[#03060F]">
                         <pre className="text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap word-break">
                           {JSON.stringify(resData.content["application/json"].schema, null, 2)}
                         </pre>
                       </div>
                    )}
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Interactive Terminal */}
      <div className="flex flex-col bg-[#0a0a0a] text-gray-100 border-l border-gray-800 shadow-2xl relative overflow-hidden">
         {/* Request Area */}
         <div className="flex-1 p-6 overflow-y-auto custom-scrollbar border-b border-gray-800">
           <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
             <Code className="w-4 h-4" /> Request Payload
           </h4>
           
           {["post", "put", "patch"].includes(method.toLowerCase()) ? (
             <Textarea 
               value={requestBody}
               onChange={(e) => setRequestBody(e.target.value)}
               className="min-h-[250px] font-mono text-sm border-0 focus:ring-0 rounded-xl bg-[#111] text-gray-200 resize-y p-4 shadow-inner"
               placeholder="{}"
             />
           ) : (
             <div className="min-h-[100px] flex items-center justify-center rounded-xl bg-[#111] text-gray-500 text-sm font-mono border border-gray-800/50">
                No payload required for {method.toUpperCase()}
             </div>
           )}

           <div className="mt-6">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                <Terminal className="w-4 h-4 text-accent" /> cURL Preview
              </h3>
            </div>
            
            <div className="p-4 overflow-x-auto custom-scrollbar bg-[#111] rounded-xl mb-6">
              <pre className="text-xs text-gray-800 dark:text-gray-200 font-mono whitespace-pre-wrap break-all leading-relaxed">
                <span className="text-pink-500 dark:text-pink-400">curl</span> -X {method.toUpperCase()} \
                <br/>  <span className="text-accent">{`${window.location.origin}${path}`}</span> \
                <br/>  -H <span className="text-green-600 dark:text-green-400">"Accept: application/json"</span> {
                  (authToken) && (
                    <>\
                      <br/>  -H <span className="text-green-600 dark:text-green-400">"Authorization: Bearer {authToken.substring(0, 5)}...{authToken.substring(authToken.length - 5)}"</span>
                    </>
                  )
                } {
                  (["post", "put", "patch"].includes(method.toLowerCase()) && requestBody) && (
                    <>\
                      <br/>  -H <span className="text-green-600 dark:text-green-400">"Content-Type: application/json"</span> \
                      <br/>  -d <span className="text-yellow-600 dark:text-yellow-400">'{requestBody.replace(/'/g, "'\\''")}'</span>
                    </>
                  )
                }
              </pre>
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#080b14] relative overflow-hidden group">
              <button 
                onClick={handleExecute} 
                disabled={loading}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold py-6 rounded-xl shadow-[0_0_20px_rgba(var(--accent),0.3)] transition-all active:scale-[0.98]"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2" />}
                {loading ? "Executing Request..." : "Send Request"}
              </button>
              
              {loading && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-accent bg-gray-50/80 dark:bg-[#080b14]/80 backdrop-blur-sm">
                    <Loader2 className="w-8 h-8 animate-spin mb-3" />
                    <p className="text-sm font-medium animate-pulse tracking-wide">Awaiting response...</p>
                 </div>
              )}
            </div>

           {error && (
             <div className="mt-4 p-4 rounded-xl bg-red-950/50 border border-red-900/50 text-red-400 text-sm">
                {error}
             </div>
           )}
         </div>

         {/* Response Area */}
         <div className="flex-1 flex flex-col bg-[#03060F] p-0 relative overflow-hidden h-[50vh] lg:h-auto">
            <div className="px-6 py-4 bg-[#0a0a0a] border-b border-gray-800 flex items-center justify-between">
               <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                 <Zap className="w-4 h-4" /> Response Output
               </h4>
               {response && (
                  <div className="flex items-center gap-3">
                     <span className={`px-2 py-1 rounded text-xs font-bold font-mono ${
                       response.status >= 200 && response.status < 300 ? 'bg-emerald-500/20 text-emerald-400' :
                       response.status >= 400 ? 'bg-red-500/20 text-red-400' :
                       'bg-gray-800 text-gray-300'
                     }`}>
                       {response.status} {response.statusText}
                     </span>
                     <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                       <Clock className="w-3 h-3" /> {response.time}ms
                     </span>
                  </div>
               )}
            </div>
            
            <div className="flex-1 relative">
              {!response && !loading && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-700">
                    <Play className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm font-medium tracking-wide">Waiting for execution...</p>
                 </div>
              )}
              {loading && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-accent">
                    <Loader2 className="w-8 h-8 animate-spin mb-3" />
                    <p className="text-sm font-medium animate-pulse tracking-wide">Awaiting response...</p>
                 </div>
              )}
              {response && (
                 <Tabs defaultValue="body" className="flex flex-col h-full w-full">
                   <div className="px-6 pt-2 bg-[#0a0a0a]">
                     <TabsList className="bg-transparent h-10 w-full justify-start gap-6 border-b border-gray-800 rounded-none pb-0">
                       <TabsTrigger value="body" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white text-gray-500 rounded-none px-0 pb-2">Body</TabsTrigger>
                       <TabsTrigger value="headers" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white text-gray-500 rounded-none px-0 pb-2">Headers</TabsTrigger>
                     </TabsList>
                   </div>
                   <div className="flex-1 overflow-y-auto custom-scrollbar">
                     <TabsContent value="body" className="m-0 h-full">
                        <pre className="p-6 text-xs font-mono text-gray-300 whitespace-pre-wrap word-break">
                           {typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : response.data}
                        </pre>
                     </TabsContent>
                     <TabsContent value="headers" className="m-0 h-full">
                        <div className="p-6 space-y-3">
                          {Object.entries(response.headers).map(([k, v]) => (
                             <div key={k} className="text-xs font-mono flex">
                               <span className="font-semibold text-gray-500 w-1/3 truncate">{k}:</span>
                               <span className="text-gray-300 flex-1 break-all">{v}</span>
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
  );
}
