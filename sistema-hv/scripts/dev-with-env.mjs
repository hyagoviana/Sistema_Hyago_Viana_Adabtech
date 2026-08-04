// Sobe o dev server (vite) com .env.local pré-carregado no process.env,
// garantindo que os server functions (Drive/Supabase/Docs/ZapSign) tenham as chaves.
import { config } from "dotenv";

// As chaves reais (Supabase/Drive/Docs/ZapSign) vivem em .env.local — carrega ele
// PRIMEIRO (dotenv não sobrescreve o que já está setado) e cai pra .env se existir.
config({ path: ".env.local" });
config({ path: ".env" });

import { spawn } from "node:child_process";

const child = spawn("npx", ["vite", "dev"], { stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
