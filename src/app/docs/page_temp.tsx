"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, BookOpen, Server, Loader2, XCircle, Moon, Sun, Play, Menu, Settings2, Key, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarItem,
  Card, ThemeSwitcher, ColorPalettePicker, LoadingSpinner, Badge, Input, ErrorDisplay
} from "@amazecontinuityprojects/amazeui";
import { EndpointTester, MethodBadge } from "./EndpointTester";
import { useTheme } from "next-themes";
import Image from "next/image";

type OpenApiSpec = {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: { url: string; description?: string }[];
  paths?: Record<string, Record<string, unknown>>;
  tags?: { name: string; description?: string }[];
};

const categoryGroup: Record<string, string> = {
  "/api/login": "Auth",
  "/api/student": "Student Profile",
  "/api/credentials": "Student Profile",
  "/api/profile-images": "Student Profile",
  "/api/change-password": "Student Profile",
  "/api/update-loginid": "Student Profile",
  "/api/grades": "Academics",
  "/api/all-grades": "Academics",
  "/api/attendance": "Academics",
  "/api/marks": "Academics",
  "/api/timetable": "Academics",
  "/api/schedule": "Academics",
  "/api/curriculum": "Academics",
  "/api/course-page": "Academics",
  "/api/course-completion": "Academics",
  "/api/registration": "Registration",
  "/api/course-option-change": "Registration",
  "/api/course-withdraw": "Registration",
  "/api/coursework-reg": "Registration",
  "/api/sem-request": "Registration",
  "/api/compre-exam": "Examinations",
  "/api/paper-see-rev": "Examinations",
  "/api/arrear": "Examinations",
  "/api/reexam": "Examinations",
  "/api/makeup": "Examinations",
  "/api/ept": "Examinations",
  "/api/hostel": "Hostel & Mess",
  "/api/late-hour": "Hostel & Mess",
  "/api/dayboarder": "Hostel & Mess",
  "/api/mess": "Hostel & Mess",
  "/api/caterer": "Hostel & Mess",
  "/api/transport": "Transport",
  "/api/buses": "Transport",
  "/api/cabshare": "CabShare",
  "/api/events": "Events",
  "/api/clubs": "Clubs",
  "/api/club-admin": "Clubs",
  "/api/library": "Library",
  "/api/book-recommendation": "Library",
  "/api/koha": "Library",
  "/api/research": "Research & Thesis",
  "/api/thesis": "Research & Thesis",
  "/api/scholar": "Scholar",
  "/api/meeting-info": "Scholar",
  "/api/internship": "Projects & Internship",
  "/api/project": "Projects & Internship",
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
  "/api/faculty": "Faculty & Mentorship",
  "/api/hod-dean": "Faculty & Mentorship",
  "/api/proctor": "Faculty & Mentorship",
  "/api/class-messages": "Faculty & Mentorship",
  "/api/circulars": "Circulars",
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
  "/api/sap": "SAP",
  "/api/mooc": "MOOCs & SWF",
  "/api/swf": "MOOCs & SWF",
  "/api/eca-upload": "MOOCs & SWF",
  "/api/exc-registration": "MOOCs & SWF",
  "/api/extra-curricular": "MOOCs & SWF",
  "/api/fdp": "FDP",
  "/api/lms-data": "External LMS",
  "/api/vitol-data": "External LMS",
  "/api/admin": "Admin",
  "/api/qbank": "QBank",
  "/api/status": "System",
  "/api/stats": "System",
  "/api/docs": "System",
  "/api/notifications": "Notifications",
  "/api/cron": "Cron",
};

const categoryIcons: Record<string, string> = {
  "Auth": "🔐", "Student Profile": "👤", "Academics": "📚", "Registration": "📝",
  "Examinations": "📋", "Hostel & Mess": "🏠", "Transport": "🚌", "CabShare": "🚕",
  "Events": "🎉", "Clubs": "🎯", "Library": "📖", "Research & Thesis": "🔬",
  "Scholar": "🎓", "Projects & Internship": "💼", "Finance": "💰", "Certificates": "📜",
  "Faculty & Mentorship": "👨‍🏫", "Circulars": "📢", "Student Services": "🛠️",
  "Feedback & Outcomes": "⭐", "SAP": "📊", "MOOCs & SWF": "🌐", "FDP": "📈",
  "External LMS": "💻", "Admin": "⚙️", "QBank": "📄", "System": "🔌", "Notifications": "🔔", "Cron": "⏰",
};

