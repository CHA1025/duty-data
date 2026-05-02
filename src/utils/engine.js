// 특정 연도/월의 모든 일요일 날짜 계산
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

// 각 멤버별 마지막 당번 데이터(전체/설거지/식기닦기) 및 조합 기록 추출
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

  // 현재 생성하려는 달의 기록이 이미 저장되어 있다면 계산에서 제외하여 중복 방지
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

// 슬롯별 유효성 검사 (가족, B그룹, 기피 인원 등)
export const validateSlot = (name, partner, dayAll, allMembers, lastWeek) => {
  const m = allMembers.find(mem => mem.name === name);
  if (!m || lastWeek.includes(name) || dayAll.includes(name)) return false;

  const dayFamilies = dayAll.map(n => allMembers.find(mem => mem.name === n)?.familyId).filter(id => id && id !== "NONE");
  if (m.familyId !== "NONE" && dayFamilies.includes(m.familyId)) return false;

  if (m.isBGroup && partner && allMembers.find(mem => mem.name === partner)?.isBGroup) return false;
  if (m.exclusionList?.includes(partner)) return false;

  return true;
};

// 메인 스케줄 생성 함수 (엄격한 순번제)
export const generateSchedule = (dates, members, history, currentSessionName) => {
  let tempHistory = JSON.parse(JSON.stringify(history));
  tempHistory.data = tempHistory.data.filter(s => s.sessionId !== currentSessionName);
  
  let schedule = [];
  let lastWeek = (tempHistory.data.length > 0) ? tempHistory.data[tempHistory.data.length - 1].records.slice(-1)[0].allNames : [];

  for (const date of dates) {
    const { lastAny, lastDish, lastWipe, pairingHistory } = getDutyMetadata(tempHistory, members, currentSessionName);
    const dayNames = [];

    // 1. 설거지 조 (18명 중 2명, 9주 주기 목표)
    const dishCand = members.filter(m => m.canDishwash).sort((a, b) => new Date(lastDish[a.name]) - new Date(lastDish[b.name]));
    let dish = [];
    for (let a of dishCand) {
      if (!validateSlot(a.name, null, dayNames, members, lastWeek)) continue;
      
      // A와 가장 오래전에 만났던 파트너 찾기 (무작위성 제거)
      const partners = dishCand.filter(p => p.name !== a.name).sort((p1, p2) => {
        const k1 = [a.name, p1.name].sort().join('-');
        const k2 = [a.name, p2.name].sort().join('-');
        return new Date(pairingHistory[k1]) - new Date(pairingHistory[k2]);
      });
      for (let b of partners) {
        if (validateSlot(b.name, a.name, [...dayNames, a.name], members, lastWeek)) {
          dish = [a.name, b.name]; break;
        }
      }
      if (dish.length === 2) break;
    }
    dayNames.push(...dish);

    // 2. 식기닦기 조 (22명 중 2명, 11주 주기 목표)
    const wipeCand = [...members].sort((a, b) => new Date(lastWipe[a.name]) - new Date(lastWipe[b.name]));
    let wipe = [];
    for (let a of wipeCand) {
      if (dayNames.includes(a.name) || !validateSlot(a.name, null, dayNames, members, lastWeek)) continue;

      const partners = wipeCand.filter(p => p.name !== a.name && !dayNames.includes(p.name)).sort((p1, p2) => {
        const k1 = [a.name, p1.name].sort().join('-');
        const k2 = [a.name, p2.name].sort().join('-');
        return new Date(pairingHistory[k1]) - new Date(pairingHistory[k2]);
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