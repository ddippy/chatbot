// เก็บข้อความตัวอย่างจากเอกสาร พร้อมชื่อไฟล์และเลขหน้าไว้อ้างอิง
export const documentChunks = [
  {
    documentName: "คู่มือนักศึกษาตัวอย่าง.pdf",
    page: 1,
    content: "นักศึกษาสามารถติดต่อฝ่ายทะเบียนในวันและเวลาราชการ",
  },
  {
    documentName: "คู่มือนักศึกษาตัวอย่าง.pdf",
    page: 2,
    content: "การยื่นคำร้องต้องแนบเอกสารตามที่มหาวิทยาลัยกำหนด",
  },
];

// ค้นข้อความตัวอย่าง โดยตรวจว่ามีคำที่ผู้ใช้ถามอยู่ในเนื้อหาหรือไม่
export function searchDocuments(question: string) {
  const searchText = question.trim().toLowerCase();

  return documentChunks.filter((chunk) =>
    chunk.content.toLowerCase().includes(searchText),
  );
}