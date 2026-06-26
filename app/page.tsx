"use client";

import { useState } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { BottomNav } from "@/components/BottomNav";
import { FAB } from "@/components/FAB";
import { GreetingHeader } from "@/components/home/GreetingHeader";
import { NextJobCard } from "@/components/home/NextJobCard";
import { GoalsCard } from "@/components/home/GoalsCard";
import { mockJobs, mockMetas, mockUsuario } from "@/lib/mock";
import type { TabId } from "@/lib/types";

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center pt-32">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {label} — em breve
      </p>
    </div>
  );
}

export default function Page() {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [fabOpen, setFabOpen] = useState(false);

  function handleTabChange(tab: TabId) {
    setActiveTab(tab);
    setFabOpen(false);
  }

  return (
    <div className="relative flex flex-col min-h-screen">
      <LoadingScreen isLoading={false} />

      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-6">
        {activeTab === "home" && (
          <>
            <GreetingHeader usuario={mockUsuario} />
            <div className="mt-5 space-y-4">
              <NextJobCard jobs={mockJobs} />
              <GoalsCard jobs={mockJobs} metas={mockMetas} />
            </div>
          </>
        )}
        {activeTab === "jobs" && <PlaceholderTab label="Jobs" />}
        {activeTab === "financeiro" && <PlaceholderTab label="Financeiro" />}
        {activeTab === "cofre" && <PlaceholderTab label="Cofre" />}
        {activeTab === "ajustes" && <PlaceholderTab label="Ajustes" />}
      </main>

      <FAB
        activeTab={activeTab}
        open={fabOpen}
        onToggle={() => setFabOpen((v) => !v)}
      />
      <BottomNav activeTab={activeTab} onChange={handleTabChange} />
    </div>
  );
}
