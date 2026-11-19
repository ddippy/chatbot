import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

// โหลด key จาก .env.local โดยไม่ใส่รหัสลับไว้ในโค้ด
try {
  process.loadEnvFile(".env.local");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

// วาดหน้า PDF เป็นภาพ PNG สำหรับส่งให้โมเดลอ่าน
async function renderPageToImage(page) {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));

  await page.render({ canvas, viewport }).promise;
  return canvas.toBuffer("image/png");
}

// รอเมื่อ Groq แจ้งว่าโควตาต่อนาทีเต็ม แล้วลองคำขอเดิมซ้ำ
async function requestGroqWithRetry(apiKey, requestBody) {
  const maxRetries = 5;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    if (response.ok) return result;

    if (response.status !== 429 || attempt === maxRetries) {
      throw new Error(`Groq API ตอบกลับ ${response.status}: ${JSON.stringify(result)}`);
    }

    const message = result.error?.message || "";
    const retryFromHeader = Number.parseFloat(response.headers.get("retry-after") || "0");
    const retryFromMessage = Number.parseFloat(message.match(/try again in ([\d.]+)s/i)?.[1] || "0");
    const waitSeconds = Math.max(retryFromHeader, retryFromMessage, 5);
    const waitMilliseconds = Math.ceil(waitSeconds * 1000) + 300;

    console.log(`โควตา Groq เต็ม รอ ${Math.ceil(waitMilliseconds / 1000)} วินาทีแล้วลองใหม่`);
    await new Promise((resolveWait) => setTimeout(resolveWait, waitMilliseconds));
  }

  throw new Error("Groq ยังไม่พร้อมหลังลองซ้ำหลายครั้ง");
}

// ส่งภาพทีละหน้าและรับข้อความธรรมดา เพื่อลดโอกาสที่ผลลัพธ์จะยาวเกินขีดจำกัด
async function recognizePage(apiKey, model, page) {
  const result = await requestGroqWithRetry(apiKey, {
      model,
      messages: [
        {
          role: "system",
          content:
            "คุณทำหน้าที่ถอดข้อความจากภาพเท่านั้น ห้ามสรุปหรือแต่งข้อมูลที่ไม่มีในภาพ ถ้าอ่านไม่ชัดให้เขียน [อ่านไม่ชัด]",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `ถอดข้อความทั้งหมดจากภาพหน้า ${page.pageNumber} ตามที่เห็น รักษาเลขไทยและตัวเลขตามต้นฉบับ ` +
                "จัดตารางเป็น Markdown table เมื่อทำได้ ตอบเป็นข้อความธรรมดา ไม่ต้องตอบเป็น JSON",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${page.image.toString("base64")}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_completion_tokens: 8000,
  });

  const choice = result.choices?.[0];
  const responseText = choice?.message?.content;
  if (!responseText) throw new Error("Groq API ไม่ได้ส่งข้อความกลับมา");
  if (choice.finish_reason === "length") {
    throw new Error(`ข้อความหน้า ${page.pageNumber} ยาวเกินขีดจำกัด token ที่กำหนด`);
  }

  // ใช้เลขหน้าจาก PDF โดยตรง เพื่อป้องกันโมเดลระบุเลขหน้าไม่ตรง
  return { pageNumber: page.pageNumber, text: responseText.trim() };
}

// อ่าน PDF เป็นภาพ ส่งให้ Groq Vision แล้วบันทึกผลพร้อมเลขหน้า
async function main() {
  const inputArgument = process.argv[2];
  const apiKey = process.env.GROQ_API_KEY;

  if (!inputArgument) {
    throw new Error('กรุณาระบุไฟล์ PDF เช่น node scripts/groq-vision-ocr.mjs "documents/ตัวอย่าง.pdf"');
  }
  if (!apiKey) {
    throw new Error("ไม่พบ GROQ_API_KEY กรุณาคัดลอก .env.example เป็น .env.local แล้วใส่ key ในเครื่อง");
  }

  const model = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";
  const inputPath = resolve(inputArgument);
  const pdfBytes = new Uint8Array(await readFile(inputPath));
  const loadingTask = getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;
  const pages = [];
  const outputDirectory = join(process.cwd(), "tmp", "pdfs");
  const outputName = `${basename(inputPath, extname(inputPath))}.groq-ocr.json`;
  const outputPath = join(outputDirectory, outputName);

  await mkdir(outputDirectory, { recursive: true });

  // บันทึกผลหลังอ่านแต่ละหน้า เพื่อเก็บหน้าที่สำเร็จแล้วไว้หากหน้าถัดไปมีปัญหา
  async function saveResult(status) {
    await writeFile(
      outputPath,
      JSON.stringify(
        {
          fileName: basename(inputPath),
          model,
          pageCount: pdf.numPages,
          status,
          pages: recognizedPages,
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      console.log(`กำลังเตรียมภาพหน้า ${pageNumber}/${pdf.numPages}`);
      const page = await pdf.getPage(pageNumber);
      const image = await renderPageToImage(page);
      pages.push({ pageNumber, image });
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  const recognizedPages = [];
  try {
    for (const page of pages) {
      console.log(`กำลังส่งภาพหน้า ${page.pageNumber}/${pages.length} ให้ Groq`);
      recognizedPages.push(await recognizePage(apiKey, model, page));
      await saveResult("in_progress");
    }
  } catch (error) {
    if (recognizedPages.length > 0) {
      await saveResult("partial");
      console.log(`บันทึกผลบางส่วนไว้ที่ ${outputPath}`);
    }
    throw error;
  }

  await saveResult("complete");

  console.log(`บันทึกผล OCR ${recognizedPages.length} หน้าไว้ที่ ${outputPath}`);
}

main().catch((error) => {
  console.error("อ่าน PDF ด้วย Groq ไม่สำเร็จ:", error.message);
  process.exitCode = 1;
});
