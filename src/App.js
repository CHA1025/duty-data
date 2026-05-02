import React, { useState, useEffect } from 'react';
import { fetchJson, updateJson } from './utils/github';
import { getSundays, validate } from './utils/engine';

function App() {
  const [members, setMembers] = useState([]);
  const [history, setHistory] = useState(null);
  const [currentSchedule, setCurrentSchedule] = useState([]);

  useEffect(() => {
    const init = async () => {
      const m = await fetchJson('members.json');
      const h = await fetchJson('history.json');
      setMembers(m.data);
      setHistory(h);
    };
    init();
  }, []);

  const generate = () => {
    const targetDates = getSundays(2026, [7, 8]); // 7-8월 생성 예시
    let newRecords = [];
    let lastWeek = history.data[history.data.length - 1].records.slice(-1)[0].allNames;

    for (let date of targetDates) {
      let found = false;
      while (!found) {
        const shuffled = [...members].sort(() => Math.random() - 0.5);
        const dish = shuffled.filter(m => m.canDishwash).slice(0, 2).map(m => m.name);
        const wipe = shuffled.filter(m => !dish.includes(m.name)).slice(0, 2).map(m => m.name);

        if (validate(dish, wipe, members, lastWeek)) {
          const record = { date, dish, wipe, allNames: [...dish, ...wipe] };
          newRecords.push(record);
          lastWeek = record.allNames;
          found = true;
        }
      }
    }
    setCurrentSchedule(newRecords);
  };

  const confirm = async () => {
    const newHistory = [...history.data, { sessionId: "2026-07-08", records: currentSchedule }];
    const ok = await updateJson('history.json', newHistory, history.sha);
    if (ok) alert("GitHub에 저장되었습니다!");
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>일요일 당번 관리자</h1>
      <button onClick={generate}>7-8월 당번 생성</button>
      <button onClick={confirm} disabled={!currentSchedule.length}>최종 확정 및 저장</button>
      
      <div style={{ marginTop: '20px' }}>
        {currentSchedule.map(s => (
          <div key={s.date} style={{ marginBottom: '10px', borderBottom: '1px solid #ccc' }}>
            <strong>{s.date}</strong> | 설거지: {s.dish.join(', ')} | 식기: {s.wipe.join(', ')}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;