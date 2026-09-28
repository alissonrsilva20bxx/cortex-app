"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Ban,
  Bell,
  Camera,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Delete,
  Download,
  ExternalLink,
  FileImage,
  FileText,
  Grid3X3,
  Heart,
  Home,
  Hourglass,
  Image as ImageIcon,
  LockKeyhole,
  Link2,
  ListChecks,
  MapPin,
  MessageCircle,
  MessageSquareText,
  MoreHorizontal,
  Palette,
  Pencil,
  Plane,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Shield,
  ShieldCheck,
  Smartphone,
  Target,
  Upload,
  UserPlus,
  UsersRound,
  Video,
  Wallet,
  X,
} from "lucide-react";
import styles from "./IosPrototypeApp.module.css";

type PrimaryScreen = "home" | "agenda" | "financeiro" | "cofre" | "rede";
type Screen = PrimaryScreen | "perfil" | "ajustes" | "pin";
type Icon = LucideIcon;

const navItems: Array<{ id: PrimaryScreen; label: string; icon: Icon }> = [
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
  | "comentarios"
  | "compartilhar"
  | "opcoes-post"
  | "amigas"
  | "perfil-ferramentas"
  | "livelinks"
  | "anotacoes"
  | "grafico-agenda"
  | "metas-financeiras"
  | "pin-config"
  | "assinatura-dados"
  | "aparencia"
  | "tela-inicial"
  | "config-notificacoes"
  | "instalar-app"
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
  comentarios: "Comentários",
  compartilhar: "Compartilhar",
  "opcoes-post": "Publicação",
  amigas: "Amigas",
  "perfil-ferramentas": "Meu espaço",
  livelinks: "Gerenciar LiveLinks",
  anotacoes: "Anotações",
  "grafico-agenda": "Resumo da agenda",
  "metas-financeiras": "Metas",
  "pin-config": "Segurança e PIN",
  "assinatura-dados": "Assinatura e dados",
  aparencia: "Aparência",
  "tela-inicial": "Tela inicial",
  "config-notificacoes": "Notificações",
  "instalar-app": "Instalar JobApp",
  "confirmar-saida": "Sair da conta?",
};

