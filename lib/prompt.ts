export function buildPrompt({
  targetShop,
  referenceShop,
  forbiddenShop,
  aspectRatio,
}: {
  targetShop: string;
  referenceShop: string;
  forbiddenShop: string;
  aspectRatio: string;
}) {
  return `
สร้างโพสต์โปรโมทราคาไอเทมในเกมแบบมืออาชีพ โดยต้องยึดภาพอ้างอิงอย่างเคร่งครัด

ภาพอ้างอิง:
- ภาพที่ 1: ใช้เป็น background / main visual
- ภาพที่ 2: ใช้ราคาแพ็ค ข้อมูลแพ็ค และรูปไอเทมในเกมเท่านั้น
- ภาพที่ 3: ใช้เป็น reference สำหรับ layout, spacing, card layout, typography hierarchy และ UI structure

ข้อมูลร้าน:
- ร้านของเรา: ${targetShop}
- layout อ้างอิงจากร้าน: ${referenceShop}
- ห้ามใช้ UI/CI ของร้าน: ${forbiddenShop}

กติกาสำคัญ:
1. ห้ามสร้างสินค้า ราคา หรือแพ็คใหม่เอง
2. ราคา แพ็ค จำนวนไอเทม และรูปไอเทม ต้องมาจากภาพที่ 2 เท่านั้น
3. ห้ามเปลี่ยนข้อความราคา ตัวเลข หรือข้อมูลแพ็คจากภาพที่ 2
4. ใช้ background/main visual จากภาพที่ 1
5. จัด layout ตามภาพที่ 3 ให้ใกล้เคียงที่สุด
6. ใช้ CI/UI ของร้าน ${targetShop} เท่านั้น
7. ห้ามใช้ CI/UI, สี, โลโก้, ฟอนต์ หรือ visual identity ของ ${forbiddenShop}
8. ห้ามสร้างตัวละคร เกม หรือภาพประกอบใหม่ที่ไม่อยู่ในภาพอ้างอิง
9. ต้องเป็นภาพโปรโมทราคาไอเทมเกม อ่านง่าย เหมาะสำหรับโพสต์ขายจริง
10. สร้างภาพในอัตราส่วน ${aspectRatio}

ผลลัพธ์:
- เป็นโพสต์โปรโมทไอเทมเกม 1 ภาพ
- เน้นราคาและแพ็คสินค้า
- คมชัด สะอาด มืออาชีพ
- ห้ามหลุดไปเป็นโปสเตอร์เกมทั่วไป
`;
}