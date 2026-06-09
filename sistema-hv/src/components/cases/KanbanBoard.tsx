import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState, type ReactNode } from "react";

import { Eyebrow } from "@/components/hv/primitives";
import { Skeleton } from "@/components/ui/skeleton";

export type KanbanColumn<C extends string> = {
  id: C;
  label: string;
  /** Cor da borda/contagem da coluna (CSS var ou hex). */
  toneColor: string;
};

type KanbanBoardProps<TItem, C extends string> = {
  columns: KanbanColumn<C>[];
  items: TItem[];
  getId: (item: TItem) => string;
  getColumn: (item: TItem) => C;
  renderCard: (item: TItem) => ReactNode;
  /** Chamado quando um card é solto numa coluna diferente da de origem. */
  onMove: (id: string, to: C) => void;
  isLoading?: boolean;
  /**
   * Largura FIXA de cada coluna em px (default 300, faixa confortável 280–320).
   * As colunas NÃO esticam (sem flex:1) — ficam com largura constante, separadas
   * por gap, e o board rola horizontalmente (overflow-x) quando há muitas.
   */
  columnWidth?: number;
};

/**
 * Board Kanban genérico com drag-and-drop (arrastar card entre colunas).
 *
 * - Clique sem arrastar continua funcionando (ex: o <Link> do card navega):
 *   o PointerSensor só inicia o drag depois de 8px de movimento.
 * - Soltar numa coluna diferente dispara onMove(id, novaColuna).
 * - A persistência/optimistic-update fica a cargo de quem passa onMove.
 */
export function KanbanBoard<TItem, C extends string>({
  columns,
  items,
  getId,
  getColumn,
  renderCard,
  onMove,
  isLoading = false,
  columnWidth = 300,
}: KanbanBoardProps<TItem, C>) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const grouped = new Map<C, TItem[]>();
  for (const col of columns) grouped.set(col.id, []);
  for (const item of items) {
    const col = getColumn(item);
    if (grouped.has(col)) grouped.get(col)!.push(item);
  }

  const activeItem = activeId ? (items.find((i) => getId(i) === activeId) ?? null) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const from = active.data.current?.column as C | undefined;
    const to = over.id as C;
    if (!to || from === to) return;
    onMove(String(active.id), to);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="overflow-x-auto -mx-1 pb-4">
        <div className="flex items-start gap-4 px-1">
          {columns.map((col) => {
            const colItems = grouped.get(col.id) ?? [];
            return (
              <DroppableColumn
                key={col.id}
                column={col}
                count={colItems.length}
                width={columnWidth}
              >
                {isLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-[10px]" />
                  ))
                ) : colItems.length === 0 ? (
                  <div className="py-2.5 text-center text-[11px] text-[var(--ink-400)] italic select-none">
                    Vazio
                  </div>
                ) : (
                  colItems.map((item) => (
                    <DraggableCard
                      key={getId(item)}
                      id={getId(item)}
                      column={col.id}
                      isActive={getId(item) === activeId}
                    >
                      {renderCard(item)}
                    </DraggableCard>
                  ))
                )}
              </DroppableColumn>
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="rotate-2 cursor-grabbing opacity-95 shadow-xl">
            {renderCard(activeItem)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DroppableColumn<C extends string>({
  column,
  count,
  width,
  children,
}: {
  column: KanbanColumn<C>;
  count: number;
  width: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col shrink-0" style={{ width }}>
      <div
        className="flex items-center justify-between gap-2 px-0.5 pb-2 mb-2.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Eyebrow>{column.label}</Eyebrow>
        <span
          className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[10.5px] font-semibold tabular shrink-0"
          style={{
            background: `color-mix(in srgb, ${column.toneColor} 12%, transparent)`,
            color: column.toneColor,
          }}
        >
          {count}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 rounded-[10px] transition-colors min-h-[48px] ${
          isOver
            ? "bg-[rgba(152,120,20,0.08)] outline-2 outline-dashed outline-[rgba(152,120,20,0.4)]"
            : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function DraggableCard({
  id,
  column,
  isActive,
  children,
}: {
  id: string;
  column: string;
  isActive: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, attributes, listeners } = useDraggable({
    id,
    data: { column },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`touch-none ${isActive ? "opacity-40" : ""}`}
    >
      {children}
    </div>
  );
}
