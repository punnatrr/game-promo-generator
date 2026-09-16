export function buildPrompt({
  targetShop,
  referenceShop,
  aspectRatio,
}: {
  targetShop: string;
  referenceShop: string;
  aspectRatio: string;
}) {
  return `
สร้างโพสต์โปรโมทราคาไอเทมในเกมแบบมืออาชีพ โดยต้องยึดภาพอ้างอิงอย่างเคร่งครัด

ภาพอ้างอิง:
- ภาพที่ 1: ใช้เป็น background / main visual
- ภาพที่ 2: ใช้เป็นแหล่งข้อมูลราคา ตัวเลข จำนวน และรูปไอเทมในเกมเท่านั้น ห้ามใช้ UI/style จากภาพนี้
- ภาพที่ 3: ใช้เป็น reference สำหรับ layout, spacing, card layout, typography hierarchy และ UI structure เท่านั้น

ข้อมูลร้าน:
- ร้านของเรา: ${targetShop}
- layout อ้างอิงจากร้าน: ${referenceShop}

STRICT DATA SOURCE RULE:
- Image 2 is the ONLY source for item images, prices, currency symbols, numbers, item quantities, and essential package data.
- Image 2 is a DATA SOURCE ONLY. Do NOT copy, reuse, redraw, imitate, infer, or transfer any UI from Image 2.
- Never use Image 2 card design, box shape, border, button, badge style, background, color palette, gradient, shadows, spacing, typography, layout, decoration, icons used as UI, or visual identity.
- Image 3 is ONLY a layout/composition reference. Do NOT read, copy, reuse, redraw, infer, or transfer any item image, product name, package name, price, number, quantity, badge, icon, currency symbol, or product text from Image 3.
- If Image 2 and Image 3 conflict, always ignore Image 3 product data and use Image 2 only.
- Treat all product/price/item information visible in Image 3 as forbidden content.
- Do not create new product data, prices, packages, item counts, or item artwork by guessing.

กติกาสำคัญ:
1. ห้ามสร้างสินค้า ราคา หรือแพ็คใหม่เอง
2. ราคา จำนวนไอเทม รูปไอเทม ตัวเลข และข้อมูลแพ็คที่จำเป็น ต้องมาจากภาพที่ 2 เท่านั้น
3. ห้ามใช้ราคา ไอเทม แพ็ค ตัวเลข จำนวน ข้อความสินค้า ไอคอน currency symbol หรือ badge ใด ๆ จากภาพที่ 3
4. ห้ามเปลี่ยนข้อความราคา ตัวเลข หรือข้อมูลแพ็คจากภาพที่ 2
5. ใช้ background/main visual จากภาพที่ 1
6. จัด layout ตามภาพที่ 3 ให้ใกล้เคียงที่สุด แต่ใช้เฉพาะตำแหน่ง โครงสร้าง spacing และลำดับความสำคัญของตัวอักษรเท่านั้น
7. ใช้ CI/UI ของร้าน ${targetShop} เป็นหลัก และปรับ price card ให้ดูเป็นของร้าน ${targetShop}
8. ห้ามใช้ UI จากภาพที่ 2 ทุกชนิด เช่น กล่องราคา การ์ดราคา สี เส้นขอบ ปุ่ม badge เงา gradient layout typography หรือ decoration
9. ห้ามสร้างตัวละคร เกม หรือภาพประกอบใหม่ที่ไม่อยู่ในภาพอ้างอิง
10. ต้องเป็นภาพโปรโมทราคาไอเทมเกม อ่านง่าย เหมาะสำหรับโพสต์ขายจริง
11. สร้างภาพในอัตราส่วน ${aspectRatio}

กติกาเฉพาะสำหรับแพ็คราคา:
12. แพ็คราคา/การ์ดราคา/กล่องสินค้า ต้องออกแบบ UI ใหม่ทั้งหมดให้เข้ากับร้าน ${targetShop}
13. ข้อมูลภายในแพ็ค เช่น จำนวนไอเทม ราคา และรูปไอเทม ต้องมาจากภาพที่ 2 เท่านั้น ห้ามมาจากภาพที่ 3 โดยเด็ดขาด
14. Extract only the item artwork and price text from Image 2; discard every UI layer from Image 2.
15. ห้าม copy กล่องราคา การ์ดราคา สีปุ่ม สีกรอบ เงา รูปทรง แถบราคา badge หรือ layout ใด ๆ จากภาพที่ 2
16. ถ้า UI ของภาพที่ 2 หรือภาพที่ 3 ขัดกับ CI ของร้าน ${targetShop} ให้คงเฉพาะข้อมูลสินค้าและราคาจากภาพที่ 2 เท่านั้น แล้วเปลี่ยน visual style ให้เป็นของ ${targetShop}
17. ก่อนสร้างผลลัพธ์ ให้ตรวจซ้ำว่าไม่มี UI ใด ๆ จากภาพที่ 2 และไม่มีราคา ไอเทม แพ็ค ตัวเลข หรือข้อความสินค้าใด ๆ จากภาพที่ 3

ผลลัพธ์:
- เป็นโพสต์โปรโมทไอเทมเกม 1 ภาพ
- เน้นราคาและแพ็คสินค้าจากภาพที่ 2 เท่านั้น
- คมชัด สะอาด มืออาชีพ
- ห้ามหลุดไปเป็นโปสเตอร์เกมทั่วไป
`;
}

