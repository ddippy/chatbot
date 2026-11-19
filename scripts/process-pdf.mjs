import { spawnSync } from "node:child_process";
import { basename, extname, join, resolve } from "node:path";
import { getCliArguments } from "./text-utils.mjs";

// รันสคริปต์แต่ละขั้นตามลำดับ และหยุดทันทีเมื่อขั้นใดทำงานไม่สำเร็จ
function runStep(label, scriptPath, argumentsList) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, [scriptPath, ...argumentsList], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`ขั้นตอน${label}หยุดทำงาน (exit code ${result.status ?? "ไม่ทราบ"})`);
  }
}

// จัดการ PDF ตั้งแต่สกัดข้อความจนถึงอัปโหลด Vector เข้า Supabase
function main() {
  const argumentsList = getCliArguments();
  const dryRunIndex = argumentsList.indexOf("--dry-run");
  const dryRun = dryRunIndex !== -1;
  if (dryRun) argumentsList.splice(dryRunIndex, 1);

  const [inputArgument] = argumentsList;
  if (!inputArgument) {
    throw new Error(
      'ระบุไฟล์ PDF เช่น pnpm run pdf:process -- "documents/ตัวอย่าง.pdf" หรือเติม --dry-run เพื่อข้ามการอัปโหลด',
    );
  }

  const inputPath = resolve(inputArgument);
  if (extname(inputPath).toLowerCase() !== ".pdf") {
    throw new Error("คำสั่งนี้รับไฟล์ PDF เท่านั้น");
  }

  const fileBaseName = basename(inputPath, extname(inputPath));
  const outputDirectory = join(process.cwd(), "tmp", "pdfs");
  const textPath = join(outputDirectory, `${fileBaseName}.text.json`);
  const embeddingsPath = join(outputDirectory, `${fileBaseName}.embeddings.json`);

  console.log(`กำลังประมวลผล: ${basename(inputPath)}`);
  runStep("สกัดข้อความและตรวจหน้าที่ต้อง OCR", "scripts/extract-pdf-text.mjs", [inputPath]);
  runStep("OCR หน้าที่จำเป็น", "scripts/ocr-pdf-iapp.mjs", [inputPath]);
  runStep("สร้าง Vector", "scripts/embed-pdf-chunks.mjs", [textPath]);

  if (dryRun) {
    console.log("\nทดลองประมวลผลเสร็จแล้ว ยังไม่ได้อัปโหลดเข้า Supabase");
    console.log(`ตรวจไฟล์ Vector ได้ที่ ${embeddingsPath}`);
    return;
  }

  runStep("อัปโหลดเข้า Supabase", "scripts/upload-embedded-chunks.mjs", [embeddingsPath]);
  console.log("\nประมวลผลและอัปโหลด PDF เสร็จแล้ว");
}

main();
