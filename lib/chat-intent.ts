// แยกคำทักทาย คำถามทั่วไป และคำถามที่ควรค้นจากเอกสารมหาวิทยาลัย
export type ChatIntent = "smalltalk" | "general" | "university";

const SMALLTALK_PATTERN =
  /^(สวัสดี|หวัดดี|ดี|hello|hi|hey|goodmorning|goodevening|ขอบคุณ|ขอบใจ|thanks|thankyou|ลาก่อน|บาย)(ครับ|ค่ะ|คะ|นะ|จ้า|จ้ะ|มาก|มากครับ|มากค่ะ)?$/u;

const UNIVERSITY_TOPIC_PATTERN =
  /(มหาวิทยาลัย|มหาลัย|มทร|rmutk|คณะ|สาขาวิชา|หลักสูตร|ค่าเทอม|ค่าเล่าเรียน|ค่าธรรมเนียม|ค่าหน่วยกิต|ลงทะเบียน|ทะเบียน|ภาคเรียน|ภาคการศึกษา|ปีการศึกษา|เทอม|นักศึกษา|อาจารย์|รายวิชา|ตารางเรียน|ตารางสอบ|วันสอบ|สอบกลางภาค|สอบปลายภาค|ทุนการศึกษา|หอพัก|รับสมัคร|สมัครเรียน|ปฏิทินการศึกษา|หน่วยกิต|เกรด|ฝึกงาน|รายงานตัว|บัตรนักศึกษา|ชำระเงิน|วิทยาเขต|เปิดเทอม|ปิดเทอม|เปิดเรียน|ปิดเรียน|กำหนดการ|ห้องเรียน|เอกสารการศึกษา)/iu;

const DEFINITION_PATTERN = /(คืออะไร|หมายถึงอะไร|แปลว่าอะไร)/u;
const EXPLICIT_UNIVERSITY_FACT_PATTERN =
  /(มหาวิทยาลัย|มหาลัย|มทร|rmutk|เท่าไหร่|เท่าไร|วันไหน|เมื่อไหร่|เมื่อไร|กำหนดการ|ปีการศึกษา|ลงทะเบียน|รับสมัคร|ตารางสอบ|วันสอบ|ชำระเงิน)/iu;

// คำทักทายตอบได้ทันที ส่วนคำถามเรื่องมหาวิทยาลัยต้องค้นเอกสารก่อน
export function detectChatIntent(question: string): ChatIntent {
  const normalized = question
    .trim()
    .toLocaleLowerCase("th-TH")
    .replace(/[\s.,!?…。ๆ]+/gu, "");

  if (SMALLTALK_PATTERN.test(normalized)) return "smalltalk";
  if (
    DEFINITION_PATTERN.test(question) &&
    !EXPLICIT_UNIVERSITY_FACT_PATTERN.test(question)
  ) {
    return "general";
  }
  if (UNIVERSITY_TOPIC_PATTERN.test(question)) return "university";

  return "general";
}