const categoryOrder = [
  "Auth", "Student Profile", "Academics", "Registration", "Examinations", "Hostel & Mess", 
  "Transport", "CabShare", "Events", "Clubs", "Library", "Research & Thesis", "Scholar", 
  "Projects & Internship", "Finance", "Certificates", "Faculty & Mentorship", "Circulars", 
  "Student Services", "Feedback & Outcomes", "SAP", "MOOCs & SWF", "FDP", "External LMS", 
  "Admin", "QBank", "System", "Notifications", "Cron",
];

function getCategory(path: string): string {
  for (const [prefix, category] of Object.entries(categoryGroup)) {
    if (path.startsWith(prefix)) return category;
  }
  return "General";
}

export default function ApiDocs() {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEndpointKey, setSelectedEndpointKey] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [authToken, setAuthToken] = useState("");
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    fetch("/api-docs-json")
      .then((r) => setApiOnline(r.ok))
      .catch(() => setApiOnline(false));

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
    const groups: Record<string, { path: string; method: string; details: unknown; key: string }[]> = {};
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, details] of Object.entries(methods)) {
        const category = getCategory(path);
        if (!groups[category]) groups[category] = [];
        groups[category].push({ path, method, details, key: `${method}:${path}` });
      }
    }
    return groups;
  }, [spec]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedEndpoints;
    const q = searchQuery.toLowerCase();
    const result: Record<string, typeof groupedEndpoints[string]> = {};
    
    for (const [category, endpoints] of Object.entries(groupedEndpoints)) {
      const filtered = endpoints.filter(ep => {
        const d = ep.details as Record<string, string> | undefined;
        return ep.path.toLowerCase().includes(q) || 
               d?.summary?.toLowerCase().includes(q)
      });
      if (filtered.length > 0) result[category] = filtered;
    }
    return result;
  }, [searchQuery, groupedEndpoints]);

  // Find currently selected endpoint details
  const currentEndpoint = useMemo(() => {
    if (!selectedEndpointKey || !spec?.paths) return null;
    const [method, path] = selectedEndpointKey.split(":");
    return {
      path,
      method,
      details: spec.paths[path]?.[method]
    };
  }, [selectedEndpointKey, spec]);

  const firstEndpointKey = useMemo(() => {
    for (const cat of categoryOrder) {
      if (filteredGroups[cat] && filteredGroups[cat].length > 0) {
        return filteredGroups[cat][0].key;
      }
    }
    return null;
  }, [filteredGroups]);


  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-[#03060F]">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" className="text-accent" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading API documentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-[#03060F] p-4">
        <div className="max-w-md w-full">
          <ErrorDisplay 
            message={`Failed to load API docs: ${error}`} 
            variant="error" 
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-[#03060F] relative">
      
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden backdrop-blur-sm animate-in fade-in" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* AmazeUI Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onOpenChange={setIsSidebarOpen}
        className={isMobileOpen ? "!flex !translate-x-0" : "max-md:-translate-x-full"}
      >
         <SidebarHeader>
           <div className="flex items-center gap-3 w-full mb-4 px-2 pt-2">
             <div className="w-8 h-8 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 flex items-center justify-center shadow-sm shrink-0">
               <Image src="/logo.png" alt="AmazeCC Logo" width={20} height={20} className="object-contain" />
             </div>
             <div>
               <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">AmazeCC API</h1>
               <p className="text-xs text-gray-500 dark:text-gray-400">v{spec?.info?.version}</p>
             </div>
           </div>
           
           <div className="relative px-2 pb-2">
             <Search className="absolute left-5 top-1/2 -translate-y-[65%] w-4 h-4 text-gray-400" />
             <input
               type="text"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               placeholder="Search endpoints..."
               className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-gray-100"
             />
           </div>
         </SidebarHeader>

         <SidebarContent className="custom-scrollbar">
           {categoryOrder.map((category) => {
             const endpoints = filteredGroups[category];
             if (!endpoints || endpoints.length === 0) return null;
             
             return (
               <SidebarGroup key={category}>
                 <SidebarGroupLabel className="flex items-center gap-2 text-xs font-black">
                   <span>{categoryIcons[category]}</span>
                   {category}
                 </SidebarGroupLabel>
                 <div className="space-y-0.5 mt-1">
                   {endpoints.map((ep) => {
                     const isSelected = selectedEndpointKey === ep.key;
                     return (
                       <SidebarItem
                         key={ep.key}
                         isActive={isSelected}
                          onClick={() => {
                            setSelectedEndpointKey(ep.key);
                            setIsMobileOpen(false);
                          }}
                         label={<span className="truncate ml-2 text-xs font-medium font-mono">{ep.path}</span>}
                         icon={<MethodBadge method={ep.method} />}
                       />
                     );
                   })}
                 </div>
               </SidebarGroup>
             );
           })}
           
           {Object.keys(filteredGroups).length === 0 && (
             <div className="text-center py-8">
                <p className="text-sm text-gray-500">No results found.</p>
             </div>
           )}
         </SidebarContent>
      </Sidebar>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden relative z-10 transition-all duration-300 ${isSidebarOpen ? 'md:pl-[312px]' : 'md:pl-[104px]'}`}>
         <header className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 md:px-6 bg-white dark:bg-[#03060F] sticky top-0 z-10">
           <div className="flex items-center gap-2 md:gap-4">
             <button 
               onClick={() => {
                 if (window.innerWidth < 768) {
                   setIsMobileOpen(!isMobileOpen);
                 } else {
                   setIsSidebarOpen(!isSidebarOpen);
                 }
               }}
               className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
             >
               <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
             </button>
               {mounted && (
                  <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <Server className="w-3.5 h-3.5" />
                    Base URL: <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">{window.location.origin}</code>
                  </div>
               )}
               {apiOnline !== null && (
                 <Badge variant={apiOnline ? "success" : "danger"} className="hidden md:flex ml-2">
                   {apiOnline ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                   {apiOnline ? "Online" : "Offline"}
                 </Badge>
               )}
             </div>
             
             <div className="flex items-center gap-4">
               <div className="relative w-48 sm:w-64 hidden md:block">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                   <Key className="h-4 w-4 text-gray-400" />
                 </div>
                 <Input 
                   type="password" 
                   placeholder="Enter Bearer Token..." 
                   className="pl-9 h-9 text-xs" 
                   value={authToken} 
                   onChange={(e) => setAuthToken(e.target.value)} 
                 />
               </div>
             </div>
         </header>

         <main className="flex-1 overflow-y-auto p-0 md:p-0 lg:p-0 custom-scrollbar bg-white dark:bg-[#03060F]">
            <div className="w-full h-full">
              {!currentEndpoint ? (
                 <div className="py-20 px-8 max-w-2xl">
                    <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-gray-100 mb-4">
                      {spec?.info?.title || "API Documentation"}
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                      {spec?.info?.description || "Welcome to the interactive API documentation. Select an endpoint from the sidebar to view details, parameters, and test requests live."}
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <Card 
                        variant="glass" 
                        hover
                        onClick={() => firstEndpointKey && setSelectedEndpointKey(firstEndpointKey)}
                        className="p-4 border-gray-200/50 dark:border-gray-800/50 cursor-pointer transition-all"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                          <Play className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">Interactive Testing</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Test any endpoint directly from the browser with live data.</p>
                      </Card>
                      <Card 
                        variant="glass" 
                        hover
                        onClick={() => firstEndpointKey && setSelectedEndpointKey(firstEndpointKey)}
                        className="p-4 border-gray-200/50 dark:border-gray-800/50 cursor-pointer transition-all"
                      >
                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3">
                          <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">Comprehensive Specs</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">View detailed schemas, requirements, and response types.</p>
                      </Card>
                    </div>
                 </div>
              ) : (
                <div className="h-full">
                  <EndpointTester 
                    path={currentEndpoint.path} 
                    method={currentEndpoint.method} 
                    details={currentEndpoint.details as Record<string, unknown>} 
                    authToken={authToken}
                  />
                </div>
              )}
            </div>
         </main>

         {/* Floating Theme / Accent Box */}
         <div className="fixed bottom-6 right-6 z-50">
           {isSettingsOpen && (
             <div className="absolute bottom-16 right-0 w-64 p-4 rounded-xl bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 shadow-2xl mb-2 animate-fadeIn origin-bottom-right">
               <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">Appearance</h4>
               <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <span className="text-xs font-medium text-gray-500">Theme</span>
                   <ThemeSwitcher />
                 </div>
                 <div className="flex flex-col gap-2">
                   <span className="text-xs font-medium text-gray-500">Accent Color</span>
                   <ColorPalettePicker />
                 </div>
               </div>
             </div>
           )}
           <button 
             onClick={() => setIsSettingsOpen(!isSettingsOpen)}
             className="w-12 h-12 rounded-full bg-white dark:bg-[#111] shadow-xl border border-gray-200 dark:border-gray-800 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors relative z-10"
           >
             <Settings2 className={`w-5 h-5 text-gray-600 dark:text-gray-300 transition-transform ${isSettingsOpen ? 'rotate-90' : ''}`} />
           </button>
         </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.3);
          border-radius: 20px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(75, 85, 99, 0.4);
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5);
        }
      `}} />
    </div>
  );
}
