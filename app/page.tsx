"use client";

import { useState, useEffect } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { BottomNav } from "@/components/BottomNav";
import { FAB } from "@/components/FAB";
import { GreetingHeader } from "@/components/home/GreetingHeader";
import { NextJobCard } from "@/components/home/NextJobCard";
import { GoalsCard } from "@/components/home/GoalsCard";
import { JobsTab } from "@/components/jobs/JobsTab";
import { JobForm } from "@/components/jobs/JobForm";
import { FinanceiroTab } from "@/components/financeiro/FinanceiroTab";
import { MetaForm } from "@/components/financeiro/MetaForm";
import { CofreTab } from "@/components/cofre/CofreTab";
import { UploadSheet } from "@/components/cofre/UploadSheet";
import { AjustesTab } from "@/components/ajustes/AjustesTab";
import { PinScreen } from "@/components/pin/PinScreen";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import type { TabId, Usuario, Job, Meta } from "@/lib/types";

export default function Page() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [fabOpen, setFabOpen] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  // Home real data
  const [jobs, setJobs] = useState<Job[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);

  // PIN lock
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  // Jobs
  const [jobFormOpen, setJobFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);

  // Financeiro
  const [metaFormOpen, setMetaFormOpen] = useState(false);
  const [financeiroRefreshKey, setFinanceiroRefreshKey] = useState(0);

  // Cofre
  const [uploadOpen, setUploadOpen] = useState(false);
  const [cofreRefreshKey, setCofreRefreshKey] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const u: Usuario = {
        id: data.user.id,
        nome:
          data.user.user_metadata?.full_name ?? data.user.email ?? "Usuário",
        email: data.user.email ?? "",
        avatarUrl: data.user.user_metadata?.avatar_url,
      };
      setUsuario(u);

      // Check PIN
      supabase
        .from("configuracoes")
        .select("pin_hash")
        .eq("user_id", data.user.id)
        .single()
        .then(({ data: cfg }) => {
          if (cfg?.pin_hash) {
            setPinHash(cfg.pin_hash);
            setLocked(true);
          }
        });
    });
  }, []);

  useEffect(() => {
    if (!usuario) return;
    Promise.all([
      supabase
        .from("jobs")
        .select("*")
        .eq("user_id", usuario.id)
        .order("data")
        .order("hora"),
      supabase.from("metas").select("*").eq("user_id", usuario.id),
    ]).then(([{ data: jobsData }, { data: metasData }]) => {
      if (jobsData) {
        setJobs(
          jobsData.map((j) => ({
            id: j.id,
            clienteNome: j.cliente_nome,
            data: j.data,
            hora: j.hora,
            valor: j.valor,
            modalidade: j.modalidade,
            local: j.local ?? undefined,
            status: j.status,
            observacoes: j.observacoes ?? undefined,
            criadoEm: j.criado_em,
          }))
        );
      }
      if (metasData) {
        setMetas(
          metasData.map((m) => ({
            periodo: m.periodo,
            valorAlvo: m.valor_alvo,
          }))
        );
      }
    });
  }, [usuario, jobsRefreshKey, financeiroRefreshKey]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function handleTabChange(tab: TabId) {
    setActiveTab(tab);
    setFabOpen(false);
  }

  function handleFabAction() {
    if (activeTab === "jobs" || activeTab === "home") {
      setEditingJob(null);
      setJobFormOpen(true);
    } else if (activeTab === "financeiro") {
      setMetaFormOpen(true);
    } else if (activeTab === "cofre") {
      setUploadOpen(true);
    }
  }

  // Show PIN screen before anything else
  if (locked && pinHash) {
    return <PinScreen pinHash={pinHash} onUnlock={() => setLocked(false)} />;
  }

  return (
    <div className="relative flex flex-col min-h-screen">
      <LoadingScreen isLoading={!usuario} />

      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-6">
        {activeTab === "home" && usuario && (
          <>
            <GreetingHeader usuario={usuario} />
            <div className="mt-5 space-y-4">
              <NextJobCard jobs={jobs} />
              <GoalsCard jobs={jobs} metas={metas} />
            </div>
          </>
        )}
        {activeTab === "jobs" && usuario && (
          <JobsTab
            userId={usuario.id}
            refreshTrigger={jobsRefreshKey}
            onEditJob={(job) => {
              setEditingJob(job);
              setJobFormOpen(true);
            }}
          />
        )}
        {activeTab === "financeiro" && usuario && (
          <FinanceiroTab
            userId={usuario.id}
            refreshTrigger={financeiroRefreshKey}
          />
        )}
        {activeTab === "cofre" && usuario && (
          <CofreTab userId={usuario.id} refreshTrigger={cofreRefreshKey} />
        )}
        {activeTab === "ajustes" && usuario && (
          <AjustesTab
            userId={usuario.id}
            onSignOut={handleSignOut}
            onPinHashChange={(h) => setPinHash(h)}
          />
        )}
      </main>

      <FAB
        activeTab={activeTab}
        open={fabOpen}
        onToggle={() => setFabOpen((v) => !v)}
        onAction={handleFabAction}
      />
      <BottomNav activeTab={activeTab} onChange={handleTabChange} />

      {usuario && (
        <>
          <JobForm
            open={jobFormOpen}
            job={editingJob}
            userId={usuario.id}
            onClose={() => setJobFormOpen(false)}
            onSaved={() => {
              setJobsRefreshKey((k) => k + 1);
              toast.success(editingJob ? "Job atualizado!" : "Job criado!");
            }}
          />
          <MetaForm
            open={metaFormOpen}
            userId={usuario.id}
            onClose={() => setMetaFormOpen(false)}
            onSaved={() => {
              setFinanceiroRefreshKey((k) => k + 1);
              toast.success("Meta salva!");
            }}
          />
          <UploadSheet
            open={uploadOpen}
            userId={usuario.id}
            onClose={() => setUploadOpen(false)}
            onUploaded={() => {
              setCofreRefreshKey((k) => k + 1);
              toast.success("Arquivo enviado!");
            }}
          />
        </>
      )}
    </div>
  );
}
