import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  useCreateTemaWikiBlock,
  useDeleteTemaWikiBlock,
  useReorderTemaWikiBlocks,
  useTemaWiki,
  useUpdateTemaWikiBlock,
  type TemaWikiBlock,
  type WikiItem,
} from "@/hooks/useTemaWiki";

// C5 (Reunião 2026-08-05) — "Links úteis" / wiki por TEMA. Quadro read-only para
// todos os usuários autenticados; modo edição só para admin (config.manage). Os
// blocos são vinculados ao TEMA (mesmo quadro em qualquer kanban do tema).
//
// Item = caixinha de TEXTO (post-it) ou LINK (URL clicável, abre em nova aba).
// O `id` do item vem do servidor; aqui usamos um id local ("tmp-…") só até salvar.

type Props = {
  temaId: string | null | undefined;
  className?: string;
};

function localId(): string {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

export function TemaWikiBoard({ temaId, className }: Props) {
  const { role } = useAuth();
  const canManage = can(role, "config.manage");
  const { data: blocks, isLoading } = useTemaWiki(temaId);
  const createBlock = useCreateTemaWikiBlock(temaId ?? "");

  if (!temaId) return null;

  const list = (blocks ?? []) as unknown as TemaWikiBlock[];

  // Sem blocos: nada para não-admin; CTA discreto só p/ admin.
  if (!isLoading && list.length === 0 && !canManage) return null;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[12px] uppercase tracking-wide text-muted-foreground">
          <StickyNote size={13} className="text-[var(--gold)]" />
          Links úteis
        </div>
        {canManage && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              createBlock.mutate(
                { titulo: "Links úteis", itens: [] },
                {
                  onError: (err) =>
                    toast.error(err instanceof Error ? err.message : "Falha ao criar quadro"),
                },
              )
            }
            disabled={createBlock.isPending}
          >
            {createBlock.isPending ? (
              <Loader2 size={13} className="mr-1 animate-spin" />
            ) : (
              <Plus size={13} className="mr-1" />
            )}
            Novo quadro
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-[12px] text-muted-foreground">Carregando…</div>
      ) : list.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border)] p-4 text-[12px] text-muted-foreground">
          Nenhum quadro ainda. Crie o primeiro com "Novo quadro".
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((b, i) => (
            <WikiBlockCard
              key={b.id}
              temaId={temaId}
              block={b}
              canManage={canManage}
              isFirst={i === 0}
              isLast={i === list.length - 1}
              allIds={list.map((x) => x.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WikiBlockCard({
  temaId,
  block,
  canManage,
  isFirst,
  isLast,
  allIds,
}: {
  temaId: string;
  block: TemaWikiBlock;
  canManage: boolean;
  isFirst: boolean;
  isLast: boolean;
  allIds: string[];
}) {
  const updateBlock = useUpdateTemaWikiBlock(temaId);
  const deleteBlock = useDeleteTemaWikiBlock(temaId);
  const reorderBlocks = useReorderTemaWikiBlocks(temaId);
  const [editing, setEditing] = useState(false);
  const [titulo, setTitulo] = useState(block.titulo);
  const [itens, setItens] = useState<WikiItem[]>(() =>
    Array.isArray(block.itens) ? block.itens : [],
  );

  const items: WikiItem[] = Array.isArray(block.itens) ? block.itens : [];

  function startEdit() {
    setTitulo(block.titulo);
    setItens(Array.isArray(block.itens) ? block.itens.map((it) => ({ ...it })) : []);
    setEditing(true);
  }

  function save() {
    const cleaned = itens
      .map((it) => ({ ...it, valor: it.valor.trim(), rotulo: it.rotulo?.trim() || undefined }))
      .filter((it) => it.valor.length > 0);
    updateBlock.mutate(
      { id: block.id, patch: { titulo: titulo.trim() || "Links úteis", itens: cleaned } },
      {
        onSuccess: () => setEditing(false),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao salvar"),
      },
    );
  }

  function move(dir: -1 | 1) {
    const idx = allIds.indexOf(block.id);
    const next = idx + dir;
    if (next < 0 || next >= allIds.length) return;
    const reordered = [...allIds];
    [reordered[idx], reordered[next]] = [reordered[next], reordered[idx]];
    reorderBlocks.mutate(reordered);
  }

  return (
    <div className="card-hero p-4">
      {editing ? (
        <div className="space-y-2.5">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título (ex.: Links úteis, Manuais, Observações)"
            className="h-8 text-[13px] font-semibold"
          />
          <div className="space-y-2">
            {itens.map((it, idx) => (
              <div key={it.id} className="rounded-md border border-[var(--border)] p-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <select
                    value={it.tipo}
                    onChange={(e) =>
                      setItens((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, tipo: e.target.value as "texto" | "link" } : x,
                        ),
                      )
                    }
                    className="h-7 rounded-md border border-[var(--border)] bg-[var(--card)] text-[12px] px-1.5"
                  >
                    <option value="texto">Texto</option>
                    <option value="link">Link</option>
                  </select>
                  <span className="text-[11px] text-muted-foreground flex-1">
                    {it.tipo === "link" ? "URL (http/https)" : "Texto livre"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setItens((prev) => prev.filter((_, i) => i !== idx))}
                    title="Remover caixinha"
                    className="text-destructive/70 hover:text-destructive"
                  >
                    <X size={14} />
                  </button>
                </div>
                {it.tipo === "link" ? (
                  <>
                    <Input
                      value={it.valor}
                      onChange={(e) =>
                        setItens((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, valor: e.target.value } : x)),
                        )
                      }
                      placeholder="https://…"
                      className="h-7 text-[12px]"
                    />
                    <Input
                      value={it.rotulo ?? ""}
                      onChange={(e) =>
                        setItens((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, rotulo: e.target.value } : x)),
                        )
                      }
                      placeholder="Rótulo (opcional)"
                      className="h-7 text-[12px]"
                    />
                  </>
                ) : (
                  <Textarea
                    value={it.valor}
                    onChange={(e) =>
                      setItens((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, valor: e.target.value } : x)),
                      )
                    }
                    placeholder="Anotação / aviso…"
                    className="text-[12px] min-h-[52px]"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setItens((prev) => [...prev, { id: localId(), tipo: "texto", valor: "" }])
              }
            >
              <StickyNote size={13} className="mr-1" />
              Texto
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setItens((prev) => [...prev, { id: localId(), tipo: "link", valor: "" }])
              }
            >
              <Link2 size={13} className="mr-1" />
              Link
            </Button>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={updateBlock.isPending}>
              {updateBlock.isPending && <Loader2 size={13} className="mr-1 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="text-[14px] font-semibold text-[var(--navy)]">{block.titulo}</div>
            {canManage && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => move(-1)}
                  disabled={isFirst}
                  title="Mover para cima"
                  className="p-1 rounded text-muted-foreground hover:text-[var(--navy)] disabled:opacity-30"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  disabled={isLast}
                  title="Mover para baixo"
                  className="p-1 rounded text-muted-foreground hover:text-[var(--navy)] disabled:opacity-30"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={startEdit}
                  title="Editar quadro"
                  className="p-1 rounded text-muted-foreground hover:text-[var(--navy)]"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    deleteBlock.mutate(block.id, {
                      onError: (err) =>
                        toast.error(err instanceof Error ? err.message : "Falha ao excluir"),
                    })
                  }
                  title="Excluir quadro"
                  className="p-1 rounded text-destructive/70 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
          {items.length === 0 ? (
            <div className="text-[12px] text-muted-foreground">
              {canManage ? "Vazio — clique no lápis para adicionar caixinhas." : "Sem itens."}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {items.map((it) => (
                <li key={it.id} className="text-[13px]">
                  {it.tipo === "link" ? (
                    <a
                      href={it.valor}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[var(--navy)] hover:text-[var(--gold)] underline decoration-[var(--gold)]/40 underline-offset-2 break-all"
                    >
                      <ExternalLink size={12} className="shrink-0" />
                      {it.rotulo || it.valor}
                    </a>
                  ) : (
                    <span className="text-[var(--foreground)] whitespace-pre-wrap break-words">
                      {it.valor}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
