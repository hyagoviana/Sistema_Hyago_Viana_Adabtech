import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import {
  Settings,
  Play,
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
import { useSincronizarDistribuicao } from "@/hooks/useDistribuicaoDashboard";
import { usePodeEditar } from "@/hooks/usePermissions";

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
  const sync = useSincronizarDistribuicao();
  const saveCreds = useSaveDistributionCreds();

  const [mode, setMode] = useState<string>("HIGH_PRODUCTION");
  // Doc 21.08 — média diária de produção agora é MANUAL (12 controle / 15 produção).
  const [writebackAtivo, setWritebackAtivo] = useState(false);
  const [ptsControle, setPtsControle] = useState<string>("12");
  const [ptsProducao, setPtsProducao] = useState<string>("15");
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

  // Credenciais ProJuris. Nao-segredos (base_url/auth_type/username) vem da
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
      setWritebackAtivo(config.projuris_writeback_ativo === true);
      setPtsControle(String(config.pontos_dia_controle ?? 12));
      setPtsProducao(String(config.pontos_dia_producao ?? 15));
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

  // Dispara o motor SEGURO (Node/server fn runSync): LÊ o ProJuris, distribui e
  // grava em system_distribution_results. ZERO writeback ao ProJuris. Substitui a
  // antiga chamada à Edge Function `projuris-sync` (que podia escrever no ProJuris
  // sem trava). Idempotente por data.
  async function executeBatch() {
    setExecuting(true);
    setExecutionResult(null);
    try {
      const summary = await sync.mutateAsync({});
      setExecutionResult({
        status: "completed",
        total_tasks: summary.totalTasks,
        successful: summary.distributed,
        failed: summary.blocked,
      });
      toast.success("Distribuicao sincronizada (leitura ProJuris, sem escrita)");
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
      {/* As credenciais da API saíram daqui: viraram configuração de SISTEMA
          (doc 21.08 — "tirar margem de erro humano"). Esta tela guarda só o que
          é operação do motor. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Conexão com o ProJuris
            {hasCredentials ? (
              <Badge className="bg-green-100 text-green-700 text-xs ml-2">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Configurada
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700 text-xs ml-2">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Pendente
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            As credenciais da API agora ficam em Configurações › Integrações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/configuracoes/integracoes">
            <Button variant="outline" size="sm">
              Abrir Configurações › Integrações
            </Button>
          </Link>
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

                {/* Doc 21.08: "Converti esse dado em algo manual a ser preenchido
                    (vinculado ao modo de produção baixa ou alta produção)." O motor
                    usa o valor do modo selecionado como referência diária por pessoa. */}
                <div className="pt-2 border-t space-y-3">
                  <div className="text-sm font-medium">Média diária de pontos por pessoa</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Modo controle</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={ptsControle}
                        disabled={!podeEditar}
                        onChange={(e) => setPtsControle(e.target.value)}
                        onBlur={() => {
                          // Campo vazio vira 0 no JS — e 0 ponto/dia zeraria a
                          // capacidade de todo mundo no motor.
                          const n = Number(ptsControle.replace(",", "."));
                          if (!Number.isFinite(n) || n <= 0) {
                            setPtsControle(String(config?.pontos_dia_controle ?? 12));
                            toast.error("A média diária precisa ser maior que zero");
                            return;
                          }
                          updateConfig.mutate(
                            { pontos_dia_controle: n },
                            { onSuccess: () => toast.success("Média do modo controle salva") },
                          );
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Modo produção</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={ptsProducao}
                        disabled={!podeEditar}
                        onChange={(e) => setPtsProducao(e.target.value)}
                        onBlur={() => {
                          const n = Number(ptsProducao.replace(",", "."));
                          if (!Number.isFinite(n) || n <= 0) {
                            setPtsProducao(String(config?.pontos_dia_producao ?? 15));
                            toast.error("A média diária precisa ser maior que zero");
                            return;
                          }
                          updateConfig.mutate(
                            { pontos_dia_producao: n },
                            { onSuccess: () => toast.success("Média do modo produção salva") },
                          );
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Substitui a média calculada pelos últimos 90 dias. O motor lê o número do modo
                    que estiver selecionado acima.
                  </p>
                </div>

                {/* Write-back ao ProJuris. Até 24/08 o sistema era leitura-only lá;
                    o Thiago pediu (reunião 19/08) que arquivar e marcar lido valham
                    nos dois sistemas. Fica atrás desta chave para poder desligar na
                    hora, sem depender de deploy. */}
                <div className="pt-2 border-t space-y-2">
                  <div className="text-sm font-medium">Refletir ações no ProJuris</div>
                  <p className="text-xs text-muted-foreground">
                    Quando ligado, "arquivar intimação" e "marcar lido" na aba Andamentos pendentes
                    também são aplicados no ProJuris. Desligado, valem só aqui. O arquivamento é
                    reversível (existe desarquivar).
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant={writebackAtivo ? "default" : "outline"}
                    disabled={!podeEditar || updateConfig.isPending}
                    onClick={() => {
                      const novo = !writebackAtivo;
                      setWritebackAtivo(novo);
                      updateConfig.mutate(
                        { projuris_writeback_ativo: novo },
                        {
                          onSuccess: () =>
                            toast.success(
                              novo
                                ? "Ações passam a refletir no ProJuris"
                                : "Ações voltam a valer só no sistema",
                            ),
                          onError: () => setWritebackAtivo(!novo),
                        },
                      );
                    }}
                  >
                    {writebackAtivo ? "Ligado — reflete no ProJuris" : "Desligado — só no sistema"}
                  </Button>
                </div>
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
                <Button onClick={() => executeBatch()} disabled={executing}>
                  {executing ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}{" "}
                  Executar Agora
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
