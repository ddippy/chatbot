import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import {
  getCliArguments,
  replaceUnpairedSurrogates,
  splitIntoChunks,
} from "./text-utils.mjs";

// อ่านข้อความที่เลือกได้จาก PDF ทีละหน้า โดยไม่เรียก AI หรือ OCR
async function extractPdfPages(pdfBytes) {
  const loadingTask = getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();

      // ต่อข้อความตามลำดับที่ PDF เก็บไว้ และขึ้นบรรทัดใหม่ตามตำแหน่งบรรทัด
      const extractedText = textContent.items
        .map((item) => {
          if (typeof item.str !== "string") return "";
          return `${item.str}${item.hasEOL ? "\n" : " "}`;
        })
        .join("")
        .replace(/[ \t]+/g, " ")
        .replace(/ *\n */g, "\n")
        .trim();
      const text = replaceUnpairedSurrogates(extractedText);

      pages.push({
        pageNumber,
        text,
        // หน้าที่ไม่มี text layer ต้องผ่าน OCR ก่อนนำไปสร้าง Vector
        status: text.length > 0 ? "text" : "needs_ocr",
      });
      page.cleanup();
    }

    return { pageCount: pdf.numPages, pages };
  } finally {
    await loadingTask.destroy();
  }
}

// รับชื่อ PDF จากคำสั่ง แล้วบันทึกข้อความแยกตามหน้าเป็นไฟล์ JSON
async function main() {
  const [inputArgument] = getCliArguments();

  if (!inputArgument) {
    throw new Error('กรุณาระบุไฟล์ PDF เช่น node scripts/extract-pdf-text.mjs "documents/ตัวอย่าง.pdf"');
  }

  const inputPath = resolve(inputArgument);
  const pdfBytes = new Uint8Array(await readFile(inputPath));
  const { pageCount, pages } = await extractPdfPages(pdfBytes);
  const pagesWithText = pages.filter((page) => page.text.length > 0);
  const ocrRequiredPages = pages
    .filter((page) => page.status === "needs_ocr")
    .map((page) => page.pageNumber);

  const outputDirectory = join(process.cwd(), "tmp", "pdfs");
  const outputName = `${basename(inputPath, extname(inputPath))}.text.json`;
  const outputPath = join(outputDirectory, outputName);
  const chunks = pages.flatMap((page) =>
    splitIntoChunks(page.text).map((content, chunkIndex) => ({
      documentName: basename(inputPath),
      page: page.pageNumber,
      chunkIndex,
      content,
    })),
  );

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        fileName: basename(inputPath),
        pageCount,
        pages,
        ocrRequiredPages,
        status: ocrRequiredPages.length > 0 ? "needs_ocr" : "ready_for_embedding",
        chunks,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`ดึงข้อความได้ ${pagesWithText.length}/${pageCount} หน้า และแบ่งเป็น ${chunks.length} ชิ้น`);
  if (ocrRequiredPages.length > 0) {
    console.log(`หน้าที่ต้อง OCR: ${ocrRequiredPages.join(", ")}`);
  }
  console.log(`บันทึกผลไว้ที่ ${outputPath}`);
}

main().catch((error) => {
  console.error("ดึงข้อความจาก PDF ไม่สำเร็จ:", error.message);
  process.exitCode = 1;
});
