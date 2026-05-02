// 특정 연도와 월의 일요일 날짜 목록 생성
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

// 각 멤버별 마지막 당번 날짜 계산 (주기성 확보)
const getLastAssignmentDates = (history, members) => {
  const lastDates = {};
  members.forEach(m => { lastDates[m.name] = "1970-01-01"; });

  if (history && history.data) {
    history.data.forEach(session => {
      session.records.forEach(record => {
        record.allNames.forEach(name => {
          if (record.date > (lastDates[name] || "1970-01-01")) lastDates[name] = record.date;
        });
      });
    });
  }
  return lastDates;
};

// 슬롯별 유효성 검사 (가족, B그룹, 특정 기피 대상 등)
export const validateSlot = (name, subGroup, otherInSubGroup, dayAllNames, allMembers, lastWeekNames) => {
  const member = allMembers.find(m => m.name === name);
  if (!member) return false;

  // 1. 2주 연속 참여 금지
  if (lastWeekNames.includes(name)) return false;

  // 2. 가족 중복 금지
  const familiesOnDay = dayAllNames.map(n => allMembers.find(m => m.name === n)?.familyId).filter(id => id && id !== "NONE");
  if (member.familyId !== "NONE" && familiesOnDay.includes(member.familyId)) return false;

  // 3. B그룹 중복 금지 (같은 조 내 1명 제한)
  if (member.isBGroup && otherInSubGroup.some(n => allMembers.find(m => m.name === n)?.isBGroup)) return false;

  // 4. 특정 금지 조합 (장하은 님 등 - 같은 조 내에서만 체크)
  if (member.exclusionList && member.exclusionList.some(ex => otherInSubGroup.includes(ex))) return false;
  const otherMember = allMembers.find(m => m.name === otherInSubGroup[0]);
  if (otherMember?.exclusionList && otherMember.exclusionList.includes(name)) return false;

  return true;
};

// 순번 기반 자동 생성 로직
export const generateSchedule = (targetDates, members, history, fixedAndExcluded) => {
  const fullHistory = history;
  let currentHistoryRecords = [];
  let schedule = [];
  
  let lastWeek = (fullHistory.data && fullHistory.data.length > 0) 
    ? fullHistory.data[fullHistory.data.length - 1].records.slice(-1)[0].allNames 
    : [];

  for (const date of targetDates) {
    const lastDates = getLastAssignmentDates({ data: [...fullHistory.data, { records: currentHistoryRecords }] }, members);
    const sortedMembers = [...members].sort((a, b) => new Date(lastDates[a.name]) - new Date(lastDates[b.name]));

    let dayDish = [];
    let dayWipe = [];
    
    const fillSlot = (currentGroup, isDish) => {
      for (const m of sortedMembers) {
        if (dayDish.includes(m.name) || dayWipe.includes(m.name)) continue;
        if (isDish && !m.canDishwash) continue; // 설거지 제외 인원 체크

        if (validateSlot(m.name, isDish ? "dish" : "wipe", currentGroup, [...dayDish, ...dayWipe], members, lastWeek)) {
          currentGroup.push(m.name);
          return true;
        }
      }
      return false;
    };

    while (dayDish.length < 2) if (!fillSlot(dayDish, true)) break;
    while (dayWipe.length < 2) if (!fillSlot(dayWipe, false)) break;

    const record = { date, dish: dayDish, wipe: dayWipe, allNames: [...dayDish, ...dayWipe] };
    schedule.push(record);
    currentHistoryRecords.push(record);
    lastWeek = record.allNames;
  }
  return schedule;
};