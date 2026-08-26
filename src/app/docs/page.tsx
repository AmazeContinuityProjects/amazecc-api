"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { Search, BookOpen, Server, Loader2, Menu, Settings2, CheckCircle2, AlertCircle, Shield } from "lucide-react";
import {
  Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarItem,
  ThemeSwitcher, ColorPalettePicker, LoadingSpinner, Badge, Input, ErrorDisplay, Button,
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Tabs, TabsList, TabsTrigger, TabsContent, Textarea
} from "@amazecontinuityprojects/amazeui";
import { EndpointTester, MethodBadge } from "./EndpointTester";

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
  "/api/course-withdraw": "Registration",
  "/api/coursework-reg": "Registration",
  "/api/sem-request": "Registration",
  "/api/paper-see-rev": "Examinations",
  "/api/reexam": "Examinations",
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
  "/api/capstone": "Projects & Internship",
  "/api/payments": "Finance",
  "/api/payment-receipts": "Finance",
  "/api/certificates": "Certificates",
  "/api/faculty": "Faculty & Mentorship",
  "/api/proctor": "Faculty & Mentorship",
  "/api/circular": "Circulars",
  "/api/university-day": "Circulars",
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
  "Auth": "🔑", "Student Profile": "👤", "Academics": "📚", "Registration": "📝",
  "Examinations": "📝", "Hostel & Mess": "🏢", "Transport": "🚌", "CabShare": "🚕",
  "Events": "🎉", "Clubs": "👥", "Library": "📖", "Research & Thesis": "🔬",
  "Scholar": "🎓", "Projects & Internship": "💼", "Finance": "💳", "Certificates": "📜",
  "Faculty & Mentorship": "👨‍🏫", "Circulars": "📢", "Student Services": "🛠️",
  "Feedback & Outcomes": "📊", "SAP": "🌐", "MOOCs & SWF": "💻", "FDP": "📈",
  "External LMS": "🎓", "Admin": "⚙️", "QBank": "❓", "System": "🖥️", "Notifications": "🔔", "Cron": "⏱️",
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

  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  // Auth States
  const [vtopAuth, setVtopAuth] = useState<{ cookies: string; csrf: string; authorizedID: string; clubToken?: string } | null>(null);
  const [moodleAuth, setMoodleAuth] = useState<{ username: string; pass: string } | null>(null);
  const [adminToken, setAdminToken] = useState("");
  const [clubToken, setClubToken] = useState("");

  const [authDialogTab, setAuthDialogTab] = useState("vtop");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);

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

  const handleVtopLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Login failed");
      
      setVtopAuth({
        cookies: Array.isArray(data.cookies) ? data.cookies.join("; ") : data.cookies,
        csrf: data.csrf,
        authorizedID: data.authorizedID,
        clubToken: data.clubToken
      });
      if (data.clubToken) setClubToken(data.clubToken);
      setIsAuthDialogOpen(false);
    } catch (err: unknown) {
      setLoginError((err instanceof Error ? err.message : String(err)));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleMoodleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setMoodleAuth({ username: loginForm.username, pass: loginForm.password });
    setIsAuthDialogOpen(false);
  };

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
         <div className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm" onClick={() => setIsMobileOpen(false)} />
      )}

      <Sidebar 
        isOpen={isSidebarOpen || isMobileOpen} 
        onOpenChange={(open) => window.innerWidth < 768 ? setIsMobileOpen(open) : setIsSidebarOpen(open)}
        className={`${isMobileOpen ? 'flex' : 'hidden'} md:flex`}
      >
        <SidebarHeader className="bg-transparent border-b border-sidebar-border p-4 h-[72px] flex items-center justify-between shrink-0">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-200 dark:bg-[#111] overflow-hidden shrink-0">
               <Image src="/logo.png" alt="Logo" width={24} height={24} className="object-contain" />
             </div>
             {isSidebarOpen && <h1 className="font-bold text-gray-900 dark:text-gray-100 text-lg tracking-tight truncate">API Docs</h1>}
           </div>
        </SidebarHeader>

        {isSidebarOpen && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
             <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
               </div>
               <input
                 type="text"
                 placeholder="Search endpoints..."
                 className="w-full pl-9 pr-4 py-2.5 bg-gray-100 dark:bg-[#111] border-0 text-sm text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 rounded-xl focus:ring-1 focus:ring-accent transition-all outline-none"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
               />
             </div>
          </div>
        )}

        <SidebarContent className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
           {categoryOrder.map((cat) => {
              const endpoints = filteredGroups[cat];
              if (!endpoints || endpoints.length === 0) return null;
              
              return (
                 <SidebarGroup key={cat} className="mb-2">
                    <SidebarGroupLabel className="text-gray-500 text-[10px] font-bold uppercase tracking-widest px-3 mb-2 flex items-center gap-2">
                      <span>{categoryIcons[cat] || "🔗"}</span> {cat}
                    </SidebarGroupLabel>
                    <div className="space-y-0.5">
                       {endpoints.map((ep) => {
                          const isSelected = selectedEndpointKey === ep.key;
                          return (
                             <SidebarItem
                               key={ep.key}
                               onClick={() => {
                                 setSelectedEndpointKey(ep.key);
                                 setIsMobileOpen(false);
                               }}
                               isActive={isSelected}
                               icon={<MethodBadge method={ep.method} />}
                               label={<span className="font-mono truncate">{ep.path}</span>}
                               className={isSelected ? "bg-white dark:bg-white/10 shadow-sm border border-gray-200 dark:border-gray-800" : "hover:bg-gray-100 dark:hover:bg-white/5"}
                             />
                          );
                       })}
                    </div>
                 </SidebarGroup>
              );
           })}
        </SidebarContent>
      </Sidebar>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-w-0 bg-white dark:bg-[#03060F] transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isSidebarOpen ? 'md:ml-[312px]' : 'md:ml-[104px]'}`}>
         <header className="h-[72px] shrink-0 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 px-6 flex items-center justify-between sticky top-0 z-10">
             <div className="flex items-center gap-2 md:gap-4">
               <button 
                 onClick={() => {
                   setIsMobileOpen(true);
                   if(window.innerWidth >= 768) setIsSidebarOpen(!isSidebarOpen);
                 }}
                 className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors md:hidden"
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
               <div className="hidden md:block">
                 <Button onClick={() => setIsAuthDialogOpen(true)} variant="outline" className="h-9 gap-2 text-xs font-semibold bg-white dark:bg-[#111] hover:bg-gray-50 dark:hover:bg-gray-900 border-gray-200 dark:border-gray-800 transition-colors">
                   <Shield className="w-4 h-4 text-accent" />
                   Test Auth Settings
                 </Button>
                 <Dialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen}>
                   <DialogContent className="sm:max-w-md bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)]">
                     <DialogHeader>
                       <DialogTitle className="text-gray-900 dark:text-gray-100 flex items-center gap-2">
                         <Shield className="w-5 h-5 text-accent" /> Configure Authentication
                       </DialogTitle>
                     </DialogHeader>
                     
                     <Tabs value={authDialogTab} onValueChange={setAuthDialogTab} className="w-full mt-4">
                       <TabsList className="grid w-full grid-cols-4 bg-gray-100 dark:bg-[#111] p-1 rounded-lg">
                         <TabsTrigger value="vtop" className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-[#222]">VTOP</TabsTrigger>
                         <TabsTrigger value="moodle" className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-[#222]">LMS</TabsTrigger>
                         <TabsTrigger value="admin" className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-[#222]">Admin</TabsTrigger>
                         <TabsTrigger value="club" className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-[#222]">Club</TabsTrigger>
                       </TabsList>
                       
                       <TabsContent value="vtop" className="pt-4">
                         <form onSubmit={handleVtopLogin} className="space-y-4">
                           <div className="space-y-2">
                             <span className="text-xs font-medium text-gray-500">Registration Number</span>
                             <Input 
                               value={loginForm.username}
                               onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                               placeholder="e.g. 21BCE0000" 
                               className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-gray-800"
                             />
                           </div>
                           <div className="space-y-2">
                             <span className="text-xs font-medium text-gray-500">Password</span>
                             <Input 
                               type="password"
                               value={loginForm.password}
                               onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                               placeholder="••••••••"
                               className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-gray-800"
                             />
                           </div>
                           {loginError && <p className="text-xs text-red-500">{loginError}</p>}
                           <Button type="submit" disabled={loginLoading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground mt-2 font-bold shadow-[0_5px_15px_-5px_rgba(var(--accent),0.5)]">
                             {loginLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                             Login & Save Credentials
                           </Button>
                           {vtopAuth && <p className="text-[10px] text-emerald-500 text-center mt-2 font-bold">✓ VTOP Credentials safely stored in session</p>}
                         </form>
                       </TabsContent>
                       
                       <TabsContent value="moodle" className="pt-4">
                         <form onSubmit={handleMoodleLogin} className="space-y-4">
                           <div className="space-y-2">
                             <span className="text-xs font-medium text-gray-500">Moodle Username</span>
                             <Input 
                               value={loginForm.username}
                               onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                               placeholder="e.g. 21BCE0000" 
                               className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-gray-800"
                             />
                           </div>
                           <div className="space-y-2">
                             <span className="text-xs font-medium text-gray-500">Moodle Password</span>
                             <Input 
                               type="password"
                               value={loginForm.password}
                               onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                               placeholder="••••••••"
                               className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-gray-800"
                             />
                           </div>
                           <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground mt-2 font-bold shadow-[0_5px_15px_-5px_rgba(var(--accent),0.5)]">
                             Save LMS Credentials
                           </Button>
                           {moodleAuth && <p className="text-[10px] text-emerald-500 text-center mt-2 font-bold">✓ LMS Credentials safely stored in session</p>}
                         </form>
                       </TabsContent>

                       <TabsContent value="admin" className="pt-4 space-y-4">
                         <div className="space-y-2">
                           <span className="text-xs font-medium text-gray-500">Admin Bearer Token</span>
                           <Textarea 
                             value={adminToken}
                             onChange={(e) => setAdminToken(e.target.value)}
                             placeholder="ey..." 
                             className="bg-gray-50 dark:bg-[#111] h-24 font-mono text-xs border-gray-200 dark:border-gray-800"
                           />
                         </div>
                         <Button onClick={() => setIsAuthDialogOpen(false)} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground mt-2 font-bold shadow-[0_5px_15px_-5px_rgba(var(--accent),0.5)]">
                           Apply Admin Token
                         </Button>
                       </TabsContent>

                       <TabsContent value="club" className="pt-4 space-y-4">
                         <div className="space-y-2">
                           <span className="text-xs font-medium text-gray-500">Club Rep Bearer Token</span>
                           <Textarea 
                             value={clubToken}
                             onChange={(e) => setClubToken(e.target.value)}
                             placeholder="ey..." 
                             className="bg-gray-50 dark:bg-[#111] h-24 font-mono text-xs border-gray-200 dark:border-gray-800"
                           />
                         </div>
                         <Button onClick={() => setIsAuthDialogOpen(false)} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground mt-2 font-bold shadow-[0_5px_15px_-5px_rgba(var(--accent),0.5)]">
                           Apply Club Token
                         </Button>
                       </TabsContent>
                     </Tabs>
                   </DialogContent>
                 </Dialog>
               </div>
             </div>
         </header>

         <main className="flex-1 overflow-y-auto p-0 md:p-0 lg:p-0 custom-scrollbar bg-white dark:bg-[#03060F]">
            {spec ? (
              !currentEndpoint ? (
                <div className="h-full flex items-center justify-center p-8">
                  <div className="text-center max-w-md">
                     <div className="w-16 h-16 bg-gray-100 dark:bg-[#111] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                       <BookOpen className="w-8 h-8 text-gray-400" />
                     </div>
                     <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">API Reference</h2>
                     <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                       Select an endpoint from the sidebar to view its documentation, parameters, and to execute test requests directly from the browser.
                     </p>
                     {firstEndpointKey && (
                       <Button variant="default" onClick={() => setSelectedEndpointKey(firstEndpointKey)}>
                         Get Started
                       </Button>
                     )}
                  </div>
                </div>
              ) : (
                <div className="h-full">
                  <EndpointTester 
                    path={currentEndpoint.path} 
                    method={currentEndpoint.method} 
                    details={currentEndpoint.details as Record<string, unknown>} 
                    vtopAuth={vtopAuth}
                    moodleAuth={moodleAuth}
                    adminToken={adminToken}
                    clubToken={clubToken}
                  />
                </div>
              )
            ) : null}
         </main>

         {/* Floating Theme / Accent Box */}
         <div className="fixed bottom-6 right-6 z-50">
           {isSettingsOpen && (
             <div className="absolute bottom-16 right-0 w-64 p-4 rounded-xl bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] mb-2 animate-fadeIn origin-bottom-right">
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

    </div>
  );
}
