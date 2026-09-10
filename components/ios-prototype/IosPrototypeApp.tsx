"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Camera,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DollarSign,
  Download,
  FileImage,
  FileText,
  Heart,
  HelpCircle,
  Home,
  Hourglass,
  Image as ImageIcon,
  LockKeyhole,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Palette,
  Plane,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Shield,
  ShieldCheck,
  Target,
  Upload,
  UserRound,
  UsersRound,
  Video,
  Wallet,
  X,
} from "lucide-react";
import styles from "./IosPrototypeApp.module.css";

type Screen = "home" | "agenda" | "financeiro" | "cofre" | "rede" | "ajustes";
type Icon = LucideIcon;

const navItems: Array<{ id: Exclude<Screen, "ajustes">; label: string; icon: Icon }> = [
  { id: "home", label: "Início", icon: Home },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "financeiro", label: "Financeiro", icon: Wallet },
  { id: "cofre", label: "Cofre", icon: ShieldCheck },
  { id: "rede", label: "Rede", icon: UsersRound },
];

type SheetKind =
  | "novo-atendimento"
  | "detalhe-atendimento"
  | "novo-objetivo"
  | "novo-movimento"
  | "upload-arquivo"
  | "arquivo"
  | "buscar-rede"
  | "notificacoes"
  | "conversas"
  | "novo-post"
  | "foto"
  | "editar-perfil"
  | "preferencia"
  | "confirmar-saida";

type OpenSheet = (kind: SheetKind) => void;
type Scenario = "conteudo" | "vazio" | "carregando" | "erro";

const sheetTitles: Record<SheetKind, string> = {
  "novo-atendimento": "Novo atendimento",
  "detalhe-atendimento": "Atendimento",
  "novo-objetivo": "Novo objetivo",
  "novo-movimento": "Nova movimentação",
  "upload-arquivo": "Enviar arquivo",
  arquivo: "Visualizar arquivo",
  "buscar-rede": "Buscar na Rede",
  notificacoes: "Notificações",
  conversas: "Conversas",
  "novo-post": "Nova publicação",
  foto: "Foto",
  "editar-perfil": "Editar perfil",
  preferencia: "Preferência",
  "confirmar-saida": "Sair da conta?",
};

function AvatarButton({ onClick, label = "Abrir Ajustes" }: { onClick: () => void; label?: string }) {
  return (
    <button className={styles.avatar} onClick={onClick} aria-label={label}>
      <span className={styles.avatarGlasses}>⌐</span>
      <span className={styles.avatarFace}>A</span>
    </button>
  );
}

function StatusBar() {
  return (
    <div className={styles.statusBar} aria-hidden="true">
      <strong>9:41</strong>
      <span className={styles.statusIcons}>▮▮▮ ◒ ▰</span>
    </div>
  );
}

function PrototypeControls({ scenario, onChange }: { scenario: Scenario; onChange: (scenario: Scenario) => void }) {
  return (
    <div className={styles.prototypeNotice} aria-label="Estados do protótipo">
      <span>PROTÓTIPO · SEM BACKEND</span>
      {(["conteudo", "vazio", "carregando", "erro"] as Scenario[]).map((item) => (
        <button key={item} onClick={() => onChange(item)} aria-pressed={scenario === item}>{item}</button>
      ))}
    </div>
  );
}

