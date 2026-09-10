"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Bell,
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
  Search,
  Settings,
  Share2,
  Shield,
  Target,
  Upload,
  UserRound,
  Users,
  Video,
  WalletCards,
} from "lucide-react";
import styles from "./IosPrototypeApp.module.css";

type Screen = "home" | "agenda" | "financeiro" | "cofre" | "rede" | "ajustes";
type Icon = LucideIcon;

const navItems: Array<{ id: Screen; label: string; icon: Icon }> = [
  { id: "home", label: "Início", icon: Home },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "financeiro", label: "Financeiro", icon: WalletCards },
  { id: "cofre", label: "Cofre", icon: Shield },
  { id: "rede", label: "Rede", icon: Users },
  { id: "ajustes", label: "Ajustes", icon: Settings },
];

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
            <NavIcon size={25} strokeWidth={isActive ? 2.5 : 2} />
          </button>
        );
      })}
    </nav>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`${styles.card} ${className}`}>{children}</div>;
}

function HomeScreen({ openSettings }: { openSettings: () => void }) {
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
        <button className={styles.primaryButton}>Registrar atendimento <ChevronRight size={20} /></button>
      </Card>

      <Card>
        <button className={styles.sectionHeading}>
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
            <button className={styles.secondaryButton}>Adicionar objetivo <ChevronRight size={18} /></button>
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

function AgendaScreen() {
  return (
    <div className={styles.screenContent}>
      <header className={styles.titleHeader}><h1>Agenda</h1><button className={styles.addButton} aria-label="Adicionar atendimento"><Plus /></button></header>
      <div className={styles.weekStrip}>
        {[['SEG','7'],['TER','8'],['QUA','9'],['QUI','10'],['SEX','11']].map(([day,date]) => (
          <button key={day} aria-pressed={day === 'QUI'} className={day === 'QUI' ? styles.dayActive : styles.day}><span>{day}</span><strong>{date}</strong></button>
        ))}
      </div>
      <div className={styles.agendaIntro}><h2>Quinta-feira, 10 de setembro</h2><p>3 atendimentos</p></div>
      <div className={styles.timeline}>
        {agendaJobs.map((job, index) => (
          <div className={styles.timelineRow} key={job.time}>
            <strong className={styles.timelineTime}>{job.time}</strong><span className={styles.timelineDot} />
            <Card className={styles.timelineCard}>
              <div className={styles.timelineTitle}><strong>{job.name}</strong>{job.done && <span className={styles.successBadge}><Check size={15} />Concluído</span>}{job.today && <span className={styles.todayBadge}><Clock3 size={15} />Hoje</span>}<ChevronRight size={18} /></div>
              <div className={styles.timelineDetails}><span>{job.online ? <Video size={17} /> : <MapPin size={17} />}{job.place}</span><strong>{job.value}</strong></div>
            </Card>
            {index === 0 && <div className={styles.openSlot}><span>11:00<br />15:00</span><Hourglass size={18} /><em>Horário disponível</em></div>}
          </div>
        ))}
      </div>
      <div className={styles.dayTotal}><span>Previsto hoje</span><strong>R$ 630,00</strong></div>
      <div className={styles.mountainLine}><i /></div>
    </div>
  );
}

function FinanceiroScreen() {
  const movements = [
    { icon: ArrowUpRight, name: "Atendimento — Marina Costa", date: "Hoje, 09:00", value: "+ R$ 180,00", positive: true },
    { icon: ArrowDownRight, name: "Assinatura de ferramentas", date: "Ontem", value: "− R$ 89,90", positive: false },
    { icon: ArrowUpRight, name: "Atendimento — Cliente Preflight QA", date: "8 de setembro", value: "+ R$ 250,00", positive: true },
  ];
  return (
    <div className={styles.screenContent}>
      <header className={styles.titleHeader}><h1>Financeiro</h1><button className={styles.outlineAdd} aria-label="Adicionar movimentação"><Plus /></button></header>
      <div className={styles.monthPicker}><ChevronLeft /><strong>Setembro de 2026</strong><ChevronRight /></div>
      <Card className={styles.balanceCard}>
        <h2>Saldo do mês</h2><div className={styles.balanceLine}><strong>R$ 2.480,00</strong><span>↗ +18%</span></div>
        <div className={styles.moneySplit}><div><span>Entradas</span><strong className={styles.positive}>R$ 4.250,00</strong></div><div><span>Saídas</span><strong className={styles.negative}>R$ 1.770,00</strong></div></div>
        <div className={styles.chart} aria-label="Gráfico do saldo no mês"><svg viewBox="0 0 320 105" role="img"><path d="M5 79 C35 69,45 60,74 68 S115 90,145 61 S186 49,204 63 S247 44,275 34 S306 29,318 39" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M5 79 C35 69,45 60,74 68 S115 90,145 61 S186 49,204 63 S247 44,275 34 S306 29,318 39 L318 105 L5 105 Z" fill="url(#fill)" opacity=".35" /><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ff2d78"/><stop offset="1" stopColor="#ff2d78" stopOpacity="0"/></linearGradient></defs></svg></div>
      </Card>
      <div className={styles.segmented} role="tablist" aria-label="Visão financeira">{["Visão","Entradas","Saídas","Metas"].map((item) => <button key={item} role="tab" aria-selected={item === "Visão"} className={item === "Visão" ? styles.segmentActive : ""}>{item}</button>)}</div>
      <Card>
        <h2>Movimentações recentes</h2>
        <div className={styles.movements}>{movements.map((movement) => { const MovementIcon = movement.icon; return <button key={movement.name} className={styles.movement}><span className={movement.positive ? styles.moneyIconPositive : styles.moneyIconNegative}><MovementIcon size={20}/></span><span className={styles.movementText}><strong>{movement.name}</strong><small>{movement.date}</small></span><strong className={movement.positive ? styles.positive : styles.negative}>{movement.value}</strong><ChevronRight size={17}/></button>; })}</div>
        <button className={styles.textButton}>Ver todas as movimentações <ChevronRight size={18}/></button>
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

function CofreScreen() {
  return (
    <div className={styles.screenContent}>
      <header className={styles.titleHeader}><div><h1>Cofre</h1><p>Seus arquivos, sempre com você</p></div><button className={styles.addButton} aria-label="Enviar arquivo"><Plus /></button></header>
      <label className={styles.searchBox}><Search /><input aria-label="Buscar no cofre" placeholder="Buscar no cofre" /></label>
      <Card className={styles.protectedCard}><div className={styles.shieldOrb}><Shield size={34}/></div><div><h2>Protegido</h2><p>12 arquivos armazenados</p><span><LockKeyhole size={16}/> Acesso protegido pelo seu PIN</span></div></Card>
      <div className={styles.chips}>{["Todos","Contratos","Comprovantes","Documentos"].map(item => <button className={item === "Todos" ? styles.chipActive : styles.chip} key={item}>{item}</button>)}</div>
      <h2 className={styles.listTitle}>Arquivos recentes</h2>
      <Card className={styles.fileList}>{vaultFiles.map(file => { const FileIcon = file.icon; return <button className={styles.fileRow} key={file.name}><span className={file.pdf ? styles.pdfIcon : styles.imageFileIcon}><FileIcon size={25}/></span><span className={styles.fileText}><strong>{file.name}</strong><small>{file.meta}</small></span><span className={styles.fileDate}>{file.date}</span><MoreHorizontal size={19}/></button>; })}</Card>
      <Card className={styles.storageCard}><span className={styles.storagePie} /><span>8,1 MB utilizados</span><ChevronRight /></Card>
    </div>
  );
}

function RedeScreen({ openSettings }: { openSettings: () => void }) {
  return (
    <div className={`${styles.screenContent} ${styles.feedContent}`}>
      <header className={styles.networkHeader}><h1>Rede</h1><div><button aria-label="Buscar"><Search/></button><button aria-label="Notificações" className={styles.notificationButton}><Bell/><i /></button><button aria-label="Conversas"><MessageCircle/></button><AvatarButton onClick={openSettings}/></div></header>
      <div className={styles.composer}><AvatarButton onClick={openSettings}/><button className={styles.composerPrompt}><span>Compartilhe algo...</span><ImageIcon/><span className={styles.srOnly}>Criar publicação</span></button></div>
      <div className={styles.feedTabs} role="tablist" aria-label="Filtro do feed"><button role="tab" aria-selected="true" className={styles.feedTabActive}>Para você</button><button role="tab" aria-selected="false">Amigas</button></div>
      <article className={styles.post}>
        <div className={styles.postHeader}><div className={`${styles.personAvatar} ${styles.personOne}`}>M</div><div><strong>Marina Costa</strong><span><b>◎ Conquista</b> · há 2h</span></div><MoreHorizontal/></div>
        <p>Primeira semana com a agenda cheia. Um passo de cada vez ✨</p>
        <div className={`${styles.feedPhoto} ${styles.workspacePhoto}`}><div className={styles.photoSun}/><div className={styles.photoLaptop}><span>Sonhe<br/>Planeje<br/>Conquiste</span></div><div className={styles.photoNotebook}>☑ Trabalhar<br/>☑ Organizar finanças<br/>☑ Planejar viagem</div><div className={styles.photoPassport}>PASSAPORTE</div></div>
        <div className={styles.postActions}><button><Heart fill="currentColor"/>24</button><button><MessageCircle/>6</button><button aria-label="Compartilhar"><Share2/></button></div>
      </article>
      <article className={styles.post}>
        <div className={styles.postHeader}><div className={`${styles.personAvatar} ${styles.personTwo}`}>C</div><div><strong>Camila Rocha</strong><span><b>◉ Dica</b> · há 5h</span></div><MoreHorizontal/></div>
        <p>Organizar o financeiro mudou a forma como planejo meus próximos meses.</p>
        <div className={`${styles.feedPhoto} ${styles.disciplinePhoto}`}><span>DISCIPLINA<br/>HOJE<br/>LIBERDADE<br/>SEMPRE ♡</span></div>
      </article>
    </div>
  );
}

const settingGroups = [
  { label: "CONTA", rows: [[UserRound,"Perfil"],[LockKeyhole,"Segurança e PIN"],[Bell,"Notificações"]] as Array<[Icon,string]> },
  { label: "PREFERÊNCIAS", rows: [[Palette,"Aparência","Vinho"],[DollarSign,"Moeda","Real (R$)"],[CalendarDays,"Primeiro dia da semana","Segunda-feira"]] as Array<[Icon,string,string?]> },
  { label: "DADOS E SUPORTE", rows: [[Download,"Exportar meus dados"],[HelpCircle,"Ajuda e suporte"],[Shield,"Privacidade"]] as Array<[Icon,string]> },
];

function AjustesScreen({ goBack, backLabel }: { goBack: () => void; backLabel: string }) {
  return (
    <div className={styles.screenContent}>
      <header className={styles.settingsHeader}><button onClick={goBack}><ArrowLeft/>{backLabel}</button><h1>Ajustes</h1><span/></header>
      <Card className={styles.profileCard}><AvatarButton onClick={() => {}} label="Editar foto do perfil"/><div><h2>Alex Silva</h2><p>alex@exemplo.test</p><button>Editar perfil</button></div><ChevronRight/></Card>
      {settingGroups.map(group => <section className={styles.settingsSection} key={group.label}><h2>{group.label}</h2><Card className={styles.settingsGroup}>{group.rows.map(([RowIcon,label,value]) => <button className={styles.settingRow} key={label}><span className={styles.settingIcon}><RowIcon size={22}/></span><strong>{label}</strong>{value && <em>{value}</em>}<ChevronRight size={18}/></button>)}</Card></section>)}
      <Card className={styles.logoutCard}><button><span className={styles.logoutIcon}><ArrowLeft size={21}/></span><strong>Sair da conta</strong><ChevronRight/></button></Card>
    </div>
  );
}

export function IosPrototypeApp() {
  const [active, setActive] = useState<Screen>("home");
  const [previous, setPrevious] = useState<Exclude<Screen, "ajustes">>("home");
  const [navCompact, setNavCompact] = useState(false);
  const scrollAreaRef = useRef<HTMLElement>(null);
  const scrollPositions = useRef<Partial<Record<Screen, number>>>({});
  const restoringScroll = useRef(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!scrollAreaRef.current) return;
      scrollAreaRef.current.scrollTop = scrollPositions.current[active] ?? 0;
      setNavCompact(active !== "ajustes" && scrollAreaRef.current.scrollTop > 40);
      requestAnimationFrame(() => { restoringScroll.current = false; });
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);

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

  return (
    <div className={styles.prototypeStage}>
      <div className={styles.prototypeNotice}>PROTÓTIPO VISUAL · DADOS SIMULADOS · SEM BACKEND</div>
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
          {active === "home" && <HomeScreen openSettings={openSettings}/>} 
          {active === "agenda" && <AgendaScreen/>}
          {active === "financeiro" && <FinanceiroScreen/>}
          {active === "cofre" && <CofreScreen/>}
          {active === "rede" && <RedeScreen openSettings={openSettings}/>} 
          {active === "ajustes" && <AjustesScreen goBack={() => changeScreen(previous)} backLabel={navItems.find((item) => item.id === previous)?.label ?? "Início"}/>} 
        </main>
        <BottomNav active={active} compact={navCompact} onChange={changeScreen}/>
        <div className={styles.homeIndicator} aria-hidden="true" />
      </div>
    </div>
  );
}
