import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createWorker } from "tesseract.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

// วาดหน้า PDF หนึ่งหน้าเป็นภาพ เพื่อส่งให้โปรแกรม OCR อ่าน
async function renderPageToImage(page) {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));

  await page.render({ canvas, viewport }).promise;
  return canvas.toBuffer("image/png");
}

// อ่าน PDF ทีละหน้า แปลงภาพเป็นข้อความภาษาไทย และบันทึกเลขหน้ากำกับไว้
async function main() {
  const inputArgument = process.argv[2];

  if (!inputArgument) {
    throw new Error('กรุณาระบุไฟล์ PDF เช่น pnpm ocr:pdf -- "documents/ตัวอย่าง.pdf"');
  }

  const inputPath = resolve(inputArgument);
  const pdfBytes = new Uint8Array(await readFile(inputPath));
  const loadingTask = getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;
  const outputDirectory = join(process.cwd(), "tmp", "pdfs");
  const outputName = `${basename(inputPath, extname(inputPath))}.ocr.json`;
  const outputPath = join(outputDirectory, outputName);
  const pages = [];
  const cachePath = join(process.cwd(), ".cache", "tesseract");

  await mkdir(outputDirectory, { recursive: true });
  await mkdir(cachePath, { recursive: true });

  // สร้าง OCR worker ครั้งเดียว แล้วใช้ซ้ำกับทุกหน้า
  const worker = await createWorker("tha+eng", 1, { cachePath });

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      console.log(`กำลัง OCR หน้า ${pageNumber}/${pdf.numPages}`);

      const page = await pdf.getPage(pageNumber);
      const image = await renderPageToImage(page);
      const { data } = await worker.recognize(image);

      pages.push({
        pageNumber,
        text: data.text.trim(),
        confidence: data.confidence,
      });

      page.cleanup();
    }
  } finally {
    // ปิด worker และ PDF เพื่อคืนหน่วยความจำหลังอ่านเสร็จ
    await worker.terminate();
    await loadingTask.destroy();
  }

  await writeFile(
    outputPath,
    JSON.stringify({ fileName: basename(inputPath), pageCount: pdf.numPages, pages }, null, 2),
    "utf8",
  );

  console.log(`อ่านครบ ${pages.length} หน้า`);
  console.log(`บันทึกข้อความพร้อมเลขหน้าไว้ที่ ${outputPath}`);

  for (const page of pages) {
    console.log(`\n--- หน้า ${page.pageNumber} (ความมั่นใจ ${page.confidence}%) ---`);
    console.log(page.text.slice(0, 250) || "ไม่พบข้อความจากหน้านี้");
  }
}

main().catch((error) => {
  console.error("อ่าน PDF ไม่สำเร็จ:", error);
  process.exitCode = 1;
});
