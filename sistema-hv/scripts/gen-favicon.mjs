// Gera o símbolo HV recortado + favicons a partir da logo completa.
// Usa sharp (já instalado). Saída em public/ (servida na raiz pelo Nitro).
//   node scripts/gen-favicon.mjs
import { mkdirSync } from "node:fs";

import sharp from "sharp";

const SRC = "src/assets/logo-hv-full.png";
const NAVY = { r: 30, g: 32, b: 68, alpha: 1 }; // #1e2044

mkdirSync("public", { recursive: true });

const meta = await sharp(SRC).metadata();
const W = meta.width;
const H = meta.height;
console.log("origem:", W, "x", H);

// Símbolo = lado esquerdo da logo (antes do divisor vertical). Frações relativas
// ao tamanho real, com folga; o .trim() apara o transparente e ajusta no símbolo.
const region = {
  left: Math.round(W * 0.06),
  top: Math.round(H * 0.15),
  width: Math.round(W * 0.26),
  height: Math.round(H * 0.7),
};
console.log("região:", region);

// Extrai primeiro (buffer próprio), depois apara num pipeline separado — encadear
// extract().trim() faz o sharp recalcular a área errada.
const croppedBuf = await sharp(SRC).extract(region).png().toBuffer();
let symbolBuf;
try {
  symbolBuf = await sharp(croppedBuf).trim({ threshold: 10 }).png().toBuffer();
} catch {
  symbolBuf = croppedBuf; // se não houver borda uniforme p/ aparar, usa o recorte direto
}

const sym = await sharp(symbolBuf).metadata();
console.log("símbolo aparado:", sym.width, "x", sym.height);

// Símbolo transparente em alta resolução (sidebar / login).
await sharp(symbolBuf)
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile("public/symbol-hv.png");

// Favicons transparentes.
for (const size of [16, 32, 48]) {
  await sharp(symbolBuf)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(`public/favicon-${size}.png`);
}

// apple-touch-icon: símbolo sobre fundo navy (iOS achata transparência em preto).
await sharp(symbolBuf)
  .resize(132, 132, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 24, bottom: 24, left: 24, right: 24, background: NAVY })
  .flatten({ background: NAVY })
  .resize(180, 180)
  .png()
  .toFile("public/apple-touch-icon.png");

console.log("favicons gerados em public/");
