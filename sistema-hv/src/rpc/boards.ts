// RPC — A3: Múltiplos Kanbans (boards/listas) por TEMA.
// Leitura: qualquer autenticado. CRUD de board/etapas = módulo sistema (config).
// Adicionar/mover caso em board = módulo operacional (edit) — é fluxo do caso.

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  addCaseToBoard,
  createBoard,
  createBoardStage,
  listBoards,
  listCaseBoards,
  listCasesByBoard,
  listStagesByBoard,
  moveCaseBetweenBoards,
  moveCaseInBoard,
  removeCaseFromBoard,
  reorderBoardStages,
  reorderBoards,
  softDeleteBoard,
  softDeleteBoardStage,
  updateBoard,
  updateBoardStage,
} from "@/lib/board-service";
import { AuthError, requireAuth, requireModule } from "@/lib/supabase/auth-guard";

function run<T>(
  guard: () => Promise<{ id: string }>,
  fn: (userId: string) => Promise<T>,
): Promise<T> {
  return (async () => {
    try {
      const { id: userId } = await guard();
      return await fn(userId);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      const status = (err as { status?: number })?.status;
      setResponseStatus(typeof status === "number" ? status : 500);
      throw err instanceof Error ? new Error(err.message) : err;
    }
  })();
}

const handle = <T>(fn: (userId: string) => Promise<T>) => run(() => requireAuth(), fn);
const handleSistema = <T>(fn: (userId: string) => Promise<T>) =>
  run(() => requireModule("sistema", "edit"), fn);
const handleOp = <T>(fn: (userId: string) => Promise<T>) =>
  run(() => requireModule("operacional", "edit"), fn);

// ------------------------------------------------------------------- Boards
export const listBoardsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ serviceTypeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => listBoards(data.serviceTypeId)));

export const createBoardFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        service_type_id: z.string().uuid(),
        label: z.string().min(1),
        ordem: z.number().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => handleSistema(() => createBoard(data)));

export const updateBoardFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          label: z.string().min(1).optional(),
          ordem: z.number().optional(),
          active: z.boolean().optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => handleSistema(() => updateBoard(data.id, data.patch)));

export const reorderBoardsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().uuid()) }).parse(d))
  .handler(async ({ data }) => handleSistema(() => reorderBoards(data.ids)));

export const deleteBoardFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handleSistema(() => softDeleteBoard(data.id)));

// ----------------------------------------------------------- Etapas por board
export const listBoardStagesFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ boardId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => listStagesByBoard(data.boardId)));

export const createBoardStageFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        board_id: z.string().uuid(),
        slug: z.string().min(1),
        label: z.string().min(1),
        stage_role: z.enum(["normal", "won", "lost", "closed"]).optional(),
        ordem: z.number().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => handleSistema(() => createBoardStage(data)));

export const updateBoardStageFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          label: z.string().min(1).optional(),
          ordem: z.number().optional(),
          stage_role: z.enum(["normal", "won", "lost", "closed"]).optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => handleSistema(() => updateBoardStage(data.id, data.patch)));

export const reorderBoardStagesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().uuid()) }).parse(d))
  .handler(async ({ data }) => handleSistema(() => reorderBoardStages(data.ids)));

export const deleteBoardStageFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handleSistema(() => softDeleteBoardStage(data.id)));

// ------------------------------------------------------------- Caso × board
export const listCasesByBoardFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ boardId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle((userId) => listCasesByBoard(data.boardId, userId)));

export const addCaseToBoardFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ caseId: z.string().uuid(), boardId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) =>
    handleOp((userId) => addCaseToBoard(data.caseId, data.boardId, userId)),
  );

// AJUSTE #2 (item 5) — boards em que o caso já está (custom); alimenta o seletor
// de destino do Mover/Duplicar (exclui os que já contêm o caso).
export const listCaseBoardsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => listCaseBoards(data.caseId)));

// AJUSTE #2 (item 5) — remove o caso de um board custom.
export const removeCaseFromBoardFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ caseId: z.string().uuid(), boardId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) =>
    handleOp((userId) => removeCaseFromBoard(data.caseId, data.boardId, userId)),
  );

// AJUSTE #2 (item 5) — MOVER entre kanbans (add no destino + sai da origem custom).
export const moveCaseBetweenBoardsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        toBoardId: z.string().uuid(),
        fromBoardId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handleOp((userId) =>
      moveCaseBetweenBoards(data.caseId, data.toBoardId, data.fromBoardId ?? null, userId),
    ),
  );

export const moveCaseInBoardFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        boardId: z.string().uuid(),
        stageId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handleOp((userId) => moveCaseInBoard(data.caseId, data.boardId, data.stageId, userId)),
  );
