// Tabela de auditoria (AU1) — usada nos DOIS lugares que o owner pediu: o menu
// global (/auditoria) e o painel dentro do caso. A diferença é só o `caseId`
// fixo e os filtros escondidos.
//
// "tudo precisa ter para pesquisa, até no caso e no motor também" (owner, 26/08).

import { useState } from "react";
import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuditActions, useAuditEvents } from "@/hooks/useAuditoria";
import { useUsers } from "@/hooks/useUsers";
import { renderEventLabel } from "@/components/cases/case-event-label";
import { formatStageSlug } from "@/lib/cases/stage-label";

const TODOS = "__todos__";

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Valor legível de um lado da mudança. `null`/vazio vira "—" (nunca em branco). */
function valor(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function AuditTable({
  caseId = null,
  compact = false,
}: {
  /** Fixa a auditoria em um caso (painel da ficha). */
  caseId?: string | null;
  /** Esconde os filtros que não fazem sentido dentro do caso. */
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [userId, setUserId] = useState(TODOS);
  const [action, setAction] = useState(TODOS);
  const [cursor, setCursor] = useState<string | null>(null);

  const { data, isLoading, isError } = useAuditEvents({
    caseId,
    q: q.trim() || null,
    from: de || null,
    to: ate || null,
    userId: userId === TODOS ? null : userId,
    action: action === TODOS ? null : action,
    cursor,
  });
  const { data: actions } = useAuditActions();
  const { data: users } = useUsers();

  const itens = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Buscar</Label>
          <Input
            className="w-[230px]"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(null);
            }}
            placeholder="Campo, valor, caso ou cliente"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">De</Label>
          <Input
            type="date"
            className="w-[150px]"
            value={de}
            onChange={(e) => {
              setDe(e.target.value);
              setCursor(null);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Até</Label>
          <Input
            type="date"
            className="w-[150px]"
            value={ate}
            onChange={(e) => {
              setAte(e.target.value);
              setCursor(null);
            }}
          />
        </div>
        {!compact && (
          <div className="space-y-1">
            <Label className="text-xs">Quem</Label>
            <Select
              value={userId}
              onValueChange={(v) => {
                setUserId(v);
                setCursor(null);
              }}
            >
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {(users ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Tipo de ação</Label>
          <Select
            value={action}
            onValueChange={(v) => {
              setAction(v);
              setCursor(null);
            }}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas</SelectItem>
              {(actions ?? []).map((a) => (
                <SelectItem key={a} value={a}>
                  {formatStageSlug(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-md border border-[var(--danger)] p-6 text-[13px]">
          Não foi possível carregar a auditoria.
        </div>
      ) : itens.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-[13px] text-muted-foreground">
          Nada registrado neste filtro.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">Quando</th>
                <th className="py-2 pr-3">Quem</th>
                {!caseId && <th className="py-2 pr-3">Caso</th>}
                <th className="py-2 pr-3">O que aconteceu</th>
                <th className="py-2">Mudança</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((e) => (
                <tr key={e.id} className="border-b border-[var(--border)] align-top">
                  <td className="py-2.5 pr-3 whitespace-nowrap">{fmtDataHora(e.created_at)}</td>
                  <td className="py-2.5 pr-3">{e.user_name ?? "sistema"}</td>
                  {!caseId && (
                    <td className="py-2.5 pr-3">
                      <Link
                        to="/casos/$id"
                        params={{ id: e.case_id }}
                        className="text-[var(--gold-700)] hover:underline"
                      >
                        {e.case_code ?? "·"}
                      </Link>
                      {e.client_name && (
                        <div className="text-[12px] text-muted-foreground">{e.client_name}</div>
                      )}
                    </td>
                  )}
                  <td className="py-2.5 pr-3">{renderEventLabel(e as never)}</td>
                  <td className="py-2.5">
                    {e.mudancas.length === 0 ? (
                      <span className="text-muted-foreground">·</span>
                    ) : (
                      <div className="space-y-0.5">
                        {e.mudancas.map((m) => (
                          <div key={m.campo} className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">
                              {formatStageSlug(m.campo)}
                            </Badge>
                            <span className="text-muted-foreground">{valor(m.de)}</span>
                            <span className="text-[var(--gold-700)]">→</span>
                            <span className="font-medium">{valor(m.para)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação por cursor — a tabela de eventos cresce todo dia. */}
      <div className="flex items-center gap-2">
        {cursor && (
          <Button variant="outline" size="sm" onClick={() => setCursor(null)}>
            ← Voltar ao início
          </Button>
        )}
        {data?.nextCursor && (
          <Button variant="outline" size="sm" onClick={() => setCursor(data.nextCursor)}>
            Ver mais antigos →
          </Button>
        )}
      </div>
    </div>
  );
}
