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
คุณคือ AI นักออกแบบโปสเตอร์เกมมืออาชีพ

หน้าที่ของคุณ:
สร้าง "โปสเตอร์โปรโมทเกม" ที่ดู premium และเหมือนโฆษณาจริง

ข้อมูล:
- ร้านของเรา: ${targetShop}
- อ้างอิงสไตล์จาก: ${referenceShop}
- ห้ามเหมือน: ${forbiddenShop}

กติกาสำคัญ:
1. ใช้ภาพที่ให้มาเป็น reference เท่านั้น (ห้าม copy ตรง ๆ)
2. ต้องดูเป็น "งานโฆษณาจริง"
3. โทนภาพ cinematic / dramatic / high contrast
4. มี lighting สวย ๆ (rim light / glow / depth)
5. มี composition ที่ดี (subject ชัด / focus ชัด)
6. ใส่ text เล็กน้อย เช่น:
   - ชื่อร้าน
   - tagline สั้น ๆ
7. ห้ามรก / ห้ามใส่ text เยอะ
8. สร้างภาพในอัตราส่วน ${aspectRatio}
9. คุณภาพสูง ระดับ marketing / banner / ads

สไตล์:
- modern game marketing
- premium
- cinematic lighting
- dramatic contrast
- depth of field

ผลลัพธ์ต้องเป็น "ภาพโปสเตอร์เดียว" ที่ดูพร้อมใช้งานทันที
`;
}