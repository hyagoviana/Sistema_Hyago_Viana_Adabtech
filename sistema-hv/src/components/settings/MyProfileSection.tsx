// Edição do próprio perfil: nome e telefone. O e-mail e o papel são só leitura
// (o papel é gerido pelo admin; o e-mail é a identidade de login).
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMyProfile, useUpdateUserProfile } from "@/hooks/useUsers";

export function MyProfileSection() {
  const { data: me } = useMyProfile();
  const update = useUpdateUserProfile();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (me) {
      setFullName(me.full_name ?? "");
      setPhone((me as { phone?: string | null }).phone ?? "");
    }
  }, [me]);

  const dirty =
    me != null &&
    (fullName !== (me.full_name ?? "") ||
      phone !== ((me as { phone?: string | null }).phone ?? ""));

  async function salvar() {
    try {
      await update.mutateAsync({ full_name: fullName.trim() || null, phone: phone.trim() || null });
      toast.success("Perfil atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar perfil");
    }
  }

  return (
    <section className="card-editorial !p-5 mb-5">
      <h3 className="text-[15px] font-semibold text-[var(--navy)] mb-3">Meus dados</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Nome completo</Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Seu nome"
          />
        </div>
        <div>
          <Label>Telefone</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(00) 00000-0000"
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button onClick={salvar} disabled={!dirty || update.isPending}>
          {update.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </section>
  );
}
