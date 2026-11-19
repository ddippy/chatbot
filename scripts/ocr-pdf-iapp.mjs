import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument } from "pdf-lib";
import {
  getCliArguments,
  replaceUnpairedSurrogates,
  splitIntoChunks,
} from "./text-utils.mjs";

const PRICE_PER_PAGE = 0.049;
const MAX_FILE_SIZE = 30 * 1024 * 1024;

// โหลด API Key จากไฟล์ .env.local โดยเก็บ Key ไว้ฝั่งเครื่องเท่านั้น
try {
  process.loadEnvFile(".env.local");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

// นับจำนวนหน้าและตรวจว่าไฟล์เป็น PDF ที่อ่านได้
async function countPdfPages(pdfBytes) {
  // PDF.js อาจย้าย ArrayBuffer ไปใช้ภายใน จึงตรวจจากสำเนาเพื่อเก็บต้นฉบับไว้ส่ง API
  const loadingTask = getDocument({ data: new Uint8Array(pdfBytes) });
  const pdf = await loadingTask.promise;

  try {
    return pdf.numPages;
  } finally {
    await loadingTask.destroy();
  }
}

// อ่านเฉพาะหน้า OCR ที่ยังไม่มีข้อความ และรวมผลเข้ากับข้อมูลเดิม
async function main() {
  const [inputArgument] = getCliArguments();

  if (!inputArgument) {
    throw new Error('ระบุ PDF เช่น pnpm run pdf:ocr:iapp -- "documents/ตัวอย่าง.pdf"');
  }

  const inputPath = resolve(inputArgument);
  if (extname(inputPath).toLowerCase() !== ".pdf") {
    throw new Error("คำสั่งนี้รับไฟล์ PDF เท่านั้น");
  }

  const fileName = basename(inputPath);
  const outputDirectory = join(process.cwd(), "tmp", "pdfs");
  const textPath = join(
    outputDirectory,
    `${basename(inputPath, extname(inputPath))}.text.json`,
  );
  const extracted = JSON.parse(await readFile(textPath, "utf8"));

  if (!Array.isArray(extracted.pages) || !Array.isArray(extracted.ocrRequiredPages)) {
    throw new Error('ไม่พบข้อมูลหน้าหรือ ocrRequiredPages กรุณารัน "pnpm run pdf:extract" ก่อน');
  }

  if (extracted.ocrRequiredPages.length === 0) {
    console.log("เอกสารนี้มีข้อความครบแล้ว ไม่ต้องเรียก OCR");
    return;
  }

  const apiKey = process.env.IAPP_API_KEY;
  if (!apiKey) {
    throw new Error("ไม่พบ IAPP_API_KEY กรุณาเพิ่ม Key ในไฟล์ .env.local");
  }

  const pdfBytes = new Uint8Array(await readFile(inputPath));
  if (pdfBytes.byteLength > MAX_FILE_SIZE) {
    throw new Error("ไฟล์ใหญ่เกิน 30 MB ซึ่งเกินขนาดที่ iApp รับได้");
  }

  const pageCount = await countPdfPages(pdfBytes);
  if (pageCount !== extracted.pageCount || pageCount !== extracted.pages.length) {
    throw new Error("จำนวนหน้าใน PDF ไม่ตรงกับผลสกัดข้อความ กรุณารัน pdf:extract ใหม่");
  }

  // สร้าง PDF ใหม่ที่มีเฉพาะหน้าที่ตรวจพบว่าต้อง OCR
  const sourcePdf = await PDFDocument.load(pdfBytes);
  const selectedPdf = await PDFDocument.create();
  const selectedPageNumbers = extracted.ocrRequiredPages;
  const selectedPages = await selectedPdf.copyPages(
    sourcePdf,
    selectedPageNumbers.map((pageNumber) => pageNumber - 1),
  );
  selectedPages.forEach((page) => selectedPdf.addPage(page));
  const selectedPdfBytes = await selectedPdf.save();

  if (selectedPdfBytes.byteLength > MAX_FILE_SIZE) {
    throw new Error("ไฟล์หน้าที่เลือกมีขนาดเกิน 30 MB ซึ่งเกินขนาดที่ iApp รับได้");
  }

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([selectedPdfBytes], { type: "application/pdf" }),
    `${basename(inputPath, extname(inputPath))}.ocr-pages.pdf`,
  );

  // ส่งเฉพาะหน้าที่ต้อง OCR เพื่อคิดเครดิตเฉพาะหน้าที่เลือก
  console.log(
    `กำลังส่งหน้า ${selectedPageNumbers.join(", ")} จาก PDF ${pageCount} หน้าไป iApp (ประมาณ ${(selectedPageNumbers.length * PRICE_PER_PAGE).toFixed(3)} เครดิต)`,
  );
  const response = await fetch("https://api.iapp.co.th/v3/store/ocr/document/ocr", {
    method: "POST",
    headers: { apikey: apiKey },
    body: formData,
  });

  const responseText = await response.text();
  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(`iApp ตอบกลับ ${response.status} แต่ไม่ใช่ JSON: ${responseText.slice(0, 300)}`);
  }

  if (!response.ok) {
    throw new Error(`iApp ตอบกลับ ${response.status}: ${JSON.stringify(result)}`);
  }
  if (!Array.isArray(result.text) || result.text.length !== selectedPageNumbers.length) {
    throw new Error(
      `iApp ส่งผลกลับ ${result.text?.length ?? 0} หน้า แต่เราส่งไป ${selectedPageNumbers.length} หน้า`,
    );
  }

  const ocrPages = result.text.map((text, index) => ({
    pageNumber: selectedPageNumbers[index],
    text: replaceUnpairedSurrogates(String(text ?? "").trim()),
  }));
  const ocrByPage = new Map(ocrPages.map((page) => [page.pageNumber, page.text]));
  const pages = extracted.pages.map((page) => {
    if (page.status !== "needs_ocr") return page;

    const text = ocrByPage.get(page.pageNumber) ?? "";
    return {
      ...page,
      text,
      // ถ้า OCR ยังอ่านข้อความไม่ออก จะคงสถานะไว้และกันไม่ให้สร้าง Vector ต่อ
      status: text ? "ocr" : "needs_ocr",
    };
  });
  const ocrRequiredPages = pages
    .filter((page) => page.status === "needs_ocr")
    .map((page) => page.pageNumber);
  const chunks = pages.flatMap((page) =>
    splitIntoChunks(page.text).map((content, chunkIndex) => ({
      documentName: fileName,
      page: page.pageNumber,
      chunkIndex,
      content,
    })),
  );
  const updatedText = {
    ...extracted,
    pages,
    ocrProvider: "iApp OpenThai OCR Text",
    ocrRequiredPages,
    status: ocrRequiredPages.length > 0 ? "needs_ocr" : "ready_for_embedding",
    chunks,
  };

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(textPath, JSON.stringify(updatedText, null, 2), "utf8");

  const rawOutputPath = join(
    outputDirectory,
    `${basename(inputPath, extname(inputPath))}.iapp-ocr.json`,
  );
  await writeFile(
    rawOutputPath,
    JSON.stringify(
      {
        fileName,
        sourcePageCount: pageCount,
        ocrRequiredPages: selectedPageNumbers,
        pageCount: ocrPages.length,
        pages: ocrPages,
        timeSeconds: result.time,
      },
      null,
      2,
    ),
    "utf8",
  );

  const completedPages = pages.filter((page) => page.status === "ocr").length;
  console.log(`เติมข้อความ OCR แล้ว ${completedPages} หน้า; รวมเป็น ${chunks.length} Chunks`);
  console.log(`อัปเดตข้อมูลพร้อมสร้าง Vector ที่ ${textPath}`);
  if (ocrRequiredPages.length > 0) {
    console.log(`ยังอ่านข้อความไม่ได้ในหน้า: ${ocrRequiredPages.join(", ")}`);
  }
}

main().catch((error) => {
  console.error("อ่าน PDF ด้วย iApp ไม่สำเร็จ:", error.message);
  process.exitCode = 1;
});
