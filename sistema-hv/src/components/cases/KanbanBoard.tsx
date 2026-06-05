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
  /** Largura de cada coluna em px (default 280). */
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
  columnWidth = 280,
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
      <div className="overflow-x-auto -mx-2 pb-4">
        <div className="flex gap-3 px-2 min-w-max">
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
                    <Skeleton key={i} className="h-24 rounded-lg" />
                  ))
                ) : colItems.length === 0 ? (
                  <div className="text-[12px] text-muted-foreground text-center py-8 italic">
                    vazio
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
    <div className="shrink-0 flex flex-col" style={{ width }}>
      <div
        className="flex items-center justify-between px-2 py-3 border-b-2 mb-3"
        style={{ borderColor: column.toneColor }}
      >
        <Eyebrow>{column.label}</Eyebrow>
        <span
          className="font-display text-[20px] font-semibold"
          style={{ color: column.toneColor }}
        >
          {String(count).padStart(2, "0")}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2.5 rounded-lg transition-colors min-h-[80px] ${
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
