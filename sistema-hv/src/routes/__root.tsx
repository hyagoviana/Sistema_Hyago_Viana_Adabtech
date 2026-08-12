import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useNavigate,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { AppLayout } from "@/components/hv/AppLayout";
import { initThemeOverrides } from "@/components/settings/AppearanceSettings";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Hyago Viana Advocacia" },
      {
        name: "description",
        content:
          "Plataforma premium de gestão jurídica para FIES, Mais Médicos, Residência e CFM/CRM.",
      },
      { name: "author", content: "Hyago Viana Advocacia" },
      { property: "og:title", content: "Hyago Viana Advocacia · Sistema de Gestão Jurídica" },
      {
        property: "og:description",
        content:
          "Plataforma premium de gestão jurídica para FIES, Mais Médicos, Residência e CFM/CRM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Hyago Viana Advocacia · Sistema de Gestão Jurídica" },
      {
        name: "twitter:description",
        content:
          "Plataforma premium de gestão jurídica para FIES, Mais Médicos, Residência e CFM/CRM.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/469e1847-cdcb-4b21-88d7-c35d3bd83e17/id-preview-205594be--1bd04073-66c8-49ea-9c46-cf61e145fed7.lovable.app-1778874656149.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/469e1847-cdcb-4b21-88d7-c35d3bd83e17/id-preview-205594be--1bd04073-66c8-49ea-9c46-cf61e145fed7.lovable.app-1778874656149.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      // Fontes agora são self-hosted via @fontsource (importadas em styles.css);
      // não há mais dependência do Google Fonts CDN.
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    initThemeOverrides();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootLayout />
      </AuthProvider>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}

function RootLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();
  // Telas de autenticação: redirecionam para /hoje se já houver sessão.
  const isAuthPage = path === "/entrar" || path === "/login";
  // Rotas públicas que NÃO redirecionam usuário logado (convidado/recovery entra com sessão).
  const isPublic =
    isAuthPage ||
    path === "/recuperar-senha" ||
    path === "/nova-senha" ||
    path === "/definir-senha";

  // Senha provisória: enquanto a flag estiver ligada, o colaborador é OBRIGADO a
  // definir uma senha nova. Bloqueia todo o app e desvia para /nova-senha (que,
  // já com a sessão ativa, mostra o formulário de definição). Ao concluir, a tela
  // faz um reload completo → o perfil recarrega com a flag zerada e libera.
  const mustChangePassword = !!session && profile?.must_change_password === true;

  useEffect(() => {
    if (loading) return;
    if (!session && !isPublic) navigate({ to: "/login" });
    if (session && isAuthPage) navigate({ to: "/hoje" });
    if (mustChangePassword && path !== "/nova-senha") navigate({ to: "/nova-senha" });
  }, [loading, session, isAuthPage, isPublic, mustChangePassword, path, navigate]);

  if (isPublic) return <Outlet />;

  // Trava dura: nunca renderiza o app com senha provisória pendente (evita flash
  // do conteúdo antes do redirecionamento do efeito acima).
  if (mustChangePassword) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--bg-page)" }}
      >
        <div className="text-sm text-[var(--ink-400)]">Redirecionando para a definição de senha…</div>
      </div>
    );
  }
  if (loading || !session) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--bg-page)" }}
      >
        <div className="text-sm text-[var(--ink-400)]">Carregando…</div>
      </div>
    );
  }
  return <AppLayout />;
}
