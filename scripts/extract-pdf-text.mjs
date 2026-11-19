import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { replaceUnpairedSurrogates } from "./text-utils.mjs";

// แบ่งข้อความยาวเป็นชิ้นเล็กๆ โดยเหลือข้อความซ้อนกันเล็กน้อยระหว่างชิ้น
function splitIntoChunks(text, chunkSize = 500, overlap = 80) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    // ถ้ามีช่องว่างใกล้จุดแบ่ง ให้ตัดตรงนั้นเพื่อลดโอกาสตัดกลางคำ
    if (end < text.length) {
      const minimumEnd = start + Math.floor(chunkSize * 0.7);
      const spacePosition = text.lastIndexOf(" ", end);
      if (spacePosition > minimumEnd) end = spacePosition;
    }

    const content = text.slice(start, end).trim();
    if (content) chunks.push(content);
    if (end >= text.length) break;

    // เลื่อนจุดเริ่มย้อนกลับเล็กน้อย เพื่อให้บริบทช่วงรอยต่อไม่หายไป
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

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

      pages.push({ pageNumber, text });
      page.cleanup();
    }

    return { pageCount: pdf.numPages, pages };
  } finally {
    await loadingTask.destroy();
  }
}

// รับชื่อ PDF จากคำสั่ง แล้วบันทึกข้อความแยกตามหน้าเป็นไฟล์ JSON
async function main() {
  const inputArgument = process.argv[2];

  if (!inputArgument) {
    throw new Error('กรุณาระบุไฟล์ PDF เช่น node scripts/extract-pdf-text.mjs "documents/ตัวอย่าง.pdf"');
  }

  const inputPath = resolve(inputArgument);
  const pdfBytes = new Uint8Array(await readFile(inputPath));
  const { pageCount, pages } = await extractPdfPages(pdfBytes);
  const pagesWithText = pages.filter((page) => page.text.length > 0);

  if (pagesWithText.length === 0) {
    throw new Error("ไม่พบข้อความใน PDF นี้ น่าจะเป็นไฟล์สแกนที่ต้องใช้ OCR หรือถอดข้อความก่อน");
  }

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
        chunks,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`ดึงข้อความได้ ${pagesWithText.length}/${pageCount} หน้า และแบ่งเป็น ${chunks.length} ชิ้น`);
  console.log(`บันทึกผลไว้ที่ ${outputPath}`);
}

main().catch((error) => {
  console.error("ดึงข้อความจาก PDF ไม่สำเร็จ:", error.message);
  process.exitCode = 1;
});
