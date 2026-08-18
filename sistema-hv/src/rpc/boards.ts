// RPC — A3: Múltiplos Kanbans (boards/listas) por TEMA.
// Leitura: qualquer autenticado. CRUD de board/etapas = módulo sistema (config).
// Adicionar/mover caso em board = módulo operacional (edit) — é fluxo do caso.

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  addCaseToBoard,
  caseHasExclusivePosition,
  caseIdsByBoard,
  createBoard,
  createBoardStage,
  exclusiveCaseIds,
  listBoards,
  listCaseBoards,
  listCaseOperationalTrail,
  listCasesByBoard,
  listStagesByBoard,
  moveCaseBetweenBoards,
  moveCaseInBoard,
  removeCaseFromBoard,
  reorderBoardStages,
  reorderBoards,
  returnCaseToPrincipal,
  softDeleteBoard,
  softDeleteBoardStage,
  updateBoard,
  updateBoardStage,
} from "@/lib/board-service";
import { AuthError, requireAuth, requireModule } from "@/lib/supabase/auth-guard";
import { runWorkflowsFor } from "@/lib/workflow-engine";

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
        // slug é opcional: o serviço SEMPRE gera um slug interno único a partir do
        // label (libera labels duplicados e recriar-após-excluir).
        slug: z.string().optional(),
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

// TAREFA B — só os IDs dos casos num board custom (p/ filtrar a Lista client-side).
export const caseIdsByBoardFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ boardId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => caseIdsByBoard(data.boardId)));

// TAREFA B — IDs dos casos movidos exclusivamente p/ custom (p/ o filtro do
// PRINCIPAL na Lista: mostra os que NÃO estão exclusivos em custom).
export const exclusiveCaseIdsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({}).parse(d ?? {}))
  .handler(async () => handle(() => exclusiveCaseIds()));

export const addCaseToBoardFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        boardId: z.string().uuid(),
        exclusive: z.boolean().optional(),
        stageId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handleOp((userId) =>
      addCaseToBoard(data.caseId, data.boardId, {
        exclusive: data.exclusive,
        stageId: data.stageId ?? null,
        triggeredBy: userId,
      }),
    ),
  );

// AJUSTE #2 (item 5) — boards em que o caso já está (custom); alimenta o seletor
// de destino do Mover/Duplicar (exclui os que já contêm o caso).
export const listCaseBoardsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => listCaseBoards(data.caseId)));

// C3 (2026-08-05) — rastro operacional agregado (multi-kanban) do caso: principal
// + boards custom com labels resolvidos. Leitura (requireAuth). READ-ONLY.
export const listCaseOperationalTrailFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => listCaseOperationalTrail(data.caseId)));

// A4 — o caso está movido exclusivamente para fora do principal?
export const caseHasExclusivePositionFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => caseHasExclusivePosition(data.caseId)));

// A4 — "voltar ao principal": remove todas as posições custom do caso.
export const returnCaseToPrincipalFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handleOp((userId) => returnCaseToPrincipal(data.caseId, userId)));

// AJUSTE #2 (item 5) — remove o caso de um board custom.
export const removeCaseFromBoardFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ caseId: z.string().uuid(), boardId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) =>
    handleOp((userId) => removeCaseFromBoard(data.caseId, data.boardId, userId)),
  );

// AJUSTE #2 (item 5) + A4 — MOVER/DUPLICAR entre kanbans.
//   • toBoard principal → volta ao principal (limpa posições custom).
//   • toBoard custom + exclusive=true → move exclusivo (sai do principal/outros).
//   • toBoard custom + exclusive=false → duplica (aditivo).
//   • stageId → etapa escolhida no board de destino (item 3).
export const moveCaseBetweenBoardsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        toBoardId: z.string().uuid(),
        exclusive: z.boolean().optional(),
        stageId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handleOp((userId) =>
      moveCaseBetweenBoards(data.caseId, data.toBoardId, {
        exclusive: data.exclusive,
        stageId: data.stageId ?? null,
        triggeredBy: userId,
      }),
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
    handleOp(async (userId) => {
      const res = await moveCaseInBoard(data.caseId, data.boardId, data.stageId, userId);
      // #2 Workflows — gatilho status_changed no KANBAN CUSTOM (board_key = boardId).
      // Só dispara em mudança real de etapa (noop=false).
      if (res && !res.noop && res.stage_slug) {
        await runWorkflowsFor(
          data.caseId,
          "status_changed",
          { toStageSlug: res.stage_slug, boardKey: data.boardId },
          userId,
        );
      }
      return res;
    }),
  );
