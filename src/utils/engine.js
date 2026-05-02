export const getSundays = (year, months) => {
  const sundays = [];
  months.forEach(month => {
    let d = new Date(year, month - 1, 1);
    while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
    while (d.getMonth() === month - 1) {
      sundays.push(new Date(d).toISOString().split('T')[0]);
      d.setDate(d.getDate() + 7);
    }
  });
  return sundays;
};

export const validate = (dish, wipe, allMembers, fullHistory, currentSchedule) => {
  const currentTeam = [...dish, ...wipe];

  // 1. 2주 연속 참여 금지 체크
  // 이번 주 생성 중인 목록의 직전 주 혹은 DB의 마지막 기록 확인
  const lastWeek = currentSchedule.length > 0 
    ? currentSchedule[currentSchedule.length - 1].allNames 
    : (fullHistory && fullHistory.data && fullHistory.data.length > 0 
        ? fullHistory.data[fullHistory.data.length - 1].records.slice(-1)[0].allNames 
        : []);
    
  if (currentTeam.some(name => lastWeek.includes(name))) return false;

  // 2. 가족 동시 배정 금지 (familyId가 같은 경우)
  const families = currentTeam.map(n => allMembers.find(m => m.name === n)?.familyId);
  const activeFamilies = families.filter(id => id && id !== "NONE");
  if (new Set(activeFamilies).size !== activeFamilies.length) return false;

  // 3. B그룹끼리 매칭 금지 (설거지 조/닦기 조 각각에 B그룹은 최대 1명만 허용)
  const isB = (name) => allMembers.find(m => m.name === name)?.isBGroup;
  if (dish.filter(isB).length > 1 || wipe.filter(isB).length > 1) return false;

  // 4. 특정 금지 조합 체크 (exclusionList 활용)
  for (const name of currentTeam) {
    const member = allMembers.find(m => m.name === name);
    if (member?.exclusionList?.some(ex => currentTeam.includes(ex))) return false;
  }

  return true;
};