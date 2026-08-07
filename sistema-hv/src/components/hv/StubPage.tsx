import * as React from "react";
import { PageHeader, Card, Eyebrow, Btn, AlertStrip } from "./primitives";

export function StubPage({
  crumbs,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  crumbs: { label: string; to?: string }[];
  eyebrow: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  void crumbs;
  return (
    <div className="page-container">
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {children ?? (
        <>
          <AlertStrip tone="warning" title="Tela em construção visual">
            O layout final desta seção será detalhado na próxima iteração. Estrutura, navegação e tokens já estão aplicados.
          </AlertStrip>
          <div className="my-6" style={{ borderTop: "1px solid #f5f5f5" }} />
          <div className="grid md:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <Eyebrow>Bloco {i}</Eyebrow>
                <div className="kpi-number text-[28px] mt-3">·</div>
                <div className="text-[12.5px] text-muted-foreground mt-2">Conteúdo desta seção em breve.</div>
              </Card>
            ))}
          </div>
          <div className="mt-6">
            <Btn variant="gold">Ação principal</Btn>
          </div>
        </>
      )}
    </div>
  );
}
