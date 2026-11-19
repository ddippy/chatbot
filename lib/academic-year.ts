// แปลงเลขไทยเป็นเลขอารบิกก่อนตรวจหาปีการศึกษา
function normalizeThaiDigits(value: string) {
  const thaiDigits = "๐๑๒๓๔๕๖๗๘๙";
  return value.replace(/[๐-๙]/g, (digit) => String(thaiDigits.indexOf(digit)));
}

// อ่านปีจากชื่อเอกสารที่มีปี พ.ศ. เช่น ปฏิทินการศึกษา 2569.pdf
function getDocumentYear(documentName: string) {
  const match = normalizeThaiDigits(documentName).match(/25\d{2}/);
  return match ? Number(match[0]) : null;
}

// แปลงปี ค.ศ. เป็น พ.ศ. และปีสองหลักให้เป็นปี พ.ศ. เต็ม
function toAcademicYear(year: number, isShortYear = false) {
  if (isShortYear) return 2500 + year;
  if (year >= 2000 && year < 2100) return year + 543;
  return year;
}

// อ่านปีที่ผู้ใช้ระบุ ทั้งเลขไทย เลขอารบิก ปี ค.ศ. และปีสองหลัก
export function getRequestedAcademicYears(question: string) {
  const normalizedQuestion = normalizeThaiDigits(question);
  const fullYears = Array.from(
    normalizedQuestion.matchAll(/\b(20\d{2}|25\d{2})\b/g),
    (match) => toAcademicYear(Number(match[1])),
  );
  const shortYears = Array.from(
    normalizedQuestion.matchAll(/(?:ปีการศึกษา|ปี)\s*(\d{2})(?!\d)/g),
    (match) => toAcademicYear(Number(match[1]), true),
  );

  return Array.from(new Set([...fullYears, ...shortYears]));
}

type YearScopedDocument = { document_name: string };

// ถ้าผู้ใช้ไม่ได้ระบุปี ให้เลือกปีล่าสุดจากเอกสารที่ค้นพบ
export function selectMatchesForAcademicYear<T extends YearScopedDocument>(
  question: string,
  candidates: T[],
  maxMatches: number,
) {
  const requestedYears = getRequestedAcademicYears(question);
  const availableYears = Array.from(
    new Set(
      candidates
        .map((candidate) => getDocumentYear(candidate.document_name))
        .filter((year): year is number => year !== null),
    ),
  ).sort((first, second) => first - second);
  const yearsToUse = requestedYears.length
    ? requestedYears
    : availableYears.length
      ? [availableYears[availableYears.length - 1]]
      : [];

  if (yearsToUse.length === 0) {
    return { yearsToUse, matches: candidates.slice(0, maxMatches) };
  }

  const matches = candidates
    .filter((candidate) => {
      const documentYear = getDocumentYear(candidate.document_name);
      return documentYear !== null && yearsToUse.includes(documentYear);
    })
    .slice(0, maxMatches);

  return { yearsToUse, matches };
}
