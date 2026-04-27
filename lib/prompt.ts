export function buildPrompt({
  targetShop,
  referenceShop,
  forbiddenShop,
}: {
  targetShop: string;
  referenceShop: string;
  forbiddenShop: string;
}) {
  return `
สร้างโพสต์โปรโมทราคาไอเทมเกมแบบมืออาชีพ

INPUT:
- ภาพที่ 1: background
- ภาพที่ 2: ราคา + ไอเทม
- ภาพที่ 3: layout reference

RULES:
1. ใช้ราคาและไอเทมจากภาพที่ 2 เท่านั้น
2. ใช้ background จากภาพที่ 1
3. layout อ้างอิงจาก ${referenceShop}
4. ใช้ CI/UI ของ ${targetShop} เท่านั้น
5. ห้ามใช้ UI ของ ${forbiddenShop}
6. ห้ามเปลี่ยนราคา
7. ทำให้ดู premium อ่านง่าย
8. ขนาด 1:1
`;
}