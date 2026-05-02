// 연도와 월을 기반으로 해당 월의 모든 일요일 날짜를 계산합니다.
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
const getDutyMetadata = (history, members, currentSessionName) => {
  const lastAny = {};
  const lastDish = {};
  const lastWipe = {};
  const pairingHistory = {};

  members.forEach(m => {
    lastAny[m.name] = lastDish[m.name] = lastWipe[m.name] = "1970-01-01";
    members.forEach(m2 => {
      if (m.name !== m2.name) pairingHistory[[m.name, m2.name].sort().join('-')] = "1970-01-01";
    });
  });

  // 현재 생성하려는 세션(예: 2026년 7,8월)과 동일한 기록은 계산에서 제외하여 로직 꼬임을 방지합니다.
  const filteredData = history?.data?.filter(s => s.sessionId !== currentSessionName) || [];

  filteredData.forEach(session => {
    session.records.forEach(r => {
      r.allNames.forEach(n => { if (r.date > lastAny[n]) lastAny[n] = r.date; });
      r.dish.forEach(n => { if (r.date > lastDish[n]) lastDish[n] = r.date; });
      r.wipe.forEach(n => { if (r.date > lastWipe[n]) lastWipe[n] = r.date; });
      const updatePair = (group) => {
        if (group.length === 2) {
          const key = [...group].sort().join('-');
          if (r.date > pairingHistory[key]) pairingHistory[key] = r.date;
        }
      };
      updatePair(r.dish); updatePair(r.wipe);
    });
  });
  return { lastAny, lastDish, lastWipe, pairingHistory };
};

// 유효성 검사 (가족, B그룹, 기피 인원 등)
export const validateSlot = (name, partner, dayAll, allMembers, lastWeek) => {
  const m = allMembers.find(mem => mem.name === name);
  if (!m || lastWeek.includes(name) || dayAll.includes(name)) return false;
  const dayFamilies = dayAll.map(n => allMembers.find(mem => mem.name === n)?.familyId).filter(id => id && id !== "NONE");
  if (m.familyId !== "NONE" && dayFamilies.includes(m.familyId)) return false;
  if (m.isBGroup && partner && allMembers.find(mem => mem.name === partner)?.isBGroup) return false;
  if (m.exclusionList?.includes(partner)) return false;
  return true;
};

// 메인 스케줄 생성 함수
export const generateSchedule = (dates, members, history, currentSessionName) => {
  let tempHistory = JSON.parse(JSON.stringify(history));
  // 생성 시점에 기존 동명 세션 데이터를 제거하여 순번 왜곡을 막습니다.
  tempHistory.data = tempHistory.data.filter(s => s.sessionId !== currentSessionName);
  
  let schedule = [];
  let lastWeek = (tempHistory.data.length > 0) ? tempHistory.data[tempHistory.data.length - 1].records.slice(-1)[0].allNames : [];

  for (const date of dates) {
    const { lastAny, lastDish, lastWipe, pairingHistory } = getDutyMetadata(tempHistory, members, currentSessionName);
    const dayNames = [];

    // 동일 순번 내 무작위성을 부여하기 위한 헬퍼 함수
    const sortWithRandom = (a, b, lastMap) => {
      const diff = new Date(lastMap[a.name]) - new Date(lastMap[b.name]);
      return diff !== 0 ? diff : Math.random() - 0.5;
    };

    // 1. 설거지 조 (18명 중 2명)
    const dishCand = members.filter(m => m.canDishwash).sort((a, b) => sortWithRandom(a, b, lastDish));
    let dish = [];
    for (let a of dishCand) {
      if (!validateSlot(a.name, null, dayNames, members, lastWeek)) continue;
      const partners = dishCand.filter(p => p.name !== a.name).sort((p1, p2) => {
        const k1 = [a.name, p1.name].sort().join('-');
        const k2 = [a.name, p2.name].sort().join('-');
        const d = new Date(pairingHistory[k1]) - new Date(pairingHistory[k2]);
        return d !== 0 ? d : Math.random() - 0.5;
      });
      for (let b of partners) {
        if (validateSlot(b.name, a.name, [...dayNames, a.name], members, lastWeek)) {
          dish = [a.name, b.name]; break;
        }
      }
      if (dish.length === 2) break;
    }
    dayNames.push(...dish);

    // 2. 식기닦기 조 (22명 중 2명)
    const wipeCand = [...members].sort((a, b) => sortWithRandom(a, b, lastWipe));
    let wipe = [];
    for (let a of wipeCand) {
      if (dayNames.includes(a.name) || !validateSlot(a.name, null, dayNames, members, lastWeek)) continue;
      const partners = wipeCand.filter(p => p.name !== a.name && !dayNames.includes(p.name)).sort((p1, p2) => {
        const k1 = [a.name, p1.name].sort().join('-');
        const k2 = [a.name, p2.name].sort().join('-');
        const d = new Date(pairingHistory[k1]) - new Date(pairingHistory[k2]);
        return d !== 0 ? d : Math.random() - 0.5;
      });
      for (let b of partners) {
        if (validateSlot(b.name, a.name, [...dayNames, a.name], members, lastWeek)) {
          wipe = [a.name, b.name]; break;
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