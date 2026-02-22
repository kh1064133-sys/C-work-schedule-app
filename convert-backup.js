const fs = require('fs');
const crypto = require('crypto');

// 구형 백업 파일 읽기
const oldData = JSON.parse(fs.readFileSync('../일정매출관리_20260216.json', 'utf8'));

const TEMP_USER_ID = '00000000-0000-0000-0000-000000000001';

function generateUUID() {
  return crypto.randomUUID();
}

function convertSchedules(oldSchedules) {
  const newSchedules = [];
  let sortOrder = 0;
  
  for (const [date, timeSlots] of Object.entries(oldSchedules)) {
    for (const [hour, schedule] of Object.entries(timeSlots)) {
      // 빈 스케줄 건너뛰기
      if (!schedule.title && !schedule.memo && !schedule.amount) continue;
      
      const timeSlot = `${hour.padStart(2, '0')}:00`;
      
      newSchedules.push({
        id: generateUUID(),
        user_id: TEMP_USER_ID,
        date: date,
        time_slot: timeSlot,
        title: schedule.title || null,
        unit: schedule.unit || null,
        memo: schedule.memo || null,
        schedule_type: schedule.type || null,
        amount: schedule.amount ? parseInt(schedule.amount, 10) : 0,
        payment_method: schedule.payment || null,
        is_done: schedule.done || false,
        is_reserved: schedule.reserved || false,
        sort_order: sortOrder++,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }
  
  return newSchedules;
}

function convertClients(oldClients) {
  return oldClients.map(client => ({
    id: generateUUID(),
    user_id: TEMP_USER_ID,
    name: client.name,
    type: client.type || null,
    address: client.addr || null,  // addr -> address
    bunji: client.bunji || null,
    households: client.households || null,
    memo: client.memo || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
}

function convertItems(oldItems) {
  return oldItems.map(item => ({
    id: generateUUID(),
    user_id: TEMP_USER_ID,
    name: item.name,
    price: item.price || 0,
    category: item.cat || null,  // cat -> category
    memo: item.memo || null,
    photo_url: item.photo || null,  // photo -> photo_url
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
}

// 변환 실행
const newData = {
  version: '1.0',
  exportedAt: new Date().toISOString(),
  schedules: convertSchedules(oldData.schedules || {}),
  clients: convertClients(oldData.clients || []),
  items: convertItems(oldData.items || [])
};

// 새 파일로 저장
const outputPath = '../일정매출관리_변환완료.json';
fs.writeFileSync(outputPath, JSON.stringify(newData, null, 2), 'utf8');

console.log('변환 완료!');
console.log(`- 스케줄: ${newData.schedules.length}건`);
console.log(`- 거래처: ${newData.clients.length}건`);
console.log(`- 품목: ${newData.items.length}건`);
console.log(`저장 위치: ${outputPath}`);
