"use client";

import { useState, useEffect } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { BottomNav } from "@/components/BottomNav";
import { FAB } from "@/components/FAB";
import { GreetingHeader } from "@/components/home/GreetingHeader";
import { NextJobCard } from "@/components/home/NextJobCard";
import { GoalsCard } from "@/components/home/GoalsCard";
import { mockJobs, mockMetas } from "@/lib/mock";
import { supabase } from "@/lib/supabase";
import type { TabId, Usuario } from "@/lib/types";

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center pt-32">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {label} — em breve
      </p>
    </div>
  );
}

function AjustesTab({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center pt-32 gap-6">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Ajustes — em breve
      </p>
      <button
        onClick={onSignOut}
        className="px-6 py-3 rounded-2xl text-sm font-medium transition-opacity active:opacity-70"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border-color)",
          color: "var(--text-muted)",
        }}
      >
        Sair da conta
      </button>
    </div>
  );
}

export default function Page() {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [fabOpen, setFabOpen] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUsuario({
        id: data.user.id,
        nome:
          data.user.user_metadata?.full_name ?? data.user.email ?? "Usuário",
        email: data.user.email ?? "",
        avatarUrl: data.user.user_metadata?.avatar_url,
      });
    });
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function handleTabChange(tab: TabId) {
    setActiveTab(tab);
    setFabOpen(false);
  }

  return (
    <div className="relative flex flex-col min-h-screen">
      <LoadingScreen isLoading={!usuario} />

      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-6">
        {activeTab === "home" && usuario && (
          <>
            <GreetingHeader usuario={usuario} />
            <div className="mt-5 space-y-4">
              <NextJobCard jobs={mockJobs} />
              <GoalsCard jobs={mockJobs} metas={mockMetas} />
            </div>
          </>
        )}
        {activeTab === "jobs" && <PlaceholderTab label="Jobs" />}
        {activeTab === "financeiro" && <PlaceholderTab label="Financeiro" />}
        {activeTab === "cofre" && <PlaceholderTab label="Cofre" />}
        {activeTab === "ajustes" && <AjustesTab onSignOut={handleSignOut} />}
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
