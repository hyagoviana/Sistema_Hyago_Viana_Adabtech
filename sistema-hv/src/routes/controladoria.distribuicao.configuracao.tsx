import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import {
  Settings,
  Play,
  FlaskConical,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  useDistributionConfig,
  useUpdateDistributionConfig,
  useDistributionCreds,
  useSaveDistributionCreds,
  useLastBatchLog,
  useAlertsSummary30d,
} from "@/hooks/useDistribuicao";
import { usePodeEditar } from "@/hooks/usePermissions";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const supabase = getSupabaseBrowserClient();

export const Route = createFileRoute("/controladoria/distribuicao/configuracao")({
  component: ConfiguracaoPage,
});

function ConfiguracaoPage() {
  const podeEditar = usePodeEditar("controladoria");
  const { data: config, isLoading: configLoading } = useDistributionConfig();
  const { data: creds, isLoading: credsLoading } = useDistributionCreds();
  const { data: lastBatch, isLoading: batchLoading } = useLastBatchLog();
  const { data: alertsSummary } = useAlertsSummary30d();
  const updateConfig = useUpdateDistributionConfig();
  const saveCreds = useSaveDistributionCreds();

  const [mode, setMode] = useState<string>("HIGH_PRODUCTION");
  const [batchHour, setBatchHour] = useState("6");
  const [executing, setExecuting] = useState(false);
  type BatchExecutionResult = {
    status?: string;
    total_tasks?: number;
    successful?: number;
    failed?: number;
    duration_ms?: number;
  };
  const [executionResult, setExecutionResult] = useState<BatchExecutionResult | null>(null);

  // Credenciais Projuris. Nao-segredos (base_url/auth_type/username) vem da
  // config e sao editaveis. Os SEGREDOS (password/token/api_key) sao WRITE-ONLY:
  // o valor NUNCA vem do servidor; a UI so sabe se "esta definido" (flag) e grava
  // apenas o que for digitado (campo em branco = "nao alterar").
  const [projurisBaseUrl, setProjurisBaseUrl] = useState("");
  const [projurisAuthType, setProjurisAuthType] = useState<string>("oauth2_password");
  const [projurisUsername, setProjurisUsername] = useState("");
  const [projurisPassword, setProjurisPassword] = useState("");
  const [projurisToken, setProjurisToken] = useState("");
  const [projurisApiKey, setProjurisApiKey] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (config) {
      setMode(config.mode);
      setBatchHour(String(config.batch_hour));
    }
  }, [config]);

  useEffect(() => {
    if (creds) {
      setProjurisBaseUrl(creds.projuris_base_url ?? "");
      setProjurisAuthType(creds.projuris_auth_type ?? "oauth2_password");
      setProjurisUsername(creds.projuris_username ?? "");
      // Segredos NUNCA vem do servidor — campos comecam vazios (= "nao alterar").
    }
  }, [creds]);

  const savingCredentials = saveCreds.isPending;

  async function saveCredentials() {
    if (!projurisBaseUrl) {
      toast.error("URL base e obrigatoria");
      return;
    }
    try {
      // Write-only: so envia o segredo do auth_type atual E somente se algo foi
      // digitado (string vazia = "nao alterar", nao sobrescreve o gravado).
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
      // Limpa os campos de segredo apos gravar (nunca os mantemos em memoria).
      setProjurisPassword("");
      setProjurisToken("");
      setProjurisApiKey("");
      toast.success("Credenciais salvas com sucesso");
    } catch {
      toast.error("Erro ao salvar credenciais");
    }
  }

  const hasCredentials = !!creds?.projuris_base_url;

  // Auto-save com debounce
  const debouncedSave = useCallback(
    (field: string, value: unknown) => {
      const timer = setTimeout(() => {
        updateConfig.mutate(
          { [field]: value },
          {
            onSuccess: () => toast.success("Configuracao salva"),
            onError: () => toast.error("Erro ao salvar"),
          },
        );
      }, 1000);
      return () => clearTimeout(timer);
    },
    [updateConfig],
  );

  function handleModeChange(newMode: string) {
    if (!podeEditar) return;
    setMode(newMode);
    debouncedSave("mode", newMode);
  }

  // Salva o horário do batch ao sair do campo (antes o valor nunca era persistido).
  function handleBatchHourBlur() {
    if (!podeEditar) return;
    const h = Number(batchHour);
    if (!Number.isInteger(h) || h < 0 || h > 23) {
      toast.error("Horário deve ser um número de 0 a 23");
      setBatchHour(String(config?.batch_hour ?? 6));
      return;
    }
    if (config && h === config.batch_hour) return;
    updateConfig.mutate(
      { batch_hour: h },
      {
        onSuccess: () => toast.success("Horário salvo"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
      },
    );
  }

  async function executeBatch(simulate: boolean) {
    setExecuting(true);
    setExecutionResult(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/projuris-sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ simulate, manual: true }),
      });
      // A Edge Function pode devolver 4xx/5xx — não trate erro como sucesso.
      if (!response.ok) {
        const msg = await response.text().catch(() => "");
        throw new Error(msg || `Falha na execução (HTTP ${response.status})`);
      }
      const result = (await response.json()) as BatchExecutionResult;
      setExecutionResult(result);
      toast.success(simulate ? "Simulacao concluida" : "Batch executado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro na execucao");
    } finally {
      setExecuting(false);
    }
  }

  const statusColors: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    running: "bg-blue-100 text-blue-700",
  };
  const StatusIcon =
    lastBatch?.status === "completed"
      ? CheckCircle
      : lastBatch?.status === "failed"
        ? XCircle
        : Clock;

  return (
    <div className="space-y-6 p-6">
      {/* Credenciais Projuris */}
      <Card className={hasCredentials ? "border-green-200" : "border-amber-200"}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Credenciais Projuris
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
          <CardDescription>Conexao com a API do Projuris para sincronizar tarefas</CardDescription>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Modo de Operacao */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modo de Operacao</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {configLoading ? (
              <Skeleton className="h-[100px]" />
            ) : (
              <>
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${mode === "HIGH_PRODUCTION" ? "border-primary bg-primary/5" : "hover:bg-accent"}`}
                  onClick={() => handleModeChange("HIGH_PRODUCTION")}
                >
                  <input
                    type="radio"
                    checked={mode === "HIGH_PRODUCTION"}
                    readOnly
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium">High Production</div>
                    <div className="text-sm text-muted-foreground">
                      Prioriza volume. Seg 95%, Ter-Qui 100%, Sex 90%.
                    </div>
                  </div>
                </label>
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${mode === "HIGH_CONTROL" ? "border-primary bg-primary/5" : "hover:bg-accent"}`}
                  onClick={() => handleModeChange("HIGH_CONTROL")}
                >
                  <input type="radio" checked={mode === "HIGH_CONTROL"} readOnly className="mt-1" />
                  <div>
                    <div className="font-medium">High Control</div>
                    <div className="text-sm text-muted-foreground">
                      Prioriza controle. Seg 90%, Ter-Qui 100%, Sex 80%.
                    </div>
                  </div>
                </label>
              </>
            )}
          </CardContent>
        </Card>

        {/* Horario e Acoes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Batch Diario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Horario (BRT)</Label>
              <Input
                type="number"
                min="0"
                max="23"
                value={batchHour}
                onChange={(e) => setBatchHour(e.target.value)}
                onBlur={handleBatchHourBlur}
                disabled={!podeEditar}
                className="w-24"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Proxima execucao: proximo dia util as {batchHour}:00
              </p>
            </div>
            {podeEditar && (
              <div className="flex gap-2">
                <Button onClick={() => executeBatch(false)} disabled={executing}>
                  {executing ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}{" "}
                  Executar Agora
                </Button>
                <Button variant="outline" onClick={() => executeBatch(true)} disabled={executing}>
                  <FlaskConical className="h-4 w-4 mr-1" /> Simular
                </Button>
              </div>
            )}
            {executionResult && (
              <div className="text-sm p-3 bg-muted rounded">
                <p>
                  <strong>Status:</strong> {executionResult.status}
                </p>
                <p>
                  <strong>Tarefas:</strong> {executionResult.total_tasks ?? 0} | Sucesso:{" "}
                  {executionResult.successful ?? 0} | Falhas: {executionResult.failed ?? 0}
                </p>
                <p>
                  <strong>Duracao:</strong> {executionResult.duration_ms ?? 0}ms
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ultimo Batch */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ultimo Batch</CardTitle>
          </CardHeader>
          <CardContent>
            {batchLoading ? (
              <Skeleton className="h-[80px]" />
            ) : lastBatch ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <StatusIcon className="h-4 w-4" />
                  <Badge className={statusColors[lastBatch.status]}>{lastBatch.status}</Badge>
                  <span className="text-muted-foreground">{lastBatch.batch_date}</span>
                </div>
                <div>
                  Total: {lastBatch.total_tasks} | Sucesso: {lastBatch.successful} | Falhas:{" "}
                  {lastBatch.failed}
                </div>
                {lastBatch.error_message && (
                  <div className="text-destructive text-xs">{lastBatch.error_message}</div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum batch executado ainda.</p>
            )}
          </CardContent>
        </Card>

        {/* Alertas 30 dias */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {alertsSummary && Object.keys(alertsSummary).length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1">Alerta</th>
                    <th className="text-right py-1">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(alertsSummary)
                    .sort((a, b) => b[1] - a[1])
                    .map(([code, count]) => (
                      <tr key={code} className="border-b">
                        <td className="py-1">
                          <Badge variant="outline" className="text-xs">
                            {code}
                          </Badge>
                        </td>
                        <td className="py-1 text-right font-medium">{count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum alerta nos ultimos 30 dias.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