export function buildRefinePrompt({
  editInstruction,
  targetShop,
  referenceShop,
  aspectRatio,
}: {
  editInstruction: string;
  targetShop?: string;
  referenceShop?: string;
  aspectRatio?: string;
}) {
  return `
แก้ไขภาพโปรโมทราคาไอเทมเกมจากภาพผลลัพธ์เดิมที่แนบมา

คำสั่งแก้ไขจากผู้ใช้:
${editInstruction}

บริบทเดิม:
- ร้านของเรา: ${targetShop || "ไม่ระบุ"}
- layout อ้างอิงจากร้าน: ${referenceShop || "ไม่ระบุ"}
- อัตราส่วนภาพ: ${aspectRatio || "คงอัตราส่วนเดิม"}

กติกาการแก้ไข:
1. ห้ามสร้างภาพใหม่ทั้งหมดจากศูนย์
2. ให้แก้เฉพาะจุดที่ผู้ใช้ร้องขอ
3. รักษา layout เดิม composition เดิม และข้อมูลเดิมให้มากที่สุด
4. ห้ามเปลี่ยนราคา จำนวนแพ็ค ชื่อแพ็ค หรือข้อมูลสินค้าเดิมโดยไม่ได้รับคำสั่ง
5. ห้ามเปลี่ยนเกม/ไอเทมหลักให้กลายเป็นอย่างอื่น
6. ถ้าผู้ใช้ขอแก้แพ็คราคา ให้ปรับเฉพาะ UI ของการ์ดราคา สี กรอบ ปุ่ม spacing และ readability
7. แพ็คราคา/การ์ดราคา ต้องเข้ากับ CI ของร้าน ${targetShop || "ร้านของเรา"} เท่านั้น
8. ห้ามเพิ่มราคา ไอเทม แพ็ค ตัวเลข หรือข้อความสินค้าใหม่ที่ไม่มีอยู่ในภาพผลลัพธ์เดิม
9. ให้ภาพยังดูเป็นโพสต์ขายไอเทมเกมระดับมืออาชีพ
10. คงอัตราส่วนภาพเป็น ${aspectRatio || "อัตราส่วนเดิม"}

เป้าหมาย:
- ปรับภาพเดิมให้ดีขึ้นตามคำสั่ง
- คงความต่อเนื่องจากภาพผลลัพธ์ล่าสุด
- ไม่หลุดจากโจทย์โปรโมทราคาไอเทมเกม
`;
}
