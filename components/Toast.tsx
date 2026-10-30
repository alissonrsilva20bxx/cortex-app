"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastType = "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

/** `ateAgir`: o aviso não some sozinho; fica até a pessoa tocar na tela ou
 * digitar (para erro que ela não pode perder, como a volta do Google). */
interface ToastOpcoes {
  ateAgir?: boolean;
}

interface ToastCtx {
  success: (message: string) => void;
  error: (message: string, opcoes?: ToastOpcoes) => void;
}

const ToastContext = createContext<ToastCtx>({
  success: () => {},
  error: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let _id = 0;

type AlvoDeAcao = {
  addEventListener: (tipo: string, fn: () => void) => void;
  removeEventListener: (tipo: string, fn: () => void) => void;
};

/** Chama `fn` uma vez, no primeiro toque ou tecla depois de agora. Começa a
 * ouvir no próximo ciclo: o toque que abriu o aviso não o fecha. */
export function ouvirPrimeiraAcao(alvo: AlvoDeAcao, fn: () => void): void {
  const agir = () => {
    alvo.removeEventListener("pointerdown", agir);
    alvo.removeEventListener("keydown", agir);
    fn();
  };
  setTimeout(() => {
    alvo.addEventListener("pointerdown", agir);
    alvo.addEventListener("keydown", agir);
  }, 0);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback(
    (message: string, type: ToastType, opcoes?: ToastOpcoes) => {
      const id = ++_id;
      setToasts((prev) => [...prev, { id, message, type }]);
      const fechar = () => setToasts((prev) => prev.filter((t) => t.id !== id));
      if (opcoes?.ateAgir) {
        ouvirPrimeiraAcao(window, fechar);
        return;
      }
      setTimeout(fechar, 3200);
    },
    []
  );

  const success = useCallback((msg: string) => show(msg, "success"), [show]);
  const error = useCallback(
    (msg: string, opcoes?: ToastOpcoes) => show(msg, "error", opcoes),
    [show]
  );

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      {/* Toasts rendered above BottomNav */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: "88px",
          left: "16px",
          right: "16px",
          zIndex: 300,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-fade-up"
            style={{
              background:
                t.type === "success"
                  ? "rgb(0 200 100 / 0.1)"
                  : "rgb(255 60 60 / 0.1)",
              border: `1px solid ${
                t.type === "success"
                  ? "rgb(0 200 100 / 0.28)"
                  : "rgb(255 60 60 / 0.28)"
              }`,
              borderRadius: "14px",
              padding: "13px 16px",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              color:
                t.type === "success" ? "rgb(60 210 120)" : "rgb(255 90 90)",
              fontSize: "14px",
              fontWeight: 600,
              boxShadow: "0 4px 24px rgb(0 0 0 / 0.3)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>
              {t.type === "success" ? "✓" : "✕"}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
