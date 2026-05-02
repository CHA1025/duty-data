// 연도와 월을 기반으로 해당 월의 모든 일요일 날짜를 계산합니다.
export const getSundays = (year, months) => {
  const sundays = [];
  months.forEach(month => {
    let d = new Date(year, month - 1, 1);
    while (d.getDay() !== 0) d.setDate(d.getDate() + 1); // 첫 일요일 찾기
    while (d.getMonth() === month - 1) {
      // 타임존 오차 보정 후 ISO 형식으로 저장
      const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      sundays.push(dateStr);
      d.setDate(d.getDate() + 7);
    }
  });
  return sundays;
};

// 각 멤버별 마지막 당번일(전체/설거지/식기닦기)과 파트너 조합 이력을 계산합니다.
const getDutyMetadata = (history, members) => {
  const lastAny = {};   // 2주 연속 금지 체크용
  const lastDish = {};  // 설거지 9주 주기 체크용
  const lastWipe = {};  // 식기닦기 11주 주기 체크용
  const pairingHistory = {}; // 조합 신선도 체크용

  members.forEach(m => {
    lastAny[m.name] = lastDish[m.name] = lastWipe[m.name] = "1970-01-01";
    members.forEach(m2 => {
      if (m.name !== m2.name) {
        pairingHistory[[m.name, m2.name].sort().join('-')] = "1970-01-01";
      }
    });
  });

  if (history?.data) {
    history.data.forEach(session => {
      session.records.forEach(r => {
        // 전체 당번 이력 기록
        r.allNames.forEach(n => { if (r.date > lastAny[n]) lastAny[n] = r.date; });
        // 각 역할별 독립 이력 기록
        r.dish.forEach(n => { if (r.date > lastDish[n]) lastDish[n] = r.date; });
        r.wipe.forEach(n => { if (r.date > lastWipe[n]) lastWipe[n] = r.date; });
        
        // 파트너 매칭 이력 기록
        const updatePair = (group) => {
          if (group.length === 2) {
            const key = [...group].sort().join('-');
            if (r.date > pairingHistory[key]) pairingHistory[key] = r.date;
          }
        };
        updatePair(r.dish);
        updatePair(r.wipe);
      });
    });
  }
  return { lastAny, lastDish, lastWipe, pairingHistory };
};

// 슬롯별 유효성 검사 (가족 중복, B그룹 중복, 기피 인원 등)
export const validateSlot = (name, partner, dayAll, allMembers, lastWeek) => {
  const m = allMembers.find(mem => mem.name === name);
  if (!m || lastWeek.includes(name) || dayAll.includes(name)) return false;

  // 가족 관계 체크 (하루 4명 팀 기준)
  const dayFamilies = dayAll.map(n => allMembers.find(mem => mem.name === n)?.familyId).filter(id => id && id !== "NONE");
  if (m.familyId !== "NONE" && dayFamilies.includes(m.familyId)) return false;

  // B그룹 중복 금지 및 특정 기피 인원 (같은 조 2명 기준)
  if (m.isBGroup && partner && allMembers.find(mem => mem.name === partner)?.isBGroup) return false;
  if (m.exclusionList?.includes(partner)) return false;

  return true;
};

// 메인 스케줄 생성 함수
export const generateSchedule = (dates, members, history) => {
  let tempHistory = JSON.parse(JSON.stringify(history));
  let schedule = [];
  let lastWeek = (tempHistory.data.length > 0) ? tempHistory.data[tempHistory.data.length - 1].records.slice(-1)[0].allNames : [];

  for (const date of dates) {
    const { lastAny, lastDish, lastWipe, pairingHistory } = getDutyMetadata(tempHistory, members);
    const dayNames = [];

    // 1. 설거지 조 (18명 중 2명, 설거지 순번 기준)
    const dishCand = members.filter(m => m.canDishwash).sort((a, b) => new Date(lastDish[a.name]) - new Date(lastDish[b.name]));
    let dish = [];
    for (let a of dishCand) {
      if (!validateSlot(a.name, null, dayNames, members, lastWeek)) continue;
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

    // 2. 식기닦기 조 (22명 중 2명, 식기닦기 순번 기준)
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