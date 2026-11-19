import { NextResponse } from "next/server";
import { answerFromDocuments, type AiProvider } from "@/lib/rag";
import { getGoogleModelName, GOOGLE_PROVIDER_NAME } from "@/lib/llm/google";
import { getGroqModelName, GROQ_PROVIDER_NAME } from "@/lib/llm/groq";
import { replaceUnpairedSurrogates } from "@/scripts/text-utils.mjs";

export const maxDuration = 60;

// ส่งชื่อ AI และ Model ไปแสดงบนหน้าเว็บ โดยไม่ส่ง API Key ออกไป
export async function GET() {
  return NextResponse.json({
    providers: [
      {
        id: "google",
        name: GOOGLE_PROVIDER_NAME,
        model: getGoogleModelName(),
        enabled: Boolean(process.env.GEMINI_API_KEY),
      },
      {
        id: "groq",
        name: GROQ_PROVIDER_NAME,
        model: getGroqModelName(),
        enabled: Boolean(process.env.GROQ_API_KEY),
      },
    ],
  });
}

// รับคำถามจากหน้าเว็บ แล้วส่งให้ระบบ RAG ประมวลผลบนเซิร์ฟเวอร์
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rawQuestion = body?.question;
  const rawProvider = body?.provider ?? "google";

  if (typeof rawQuestion !== "string" || !rawQuestion.trim()) {
    return NextResponse.json({ error: "กรุณาพิมพ์คำถามก่อนส่ง" }, { status: 400 });
  }

  if (rawQuestion.length > 1000) {
    return NextResponse.json({ error: "คำถามยาวเกินไป กรุณาย่อคำถามให้สั้นลง" }, { status: 400 });
  }

  if (rawProvider !== "google" && rawProvider !== "groq") {
    return NextResponse.json({ error: "กรุณาเลือก AI ที่รองรับ" }, { status: 400 });
  }

  const provider = rawProvider as AiProvider;
  const apiKey = provider === "google" ? process.env.GEMINI_API_KEY : process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI ที่เลือกยังไม่ได้ตั้งค่า API Key ใน .env.local" },
      { status: 400 },
    );
  }

  const question = replaceUnpairedSurrogates(rawQuestion.trim());

  try {
    const result = await answerFromDocuments(question, provider);
    const selected = provider === "google"
      ? { provider: GOOGLE_PROVIDER_NAME, model: getGoogleModelName() }
      : { provider: GROQ_PROVIDER_NAME, model: getGroqModelName() };
    return NextResponse.json({ ...result, ...selected });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ระบบยังตอบคำถามไม่ได้";
    const status = message.includes("โควตา Google AI เต็ม") || message.includes("โควตา Groq เต็ม")
      ? 429
      : message.includes("ผู้ใช้จำนวนมาก")
        ? 503
        : message.includes("นานเกินไป")
          ? 504
          : message.includes("เชื่อมต่อ Google AI ไม่ได้") || message.includes("เชื่อมต่อ Groq ไม่ได้")
            ? 502
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
