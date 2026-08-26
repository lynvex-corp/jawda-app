import type { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Topbar } from "./topbar";
import { AIAssistant } from "./ai-assistant";
import { SobreJawdaProvider, SobreJawdaTrigger } from "./sobre-jawda";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SobreJawdaProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
            <footer className="border-t border-border/60 px-4 py-3 text-center md:px-8">
              <SobreJawdaTrigger />
            </footer>
          </div>
          <AIAssistant />
        </div>
      </SidebarProvider>
    </SobreJawdaProvider>
  );
}
