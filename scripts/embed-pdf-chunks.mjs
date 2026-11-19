import { pipeline } from "@huggingface/transformers";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { replaceUnpairedSurrogates } from "./text-utils.mjs";

const MODEL_NAME = "intfloat/multilingual-e5-small";

// อ่าน Chunk จากไฟล์ที่สกัดข้อความ PDF แล้วสร้าง Vector ทีละรายการ
async function main() {
  const inputArgument = process.argv[2];

  if (!inputArgument) {
    throw new Error('กรุณาระบุไฟล์ข้อความ เช่น node scripts/embed-pdf-chunks.mjs "tmp/pdfs/ตัวอย่าง.text.json"');
  }

  const inputPath = resolve(inputArgument);
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const chunks = input.chunks;

  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error("ไม่พบรายการ chunks ในไฟล์ กรุณาสกัดข้อความ PDF และแบ่ง Chunk ก่อน");
  }

  console.log(`กำลังโหลดโมเดล ${MODEL_NAME} (ครั้งแรกอาจใช้เวลาดาวน์โหลด)`);
  const createEmbedding = await pipeline("feature-extraction", MODEL_NAME);
  const embeddedChunks = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    if (typeof chunk.content !== "string" || !chunk.content.trim()) continue;
    const content = replaceUnpairedSurrogates(chunk.content);

    // โมเดล E5 ใช้คำนำหน้า passage สำหรับข้อความเอกสาร
    const output = await createEmbedding(`passage: ${content}`, {
      pooling: "mean",
      normalize: true,
    });

    embeddedChunks.push({
      ...chunk,
      content,
      embedding: Array.from(output.data),
    });
    console.log(`สร้าง Vector แล้ว ${index + 1}/${chunks.length} ชิ้น`);
  }

  if (embeddedChunks.length === 0) {
    throw new Error("ไม่มีข้อความใน Chunk ที่นำไปสร้าง Vector ได้");
  }

  const outputDirectory = join(process.cwd(), "tmp", "pdfs");
  const inputBaseName = basename(inputPath).replace(/\.text\.json$/i, "");
  const outputPath = join(outputDirectory, `${inputBaseName}.embeddings.json`);

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        fileName: input.fileName,
        model: MODEL_NAME,
        dimensions: embeddedChunks[0].embedding.length,
        chunks: embeddedChunks,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`บันทึก Vector ${embeddedChunks.length} ชิ้นไว้ที่ ${outputPath}`);
}

main().catch((error) => {
  console.error("สร้าง Vector ไม่สำเร็จ:", error.message);
  process.exitCode = 1;
});
