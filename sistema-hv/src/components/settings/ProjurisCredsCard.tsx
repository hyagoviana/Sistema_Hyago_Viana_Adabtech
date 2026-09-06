// CREDENCIAIS DA API DO PROJURIS — configuração de SISTEMA, não do motor.
//
// Doc "21.08 _ Controladoria": "isso da API tem que ir para um espaço de
// configurações geral no sistema para tirar margem de erro humano". Quem opera a
// controladoria no dia a dia não precisa (nem deve) esbarrar em credencial.
//
// Segurança preservada da versão anterior: os campos de SEGREDO (senha, token,
// api key) são WRITE-ONLY. O valor nunca vem do servidor — a tela só sabe se
// "está definido" (flag), e campo em branco significa "não alterar".

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Key, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDistributionCreds, useSaveDistributionCreds } from "@/hooks/useDistribuicao";
import { usePodeEditar } from "@/hooks/usePermissions";

export function ProjurisCredsCard() {
  const podeEditar = usePodeEditar("controladoria");
  const { data: creds, isLoading: credsLoading } = useDistributionCreds();
  const saveCreds = useSaveDistributionCreds();

  const [projurisBaseUrl, setProjurisBaseUrl] = useState("");
  const [projurisAuthType, setProjurisAuthType] = useState<string>("oauth2_password");
  const [projurisUsername, setProjurisUsername] = useState("");
  const [projurisPassword, setProjurisPassword] = useState("");
  const [projurisToken, setProjurisToken] = useState("");
  const [projurisApiKey, setProjurisApiKey] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (creds) {
      setProjurisBaseUrl(creds.projuris_base_url ?? "");
      setProjurisAuthType(creds.projuris_auth_type ?? "oauth2_password");
      setProjurisUsername(creds.projuris_username ?? "");
      // Segredos NUNCA vêm do servidor — começam vazios (= "não alterar").
    }
  }, [creds]);

  const savingCredentials = saveCreds.isPending;
  const hasCredentials = !!creds?.projuris_base_url;

  async function saveCredentials() {
    if (!projurisBaseUrl) {
      toast.error("URL base é obrigatória");
      return;
    }
    try {
      await saveCreds.mutateAsync({
        projuris_base_url: projurisBaseUrl,
        projuris_auth_type: projurisAuthType,
        projuris_username:
          projurisAuthType === "basic" || projurisAuthType === "oauth2_password"
            ? projurisUsername
            : null,
        projuris_password:
          (projurisAuthType === "basic" || projurisAuthType === "oauth2_password") &&
          projurisPassword
            ? projurisPassword
            : undefined,
        projuris_token: projurisAuthType === "bearer" && projurisToken ? projurisToken : undefined,
        projuris_api_key:
          projurisAuthType === "apikey" && projurisApiKey ? projurisApiKey : undefined,
      });
      // Limpa os segredos da memória depois de gravar.
      setProjurisPassword("");
      setProjurisToken("");
      setProjurisApiKey("");
      toast.success("Credenciais salvas com sucesso");
    } catch {
      toast.error("Erro ao salvar credenciais");
    }
  }

  return (
    <Card className={hasCredentials ? "border-green-200" : "border-amber-200"}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Key className="h-4 w-4" />
          Credenciais ProJuris
          {hasCredentials ? (
            <Badge className="bg-green-100 text-green-700 text-xs ml-2">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Configurado
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-700 text-xs ml-2">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Pendente
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Conexao com a API do ProJuris para sincronizar tarefas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {credsLoading ? (
          <Skeleton className="h-[150px]" />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>URL Base da API</Label>
                <Input
                  placeholder="https://app.projuris.com.br/api/v1"
                  value={projurisBaseUrl}
                  onChange={(e) => setProjurisBaseUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Ex: https://app.projuris.com.br/api/v1
                </p>
              </div>
              <div>
                <Label>Tipo de Autenticacao</Label>
                <Select value={projurisAuthType} onValueChange={setProjurisAuthType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oauth2_password">OAuth2 (usuario/senha)</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="apikey">API Key</SelectItem>
                    <SelectItem value="basic">Basic Auth (usuario/senha)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {projurisAuthType === "bearer" && (
              <div>
                <Label>Token</Label>
                <div className="relative">
                  <Input
                    type={showSecret ? "text" : "password"}
                    placeholder={
                      creds?.has_token
                        ? "•••• definido · digite para substituir"
                        : "não definido · cole o token de acesso"
                    }
                    value={projurisToken}
                    onChange={(e) => setProjurisToken(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Deixe em branco para não alterar o token já gravado.
                </p>
              </div>
            )}

            {projurisAuthType === "apikey" && (
              <div>
                <Label>API Key</Label>
                <div className="relative">
                  <Input
                    type={showSecret ? "text" : "password"}
                    placeholder={
                      creds?.has_api_key
                        ? "•••• definido · digite para substituir"
                        : "não definido · cole a API Key"
                    }
                    value={projurisApiKey}
                    onChange={(e) => setProjurisApiKey(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Deixe em branco para não alterar a API Key já gravada.
                </p>
              </div>
            )}

            {(projurisAuthType === "basic" || projurisAuthType === "oauth2_password") && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Usuario</Label>
                  <Input
                    placeholder="usuario@projuris"
                    value={projurisUsername}
                    onChange={(e) => setProjurisUsername(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Senha</Label>
                  <div className="relative">
                    <Input
                      type={showSecret ? "text" : "password"}
                      placeholder={
                        creds?.has_password
                          ? "•••• definido · digite para substituir"
                          : "não definido"
                      }
                      value={projurisPassword}
                      onChange={(e) => setProjurisPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Deixe em branco para não alterar a senha já gravada.
                    {projurisAuthType === "oauth2_password"
                      ? " client_id/secret ficam no ambiente (.env)."
                      : ""}
                  </p>
                </div>
              </div>
            )}

            {podeEditar && (
              <Button onClick={saveCredentials} disabled={savingCredentials || !projurisBaseUrl}>
                {savingCredentials ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Key className="h-4 w-4 mr-1" />
                )}
                Salvar Credenciais
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