function AvatarButton({
  onClick,
  label = "Abrir Ajustes",
}: {
  onClick: () => void;
  label?: string;
}) {
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

function PrototypeControls({
  scenario,
  onChange,
}: {
  scenario: Scenario;
  onChange: (scenario: Scenario) => void;
}) {
  return (
    <div className={styles.prototypeNotice} aria-label="Estados do protótipo">
      <span>PROTÓTIPO · SEM BACKEND</span>
      {(["conteudo", "vazio", "carregando", "erro"] as Scenario[]).map(
        (item) => (
          <button
            key={item}
            onClick={() => onChange(item)}
            aria-pressed={scenario === item}
          >
            {item}
          </button>
        )
      )}
    </div>
  );
}

function PrototypeStateView({
  screen,
  scenario,
  onRetry,
  openSheet,
}: {
  screen: PrimaryScreen;
  scenario: Exclude<Scenario, "conteudo">;
  onRetry: () => void;
  openSheet: OpenSheet;
}) {
  const labels = {
    home: {
      title: "Início",
      empty: "Seu espaço começa com o primeiro atendimento.",
      action: "Registrar atendimento",
      sheet: "novo-atendimento" as const,
    },
    agenda: {
      title: "Agenda",
      empty: "Nenhum atendimento para este dia.",
      action: "Adicionar atendimento",
      sheet: "novo-atendimento" as const,
    },
    financeiro: {
      title: "Financeiro",
      empty: "Suas movimentações aparecerão aqui.",
      action: "Adicionar movimentação",
      sheet: "novo-movimento" as const,
    },
    cofre: {
      title: "Cofre",
      empty: "Seu Cofre ainda está vazio.",
      action: "Enviar arquivo",
      sheet: "upload-arquivo" as const,
    },
    rede: {
      title: "Rede",
      empty: "As novas publicações aparecerão aqui.",
      action: "Criar publicação",
      sheet: "novo-post" as const,
    },
  }[screen];

  if (scenario === "carregando") {
    return (
      <div
        className={`${styles.screenContent} ${styles.stateScreen}`}
        aria-busy="true"
      >
        <h1>{labels.title}</h1>
        <div className={styles.loadingLine} />
        <div className={styles.loadingCard} />
        <div className={styles.loadingCard} />
        <span className={styles.srOnly}>Carregando conteúdo</span>
      </div>
    );
  }

  if (scenario === "erro") {
    return (
      <div className={`${styles.screenContent} ${styles.stateScreen}`}>
        <h1>{labels.title}</h1>
        <div className={styles.stateCenter}>
          <span className={styles.stateIcon}>
            <RefreshCw />
          </span>
          <h2>Não foi possível carregar</h2>
          <p>Confira sua conexão e tente novamente.</p>
          <button className={styles.stateAction} onClick={onRetry}>
            <RefreshCw size={18} />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.screenContent} ${styles.stateScreen}`}>
      <h1>{labels.title}</h1>
      <div className={styles.stateCenter}>
        <span className={styles.stateIcon}>
          {screen === "cofre" ? (
            <ShieldCheck />
          ) : screen === "rede" ? (
            <UsersRound />
          ) : (
            <Plane />
          )}
        </span>
        <h2>Tudo pronto para começar</h2>
        <p>{labels.empty}</p>
        <button
          className={styles.stateAction}
          onClick={() => openSheet(labels.sheet)}
        >
          {labels.action}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function BottomNav({
  active,
  compact,
  onChange,
}: {
  active: PrimaryScreen;
  compact: boolean;
  onChange: (screen: PrimaryScreen) => void;
}) {
  return (
    <nav
      className={`${styles.bottomNav} ${compact ? styles.bottomNavCompact : ""}`}
      aria-label="Navegação principal"
    >
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
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
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
    <div
      className={styles.sheetBackdrop}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prototype-sheet-title"
      >
        <div className={styles.sheetHandle} aria-hidden="true" />
        <header className={styles.sheetHeader}>
          <h2 id="prototype-sheet-title">{sheetTitles[kind]}</h2>
          <button
            ref={closeRef}
            className={styles.sheetClose}
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </header>

        {(kind === "novo-atendimento" || kind === "editar-perfil") && (
          <div className={styles.sheetForm}>
            {kind === "editar-perfil" ? (
              <>
                <button className={styles.avatarEditor}>
                  <span className={styles.personAvatar}>A</span>
                  <Camera size={20} />
                  <strong>Trocar foto</strong>
                </button>
                <label>
                  Nome
                  <input defaultValue="Alex Silva" />
                </label>
                <label>
                  Bio
                  <textarea defaultValue="Organizando meu trabalho para viver com mais liberdade." />
                </label>
              </>
            ) : (
              <>
                <label>
                  Cliente
                  <input placeholder="Nome do cliente" />
                </label>
                <div className={styles.sheetGrid}>
                  <label>
                    Data
                    <input type="date" defaultValue="2026-09-10" />
                  </label>
                  <label>
                    Hora
                    <input type="time" defaultValue="15:30" />
                  </label>
                </div>
                <label>
                  Valor
                  <input inputMode="decimal" placeholder="R$ 0,00" />
                </label>
                <label>
                  Modalidade
                  <select defaultValue="presencial">
                    <option value="presencial">Presencial</option>
                    <option value="online">Online</option>
                  </select>
                </label>
                <label>
                  Local
                  <input placeholder="Onde será o atendimento?" />
                </label>
                <label>
                  Status
                  <select defaultValue="agendado">
                    <option>Agendado</option>
                    <option>Confirmado</option>
                    <option>Concluído</option>
                    <option>Cancelado</option>
                  </select>
                </label>
                <label>
                  Observações
                  <textarea placeholder="Notas sobre o atendimento..." />
                </label>
              </>
            )}
            <button
              className={styles.sheetPrimary}
              onClick={() =>
                finish(
                  kind === "editar-perfil"
                    ? "Perfil atualizado no protótipo"
                    : "Atendimento salvo no protótipo"
                )
              }
            >
              Salvar
            </button>
          </div>
        )}

        {kind === "detalhe-atendimento" && (
          <div className={styles.sheetBody}>
            <div className={styles.detailHero}>
              <span className={styles.dateTile}>
                <strong>10</strong>
                <small>SET</small>
              </span>
              <div>
                <h3>Cliente Preflight QA</h3>
                <p>Hoje, 15h30 · Studio Preflight</p>
              </div>
            </div>
            <div className={styles.detailRows}>
              <p>
                <span>Status</span>
                <strong>Confirmado</strong>
              </p>
              <p>
                <span>Valor</span>
                <strong>R$ 250,00</strong>
              </p>
              <p>
                <span>Modalidade</span>
                <strong>Presencial</strong>
              </p>
            </div>
            <button
              className={styles.sheetPrimary}
              onClick={() => finish("Edição simulada aberta")}
            >
              Editar atendimento
            </button>
          </div>
        )}

        {kind === "novo-objetivo" && (
          <div className={styles.sheetForm}>
            <label>
              Objetivo
              <input placeholder="Ex.: Minha próxima viagem" />
            </label>
            <label>
              Quanto você quer guardar?
              <input inputMode="decimal" placeholder="R$ 0,00" />
            </label>
            <label>
              Prazo
              <input type="date" />
            </label>
            <button
              className={styles.sheetPrimary}
              onClick={() => finish("Objetivo criado no protótipo")}
            >
              Criar objetivo
            </button>
          </div>
        )}

        {kind === "novo-movimento" && (
          <div className={styles.sheetForm}>
            <div className={styles.sheetSegment}>
              <button aria-pressed="true">Entrada</button>
              <button aria-pressed="false">Saída</button>
            </div>
            <label>
              Descrição
              <input placeholder="Descrição da movimentação" />
            </label>
            <label>
              Valor
              <input inputMode="decimal" placeholder="R$ 0,00" />
            </label>
            <label>
              Data
              <input type="date" defaultValue="2026-09-10" />
            </label>
            <button
              className={styles.sheetPrimary}
              onClick={() => finish("Movimentação salva no protótipo")}
            >
              Salvar movimentação
            </button>
          </div>
        )}

        {kind === "upload-arquivo" && (
          <div className={styles.sheetBody}>
            <button
              className={styles.uploadDrop}
              onClick={() => onConfirm("Arquivo escolhido no protótipo")}
            >
              <Upload size={32} />
              <strong>Escolher arquivo</strong>
              <span>Imagem, PDF, Office ou texto</span>
            </button>
            <label className={styles.sheetLabel}>
              Categoria
              <select defaultValue="documentos">
                <option value="comprovantes">Comprovantes</option>
                <option value="conversas">Conversas</option>
                <option value="documentos">Documentos</option>
                <option value="pessoal">Pessoal</option>
              </select>
            </label>
            <button
              className={styles.sheetPrimary}
              onClick={() => finish("Arquivo enviado no protótipo")}
            >
              Enviar para o Cofre
            </button>
          </div>
        )}

        {kind === "arquivo" && (
          <div className={styles.sheetBody}>
            <div className={styles.filePreview}>
              <FileText size={58} />
              <strong>Contrato — Studio Preflight.pdf</strong>
              <span>2,4 MB · PDF</span>
            </div>
            <button
              className={styles.sheetPrimary}
              onClick={() => finish("Arquivo aberto no protótipo")}
            >
              Abrir arquivo
            </button>
          </div>
        )}

        {kind === "buscar-rede" && (
          <div className={styles.sheetBody}>
            <label className={styles.sheetSearch}>
              <Search size={19} />
              <input autoFocus placeholder="Buscar pessoas ou publicações" />
            </label>
            <div className={styles.sheetList}>
              <button>
                <span className={`${styles.personAvatar} ${styles.personOne}`}>
                  M
                </span>
                <span>
                  <strong>Marina Costa</strong>
                  <small>@marina</small>
                </span>
                <ChevronRight />
              </button>
              <button>
                <span className={`${styles.personAvatar} ${styles.personTwo}`}>
                  C
                </span>
                <span>
                  <strong>Camila Rocha</strong>
                  <small>@camila</small>
                </span>
                <ChevronRight />
              </button>
            </div>
          </div>
        )}

        {(kind === "notificacoes" || kind === "conversas") && (
          <div className={styles.sheetList}>
            {kind === "notificacoes" ? (
              <>
                <button>
                  <span
                    className={`${styles.personAvatar} ${styles.personOne}`}
                  >
                    M
                  </span>
                  <span>
                    <strong>Marina curtiu sua publicação</strong>
                    <small>há 12 min</small>
                  </span>
                  <ChevronRight />
                </button>
                <button>
                  <span
                    className={`${styles.personAvatar} ${styles.personTwo}`}
                  >
                    C
                  </span>
                  <span>
                    <strong>Camila começou a seguir você</strong>
                    <small>há 1h</small>
                  </span>
                  <ChevronRight />
                </button>
              </>
            ) : (
              <>
                <button>
                  <span
                    className={`${styles.personAvatar} ${styles.personOne}`}
                  >
                    M
                  </span>
                  <span>
                    <strong>Marina Costa</strong>
                    <small>Vamos marcar para amanhã?</small>
                  </span>
                  <ChevronRight />
                </button>
                <button>
                  <span
                    className={`${styles.personAvatar} ${styles.personTwo}`}
                  >
                    C
                  </span>
                  <span>
                    <strong>Camila Rocha</strong>
                    <small>Parabéns pela conquista!</small>
                  </span>
                  <ChevronRight />
                </button>
              </>
            )}
          </div>
        )}

        {kind === "novo-post" && (
          <div className={styles.sheetForm}>
            <textarea
              className={styles.postInput}
              autoFocus
              placeholder="Compartilhe uma conquista, uma dica ou um momento..."
            />
            <div className={styles.photoActions}>
              <button>
                <ImageIcon />
                Foto
              </button>
              <button>
                <Camera />
                Câmera
              </button>
            </div>
            <div className={styles.sheetNotice}>
              Até 2 fotos. As imagens exibidas aqui são apenas simulação visual.
            </div>
            <button
              className={styles.sheetPrimary}
              onClick={() => finish("Publicação criada no protótipo")}
            >
              Publicar
            </button>
          </div>
        )}

        {kind === "foto" && (
          <div className={styles.sheetBody}>
            <div className={`${styles.viewerPhoto} ${styles.workspacePhoto}`}>
              <div className={styles.photoSun} />
              <div className={styles.photoLaptop}>
                <span>
                  Sonhe
                  <br />
                  Planeje
                  <br />
                  Conquiste
                </span>
              </div>
              <div className={styles.photoPassport}>PASSAPORTE</div>
            </div>
            <p className={styles.sheetHint}>
              No aplicativo real, esta tela usa a foto principal em alta
              qualidade e mantém a posição do feed ao fechar.
            </p>
          </div>
        )}

        {kind === "comentarios" && (
          <div className={styles.sheetBody}>
            <div className={styles.sheetList}>
              <button>
                <span className={`${styles.personAvatar} ${styles.personTwo}`}>
                  C
                </span>
                <span>
                  <strong>Camila Rocha</strong>
                  <small>Parabéns por essa conquista! ✨</small>
                </span>
              </button>
            </div>
            <label className={styles.sheetLabel}>
              Novo comentário
              <textarea placeholder="Escreva um comentário..." />
            </label>
            <button
              className={styles.sheetPrimary}
              onClick={() => finish("Comentário enviado no protótipo")}
            >
              Enviar comentário
            </button>
          </div>
        )}

        {kind === "compartilhar" && (
          <div className={styles.sheetBody}>
            <div className={styles.preferenceRows}>
              <button
                onClick={() => finish("Publicação enviada para uma conversa")}
              >
                <MessageCircle />
                <span>Enviar numa conversa</span>
                <ChevronRight />
              </button>
              <button onClick={() => finish("Link copiado no protótipo")}>
                <Link2 />
                <span>Copiar link</span>
                <ChevronRight />
              </button>
            </div>
          </div>
        )}

        {kind === "opcoes-post" && (
          <div className={styles.sheetBody}>
            <div className={styles.preferenceRows}>
              <button onClick={() => finish("Edição de publicação aberta")}>
                <Pencil />
                <span>Editar publicação</span>
                <ChevronRight />
              </button>
              <button onClick={() => finish("Denúncia simulada aberta")}>
                <Shield />
                <span>Denunciar publicação</span>
                <ChevronRight />
              </button>
              <button
                onClick={() => finish("Exclusão simulada com confirmação")}
              >
                <Delete />
                <span>Excluir minha publicação</span>
                <ChevronRight />
              </button>
            </div>
          </div>
        )}

        {kind === "amigas" && (
          <div className={styles.sheetBody}>
            <div className={styles.sheetSegment}>
              <button aria-pressed="true">Minhas amigas</button>
              <button>Solicitações</button>
              <button>Descobrir</button>
            </div>
            <div className={styles.sheetList}>
              <button>
                <span className={`${styles.personAvatar} ${styles.personOne}`}>
                  M
                </span>
                <span>
                  <strong>Marina Costa</strong>
                  <small>Enviar mensagem · remover · bloquear</small>
                </span>
                <MessageCircle />
              </button>
              <button>
                <span className={`${styles.personAvatar} ${styles.personTwo}`}>
                  C
                </span>
                <span>
                  <strong>Camila Rocha</strong>
                  <small>Solicitação pendente</small>
                </span>
                <UserPlus />
              </button>
            </div>
          </div>
        )}

        {kind === "perfil-ferramentas" && (
          <div className={styles.sheetBody}>
            <div className={styles.preferenceRows}>
              <button onClick={() => finish("Preview público aberto")}>
                <ExternalLink />
                <span>Ver como perfil público</span>
                <ChevronRight />
              </button>
              <button onClick={() => finish("Desejos abertos")}>
                <Target />
                <span>Desejos</span>
                <ChevronRight />
              </button>
              <button onClick={() => finish("Clientes abertos")}>
                <UsersRound />
                <span>Clientes privados</span>
                <ChevronRight />
              </button>
              <button onClick={() => finish("Privacidade aberta")}>
                <Shield />
                <span>Privacidade das publicações</span>
                <ChevronRight />
              </button>
              <button onClick={() => finish("Pessoas bloqueadas abertas")}>
                <Ban />
                <span>Pessoas bloqueadas</span>
                <ChevronRight />
              </button>
            </div>
          </div>
        )}

        {kind === "livelinks" && (
          <div className={styles.sheetBody}>
            <p className={styles.sheetHint}>
              Adicionar, editar, excluir e reordenar os links públicos do
              perfil.
            </p>
            <div className={styles.preferenceRows}>
              {profileLinks.map(({ label }) => (
                <button key={label}>
                  <Link2 />
                  <span>{label}</span>
                  <MoreHorizontal />
                </button>
              ))}
            </div>
            <button
              className={styles.sheetPrimary}
              onClick={() => finish("Novo LiveLink aberto")}
            >
              Adicionar LiveLink
            </button>
          </div>
        )}

        {(kind === "anotacoes" || kind === "grafico-agenda") && (
          <div className={styles.sheetBody}>
            {kind === "anotacoes" ? (
              <>
                <label className={styles.sheetLabel}>
                  Anotações livres
                  <textarea defaultValue="Confirmar horários e separar materiais da semana." />
                </label>
                <button
                  className={styles.sheetPrimary}
                  onClick={() => finish("Anotações salvas")}
                >
                  Salvar anotações
                </button>
              </>
            ) : (
              <>
                <div className={styles.sheetSegment}>
                  <button aria-pressed="true">Semana</button>
                  <button>Mês</button>
                  <button>Ano</button>
                </div>
                <div className={styles.filePreview}>
                  <BarChart3 size={58} />
                  <strong>Receitas e atendimentos</strong>
                  <span>Resumo por período e por status</span>
                </div>
              </>
            )}
          </div>
        )}

        {kind === "metas-financeiras" && (
          <div className={styles.sheetBody}>
            <div className={styles.preferenceRows}>
              <button>
                <Target />
                <span>Meta diária</span>
                <strong>R$ 250</strong>
              </button>
              <button>
                <Target />
                <span>Meta mensal</span>
                <strong>R$ 4.500</strong>
              </button>
              <button>
                <ListChecks />
                <span>Objetivos pessoais</span>
                <ChevronRight />
              </button>
            </div>
            <button
              className={styles.sheetPrimary}
              onClick={() => finish("Meta salva no protótipo")}
            >
              Editar metas
            </button>
          </div>
        )}

        {kind === "pin-config" && (
          <div className={styles.sheetBody}>
            <div className={styles.filePreview}>
              <LockKeyhole size={52} />
              <strong>PIN ativo</strong>
              <span>Protege o app neste aparelho e o acesso ao Cofre.</span>
            </div>
            <button
              className={styles.sheetPrimary}
              onClick={() =>
                finish("Fluxo Definir PIN → Confirmar PIN simulado")
              }
            >
              Alterar PIN
            </button>
            <button
              className={styles.sheetSecondary}
              onClick={() => finish("PIN desativado no protótipo")}
            >
              Desativar PIN
            </button>
          </div>
        )}

        {kind === "assinatura-dados" && (
          <div className={styles.sheetBody}>
            <div className={styles.filePreview}>
              <ShieldCheck size={52} />
              <strong>Teste grátis ativo</strong>
              <span>Seus dados ficam salvos na conta e sincronizados.</span>
            </div>
            <button
              className={styles.sheetPrimary}
              onClick={() => finish("Exportação iniciada no protótipo")}
            >
              <Download /> Exportar meus dados
            </button>
          </div>
        )}

        {(kind === "aparencia" ||
          kind === "tela-inicial" ||
          kind === "config-notificacoes" ||
          kind === "instalar-app") && (
          <div className={styles.sheetBody}>
            {kind === "aparencia" && (
              <div className={styles.preferenceRows}>
                <button>
                  <Palette />
                  <span>Tema</span>
                  <strong>Vinho</strong>
                </button>
                <button>
                  <span>Modo</span>
                  <strong>Escuro</strong>
                </button>
              </div>
            )}
            {kind === "tela-inicial" && (
              <div className={styles.preferenceRows}>
                <button>
                  <span>Próximo atendimento</span>
                  <strong>Visível</strong>
                </button>
                <button>
                  <span>Objetivos</span>
                  <strong>Visível</strong>
                </button>
                <button>
                  <span>Gráfico financeiro</span>
                  <strong>Área</strong>
                </button>
                <button>
                  <span>Gráfico da agenda</span>
                  <strong>Barras</strong>
                </button>
              </div>
            )}
            {kind === "config-notificacoes" && (
              <div className={styles.preferenceRows}>
                <button>
                  <Bell />
                  <span>Lembretes</span>
                  <strong>Ativados</strong>
                </button>
              </div>
            )}
            {kind === "instalar-app" && (
              <>
                <div className={styles.filePreview}>
                  <Smartphone size={52} />
                  <strong>Instalar JobApp</strong>
                  <span>
                    Acesso rápido, notificações e funcionamento offline.
                  </span>
                </div>
                <button
                  className={styles.sheetPrimary}
                  onClick={() => finish("Instalação simulada")}
                >
                  Ver instruções de instalação
                </button>
              </>
            )}
          </div>
        )}

        {kind === "confirmar-saida" && (
          <div className={styles.sheetBody}>
            <p className={styles.confirmCopy}>
              Você precisará entrar novamente para acessar sua agenda, finanças
              e Cofre.
            </p>
            <button
              className={styles.dangerButton}
              onClick={() =>
                finish("Saída simulada — sua sessão real continua ativa")
              }
            >
              Sair da conta
            </button>
            <button className={styles.sheetSecondary} onClick={onClose}>
              Cancelar
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`${styles.card} ${className}`}>{children}</div>;
}

function HomeScreen({
  openSettings,
  openSheet,
  openFinanceiro,
}: {
  openSettings: () => void;
  openSheet: OpenSheet;
  openFinanceiro: () => void;
}) {
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
          <div className={styles.flightRing}>
            <Plane size={31} />
          </div>
        </div>
        <strong className={styles.bigMetric}>0%</strong>
        <p className={styles.metricCaption}>R$ 0 de R$ 4.500</p>
        <div className={styles.cardDivider} />
        <p>Cada atendimento aproxima você da sua liberdade.</p>
        <button className={styles.primaryButton} onClick={openFinanceiro}>
          Ver minha evolução <ChevronRight size={20} />
        </button>
      </Card>

      <Card>
        <button
          className={styles.sectionHeading}
          onClick={() => openSheet("detalhe-atendimento")}
        >
          <h2>Próximo atendimento</h2>
          <ChevronRight size={21} />
        </button>
        <div className={styles.nextJob}>
          <div className={styles.dateTile}>
            <strong>10</strong>
            <span>SET</span>
          </div>
          <div className={styles.jobInfo}>
            <strong>Cliente Preflight QA</strong>
            <span>
              <Clock3 size={15} /> Hoje, 15h30
            </span>
            <span>
              <MapPin size={15} /> Studio Preflight
            </span>
          </div>
          <div className={styles.jobValue}>
            <ChevronRight size={18} />
            <strong>R$ 250,00</strong>
          </div>
        </div>
      </Card>

      <Card className={styles.goalCard}>
        <button
          className={styles.sectionHeading}
          onClick={() => openSheet("metas-financeiras")}
        >
          <h2>Objetivos</h2>
          <ChevronRight size={21} />
        </button>
        <div className={styles.goalBody}>
          <div className={styles.roundIcon}>
            <Target size={25} />
          </div>
          <div>
            <p>Crie uma meta para a sua próxima conquista</p>
            <button
              className={styles.secondaryButton}
              onClick={() => openSheet("novo-objetivo")}
            >
              Adicionar objetivo <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className={styles.horizon}>
          <span>
            SONHE.
            <br />
            PLANEJE.
            <br />
            CONQUISTE.
          </span>
          <i />
        </div>
      </Card>
      <button
        className={`${styles.card} ${styles.storageCard}`}
        onClick={() => openSheet("instalar-app")}
      >
        <Smartphone />
        <span>Instalar o JobApp neste aparelho</span>
        <ChevronRight />
      </button>
    </div>
  );
}

const agendaJobs = [
  {
    time: "09:00",
    name: "Marina Costa",
    place: "Studio Centro",
    value: "R$ 180,00",
    done: true,
  },
  {
    time: "15:30",
    name: "Cliente Preflight QA",
    place: "Studio Preflight",
    value: "R$ 250,00",
    today: true,
  },
  {
    time: "18:00",
    name: "Camila Rocha",
    place: "Atendimento online",
    value: "R$ 200,00",
    online: true,
  },
];

function AgendaScreen({ openSheet }: { openSheet: OpenSheet }) {
  const [selectedDay, setSelectedDay] = useState("QUI");
  const [statusFilter, setStatusFilter] = useState("Todos");
  return (
    <div className={styles.screenContent}>
      <header className={styles.titleHeader}>
        <h1>Agenda</h1>
        <button
          className={styles.addButton}
          onClick={() => openSheet("novo-atendimento")}
          aria-label="Adicionar atendimento"
        >
          <Plus />
        </button>
      </header>
      <div className={styles.monthPicker}>
        <button aria-label="Semana anterior">
          <ChevronLeft />
        </button>
        <strong>7–13 de setembro</strong>
        <button aria-label="Próxima semana">
          <ChevronRight />
        </button>
      </div>
      <div className={styles.weekStrip}>
        {[
          ["SEG", "7"],
          ["TER", "8"],
          ["QUA", "9"],
          ["QUI", "10"],
          ["SEX", "11"],
        ].map(([day, date]) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            aria-pressed={day === selectedDay}
            className={day === selectedDay ? styles.dayActive : styles.day}
          >
            <span>{day}</span>
            <strong>{date}</strong>
          </button>
        ))}
      </div>
      <div className={styles.chips}>
        {["Todos", "Agendado", "Confirmado", "Concluído", "Cancelado"].map(
          (item) => (
            <button
              onClick={() => setStatusFilter(item)}
              aria-pressed={item === statusFilter}
              className={
                item === statusFilter ? styles.chipActive : styles.chip
              }
              key={item}
            >
              {item}
            </button>
          )
        )}
      </div>
      <div className={styles.agendaIntro}>
        <h2>Quinta-feira, 10 de setembro</h2>
        <p>3 atendimentos</p>
      </div>
      <div className={styles.timeline}>
        {agendaJobs.map((job, index) => (
          <div className={styles.timelineRow} key={job.time}>
            <strong className={styles.timelineTime}>{job.time}</strong>
            <span className={styles.timelineDot} />
            <button
              className={`${styles.card} ${styles.timelineCard}`}
              onClick={() => openSheet("detalhe-atendimento")}
            >
              <div className={styles.timelineTitle}>
                <strong>{job.name}</strong>
                {job.done && (
                  <span className={styles.successBadge}>
                    <Check size={15} />
                    Concluído
                  </span>
                )}
                {job.today && (
                  <span className={styles.todayBadge}>
                    <Clock3 size={15} />
                    Hoje
                  </span>
                )}
                <ChevronRight size={18} />
              </div>
              <div className={styles.timelineDetails}>
                <span>
                  {job.online ? <Video size={17} /> : <MapPin size={17} />}
                  {job.place}
                </span>
                <strong>{job.value}</strong>
              </div>
            </button>
            {index === 0 && (
              <div className={styles.openSlot}>
                <span>
                  11:00
                  <br />
                  15:00
                </span>
                <Hourglass size={18} />
                <em>Horário disponível</em>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className={styles.dayTotal}>
        <span>Previsto hoje</span>
        <strong>R$ 630,00</strong>
      </div>
      <div className={styles.profileActions}>
        <button onClick={() => openSheet("grafico-agenda")}>
          <BarChart3 size={17} />
          Resumo
        </button>
        <button onClick={() => openSheet("anotacoes")}>
          <MessageSquareText size={17} />
          Anotações
        </button>
      </div>
      <div className={styles.mountainLine}>
        <i />
      </div>
    </div>
  );
}

function FinanceiroScreen({ openSheet }: { openSheet: OpenSheet }) {
  const [activeSegment, setActiveSegment] = useState("Visão");
  const [chartPeriod, setChartPeriod] = useState("Mês");
  const movements = [
    {
      icon: ArrowUpRight,
      name: "Atendimento — Marina Costa",
      date: "Hoje, 09:00",
      value: "+ R$ 180,00",
      positive: true,
    },
    {
      icon: ArrowDownRight,
      name: "Assinatura de ferramentas",
      date: "Ontem",
      value: "− R$ 89,90",
      positive: false,
    },
    {
      icon: ArrowUpRight,
      name: "Atendimento — Cliente Preflight QA",
      date: "8 de setembro",
      value: "+ R$ 250,00",
      positive: true,
    },
  ];
  return (
    <div className={styles.screenContent}>
      <header className={styles.titleHeader}>
        <h1>Financeiro</h1>
        <button
          className={styles.outlineAdd}
          onClick={() => openSheet("novo-movimento")}
          aria-label="Adicionar movimentação"
        >
          <Plus />
        </button>
      </header>
      <div className={styles.monthPicker}>
        <strong>Resumo financeiro</strong>
        <div className={styles.sheetSegment}>
          {["Semana", "Mês", "Ano"].map((period) => (
            <button
              key={period}
              onClick={() => setChartPeriod(period)}
              aria-pressed={chartPeriod === period}
            >
              {period}
            </button>
          ))}
        </div>
      </div>
      <Card className={styles.balanceCard}>
        <h2>Saldo do mês</h2>
        <div className={styles.balanceLine}>
          <strong>R$ 2.480,00</strong>
          <span>↗ +18%</span>
        </div>
        <div className={styles.moneySplit}>
          <div>
            <span>Entradas</span>
            <strong className={styles.positive}>R$ 4.250,00</strong>
          </div>
          <div>
            <span>Saídas</span>
            <strong className={styles.negative}>R$ 1.770,00</strong>
          </div>
        </div>
        <div className={styles.chart} aria-label="Gráfico do saldo no mês">
          <svg viewBox="0 0 320 105" role="img">
            <path
              d="M5 79 C35 69,45 60,74 68 S115 90,145 61 S186 49,204 63 S247 44,275 34 S306 29,318 39"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              d="M5 79 C35 69,45 60,74 68 S115 90,145 61 S186 49,204 63 S247 44,275 34 S306 29,318 39 L318 105 L5 105 Z"
              fill="url(#fill)"
              opacity=".35"
            />
            <defs>
              <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#ff2d78" />
                <stop offset="1" stopColor="#ff2d78" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </Card>
      <div
        className={styles.segmented}
        role="tablist"
        aria-label="Visão financeira"
      >
        {["Visão", "Entradas", "Saídas", "Metas"].map((item) => (
          <button
            key={item}
            onClick={() => setActiveSegment(item)}
            role="tab"
            aria-selected={item === activeSegment}
            className={item === activeSegment ? styles.segmentActive : ""}
          >
            {item}
          </button>
        ))}
      </div>
      {activeSegment === "Visão" && (
        <Card>
          <h2>Movimentações recentes</h2>
          <div className={styles.movements}>
            {movements.map((movement) => {
              const MovementIcon = movement.icon;
              return (
                <button
                  key={movement.name}
                  onClick={() => openSheet("novo-movimento")}
                  className={styles.movement}
                >
                  <span
                    className={
                      movement.positive
                        ? styles.moneyIconPositive
                        : styles.moneyIconNegative
                    }
                  >
                    <MovementIcon size={20} />
                  </span>
                  <span className={styles.movementText}>
                    <strong>{movement.name}</strong>
                    <small>{movement.date}</small>
                  </span>
                  <strong
                    className={
                      movement.positive ? styles.positive : styles.negative
                    }
                  >
                    {movement.value}
                  </strong>
                  <ChevronRight size={17} />
                </button>
              );
            })}
          </div>
        </Card>
      )}
      {(activeSegment === "Entradas" || activeSegment === "Saídas") && (
        <Card>
          <div className={styles.sectionHeading}>
            <h2>{activeSegment}</h2>
            <button
              className={styles.textButton}
              onClick={() => openSheet("novo-movimento")}
            >
              <Plus size={17} />
              Nova {activeSegment === "Entradas" ? "entrada" : "saída"}
            </button>
          </div>
          <div className={styles.movements}>
            {movements
              .filter((item) =>
                activeSegment === "Entradas" ? item.positive : !item.positive
              )
              .map((movement) => {
                const MovementIcon = movement.icon;
                return (
                  <div key={movement.name} className={styles.movement}>
                    <span
                      className={
                        movement.positive
                          ? styles.moneyIconPositive
                          : styles.moneyIconNegative
                      }
                    >
                      <MovementIcon size={20} />
                    </span>
                    <span className={styles.movementText}>
                      <strong>{movement.name}</strong>
                      <small>{movement.date}</small>
                    </span>
                    <strong
                      className={
                        movement.positive ? styles.positive : styles.negative
                      }
                    >
                      {movement.value}
                    </strong>
                    <button
                      aria-label={`Excluir ${movement.name}`}
                      onClick={() => openSheet("novo-movimento")}
                    >
                      <Delete size={17} />
                    </button>
                  </div>
                );
              })}
          </div>
        </Card>
      )}
      {activeSegment === "Metas" && (
        <Card>
          <h2>Metas financeiras e objetivos</h2>
          <div className={styles.preferenceRows}>
            <button onClick={() => openSheet("metas-financeiras")}>
              <Target />
              <span>Meta mensal</span>
              <strong>R$ 4.500</strong>
            </button>
            <button onClick={() => openSheet("novo-objetivo")}>
              <ListChecks />
              <span>Próxima viagem</span>
              <strong>35%</strong>
            </button>
          </div>
          <button
            className={styles.primaryButton}
            onClick={() => openSheet("metas-financeiras")}
          >
            Editar metas <ChevronRight size={18} />
          </button>
        </Card>
      )}
    </div>
  );
}

const vaultFiles = [
  {
    icon: FileText,
    name: "Contrato — Studio Preflight.pdf",
    meta: "Contrato · 2,4 MB",
    date: "Hoje",
    pdf: true,
  },
  {
    icon: FileText,
    name: "Comprovante — Marina Costa.pdf",
    meta: "Comprovante · 840 KB",
    date: "Ontem",
    pdf: true,
  },
  {
    icon: FileImage,
    name: "Documento pessoal.jpg",
    meta: "Documento · 1,8 MB",
    date: "7 de setembro",
  },
  {
    icon: FileText,
    name: "Planejamento 2026.pdf",
    meta: "Documento · 3,1 MB",
    date: "5 de setembro",
    pdf: true,
  },
];

function CofreScreen({ openSheet }: { openSheet: OpenSheet }) {
  const [activeChip, setActiveChip] = useState("Todos");
  const [query, setQuery] = useState("");
  const filteredFiles = vaultFiles.filter((file) => {
    const matchesQuery = file.name
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR"));
    const matchesChip =
      activeChip === "Todos" ||
      file.meta
        .toLocaleLowerCase("pt-BR")
        .includes(activeChip.slice(0, -1).toLocaleLowerCase("pt-BR"));
    return matchesQuery && matchesChip;
  });
  return (
    <div className={styles.screenContent}>
      <header className={styles.titleHeader}>
        <div>
          <h1>Cofre</h1>
          <p>Seus arquivos, sempre com você</p>
        </div>
        <button
          className={styles.addButton}
          onClick={() => openSheet("upload-arquivo")}
          aria-label="Enviar arquivo"
        >
          <Plus />
        </button>
      </header>
      <label className={styles.searchBox}>
        <Search />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Buscar no cofre"
          placeholder="Buscar no cofre"
        />
      </label>
      <Card className={styles.protectedCard}>
        <div className={styles.shieldOrb}>
          <Shield size={34} />
        </div>
        <div>
          <h2>Protegido</h2>
          <p>12 arquivos armazenados</p>
          <span>
            <LockKeyhole size={16} /> Acesso protegido pelo seu PIN
          </span>
        </div>
      </Card>
      <div className={styles.chips}>
        {["Todos", "Comprovantes", "Conversas", "Documentos", "Pessoal"].map(
          (item) => (
            <button
              onClick={() => setActiveChip(item)}
              aria-pressed={item === activeChip}
              className={item === activeChip ? styles.chipActive : styles.chip}
              key={item}
            >
              {item}
            </button>
          )
        )}
      </div>
      <h2 className={styles.listTitle}>Arquivos recentes</h2>
      {filteredFiles.length > 0 ? (
        <Card className={styles.fileList}>
          {filteredFiles.map((file) => {
            const FileIcon = file.icon;
            return (
              <button
                onClick={() => openSheet("arquivo")}
                className={styles.fileRow}
                key={file.name}
              >
                <span
                  className={file.pdf ? styles.pdfIcon : styles.imageFileIcon}
                >
                  <FileIcon size={25} />
                </span>
                <span className={styles.fileText}>
                  <strong>{file.name}</strong>
                  <small>{file.meta}</small>
                </span>
                <span className={styles.fileDate}>{file.date}</span>
                <MoreHorizontal size={19} />
              </button>
            );
          })}
        </Card>
      ) : (
        <div className={styles.searchEmpty}>
          <Search />
          <strong>Nenhum arquivo encontrado</strong>
          <span>Tente outro nome ou categoria.</span>
        </div>
      )}
      <button
        className={`${styles.card} ${styles.storageCard}`}
        onClick={() => openSheet("upload-arquivo")}
      >
        <span className={styles.storagePie} />
        <span>8,1 MB utilizados</span>
        <ChevronRight />
      </button>
    </div>
  );
}

function RedeScreen({
  openProfile,
  openSheet,
  showToast,
}: {
  openProfile: () => void;
  openSheet: OpenSheet;
  showToast: (message: string) => void;
}) {
  const [feedTab, setFeedTab] = useState("Para você");
  const [liked, setLiked] = useState(true);
  return (
    <div className={`${styles.screenContent} ${styles.feedContent}`}>
      <header className={styles.networkHeader}>
        <h1>Rede</h1>
        <div>
          <button onClick={() => openSheet("buscar-rede")} aria-label="Buscar">
            <Search />
          </button>
          <button
            onClick={() => openSheet("notificacoes")}
            aria-label="Notificações"
            className={styles.notificationButton}
          >
            <Bell />
            <i />
          </button>
          <button onClick={() => openSheet("conversas")} aria-label="Conversas">
            <MessageCircle />
          </button>
          <AvatarButton onClick={openProfile} label="Abrir meu perfil" />
        </div>
      </header>
      <div className={styles.composer}>
        <AvatarButton onClick={openProfile} label="Abrir meu perfil" />
        <button
          className={styles.composerPrompt}
          onClick={() => openSheet("novo-post")}
        >
          <span>Compartilhe algo...</span>
          <ImageIcon />
          <span className={styles.srOnly}>Criar publicação</span>
        </button>
      </div>
      <div
        className={styles.feedTabs}
        role="tablist"
        aria-label="Filtro do feed"
      >
        <button
          onClick={() => setFeedTab("Para você")}
          role="tab"
          aria-selected={feedTab === "Para você"}
          className={feedTab === "Para você" ? styles.feedTabActive : ""}
        >
          Para você
        </button>
        <button
          onClick={() => setFeedTab("Amigas")}
          role="tab"
          aria-selected={feedTab === "Amigas"}
          className={feedTab === "Amigas" ? styles.feedTabActive : ""}
        >
          Amigas
        </button>
      </div>
      <button
        className={`${styles.card} ${styles.storageCard}`}
        onClick={() => openSheet("amigas")}
      >
        <UsersRound />
        <span>Amigas, solicitações e descobrir pessoas</span>
        <ChevronRight />
      </button>
      <article className={styles.post}>
        <div className={styles.postHeader}>
          <div className={`${styles.personAvatar} ${styles.personOne}`}>M</div>
          <div>
            <strong>Marina Costa</strong>
            <span>
              <b>◎ Conquista</b> · há 2h
            </span>
          </div>
          <button
            onClick={() => openSheet("opcoes-post")}
            aria-label="Mais opções"
          >
            <MoreHorizontal />
          </button>
        </div>
        <p>Primeira semana com a agenda cheia. Um passo de cada vez ✨</p>
        <button
          className={`${styles.feedPhoto} ${styles.workspacePhoto}`}
          onClick={() => openSheet("foto")}
          aria-label="Abrir foto da publicação"
        >
          <div className={styles.photoSun} />
          <div className={styles.photoLaptop}>
            <span>
              Sonhe
              <br />
              Planeje
              <br />
              Conquiste
            </span>
          </div>
          <div className={styles.photoNotebook}>
            ☑ Trabalhar
            <br />☑ Organizar finanças
            <br />☑ Planejar viagem
          </div>
          <div className={styles.photoPassport}>PASSAPORTE</div>
        </button>
        <div className={styles.postActions}>
          <button
            onClick={() => setLiked((value) => !value)}
            aria-pressed={liked}
          >
            <Heart fill={liked ? "currentColor" : "none"} />
            {liked ? 24 : 23}
          </button>
          <button onClick={() => openSheet("comentarios")}>
            <MessageCircle />6
          </button>
          <button
            onClick={() => openSheet("compartilhar")}
            aria-label="Compartilhar"
          >
            <Share2 />
          </button>
        </div>
      </article>
      <article className={styles.post}>
        <div className={styles.postHeader}>
          <div className={`${styles.personAvatar} ${styles.personTwo}`}>C</div>
          <div>
            <strong>Camila Rocha</strong>
            <span>
              <b>◉ Dica</b> · há 5h
            </span>
          </div>
          <button
            onClick={() => openSheet("opcoes-post")}
            aria-label="Mais opções"
          >
            <MoreHorizontal />
          </button>
        </div>
        <p>
          Organizar o financeiro mudou a forma como planejo meus próximos meses.
        </p>
        <button
          className={`${styles.feedPhoto} ${styles.disciplinePhoto}`}
          onClick={() => openSheet("foto")}
          aria-label="Abrir foto da publicação"
        >
          <span>
            DISCIPLINA
            <br />
            HOJE
            <br />
            LIBERDADE
            <br />
            SEMPRE ♡
          </span>
        </button>
        <div className={styles.postActions}>
          <button>
            <Heart />
            18
          </button>
          <button onClick={() => openSheet("comentarios")}>
            <MessageCircle />3
          </button>
          <button
            onClick={() => openSheet("compartilhar")}
            aria-label="Compartilhar"
          >
            <Share2 />
          </button>
        </div>
      </article>
      <button
        className={styles.textButton}
        onClick={() => showToast("Mais publicações carregadas no protótipo")}
      >
        Carregar mais publicações <ChevronRight size={18} />
      </button>
    </div>
  );
}

const profileLinks = [
  { label: "Portfólio", detail: "trabalhos e projetos", icon: ImageIcon },
  { label: "Instagram", detail: "rotina e bastidores", icon: Link2 },
  { label: "TikTok", detail: "conteúdo e bastidores", icon: Video },
];

function ProfileScreen({
  goBack,
  openSheet,
  showToast,
}: {
  goBack: () => void;
  openSheet: OpenSheet;
  showToast: (message: string) => void;
}) {
  return (
    <div className={`${styles.screenContent} ${styles.profileScreen}`}>
      <header className={styles.profileTopbar}>
        <button onClick={goBack} aria-label="Voltar para a Rede">
          <ChevronLeft />
        </button>
        <strong>alexsilva</strong>
        <button
          onClick={() => openSheet("perfil-ferramentas")}
          aria-label="Abrir ferramentas do perfil"
        >
          <MoreHorizontal />
        </button>
      </header>

      <section
        className={styles.profileIdentity}
        aria-label="Apresentação do perfil"
      >
        <div className={styles.profileIdentityTop}>
          <div className={styles.profileAvatarLarge}>
            <span>⌐</span>
            <strong>A</strong>
          </div>
          <div className={styles.profileStats}>
            <button>
              <strong>18</strong>
              <span>publicações</span>
            </button>
            <button onClick={() => openSheet("amigas")}>
              <strong>246</strong>
              <span>amigas</span>
            </button>
            <button onClick={() => openSheet("perfil-ferramentas")}>
              <strong>31</strong>
              <span>clientes</span>
            </button>
          </div>
        </div>
        <div className={styles.profileBio}>
          <h1>Alex Silva</h1>
          <p>Transformando trabalho em liberdade para conhecer o mundo.</p>
          <div className={styles.profileLinkChips} aria-label="LiveLinks">
            {profileLinks.map(({ label, detail, icon: LinkIcon }) => (
              <button
                key={label}
                onClick={() => showToast(`${label} aberto no protótipo`)}
                aria-label={`${label}: ${detail}`}
              >
                <LinkIcon size={13} />
                <strong>{label}</strong>
              </button>
            ))}
            <button
              onClick={() => openSheet("livelinks")}
              aria-label="Gerenciar LiveLinks"
            >
              <Pencil size={13} />
              <strong>Editar</strong>
            </button>
          </div>
        </div>
        <div className={styles.profileActions}>
          <button onClick={() => openSheet("editar-perfil")}>
            <Pencil size={16} />
            Editar perfil
          </button>
          <button onClick={() => openSheet("novo-post")}>
            <Plus size={17} />
            Publicar
          </button>
          <button
            className={styles.profileShare}
            onClick={() => openSheet("compartilhar")}
            aria-label="Compartilhar perfil"
          >
            <Share2 size={17} />
          </button>
        </div>
      </section>

      <section className={styles.profilePosts} aria-label="Publicações de Alex">
        <div className={styles.profilePostsTabs}>
          <button
            className={styles.profilePostsActive}
            aria-label="Grade de publicações"
          >
            <Grid3X3 size={21} />
          </button>
        </div>
        <div className={styles.profileGrid}>
          <button
            className={`${styles.profileTile} ${styles.profileTileTravel}`}
            onClick={() => openSheet("foto")}
            aria-label="Abrir publicação sobre viagem"
          >
            <Plane />
          </button>
          <button
            className={`${styles.profileTile} ${styles.profileTileWork}`}
            onClick={() => openSheet("foto")}
            aria-label="Abrir publicação sobre trabalho"
          >
            <span>
              LIBERDADE
              <br />
              COMEÇA
              <br />
              NO PLANO.
            </span>
          </button>
          <button
            className={`${styles.profileTile} ${styles.profileTileCity}`}
            onClick={() => openSheet("foto")}
            aria-label="Abrir publicação sobre cidade"
          >
            <MapPin />
          </button>
          <button
            className={`${styles.profileTile} ${styles.profileTileMoney}`}
            onClick={() => openSheet("foto")}
            aria-label="Abrir publicação sobre finanças"
          >
            <strong>R$</strong>
          </button>
          <button
            className={`${styles.profileTile} ${styles.profileTilePassport}`}
            onClick={() => openSheet("foto")}
            aria-label="Abrir publicação sobre passaporte"
          >
            <span>PASSAPORTE</span>
          </button>
          <button
            className={`${styles.profileTile} ${styles.profileTileSunset}`}
            onClick={() => openSheet("foto")}
            aria-label="Abrir publicação sobre conquista"
          >
            <Target />
          </button>
        </div>
      </section>
    </div>
  );
}

const settingGroups: Array<{
  label: string;
  rows: Array<{ icon: Icon; label: string; value?: string; sheet: SheetKind }>;
}> = [
  {
    label: "CONTA",
    rows: [
      {
        icon: LockKeyhole,
        label: "Segurança e PIN",
        value: "PIN ativo",
        sheet: "pin-config",
      },
      {
        icon: ShieldCheck,
        label: "Assinatura e dados",
        value: "Nuvem e exportação",
        sheet: "assinatura-dados",
      },
    ],
  },
  {
    label: "PREFERÊNCIAS",
    rows: [
      {
        icon: Palette,
        label: "Aparência",
        value: "Vinho · Escuro",
        sheet: "aparencia",
      },
      {
        icon: Home,
        label: "Tela inicial",
        value: "Cards e gráficos",
        sheet: "tela-inicial",
      },
      {
        icon: Bell,
        label: "Notificações",
        value: "Ativadas",
        sheet: "config-notificacoes",
      },
    ],
  },
  {
    label: "APLICATIVO",
    rows: [
      {
        icon: Smartphone,
        label: "Instalar JobApp",
        value: "Acesso rápido e offline",
        sheet: "instalar-app",
      },
    ],
  },
];

const pinKeys = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
  { digit: "", letters: "" },
  { digit: "0", letters: "" },
  { digit: "delete", letters: "" },
];

function PinPrototypeScreen({
  onUnlock,
  vault = false,
}: {
  onUnlock: () => void;
  vault?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    },
    []
  );

  function pressPinKey(key: string) {
    if (unlocked) return;
    if (key === "delete") {
      setDigits((current) => current.slice(0, -1));
      return;
    }
    if (!key || digits.length === 4) return;
    const next = [...digits, key];
    setDigits(next);
    if (next.length === 4) {
      setUnlocked(true);
      unlockTimerRef.current = setTimeout(onUnlock, 720);
    }
  }

  return (
    <section
      className={styles.pinPrototypeScreen}
      aria-labelledby="prototype-pin-title"
    >
      <div className={styles.pinAtmosphere} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className={styles.pinWordmark}>JobApp</div>
      <div className={styles.pinIntro}>
        <div className={styles.pinLockSeal}>
          <LockKeyhole size={27} />
        </div>
        <h1 id="prototype-pin-title">
          {vault ? "Abra seu cofre" : "Digite seu PIN"}
        </h1>
        <p aria-live="polite">
          {unlocked
            ? "Acesso liberado."
            : vault
              ? "Digite seu PIN para acessar seus arquivos protegidos."
              : "Confirme sua identidade para entrar no seu espaço."}
        </p>
      </div>
      <div
        className={styles.pinDots}
        aria-label={`${digits.length} de 4 dígitos preenchidos`}
        data-unlocked={unlocked ? "true" : "false"}
      >
        {[0, 1, 2, 3].map((index) => (
          <i
            key={index}
            className={digits.length > index ? styles.pinDotFilled : ""}
          />
        ))}
      </div>
      <div className={styles.pinKeypad} aria-label="Teclado do PIN">
        {pinKeys.map(({ digit, letters }, index) => {
          if (!digit) return <span key={`blank-${index}`} aria-hidden="true" />;
          const deleting = digit === "delete";
          return (
            <button
              key={digit}
              onClick={() => pressPinKey(digit)}
              aria-label={deleting ? "Apagar último dígito" : `Dígito ${digit}`}
              disabled={unlocked}
            >
              {deleting ? (
                <Delete size={22} />
              ) : (
                <>
                  <strong>{digit}</strong>
                  {letters && <small>{letters}</small>}
                </>
              )}
            </button>
          );
        })}
      </div>
      <p className={styles.pinPrivacy}>
        <ShieldCheck size={14} /> Seu espaço permanece protegido neste aparelho.
      </p>
    </section>
  );
}

function AjustesScreen({
  goBack,
  backLabel,
  openSheet,
  openPin,
}: {
  goBack: () => void;
  backLabel: string;
  openSheet: OpenSheet;
  openPin: () => void;
}) {
  return (
    <div className={styles.screenContent}>
      <header className={styles.settingsHeader}>
        <button onClick={goBack}>
          <ArrowLeft />
          {backLabel}
        </button>
        <h1>Ajustes</h1>
        <span />
      </header>
      {settingGroups.map((group) => (
        <section className={styles.settingsSection} key={group.label}>
          <h2>{group.label}</h2>
          <Card className={styles.settingsGroup}>
            {group.rows.map(({ icon: RowIcon, label, value, sheet }) => (
              <button
                onClick={() => openSheet(sheet)}
                className={styles.settingRow}
                key={label}
              >
                <span className={styles.settingIcon}>
                  <RowIcon size={22} />
                </span>
                <strong>{label}</strong>
                {value && <em>{value}</em>}
                <ChevronRight size={18} />
              </button>
            ))}
          </Card>
        </section>
      ))}
      <button
        className={`${styles.card} ${styles.storageCard}`}
        onClick={() => openPin()}
      >
        <LockKeyhole />
        <span>Prévia da tela de bloqueio</span>
        <ChevronRight />
      </button>
      <Card className={styles.logoutCard}>
        <button onClick={() => openSheet("confirmar-saida")}>
          <span className={styles.logoutIcon}>
            <ArrowLeft size={21} />
          </span>
          <strong>Sair da conta</strong>
          <ChevronRight />
        </button>
      </Card>
    </div>
  );
}

export function IosPrototypeApp() {
  const [active, setActive] = useState<Screen>("home");
  const [previous, setPrevious] = useState<PrimaryScreen>("home");
  const [navCompact, setNavCompact] = useState(false);
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [toast, setToast] = useState("");
  const [pinDestination, setPinDestination] = useState<PrimaryScreen | null>(
    null
  );
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
      setNavCompact(
        active !== "ajustes" && scrollAreaRef.current.scrollTop > 40
      );
      requestAnimationFrame(() => {
        restoringScroll.current = false;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  function rememberScroll() {
    if (scrollAreaRef.current)
      scrollPositions.current[active] = scrollAreaRef.current.scrollTop;
  }

  function openSettings() {
    rememberScroll();
    restoringScroll.current = true;
    if (navItems.some((item) => item.id === active)) {
      setPrevious(active as PrimaryScreen);
    }
    setActive("ajustes");
  }

  function openProfile() {
    rememberScroll();
    restoringScroll.current = true;
    setPrevious("rede");
    setActive("perfil");
  }

  function openPin(destination: PrimaryScreen | null = null) {
    rememberScroll();
    restoringScroll.current = true;
    setPinDestination(destination);
    setActive("pin");
  }

  function changeScreen(screen: Screen) {
    if (screen === active) return;
    rememberScroll();
    restoringScroll.current = true;
    if (screen === "cofre") {
      setPrevious("cofre");
      setPinDestination("cofre");
      setActive("pin");
      return;
    }
    if (screen !== "ajustes" && screen !== "perfil" && screen !== "pin")
      setPrevious(screen);
    setActive(screen);
  }

  function openSheet(kind: SheetKind) {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
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

  const bottomNavActive: PrimaryScreen =
    active === "ajustes" || active === "pin"
      ? previous
      : active === "perfil"
        ? "rede"
        : active;

  return (
    <div className={styles.prototypeStage}>
      <PrototypeControls scenario={scenario} onChange={setScenario} />
      <div className={styles.phoneShell}>
        <StatusBar />
        <main
          ref={scrollAreaRef}
          className={styles.scrollArea}
          onScroll={(event) => {
            if (restoringScroll.current) return;
            scrollPositions.current[active] = event.currentTarget.scrollTop;
            setNavCompact(
              active !== "ajustes" && event.currentTarget.scrollTop > 40
            );
          }}
        >
          {navItems.some((item) => item.id === active) &&
          scenario !== "conteudo" ? (
            <PrototypeStateView
              screen={active as PrimaryScreen}
              scenario={scenario}
              onRetry={() => setScenario("conteudo")}
              openSheet={openSheet}
            />
          ) : (
            <>
              {active === "home" && (
                <HomeScreen
                  openSettings={openSettings}
                  openSheet={openSheet}
                  openFinanceiro={() => changeScreen("financeiro")}
                />
              )}
              {active === "agenda" && <AgendaScreen openSheet={openSheet} />}
              {active === "financeiro" && (
                <FinanceiroScreen openSheet={openSheet} />
              )}
              {active === "cofre" && <CofreScreen openSheet={openSheet} />}
              {active === "rede" && (
                <RedeScreen
                  openProfile={openProfile}
                  openSheet={openSheet}
                  showToast={showToast}
                />
              )}
              {active === "perfil" && (
                <ProfileScreen
                  goBack={() => changeScreen("rede")}
                  openSheet={openSheet}
                  showToast={showToast}
                />
              )}
              {active === "ajustes" && (
                <AjustesScreen
                  goBack={() => changeScreen(previous)}
                  backLabel={
                    navItems.find((item) => item.id === previous)?.label ??
                    "Início"
                  }
                  openSheet={openSheet}
                  openPin={openPin}
                />
              )}
              {active === "pin" && (
                <PinPrototypeScreen
                  vault={pinDestination === "cofre"}
                  onUnlock={() => {
                    const destination = pinDestination ?? previous;
                    setPinDestination(null);
                    setPrevious(destination);
                    setActive(destination);
                  }}
                />
              )}
            </>
          )}
        </main>
        {active !== "pin" && (
          <BottomNav
            active={bottomNavActive}
            compact={navCompact}
            onChange={changeScreen}
          />
        )}
        <PrototypeSheet
          kind={sheet}
          onClose={closeSheet}
          onConfirm={showToast}
        />
        {toast && (
          <div className={styles.prototypeToast} role="status">
            {toast}
          </div>
        )}
        <div className={styles.homeIndicator} aria-hidden="true" />
      </div>
    </div>
  );
}
