// Falha rápida no boot se faltar variável crítica.
// Use no início de scripts standalone e de server entry points.

type EnvCheck = {
  name: string;
  required: boolean;
  validate?: (value: string) => string | null;
};

const ENV_CHECKS: EnvCheck[] = [
  {
    name: "VITE_SUPABASE_URL",
    required: true,
    validate: (v) => (v.startsWith("https://") ? null : "deve começar com https://"),
  },
  { name: "VITE_SUPABASE_ANON_KEY", required: true },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true },
  {
    name: "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    required: true,
    validate: (v) => (v.includes("@") ? null : "não parece um e-mail"),
  },
  {
    name: "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    required: true,
    validate: (v) => {
      if (!v.includes("BEGIN PRIVATE KEY")) return "deve conter '-----BEGIN PRIVATE KEY-----'";
      if (!v.includes("\\n") && !v.includes("\n"))
        return "deve conter quebras de linha (\\n literais ou reais)";
      return null;
    },
  },
  {
    name: "GOOGLE_DRIVE_ROOT_FOLDER_ID",
    required: true,
    validate: (v) => (v.length >= 20 ? null : "ID muito curto, suspeito"),
  },
];

export type EnvValidationResult = {
  ok: boolean;
  errors: string[];
};

export function validateEnv(
  env: Record<string, string | undefined> = process.env,
): EnvValidationResult {
  const errors: string[] = [];

  for (const check of ENV_CHECKS) {
    const value = env[check.name];
    if (!value || value.trim() === "") {
      if (check.required) errors.push(`❌ ${check.name} ausente ou vazio`);
      continue;
    }
    if (check.validate) {
      const reason = check.validate(value);
      if (reason) errors.push(`❌ ${check.name}: ${reason}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertEnvOrExit(env: Record<string, string | undefined> = process.env): void {
  const result = validateEnv(env);
  if (result.ok) return;

  console.error("\n🚨 Variáveis de ambiente inválidas ou faltando:\n");
  for (const err of result.errors) console.error("   " + err);
  console.error("\n💡 Verifique o arquivo .env.local na raiz de sistema-hv/\n");
  process.exit(1);
}
