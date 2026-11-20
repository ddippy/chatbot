import { generateGoogleAnswer } from "./google";
import { generateGroqAnswer } from "./groq";

// ตอบคำถามทั่วไปแบบสั้น โดยไม่ค้นหรืออ้างว่าใช้เอกสารมหาวิทยาลัย
export async function answerGeneralQuestion(
  question: string,
  provider: "google" | "groq",
) {
  const systemInstruction =
    "คุณเป็นผู้ช่วยตอบคำถามทั่วไป ตอบเป็นภาษาไทยอย่างกระชับ 1-3 ประโยค " +
    "ห้ามแต่งข้อมูลเฉพาะของมหาวิทยาลัย เช่น ค่าใช้จ่าย กำหนดการ การรับสมัคร หรือระเบียบ " +
    "หากคำถามต้องใช้ข้อมูลเฉพาะของมหาวิทยาลัย ให้บอกว่าควรถามโดยระบุเรื่องมหาวิทยาลัยเพื่อค้นเอกสาร " +
    "ถ้าไม่มั่นใจ ให้บอกตรง ๆ ว่าไม่แน่ใจ และอย่าอ้างว่าได้ค้นจากเอกสาร";

  return provider === "groq"
    ? generateGroqAnswer(systemInstruction, question)
    : generateGoogleAnswer(systemInstruction, question);
}