function PrototypeStateView({ screen, scenario, onRetry, openSheet }: { screen: Exclude<Screen, "ajustes">; scenario: Exclude<Scenario, "conteudo">; onRetry: () => void; openSheet: OpenSheet }) {
  const labels = {
    home: { title: "Início", empty: "Seu espaço começa com o primeiro atendimento.", action: "Registrar atendimento", sheet: "novo-atendimento" as const },
    agenda: { title: "Agenda", empty: "Nenhum atendimento para este dia.", action: "Adicionar atendimento", sheet: "novo-atendimento" as const },
    financeiro: { title: "Financeiro", empty: "Suas movimentações aparecerão aqui.", action: "Adicionar movimentação", sheet: "novo-movimento" as const },
    cofre: { title: "Cofre", empty: "Seu Cofre ainda está vazio.", action: "Enviar arquivo", sheet: "upload-arquivo" as const },
    rede: { title: "Rede", empty: "As novas publicações aparecerão aqui.", action: "Criar publicação", sheet: "novo-post" as const },
  }[screen];

  if (scenario === "carregando") {
    return (
      <div className={`${styles.screenContent} ${styles.stateScreen}`} aria-busy="true">
        <h1>{labels.title}</h1>
        <div className={styles.loadingLine}/><div className={styles.loadingCard}/><div className={styles.loadingCard}/><span className={styles.srOnly}>Carregando conteúdo</span>
      </div>
    );
  }

  if (scenario === "erro") {
    return (
      <div className={`${styles.screenContent} ${styles.stateScreen}`}>
        <h1>{labels.title}</h1>
        <div className={styles.stateCenter}><span className={styles.stateIcon}><RefreshCw/></span><h2>Não foi possível carregar</h2><p>Confira sua conexão e tente novamente.</p><button className={styles.stateAction} onClick={onRetry}><RefreshCw size={18}/>Tentar novamente</button></div>
      </div>
    );
  }

  return (
    <div className={`${styles.screenContent} ${styles.stateScreen}`}>
      <h1>{labels.title}</h1>
      <div className={styles.stateCenter}><span className={styles.stateIcon}>{screen === "cofre" ? <ShieldCheck/> : screen === "rede" ? <UsersRound/> : <Plane/>}</span><h2>Tudo pronto para começar</h2><p>{labels.empty}</p><button className={styles.stateAction} onClick={() => openSheet(labels.sheet)}>{labels.action}<ChevronRight size={18}/></button></div>
    </div>
  );
}

function BottomNav({ active, compact, onChange }: { active: Screen; compact: boolean; onChange: (screen: Screen) => void }) {
  return (
    <nav className={`${styles.bottomNav} ${compact ? styles.bottomNavCompact : ""}`} aria-label="Navegação principal">
      {navItems.map(({ id, label, icon: NavIcon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            className={isActive ? styles.navActive : styles.navButton}
            onClick={() => onChange(id)}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
          >
            <NavIcon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
          </button>
        );
      })}
    </nav>
  );
}

