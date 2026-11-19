import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getCliArguments, replaceUnpairedSurrogates } from "./text-utils.mjs";

// โหลด URL และ Secret Key จากไฟล์ในเครื่อง โดยไม่เขียน key ลงในโค้ด
try {
  process.loadEnvFile(".env.local");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

// ตรวจข้อมูล Vector แล้วแปลงชื่อฟิลด์ให้ตรงกับคอลัมน์ใน Supabase
function prepareRows(input) {
  if (!Array.isArray(input.chunks) || input.chunks.length === 0) {
    throw new Error("ไม่พบรายการ chunks ในไฟล์ Vector");
  }

  return input.chunks.map((chunk, index) => {
    if (
      !Array.isArray(chunk.embedding) ||
      chunk.embedding.length !== 384 ||
      !chunk.embedding.every((value) => Number.isFinite(value))
    ) {
      throw new Error(`Vector ของ Chunk ลำดับ ${index + 1} ต้องมีตัวเลข 384 ค่า`);
    }

    if (!chunk.documentName || !chunk.content || !Number.isInteger(chunk.page)) {
      throw new Error(`ข้อมูลอ้างอิงของ Chunk ลำดับ ${index + 1} ไม่ครบ`);
    }

    return {
      document_name: chunk.documentName,
      page_number: chunk.page,
      chunk_index: chunk.chunkIndex,
      content: replaceUnpairedSurrogates(chunk.content),
      embedding: chunk.embedding,
    };
  });
}

// อัปโหลด Chunk ที่มี Vector แล้วเข้า Supabase โดยป้องกันการนำเข้าไฟล์ซ้ำ
async function main() {
  const [inputArgument] = getCliArguments();
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!inputArgument) {
    throw new Error('กรุณาระบุไฟล์ เช่น node scripts/upload-embedded-chunks.mjs "tmp/pdfs/ตัวอย่าง.embeddings.json"');
  }
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("ไม่พบ SUPABASE_URL หรือ SUPABASE_SECRET_KEY ในไฟล์ .env.local");
  }

  const input = JSON.parse(await readFile(resolve(inputArgument), "utf8"));
  const rows = prepareRows(input);
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      // แสดงสถานะ HTTP อย่างปลอดภัย โดยไม่พิมพ์ URL หรือ Key ออกมา
      fetch: async (request, options) => {
        const response = await fetch(request, options);
        if (!response.ok) {
          console.error(
            `Supabase HTTP ${response.status} ${response.statusText} (${response.headers.get("content-type") || "ไม่มี content-type"})`,
          );
        }
        return response;
      },
    },
  });

  // หยุดก่อนอัปโหลดถ้ามี Chunk ของเอกสารชื่อเดียวกันอยู่แล้ว
  const { data: existingRows, error: checkError } = await supabase
    .from("document_chunks")
    .select("id")
    .eq("document_name", input.fileName)
    .limit(1);

  if (checkError) {
    const safeDetails = {
      message: checkError.message,
      code: checkError.code,
      details: checkError.details,
      hint: checkError.hint,
      status: checkError.status,
    };
    throw new Error(
      `ตรวจข้อมูลเดิมใน Supabase ไม่สำเร็จ: ${JSON.stringify(safeDetails)}`,
    );
  }
  if (existingRows?.length > 0) {
    throw new Error(`มีข้อมูลของ ${input.fileName} อยู่แล้ว จึงหยุดเพื่อป้องกันข้อมูลซ้ำ`);
  }

  const { error: insertError } = await supabase.from("document_chunks").insert(rows);
  if (insertError) {
    const safeDetails = {
      message: insertError.message,
      code: insertError.code,
      details: insertError.details,
      hint: insertError.hint,
    };
    throw new Error(
      `บันทึกข้อมูลลง Supabase ไม่สำเร็จ: ${JSON.stringify(safeDetails)}`,
    );
  }

  console.log(`บันทึก ${rows.length} Chunks จาก ${input.fileName} ลง Supabase แล้ว`);
}

main().catch((error) => {
  console.error("นำ Vector เข้า Supabase ไม่สำเร็จ:", error.message);
  process.exitCode = 1;
});
