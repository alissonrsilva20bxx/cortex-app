// Baixa todo objeto dos buckets relevantes (rede-midia, avatares) pra uma
// pasta local, preservando o path -- parte do backup manual em
// backup-antes-retencao.sh. So le; nao apaga nem modifica nada no Storage.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const destDir = process.env.DEST_DIR;
if (!url || !serviceKey || !destDir) {
  console.error(
    "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e DEST_DIR são obrigatórias"
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey);
const BUCKETS = ["rede-midia", "avatares"];

async function listAllRecursive(bucket, prefix = "") {
  const { data, error } = await admin.storage.from(bucket).list(prefix, {
    limit: 1000,
  });
  if (error) throw error;
  let files = [];
  for (const entry of data ?? []) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      // é uma "pasta" (sem id próprio) -- desce recursivamente
      files = files.concat(await listAllRecursive(bucket, fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

for (const bucket of BUCKETS) {
  const { data: exists } = await admin.storage.getBucket(bucket);
  if (!exists) {
    console.log(`bucket "${bucket}" não existe nesse projeto, pulando`);
    continue;
  }
  const files = await listAllRecursive(bucket);
  console.log(`${bucket}: ${files.length} arquivo(s)`);
  for (const filePath of files) {
    const { data, error } = await admin.storage.from(bucket).download(filePath);
    if (error) {
      console.error(`  FALHOU ${filePath}: ${error.message}`);
      continue;
    }
    const localPath = path.join(destDir, bucket, filePath);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    const buf = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(localPath, buf);
  }
}
console.log("backup de storage concluído");
