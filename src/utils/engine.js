// 1. 일요일 날짜 자동 계산
export const getSundays = (year, months) => {
  let dates = [];
  months.forEach(month => {
    let date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
      if (date.getDay() === 0) dates.push(new Date(date).toISOString().split('T')[0]);
      date.setDate(date.getDate() + 1);
    }
  });
  return dates;
};

// 2. 핵심 제약 조건 검증
export const validate = (dish, wipe, members, lastWeekNames) => {
  const allToday = [...dish, ...wipe];

  // 규칙: 2주 연속 참여 금지
  if (allToday.some(name => lastWeekNames.includes(name))) return false;

  // 규칙: 가족 동시 배정 금지 (가족ID가 모두 달라야 함)
  const families = allToday.map(name => members.find(m => m.name === name)?.familyId);
  if (new Set(families).size !== 4) return false;

  // 규칙: B그룹끼리 묶기 금지 (설거지팀, 식기팀 각각 B그룹은 최대 1명)
  const isB = (name) => members.find(m => m.name === name)?.group === 'B';
  if (dish.filter(isB).length > 1 || wipe.filter(isB).length > 1) return false;

  // 규칙: 특정 금지 조합 (장하은-박창욱/현진실)
  if (dish.includes("장하은") && (dish.includes("박창욱") || dish.includes("현진실"))) return false;

  return true;
};