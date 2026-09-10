/**
 * Client Supabase falso, só pro shell mockado em /dev-preview/app. Imita a
 * fatia da API do supabase-js que os componentes reais (JobsTab, Financeiro,
 * Cofre, Ajustes, formulários…) realmente usam — from().select().eq()...
 * encadeável e "thenable", mais storage.from().list/upload/createSignedUrl.
 * Tudo em memória, reseta ao recarregar a página.
 */

type Row = Record<string, unknown>;
type Store = Record<string, Row[]>;

function delay<T>(value: T, ms = 220 + Math.random() * 180): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function matchesFilters(row: Row, filters: [string, unknown][]) {
  return filters.every(([col, val]) => row[col] === val);
}

function pick(row: Row, cols: string): Row {
  if (cols === "*") return row;
  const names = cols.split(",").map((c) => c.trim());
  const out: Row = {};
  for (const n of names) out[n] = row[n];
  return out;
}

class QueryBuilder<T = unknown> implements PromiseLike<{
  data: T | null;
  error: { message: string } | null;
}> {
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private filters: [string, unknown][] = [];
  private inFilters: [string, unknown[]][] = [];
  private ilikeFilters: [string, string][] = [];
  private orders: [string, boolean][] = [];
  private limitN: number | null = null;
  private wantsSingle = false;
  private wantsMaybeSingle = false;
  private selectCols = "*";
  private payload: Row | Row[] | null = null;
  private upsertConflict: string | null = null;

  constructor(
    private store: Store,
    private table: string
  ) {}

  private matches(row: Row): boolean {
    return (
      matchesFilters(row, this.filters) &&
      this.inFilters.every(([col, vals]) => vals.includes(row[col])) &&
      this.ilikeFilters.every(([col, pattern]) => {
        const re = new RegExp(
          `^${pattern
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            .replace(/%/g, ".*")
            .replace(/_/g, ".")}$`,
          "i"
        );
        return re.test(String(row[col] ?? ""));
      })
    );
  }

  select(cols = "*") {
    if (this.op === "insert" || this.op === "update" || this.op === "upsert") {
      this.selectCols = cols;
      return this;
    }
    this.op = "select";
    this.selectCols = cols;
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push([col, val]);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.inFilters.push([col, vals]);
    return this;
  }
  ilike(col: string, pattern: string) {
    this.ilikeFilters.push([col, pattern]);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push([col, opts?.ascending !== false]);
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  single() {
    this.wantsSingle = true;
    return this;
  }
  maybeSingle() {
    this.wantsMaybeSingle = true;
    return this;
  }
  insert(payload: Row | Row[]) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Row) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  upsert(payload: Row | Row[], opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = payload;
    this.upsertConflict = opts?.onConflict ?? null;
    return this;
  }

  then<
    TResult1 = { data: T | null; error: { message: string } | null },
    TResult2 = never,
  >(
    onfulfilled?:
      | ((value: {
          data: T | null;
          error: { message: string } | null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected) as PromiseLike<
      TResult1 | TResult2
    >;
  }

  private async execute(): Promise<{
    data: T | null;
    error: { message: string } | null;
  }> {
    if (!this.store[this.table]) this.store[this.table] = [];
    const rows = this.store[this.table];

    if (this.op === "select") {
      let result = rows.filter((r) => this.matches(r));
      for (const [col, asc] of this.orders) {
        result = [...result].sort((a, b) => {
          const av = a[col] as string | number;
          const bv = b[col] as string | number;
          if (av === bv) return 0;
          return (av < bv ? -1 : 1) * (asc ? 1 : -1);
        });
      }
      if (this.limitN !== null) result = result.slice(0, this.limitN);
      const projected = result.map((r) => pick(r, this.selectCols));
      if (this.wantsSingle) {
        const one = projected[0];
        return delay(
          one
            ? { data: one as T, error: null }
            : { data: null, error: { message: "No rows found" } }
        );
      }
      if (this.wantsMaybeSingle) {
        return delay({ data: (projected[0] as T) ?? null, error: null });
      }
      return delay({ data: projected as T, error: null });
    }

    if (this.op === "insert") {
      const items = Array.isArray(this.payload)
        ? this.payload
        : [this.payload!];
      const inserted = items.map((item) => ({
        id: genId(this.table),
        criado_em: new Date().toISOString(),
        ...item,
      }));
      rows.push(...inserted);
      if (this.wantsSingle) {
        return delay({
          data: pick(inserted[0], this.selectCols) as T,
          error: null,
        });
      }
      return delay({ data: inserted as T, error: null });
    }

    if (this.op === "update") {
      const matched = rows.filter((r) => this.matches(r));
      for (const row of matched) Object.assign(row, this.payload);
      const projected = matched.map((r) => pick(r, this.selectCols));
      if (this.wantsSingle) {
        const one = projected[0];
        return delay(
          one
            ? { data: one as T, error: null }
            : { data: null, error: { message: "No rows found" } }
        );
      }
      return delay({ data: projected as T, error: null });
    }

    if (this.op === "delete") {
      const keep = rows.filter((r) => !this.matches(r));
      const removedCount = rows.length - keep.length;
      this.store[this.table] = keep;
      return delay({ data: null, error: removedCount > 0 ? null : null });
    }

    if (this.op === "upsert") {
      const items = Array.isArray(this.payload)
        ? this.payload
        : [this.payload!];
      const conflictCols = this.upsertConflict
        ? this.upsertConflict.split(",").map((c) => c.trim())
        : ["id"];
      for (const item of items) {
        const existing = rows.find((r) =>
          conflictCols.every((c) => r[c] === item[c])
        );
        if (existing) Object.assign(existing, item);
        else rows.push({ id: genId(this.table), ...item });
      }
      return delay({ data: null, error: null });
    }

    return delay({
      data: null,
      error: { message: `Unsupported op ${this.op}` },
    });
  }
}

interface StorageFileMeta {
  path: string;
  name: string;
  categoria: string;
  size: number;
  mimeType?: string;
  createdAt: string;
  blobUrl?: string;
}

class MockStorageBucket {
  constructor(private files: StorageFileMeta[]) {}

  list(
    prefix: string,
    opts?: { sortBy?: { column: string; order: "asc" | "desc" } }
  ) {
    let matched = this.files.filter((f) => f.path.startsWith(`${prefix}/`));
    if (opts?.sortBy?.column === "created_at") {
      matched = [...matched].sort((a, b) => {
        const d =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return opts.sortBy!.order === "desc" ? -d : d;
      });
    }
    return delay({
      data: matched.map((f) => ({
        name: f.name,
        created_at: f.createdAt,
        updated_at: f.createdAt,
        metadata: { size: f.size, mimetype: f.mimeType },
      })),
      error: null,
    });
  }

  /** `token` novo a cada chamada -- imita uma URL assinada real (sempre
   * única), pra dev-preview poder exercitar a renovação de URL expirada. */
  private assinar(file: StorageFileMeta): string {
    const base = file.blobUrl ?? placeholderDocDataUri(file.name);
    const nonce = `mocktok=${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    return base.includes("?") ? `${base}&${nonce}` : `${base}?${nonce}`;
  }

  createSignedUrl(path: string, _expiresIn: number) {
    const file = this.files.find((f) => f.path === path);
    return delay({
      data: file ? { signedUrl: this.assinar(file) } : null,
      error: file ? null : { message: "Object not found" },
    });
  }

  /** Usado por lib/rede/feed.ts (listarFeed) pra assinar todas as fotos da
   * página numa chamada só -- sem isso, o feed real quebra rodando contra
   * o mock assim que um post tem foto. */
  createSignedUrls(paths: string[], _expiresIn: number) {
    return delay({
      data: paths.map((path) => {
        const file = this.files.find((f) => f.path === path);
        return {
          path,
          signedUrl: file ? this.assinar(file) : "",
          error: file ? null : "Object not found",
        };
      }),
      error: null,
    });
  }

  /** Usado por excluirPost (lib/rede/feed.ts) -- limpeza imediata das
   * fotos de um post excluído. */
  remove(paths: string[]) {
    const removed = paths.filter((path) =>
      this.files.some((f) => f.path === path)
    );
    this.files = this.files.filter((f) => !paths.includes(f.path));
    return delay({
      data: removed.map((path) => ({ path })),
      error: null,
    });
  }

  upload(path: string, file: File, opts?: { contentType?: string }) {
    const parts = path.split("/");
    const categoria = parts[1] ?? "documentos";
    const name = parts[parts.length - 1];
    let blobUrl: string | undefined;
    try {
      blobUrl = URL.createObjectURL(file);
    } catch {
      blobUrl = undefined;
    }
    this.files.push({
      path,
      name,
      categoria,
      size: file.size,
      mimeType: opts?.contentType ?? file.type,
      createdAt: new Date().toISOString(),
      blobUrl,
    });
    return delay({ data: { path }, error: null });
  }
}

function placeholderDocDataUri(name: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="100%" height="100%" fill="#1a1825"/><text x="50%" y="50%" fill="#9B5CF6" font-size="28" font-family="sans-serif" text-anchor="middle">${name}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export interface MockSupabaseSeed {
  tables: Store;
  cofreFiles: StorageFileMeta[];
}

export function createMockSupabaseClient(
  seed: MockSupabaseSeed,
  authUserId?: string
) {
  const store: Store = seed.tables;
  const bucket = new MockStorageBucket(seed.cofreFiles);

  return {
    /** Marca este client como o mock em memória -- `criarPost`
     * (lib/rede/feed.ts) usa isto pra gravar foto direto no mock em vez de
     * chamar a rota `/api/rede/foto-upload`, que não existe no harness. */
    __mock: true as const,
    from(table: string) {
      return new QueryBuilder(store, table);
    },
    storage: {
      from(_bucket: string) {
        return bucket;
      },
    },
    // Só o suficiente pra código real que chama auth.getUser() (ex.:
    // lib/rede/perfis.ts) não quebrar rodando contra o mock -- nenhuma
    // sessão de verdade, só devolve o id combinado com o preview.
    auth: {
      async getUser() {
        return authUserId
          ? { data: { user: { id: authUserId } }, error: null }
          : { data: { user: null }, error: null };
      },
    },
    // Só cobre as RPCs que o client-side de fato chama direto (a maioria
    // fica atrás das rotas de API, com seu próprio client server-side).
    rpc(fn: string, params?: Record<string, unknown>) {
      if (fn === "rede_reordenar_livelinks") {
        const ids = (params?.livelink_ids as string[] | undefined) ?? [];
        const rows = store["rede_livelinks"] ?? [];
        ids.forEach((id, i) => {
          const row = rows.find((r) => r.id === id);
          if (row) row.ordem = i;
        });
        const sorted = [...rows].sort(
          (a, b) => (a.ordem as number) - (b.ordem as number)
        );
        return delay({ data: sorted as unknown, error: null });
      }
      if (fn === "rede_criar_conversa_1a1" && authUserId) {
        const outroUserId = params?.outro_user_id as string;
        const participantes = (store["rede_conversas_participantes"] ??= []);
        const minhasConversas = new Set(
          participantes
            .filter((p) => p.user_id === authUserId)
            .map((p) => p.conversa_id as string)
        );
        const existente = participantes.find(
          (p) =>
            p.user_id === outroUserId &&
            minhasConversas.has(p.conversa_id as string)
        );
        if (existente) {
          return delay({ data: existente.conversa_id, error: null });
        }
        const novaConversaId = genId("conversa");
        const conversas = (store["rede_conversas"] ??= []);
        conversas.push({
          id: novaConversaId,
          criado_em: new Date().toISOString(),
          user_high_id: authUserId > outroUserId ? authUserId : outroUserId,
          user_low_id: authUserId > outroUserId ? outroUserId : authUserId,
        });
        participantes.push(
          { conversa_id: novaConversaId, user_id: authUserId },
          { conversa_id: novaConversaId, user_id: outroUserId }
        );
        return delay({ data: novaConversaId, error: null });
      }
      return delay({
        data: null,
        error: { message: `RPC mock não implementada: ${fn}` },
      });
    },
    // Sem WebSocket de verdade no mock -- só confirma a inscrição pra não
    // travar quem espera "SUBSCRIBED". Mensagens em tempo real de outra
    // sessão nunca chegam aqui (Realtime já foi validado de verdade contra
    // Supabase real na ticket 05 do mapa; aqui é só pra não quebrar quem
    // chama .channel()/.subscribe() rodando contra o preview).
    channel(_name: string) {
      return {
        on() {
          return this;
        },
        subscribe(callback?: (status: string) => void) {
          if (callback) setTimeout(() => callback("SUBSCRIBED"), 0);
          return this;
        },
      };
    },
    removeChannel(_channel: unknown) {
      return Promise.resolve("ok");
    },
  };
}
