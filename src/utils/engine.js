// 특정 연도/월의 일요일 계산
export const getSundays = (year, months) => {
  const sundays = [];
  months.forEach(month => {
    let d = new Date(year, month - 1, 1);
    while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
    while (d.getMonth() === month - 1) {
      const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      sundays.push(dateStr);
      d.setDate(d.getDate() + 7);
    }
  });
  return sundays;
};

// 마지막 당번일 및 페어링 이력 계산
const getDutyMetadata = (history, members) => {
  const lastServed = {};
  const pairingHistory = {}; // { '이름1-이름2': '마지막 날짜' }

  members.forEach(m => {
    lastServed[m.name] = "1970-01-01";
    members.forEach(m2 => {
      if (m.name !== m2.name) {
        const key = [m.name, m2.name].sort().join('-');
        pairingHistory[key] = "1970-01-01";
      }
    });
  });

  if (history?.data) {
    history.data.forEach(session => {
      session.records.forEach(record => {
        record.allNames.forEach(name => {
          if (record.date > (lastServed[name] || "1970-01-01")) lastServed[name] = record.date;
        });
        // 같은 조(dish/wipe) 페어링 기록 저장
        const updatePair = (group) => {
          if (group.length === 2) {
            const key = [...group].sort().join('-');
            if (record.date > (pairingHistory[key] || "1970-01-01")) pairingHistory[key] = record.date;
          }
        };
        updatePair(record.dish);
        updatePair(record.wipe);
      });
    });
  }
  return { lastServed, pairingHistory };
};

// 슬롯 유효성 검사
export const validateSlot = (name, partnerName, dayAllNames, allMembers, lastWeekNames) => {
  const m = allMembers.find(mem => mem.name === name);
  if (!m) return false;

  if (lastWeekNames.includes(name)) return false; // 2주 연속 금지
  if (dayAllNames.includes(name)) return false; // 중복 당번 금지

  // 가족 중복 금지
  const dayFamilies = dayAllNames.map(n => allMembers.find(mem => mem.name === n)?.familyId).filter(id => id && id !== "NONE");
  if (m.familyId !== "NONE" && dayFamilies.includes(m.familyId)) return false;

  // B그룹 중복 금지 (조 내 1명)
  if (m.isBGroup && partnerName) {
    const partner = allMembers.find(mem => mem.name === partnerName);
    if (partner?.isBGroup) return false;
  }

  // 장하은 기피 리스트 (같은 조 내에서만)
  if (m.exclusionList && m.exclusionList.includes(partnerName)) return false;
  const p = allMembers.find(mem => mem.name === partnerName);
  if (p?.exclusionList && p.exclusionList.includes(name)) return false;

  return true;
};

export const generateSchedule = (targetDates, members, history) => {
  let tempHistory = JSON.parse(JSON.stringify(history));
  let schedule = [];
  let lastWeek = (tempHistory.data.length > 0) ? tempHistory.data[tempHistory.data.length - 1].records.slice(-1)[0].allNames : [];

  for (const date of targetDates) {
    const { lastServed, pairingHistory } = getDutyMetadata(tempHistory, members);
    const dayNames = [];

    // 1. 설거지 조 (18명 중 2명)
    const dishCandidates = members.filter(m => m.canDishwash).sort((a, b) => new Date(lastServed[a.name]) - new Date(lastServed[b.name]));
    let dish = [];
    
    for (let i = 0; i < dishCandidates.length; i++) {
      const a = dishCandidates[i];
      if (!validateSlot(a.name, null, dayNames, members, lastWeek)) continue;
      
      // 파트너 찾기 (A와 페어링 이력이 가장 오래된 사람)
      const partners = dishCandidates.filter(p => p.name !== a.name)
        .sort((p1, p2) => {
          const key1 = [a.name, p1.name].sort().join('-');
          const key2 = [a.name, p2.name].sort().join('-');
          return new Date(pairingHistory[key1]) - new Date(pairingHistory[key2]);
        });

      for (let b of partners) {
        if (validateSlot(b.name, a.name, [...dayNames, a.name], members, lastWeek)) {
          dish = [a.name, b.name];
          break;
        }
      }
      if (dish.length === 2) break;
    }

    dayNames.push(...dish);

    // 2. 식기닦기 조 (22명 중 2명, 설거지 제외)
    const wipeCandidates = members.sort((a, b) => new Date(lastServed[a.name]) - new Date(lastServed[b.name]));
    let wipe = [];

    for (let i = 0; i < wipeCandidates.length; i++) {
      const a = wipeCandidates[i];
      if (dayNames.includes(a.name) || !validateSlot(a.name, null, dayNames, members, lastWeek)) continue;

      const partners = wipeCandidates.filter(p => p.name !== a.name && !dayNames.includes(p.name))
        .sort((p1, p2) => {
          const key1 = [a.name, p1.name].sort().join('-');
          const key2 = [a.name, p2.name].sort().join('-');
          return new Date(pairingHistory[key1]) - new Date(pairingHistory[key2]);
        });

      for (let b of partners) {
        if (validateSlot(b.name, a.name, [...dayNames, a.name], members, lastWeek)) {
          wipe = [a.name, b.name];
          break;
        }
      }
      if (wipe.length === 2) break;
    }

    const record = { date, dish, wipe, allNames: [...dish, ...wipe] };
    schedule.push(record);
    tempHistory.data.push({ records: [record] });
    lastWeek = record.allNames;
  }
  return schedule;
};