import { NextResponse } from "next/server";
import { answerFromDocuments } from "@/lib/rag";
import { replaceUnpairedSurrogates } from "@/scripts/text-utils.mjs";

export const maxDuration = 60;

// รับคำถามจากหน้าเว็บ แล้วส่งให้ระบบ RAG ประมวลผลบนเซิร์ฟเวอร์
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rawQuestion = body?.question;

  if (typeof rawQuestion !== "string" || !rawQuestion.trim()) {
    return NextResponse.json({ error: "กรุณาพิมพ์คำถามก่อนส่ง" }, { status: 400 });
  }

  if (rawQuestion.length > 1000) {
    return NextResponse.json({ error: "คำถามยาวเกินไป กรุณาย่อคำถามให้สั้นลง" }, { status: 400 });
  }

  const question = replaceUnpairedSurrogates(rawQuestion.trim());

  try {
    const result = await answerFromDocuments(question);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ระบบยังตอบคำถามไม่ได้";
    const status = message.includes("โควตา Groq เต็ม") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
