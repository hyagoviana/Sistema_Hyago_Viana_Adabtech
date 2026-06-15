// Sobe o dev server (vite) com .env.local pré-carregado no process.env,
// garantindo que os server functions (Drive/Supabase/Docs/ZapSign) tenham as chaves.
import { config } from "dotenv";

config({ path: ".env" });

import { spawn } from "node:child_process";

const child = spawn("npx", ["vite", "dev"], { stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