function PrototypeSheet({
  kind,
  onClose,
  onConfirm,
}: {
  kind: SheetKind | null;
  onClose: () => void;
  onConfirm: (message: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!kind) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [kind, onClose]);

  if (!kind) return null;

  const finish = (message: string) => {
    onConfirm(message);
    onClose();
  };

  return (
    <div className={styles.sheetBackdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="prototype-sheet-title">
        <div className={styles.sheetHandle} aria-hidden="true" />
        <header className={styles.sheetHeader}>
          <h2 id="prototype-sheet-title">{sheetTitles[kind]}</h2>
          <button ref={closeRef} className={styles.sheetClose} onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>

        {(kind === "novo-atendimento" || kind === "editar-perfil") && (
          <div className={styles.sheetForm}>
            {kind === "editar-perfil" ? (
              <>
                <button className={styles.avatarEditor}><span className={styles.personAvatar}>A</span><Camera size={20}/><strong>Trocar foto</strong></button>
                <label>Nome<input defaultValue="Alex Silva" /></label>
                <label>Bio<textarea defaultValue="Organizando meu trabalho para viver com mais liberdade." /></label>
              </>
            ) : (
              <>
                <label>Cliente<input placeholder="Nome do cliente" /></label>
                <div className={styles.sheetGrid}><label>Data<input type="date" defaultValue="2026-09-10" /></label><label>Hora<input type="time" defaultValue="15:30" /></label></div>
                <label>Valor<input inputMode="decimal" placeholder="R$ 0,00" /></label>
                <label>Local<input placeholder="Onde será o atendimento?" /></label>
              </>
            )}
            <button className={styles.sheetPrimary} onClick={() => finish(kind === "editar-perfil" ? "Perfil atualizado no protótipo" : "Atendimento salvo no protótipo")}>Salvar</button>
          </div>
        )}

        {kind === "detalhe-atendimento" && (
          <div className={styles.sheetBody}>
            <div className={styles.detailHero}><span className={styles.dateTile}><strong>10</strong><small>SET</small></span><div><h3>Cliente Preflight QA</h3><p>Hoje, 15h30 · Studio Preflight</p></div></div>
            <div className={styles.detailRows}><p><span>Status</span><strong>Confirmado</strong></p><p><span>Valor</span><strong>R$ 250,00</strong></p><p><span>Modalidade</span><strong>Presencial</strong></p></div>
            <button className={styles.sheetPrimary} onClick={() => finish("Edição simulada aberta")}>Editar atendimento</button>
          </div>
        )}

        {kind === "novo-objetivo" && (
          <div className={styles.sheetForm}>
            <label>Objetivo<input placeholder="Ex.: Minha próxima viagem" /></label>
            <label>Quanto você quer guardar?<input inputMode="decimal" placeholder="R$ 0,00" /></label>
            <label>Prazo<input type="date" /></label>
            <button className={styles.sheetPrimary} onClick={() => finish("Objetivo criado no protótipo")}>Criar objetivo</button>
          </div>
        )}

        {kind === "novo-movimento" && (
          <div className={styles.sheetForm}>
            <div className={styles.sheetSegment}><button aria-pressed="true">Entrada</button><button aria-pressed="false">Saída</button></div>
            <label>Descrição<input placeholder="Descrição da movimentação" /></label>
            <label>Valor<input inputMode="decimal" placeholder="R$ 0,00" /></label>
            <label>Data<input type="date" defaultValue="2026-09-10" /></label>
            <button className={styles.sheetPrimary} onClick={() => finish("Movimentação salva no protótipo")}>Salvar movimentação</button>
          </div>
        )}

        {kind === "upload-arquivo" && (
          <div className={styles.sheetBody}>
            <button className={styles.uploadDrop} onClick={() => onConfirm("Arquivo escolhido no protótipo")}><Upload size={32}/><strong>Escolher arquivo</strong><span>PDF, JPG ou PNG</span></button>
            <label className={styles.sheetLabel}>Categoria<select defaultValue="documentos"><option value="documentos">Documentos</option><option value="contratos">Contratos</option><option value="comprovantes">Comprovantes</option></select></label>
            <button className={styles.sheetPrimary} onClick={() => finish("Arquivo enviado no protótipo")}>Enviar para o Cofre</button>
          </div>
        )}

        {kind === "arquivo" && (
          <div className={styles.sheetBody}>
            <div className={styles.filePreview}><FileText size={58}/><strong>Contrato — Studio Preflight.pdf</strong><span>2,4 MB · PDF</span></div>
            <button className={styles.sheetPrimary} onClick={() => finish("Arquivo aberto no protótipo")}>Abrir arquivo</button>
            <button className={styles.sheetSecondary} onClick={() => finish("Compartilhamento simulado")}>Compartilhar</button>
          </div>
        )}

        {kind === "buscar-rede" && (
          <div className={styles.sheetBody}>
            <label className={styles.sheetSearch}><Search size={19}/><input autoFocus placeholder="Buscar pessoas ou publicações" /></label>
            <div className={styles.sheetList}><button><span className={`${styles.personAvatar} ${styles.personOne}`}>M</span><span><strong>Marina Costa</strong><small>@marina</small></span><ChevronRight/></button><button><span className={`${styles.personAvatar} ${styles.personTwo}`}>C</span><span><strong>Camila Rocha</strong><small>@camila</small></span><ChevronRight/></button></div>
          </div>
        )}

        {(kind === "notificacoes" || kind === "conversas") && (
          <div className={styles.sheetList}>
            {kind === "notificacoes" ? (
              <><button><span className={`${styles.personAvatar} ${styles.personOne}`}>M</span><span><strong>Marina curtiu sua publicação</strong><small>há 12 min</small></span><ChevronRight/></button><button><span className={`${styles.personAvatar} ${styles.personTwo}`}>C</span><span><strong>Camila começou a seguir você</strong><small>há 1h</small></span><ChevronRight/></button></>
            ) : (
              <><button><span className={`${styles.personAvatar} ${styles.personOne}`}>M</span><span><strong>Marina Costa</strong><small>Vamos marcar para amanhã?</small></span><ChevronRight/></button><button><span className={`${styles.personAvatar} ${styles.personTwo}`}>C</span><span><strong>Camila Rocha</strong><small>Parabéns pela conquista!</small></span><ChevronRight/></button></>
            )}
          </div>
        )}

        {kind === "novo-post" && (
          <div className={styles.sheetForm}>
            <textarea className={styles.postInput} autoFocus placeholder="Compartilhe uma conquista, uma dica ou um momento..." />
            <div className={styles.photoActions}><button><ImageIcon/>Foto</button><button><Camera/>Câmera</button></div>
            <div className={styles.sheetNotice}>Até 2 fotos. As imagens exibidas aqui são apenas simulação visual.</div>
            <button className={styles.sheetPrimary} onClick={() => finish("Publicação criada no protótipo")}>Publicar</button>
          </div>
        )}

        {kind === "foto" && (
          <div className={styles.sheetBody}>
            <div className={`${styles.viewerPhoto} ${styles.workspacePhoto}`}><div className={styles.photoSun}/><div className={styles.photoLaptop}><span>Sonhe<br/>Planeje<br/>Conquiste</span></div><div className={styles.photoPassport}>PASSAPORTE</div></div>
            <p className={styles.sheetHint}>No aplicativo real, esta tela usa a foto principal em alta qualidade e mantém a posição do feed ao fechar.</p>
          </div>
        )}

        {kind === "preferencia" && (
          <div className={styles.sheetBody}>
            <div className={styles.preferenceRows}><button><span>Tema do aplicativo</span><strong>Vinho</strong><ChevronRight/></button><button><span>Moeda</span><strong>Real (R$)</strong><ChevronRight/></button><button><span>Notificações</span><strong>Ativadas</strong><ChevronRight/></button></div>
            <p className={styles.sheetHint}>Este painel demonstra apenas a aparência. Nenhuma preferência real será alterada.</p>
          </div>
        )}

        {kind === "confirmar-saida" && (
          <div className={styles.sheetBody}>
            <p className={styles.confirmCopy}>Você precisará entrar novamente para acessar sua agenda, finanças e Cofre.</p>
            <button className={styles.dangerButton} onClick={() => finish("Saída simulada — sua sessão real continua ativa")}>Sair da conta</button>
            <button className={styles.sheetSecondary} onClick={onClose}>Cancelar</button>
          </div>
        )}
      </section>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`${styles.card} ${className}`}>{children}</div>;
}

function HomeScreen({ openSettings, openSheet }: { openSettings: () => void; openSheet: OpenSheet }) {
  return (
    <div className={styles.screenContent}>
      <header className={styles.greetingHeader}>
        <div>
          <h1>Bom dia, Alex</h1>
          <p>Quinta-feira, 10 de setembro</p>
        </div>
        <AvatarButton onClick={openSettings} />
      </header>

      <Card className={styles.heroCard}>
        <div className={styles.heroGlow} />
        <div className={styles.heroTop}>
          <div>
            <h2>Sua projeção</h2>
            <p>Você está construindo no seu ritmo</p>
          </div>
          <div className={styles.flightRing}><Plane size={31} /></div>
        </div>
        <strong className={styles.bigMetric}>0%</strong>
        <p className={styles.metricCaption}>R$ 0 de R$ 4.500</p>
        <div className={styles.cardDivider} />
        <p>Cada atendimento aproxima você da sua liberdade.</p>
        <button className={styles.primaryButton} onClick={() => openSheet("novo-atendimento")}>Registrar atendimento <ChevronRight size={20} /></button>
      </Card>

      <Card>
        <button className={styles.sectionHeading} onClick={() => openSheet("detalhe-atendimento")}>
          <h2>Próximo atendimento</h2><ChevronRight size={21} />
        </button>
        <div className={styles.nextJob}>
          <div className={styles.dateTile}><strong>10</strong><span>SET</span></div>
          <div className={styles.jobInfo}>
            <strong>Cliente Preflight QA</strong>
            <span><Clock3 size={15} /> Hoje, 15h30</span>
            <span><MapPin size={15} /> Studio Preflight</span>
          </div>
          <div className={styles.jobValue}><ChevronRight size={18} /><strong>R$ 250,00</strong></div>
        </div>
      </Card>

      <Card className={styles.goalCard}>
        <button className={styles.sectionHeading}><h2>Objetivos</h2><ChevronRight size={21} /></button>
        <div className={styles.goalBody}>
          <div className={styles.roundIcon}><Target size={25} /></div>
          <div>
            <p>Crie uma meta para a sua próxima conquista</p>
            <button className={styles.secondaryButton} onClick={() => openSheet("novo-objetivo")}>Adicionar objetivo <ChevronRight size={18} /></button>
          </div>
        </div>
        <div className={styles.horizon}><span>SONHE.<br />PLANEJE.<br />CONQUISTE.</span><i /></div>
      </Card>
    </div>
  );
}

const agendaJobs = [
  { time: "09:00", name: "Marina Costa", place: "Studio Centro", value: "R$ 180,00", done: true },
  { time: "15:30", name: "Cliente Preflight QA", place: "Studio Preflight", value: "R$ 250,00", today: true },
  { time: "18:00", name: "Camila Rocha", place: "Atendimento online", value: "R$ 200,00", online: true },
];

function AgendaScreen({ openSheet }: { openSheet: OpenSheet }) {
  const [selectedDay, setSelectedDay] = useState("QUI");
  return (
    <div className={styles.screenContent}>
      <header className={styles.titleHeader}><h1>Agenda</h1><button className={styles.addButton} onClick={() => openSheet("novo-atendimento")} aria-label="Adicionar atendimento"><Plus /></button></header>
      <div className={styles.weekStrip}>
        {[['SEG','7'],['TER','8'],['QUA','9'],['QUI','10'],['SEX','11']].map(([day,date]) => (
          <button key={day} onClick={() => setSelectedDay(day)} aria-pressed={day === selectedDay} className={day === selectedDay ? styles.dayActive : styles.day}><span>{day}</span><strong>{date}</strong></button>
        ))}
      </div>
      <div className={styles.agendaIntro}><h2>Quinta-feira, 10 de setembro</h2><p>3 atendimentos</p></div>
      <div className={styles.timeline}>
        {agendaJobs.map((job, index) => (
          <div className={styles.timelineRow} key={job.time}>
            <strong className={styles.timelineTime}>{job.time}</strong><span className={styles.timelineDot} />
            <button className={`${styles.card} ${styles.timelineCard}`} onClick={() => openSheet("detalhe-atendimento")}>
              <div className={styles.timelineTitle}><strong>{job.name}</strong>{job.done && <span className={styles.successBadge}><Check size={15} />Concluído</span>}{job.today && <span className={styles.todayBadge}><Clock3 size={15} />Hoje</span>}<ChevronRight size={18} /></div>
              <div className={styles.timelineDetails}><span>{job.online ? <Video size={17} /> : <MapPin size={17} />}{job.place}</span><strong>{job.value}</strong></div>
            </button>
            {index === 0 && <div className={styles.openSlot}><span>11:00<br />15:00</span><Hourglass size={18} /><em>Horário disponível</em></div>}
          </div>
        ))}
      </div>
      <div className={styles.dayTotal}><span>Previsto hoje</span><strong>R$ 630,00</strong></div>
      <div className={styles.mountainLine}><i /></div>
    </div>
  );
}

function FinanceiroScreen({ openSheet }: { openSheet: OpenSheet }) {
  const [activeSegment, setActiveSegment] = useState("Visão");
  const [monthOffset, setMonthOffset] = useState(0);
  const movements = [
    { icon: ArrowUpRight, name: "Atendimento — Marina Costa", date: "Hoje, 09:00", value: "+ R$ 180,00", positive: true },
    { icon: ArrowDownRight, name: "Assinatura de ferramentas", date: "Ontem", value: "− R$ 89,90", positive: false },
    { icon: ArrowUpRight, name: "Atendimento — Cliente Preflight QA", date: "8 de setembro", value: "+ R$ 250,00", positive: true },
  ];
  return (
    <div className={styles.screenContent}>
      <header className={styles.titleHeader}><h1>Financeiro</h1><button className={styles.outlineAdd} onClick={() => openSheet("novo-movimento")} aria-label="Adicionar movimentação"><Plus /></button></header>
      <div className={styles.monthPicker}><button onClick={() => setMonthOffset((value) => value - 1)} aria-label="Mês anterior"><ChevronLeft /></button><strong>{monthOffset === 0 ? "Setembro de 2026" : monthOffset < 0 ? "Agosto de 2026" : "Outubro de 2026"}</strong><button onClick={() => setMonthOffset((value) => value + 1)} aria-label="Próximo mês"><ChevronRight /></button></div>
      <Card className={styles.balanceCard}>
        <h2>Saldo do mês</h2><div className={styles.balanceLine}><strong>R$ 2.480,00</strong><span>↗ +18%</span></div>
        <div className={styles.moneySplit}><div><span>Entradas</span><strong className={styles.positive}>R$ 4.250,00</strong></div><div><span>Saídas</span><strong className={styles.negative}>R$ 1.770,00</strong></div></div>
        <div className={styles.chart} aria-label="Gráfico do saldo no mês"><svg viewBox="0 0 320 105" role="img"><path d="M5 79 C35 69,45 60,74 68 S115 90,145 61 S186 49,204 63 S247 44,275 34 S306 29,318 39" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M5 79 C35 69,45 60,74 68 S115 90,145 61 S186 49,204 63 S247 44,275 34 S306 29,318 39 L318 105 L5 105 Z" fill="url(#fill)" opacity=".35" /><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ff2d78"/><stop offset="1" stopColor="#ff2d78" stopOpacity="0"/></linearGradient></defs></svg></div>
      </Card>
      <div className={styles.segmented} role="tablist" aria-label="Visão financeira">{["Visão","Entradas","Saídas","Metas"].map((item) => <button key={item} onClick={() => setActiveSegment(item)} role="tab" aria-selected={item === activeSegment} className={item === activeSegment ? styles.segmentActive : ""}>{item}</button>)}</div>
      <Card>
        <h2>Movimentações recentes</h2>
        <div className={styles.movements}>{movements.map((movement) => { const MovementIcon = movement.icon; return <button key={movement.name} onClick={() => openSheet("novo-movimento")} className={styles.movement}><span className={movement.positive ? styles.moneyIconPositive : styles.moneyIconNegative}><MovementIcon size={20}/></span><span className={styles.movementText}><strong>{movement.name}</strong><small>{movement.date}</small></span><strong className={movement.positive ? styles.positive : styles.negative}>{movement.value}</strong><ChevronRight size={17}/></button>; })}</div>
        <button className={styles.textButton} onClick={() => openSheet("novo-movimento")}>Ver todas as movimentações <ChevronRight size={18}/></button>
      </Card>
    </div>
  );
}

const vaultFiles = [
  { icon: FileText, name: "Contrato — Studio Preflight.pdf", meta: "Contrato · 2,4 MB", date: "Hoje", pdf: true },
  { icon: FileText, name: "Comprovante — Marina Costa.pdf", meta: "Comprovante · 840 KB", date: "Ontem", pdf: true },
  { icon: FileImage, name: "Documento pessoal.jpg", meta: "Documento · 1,8 MB", date: "7 de setembro" },
  { icon: FileText, name: "Planejamento 2026.pdf", meta: "Documento · 3,1 MB", date: "5 de setembro", pdf: true },
];

function CofreScreen({ openSheet }: { openSheet: OpenSheet }) {
  const [activeChip, setActiveChip] = useState("Todos");
  const [query, setQuery] = useState("");
  const filteredFiles = vaultFiles.filter((file) => {
    const matchesQuery = file.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"));
    const matchesChip = activeChip === "Todos" || file.meta.toLocaleLowerCase("pt-BR").includes(activeChip.slice(0, -1).toLocaleLowerCase("pt-BR"));
    return matchesQuery && matchesChip;
  });
  return (
    <div className={styles.screenContent}>
      <header className={styles.titleHeader}><div><h1>Cofre</h1><p>Seus arquivos, sempre com você</p></div><button className={styles.addButton} onClick={() => openSheet("upload-arquivo")} aria-label="Enviar arquivo"><Plus /></button></header>
      <label className={styles.searchBox}><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar no cofre" placeholder="Buscar no cofre" /></label>
      <Card className={styles.protectedCard}><div className={styles.shieldOrb}><Shield size={34}/></div><div><h2>Protegido</h2><p>12 arquivos armazenados</p><span><LockKeyhole size={16}/> Acesso protegido pelo seu PIN</span></div></Card>
      <div className={styles.chips}>{["Todos","Contratos","Comprovantes","Documentos"].map(item => <button onClick={() => setActiveChip(item)} aria-pressed={item === activeChip} className={item === activeChip ? styles.chipActive : styles.chip} key={item}>{item}</button>)}</div>
      <h2 className={styles.listTitle}>Arquivos recentes</h2>
      {filteredFiles.length > 0 ? <Card className={styles.fileList}>{filteredFiles.map(file => { const FileIcon = file.icon; return <button onClick={() => openSheet("arquivo")} className={styles.fileRow} key={file.name}><span className={file.pdf ? styles.pdfIcon : styles.imageFileIcon}><FileIcon size={25}/></span><span className={styles.fileText}><strong>{file.name}</strong><small>{file.meta}</small></span><span className={styles.fileDate}>{file.date}</span><MoreHorizontal size={19}/></button>; })}</Card> : <div className={styles.searchEmpty}><Search/><strong>Nenhum arquivo encontrado</strong><span>Tente outro nome ou categoria.</span></div>}
      <button className={`${styles.card} ${styles.storageCard}`} onClick={() => openSheet("upload-arquivo")}><span className={styles.storagePie} /><span>8,1 MB utilizados</span><ChevronRight /></button>
    </div>
  );
}

function RedeScreen({ openSettings, openSheet }: { openSettings: () => void; openSheet: OpenSheet }) {
  const [feedTab, setFeedTab] = useState("Para você");
  const [liked, setLiked] = useState(true);
  return (
    <div className={`${styles.screenContent} ${styles.feedContent}`}>
      <header className={styles.networkHeader}><h1>Rede</h1><div><button onClick={() => openSheet("buscar-rede")} aria-label="Buscar"><Search/></button><button onClick={() => openSheet("notificacoes")} aria-label="Notificações" className={styles.notificationButton}><Bell/><i /></button><button onClick={() => openSheet("conversas")} aria-label="Conversas"><MessageCircle/></button><AvatarButton onClick={openSettings}/></div></header>
      <div className={styles.composer}><AvatarButton onClick={openSettings}/><button className={styles.composerPrompt} onClick={() => openSheet("novo-post")}><span>Compartilhe algo...</span><ImageIcon/><span className={styles.srOnly}>Criar publicação</span></button></div>
      <div className={styles.feedTabs} role="tablist" aria-label="Filtro do feed"><button onClick={() => setFeedTab("Para você")} role="tab" aria-selected={feedTab === "Para você"} className={feedTab === "Para você" ? styles.feedTabActive : ""}>Para você</button><button onClick={() => setFeedTab("Amigas")} role="tab" aria-selected={feedTab === "Amigas"} className={feedTab === "Amigas" ? styles.feedTabActive : ""}>Amigas</button></div>
      <article className={styles.post}>
        <div className={styles.postHeader}><div className={`${styles.personAvatar} ${styles.personOne}`}>M</div><div><strong>Marina Costa</strong><span><b>◎ Conquista</b> · há 2h</span></div><MoreHorizontal/></div>
        <p>Primeira semana com a agenda cheia. Um passo de cada vez ✨</p>
        <button className={`${styles.feedPhoto} ${styles.workspacePhoto}`} onClick={() => openSheet("foto")} aria-label="Abrir foto da publicação"><div className={styles.photoSun}/><div className={styles.photoLaptop}><span>Sonhe<br/>Planeje<br/>Conquiste</span></div><div className={styles.photoNotebook}>☑ Trabalhar<br/>☑ Organizar finanças<br/>☑ Planejar viagem</div><div className={styles.photoPassport}>PASSAPORTE</div></button>
        <div className={styles.postActions}><button onClick={() => setLiked((value) => !value)} aria-pressed={liked}><Heart fill={liked ? "currentColor" : "none"}/>{liked ? 24 : 23}</button><button onClick={() => openSheet("conversas")}><MessageCircle/>6</button><button onClick={() => openSheet("novo-post")} aria-label="Compartilhar"><Share2/></button></div>
      </article>
      <article className={styles.post}>
        <div className={styles.postHeader}><div className={`${styles.personAvatar} ${styles.personTwo}`}>C</div><div><strong>Camila Rocha</strong><span><b>◉ Dica</b> · há 5h</span></div><MoreHorizontal/></div>
        <p>Organizar o financeiro mudou a forma como planejo meus próximos meses.</p>
        <button className={`${styles.feedPhoto} ${styles.disciplinePhoto}`} onClick={() => openSheet("foto")} aria-label="Abrir foto da publicação"><span>DISCIPLINA<br/>HOJE<br/>LIBERDADE<br/>SEMPRE ♡</span></button>
      </article>
    </div>
  );
}

const settingGroups = [
  { label: "CONTA", rows: [[UserRound,"Perfil"],[LockKeyhole,"Segurança e PIN"],[Bell,"Notificações"]] as Array<[Icon,string]> },
  { label: "PREFERÊNCIAS", rows: [[Palette,"Aparência","Vinho"],[DollarSign,"Moeda","Real (R$)"],[CalendarDays,"Primeiro dia da semana","Segunda-feira"]] as Array<[Icon,string,string?]> },
  { label: "DADOS E SUPORTE", rows: [[Download,"Exportar meus dados"],[HelpCircle,"Ajuda e suporte"],[Shield,"Privacidade"]] as Array<[Icon,string]> },
];

function AjustesScreen({ goBack, backLabel, openSheet }: { goBack: () => void; backLabel: string; openSheet: OpenSheet }) {
  return (
    <div className={styles.screenContent}>
      <header className={styles.settingsHeader}><button onClick={goBack}><ArrowLeft/>{backLabel}</button><h1>Ajustes</h1><span/></header>
      <Card className={styles.profileCard}><AvatarButton onClick={() => openSheet("editar-perfil")} label="Editar foto do perfil"/><div><h2>Alex Silva</h2><p>alex@exemplo.test</p><button onClick={() => openSheet("editar-perfil")}>Editar perfil</button></div><ChevronRight/></Card>
      {settingGroups.map(group => <section className={styles.settingsSection} key={group.label}><h2>{group.label}</h2><Card className={styles.settingsGroup}>{group.rows.map(([RowIcon,label,value]) => <button onClick={() => openSheet(label === "Perfil" ? "editar-perfil" : "preferencia")} className={styles.settingRow} key={label}><span className={styles.settingIcon}><RowIcon size={22}/></span><strong>{label}</strong>{value && <em>{value}</em>}<ChevronRight size={18}/></button>)}</Card></section>)}
      <Card className={styles.logoutCard}><button onClick={() => openSheet("confirmar-saida")}><span className={styles.logoutIcon}><ArrowLeft size={21}/></span><strong>Sair da conta</strong><ChevronRight/></button></Card>
    </div>
  );
}

export function IosPrototypeApp() {
  const [active, setActive] = useState<Screen>("home");
  const [previous, setPrevious] = useState<Exclude<Screen, "ajustes">>("home");
  const [navCompact, setNavCompact] = useState(false);
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [toast, setToast] = useState("");
  const [scenario, setScenario] = useState<Scenario>("conteudo");
  const scrollAreaRef = useRef<HTMLElement>(null);
  const scrollPositions = useRef<Partial<Record<Screen, number>>>({});
  const restoringScroll = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!scrollAreaRef.current) return;
      scrollAreaRef.current.scrollTop = scrollPositions.current[active] ?? 0;
      setNavCompact(active !== "ajustes" && scrollAreaRef.current.scrollTop > 40);
      requestAnimationFrame(() => { restoringScroll.current = false; });
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  function rememberScroll() {
    if (scrollAreaRef.current) scrollPositions.current[active] = scrollAreaRef.current.scrollTop;
  }

  function openSettings() {
    rememberScroll();
    restoringScroll.current = true;
    if (active !== "ajustes") setPrevious(active);
    setActive("ajustes");
  }

  function changeScreen(screen: Screen) {
    if (screen === active) return;
    rememberScroll();
    restoringScroll.current = true;
    if (screen !== "ajustes") setPrevious(screen);
    setActive(screen);
  }

  function openSheet(kind: SheetKind) {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSheet(kind);
  }

  const closeSheet = useCallback(() => {
    setSheet(null);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  function showToast(message: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(""), 2400);
  }

  return (
    <div className={styles.prototypeStage}>
      <PrototypeControls scenario={scenario} onChange={setScenario}/>
      <div className={styles.phoneShell}>
        <StatusBar />
        <main
          ref={scrollAreaRef}
          className={styles.scrollArea}
          onScroll={(event) => {
            if (restoringScroll.current) return;
            scrollPositions.current[active] = event.currentTarget.scrollTop;
            setNavCompact(active !== "ajustes" && event.currentTarget.scrollTop > 40);
          }}
        >
          {active !== "ajustes" && scenario !== "conteudo" ? (
            <PrototypeStateView screen={active} scenario={scenario} onRetry={() => setScenario("conteudo")} openSheet={openSheet}/>
          ) : (
            <>
              {active === "home" && <HomeScreen openSettings={openSettings} openSheet={openSheet}/>}
              {active === "agenda" && <AgendaScreen openSheet={openSheet}/>}
              {active === "financeiro" && <FinanceiroScreen openSheet={openSheet}/>}
              {active === "cofre" && <CofreScreen openSheet={openSheet}/>}
              {active === "rede" && <RedeScreen openSettings={openSettings} openSheet={openSheet}/>}
              {active === "ajustes" && <AjustesScreen goBack={() => changeScreen(previous)} backLabel={navItems.find((item) => item.id === previous)?.label ?? "Início"} openSheet={openSheet}/>}
            </>
          )}
        </main>
        <BottomNav active={active === "ajustes" ? previous : active} compact={navCompact} onChange={changeScreen}/>
        <PrototypeSheet kind={sheet} onClose={closeSheet} onConfirm={showToast}/>
        {toast && <div className={styles.prototypeToast} role="status">{toast}</div>}
        <div className={styles.homeIndicator} aria-hidden="true" />
      </div>
    </div>
  );
}
