import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSetUserModulePerms, useUserModulePerms } from "@/hooks/usePermissions";

import { ModulePermsGrid, type ModulePermsValue } from "./ModulePermsGrid";

// Editor de permissões por aba de um usuário JÁ existente (R3, 2026-07-19).
// Autossuficiente: carrega os overrides do usuário, deixa editar e salva com o
// próprio botão (desacoplado do "Salvar" do perfil). Admin-only pelo RPC.
export function UserModulePermsEditor({ userId }: { userId: string }) {
  const { data, isLoading } = useUserModulePerms(userId);
  const save = useSetUserModulePerms();
  const [perms, setPerms] = useState<ModulePermsValue>({});
  const [dirty, setDirty] = useState(false);

  // Sincroniza o estado local com o que veio do servidor (e após salvar, quando a
  // query é invalidada e re-busca). Como `data` só muda de referência nesses
  // momentos, as edições do usuário (que só mexem em `perms`) não são perdidas.
  useEffect(() => {
    if (data) {
      setPerms(data);
      setDirty(false);
    }
  }, [data]);

  async function handleSave() {
    try {
      await save.mutateAsync({ userId, perms });
      toast.success("Permissões por aba atualizadas.");
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar permissões");
    }
  }

  if (isLoading) {
    return <Skeleton className="h-40 rounded-md" />;
  }

  return (
    <div className="space-y-3">
      <ModulePermsGrid
        value={perms}
        onChange={(next) => {
          setPerms(next);
          setDirty(true);
        }}
        disabled={save.isPending}
      />
      <Button
        variant="outline"
        className="w-full"
        onClick={handleSave}
        disabled={!dirty || save.isPending}
      >
        {save.isPending ? "Salvando permissões…" : "Salvar permissões"}
      </Button>
    </div>
  );
}
