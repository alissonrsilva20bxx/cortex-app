// Re-sobe pro Storage tudo que backup-storage.mjs baixou, preservando o
// path original. Companheiro de restore-apos-backup.sh.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const srcDir = process.env.SRC_DIR;
if (!url || !serviceKey || !srcDir) {
  console.error(
    "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SRC_DIR são obrigatórias"
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey);

// Sem isto, o client infere `text/plain;charset=UTF-8` pro upload -- o
// bucket rede-midia só aceita image/*, então TODA foto falhava ao
// restaurar (silenciosamente: o script seguia e só imprimia "FALHOU" por
// arquivo, sem falhar o processo inteiro) -- achado rodando o ciclo
// completo backup->restore contra homologação antes deste script ser
// proposto (ver PR #105).
const MIME_POR_EXTENSAO = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function walk(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(full));
    else files.push(full);
  }
  return files;
}

if (!fs.existsSync(srcDir)) {
  console.log(`${srcDir} não existe, nada pra restaurar`);
  process.exit(0);
}

let falhas = 0;
for (const bucketDir of fs.readdirSync(srcDir)) {
  const bucket = bucketDir;
  const bucketPath = path.join(srcDir, bucketDir);
  if (!fs.statSync(bucketPath).isDirectory()) continue;
  const files = walk(bucketPath);
  console.log(`${bucket}: ${files.length} arquivo(s) a re-subir`);
  for (const localFile of files) {
    const objectPath = path
      .relative(bucketPath, localFile)
      .split(path.sep)
      .join("/");
    const buf = fs.readFileSync(localFile);
    const ext = path.extname(localFile).toLowerCase();
    const contentType = MIME_POR_EXTENSAO[ext] ?? "application/octet-stream";
    const { error } = await admin.storage
      .from(bucket)
      .upload(objectPath, buf, { upsert: true, contentType });
    if (error) {
      console.error(`  FALHOU ${bucket}/${objectPath}: ${error.message}`);
      falhas++;
    }
  }
}
if (falhas > 0) {
  console.error(
    `restauração de storage terminou com ${falhas} falha(s) -- NÃO considerar concluída`
  );
  process.exit(1);
}
console.log("restauração de storage concluída (0 falhas)");
