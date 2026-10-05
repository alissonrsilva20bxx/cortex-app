import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "../styles/globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

// Telas de abertura do PWA no iOS (ver app/pwa-splash/route.tsx): uma por
// tamanho de iPhone em retrato — [largura CSS, altura CSS, densidade]. O
// iOS só usa a imagem cuja media query bate EXATAMENTE com o aparelho.
const IOS_SPLASH_SCREENS: Array<[number, number, number]> = [
  [440, 956, 3], // 16/17 Pro Max
  [430, 932, 3], // 14 Pro Max, 15/16 Plus, 15 Pro Max
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [420, 912, 3], // Air
  [414, 896, 3], // XS Max, 11 Pro Max
  [414, 896, 2], // XR, 11
  [414, 736, 3], // 6s/7/8 Plus
  [402, 874, 3], // 16 Pro, 17, 17 Pro
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [390, 844, 3], // 12, 13, 14, 16e
  [375, 812, 3], // X, XS, 11 Pro, 12/13 mini
  [375, 667, 2], // 6/7/8, SE 2/3
];

export const metadata: Metadata = {
  title: "JobApp",
  description: "Gerenciador de atendimentos e finanças.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JobApp",
    startupImage: IOS_SPLASH_SCREENS.map(([w, h, dpr]) => ({
      url: `/pwa-splash?w=${w * dpr}&h=${h * dpr}`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
    })),
  },
  icons: {
    icon: "/pwa-icon?size=512",
    apple: "/pwa-icon?size=512",
  },
  formatDetection: {
    telephone: false,
  },
  // Par moderno do `apple-mobile-web-app-capable` (Chrome/Android avisa
  // que o da Apple sozinho está obsoleto).
  other: {
    "mobile-web-app-capable": "yes",
  },
};

// Runs before paint to avoid theme flash
const themeScript = `
  try {
    var t = localStorage.getItem('jobapp-theme');
    var valid = ['grafite', 'pink-neon', 'purple', 'crimson', 'ocean', 'gold', 'emerald', 'midnight'];
    if (t && valid.includes(t)) document.documentElement.setAttribute('data-theme', t);
    var m = localStorage.getItem('jobapp-mode');
    if (m === 'light') {
      document.documentElement.setAttribute('data-mode', 'light');
      // "black-translucent" pinta o relógio/bateria do iOS sempre em
      // BRANCO por cima do app -- no modo claro (fundo #f5f5f7) a barra
      // de status ficava invisível. "default" = texto preto sobre o
      // fundo claro. O iOS lê essa meta na abertura do PWA, então troca
      // assim que ela existir no <head> (antes do primeiro paint).
      var fixStatusBar = function () {
        var sb = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
        if (sb) sb.setAttribute('content', 'default');
        var tc = document.querySelector('meta[name="theme-color"]');
        if (tc) tc.setAttribute('content', '#f5f5f7');
        return !!sb;
      };
      if (!fixStatusBar()) document.addEventListener('DOMContentLoaded', fixStatusBar);
    }
  } catch(e) {}
`;

// Register service worker after page load
const swScript = `
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' });
    });
  }
`;

// Dev mode never registers a SW (see below), but a SW registered by an
// earlier prod build or dev session may still be sitting in the browser,
// silently serving stale dev bundles. Tear it down on every dev load.
const swTeardownScript = `
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) { r.unregister(); });
    });
  }
  if ('caches' in window) {
    caches.keys().then(function (keys) {
      keys.forEach(function (k) { caches.delete(k); });
    });
  }
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `no-scrollbar` (styles/globals.css) vai no <html>, não só no <main>.
  // O indicador visível de rolagem confirmado manualmente é do
  // VIEWPORT/documento -- verificado ao vivo (Playwright): o `<main
  // overflow-y-auto>` de `app/page.tsx` nunca chega a overflow-ar sozinho
  // (scrollHeight === clientHeight; ver memória "main nunca rola, quem
  // rola é window"), quem rola de verdade é `document.documentElement`
  // (scrollHeight > innerHeight). `<main>` também tem a classe (defesa
  // extra pro dia em que ele passar a rolar sozinho de verdade), mas
  // sozinha ela não escondia a barra real.
  return (
    <html
      lang="pt-BR"
      data-theme="pink-neon"
      className={`${jakarta.variable} no-scrollbar`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
        {/* Only in production: dev chunk filenames aren't content-hashed,
            so a cache-first SW would serve stale JS across dev sessions.
            In dev, actively tear down any SW/cache left over from a
            previous session instead. */}
        {process.env.NODE_ENV === "production" ? (
          <script dangerouslySetInnerHTML={{ __html: swScript }} />
        ) : (
          <script dangerouslySetInnerHTML={{ __html: swTeardownScript }} />
        )}
      </body>
    </html>
  );
}
