import React, { useState, useEffect } from 'react';
import { fetchJson, updateJson } from './utils/github';
import { getSundays, validate } from './utils/engine';

function App() {
  const [members, setMembers] = useState([]);
  const [history, setHistory] = useState(null);
  const [currentSchedule, setCurrentSchedule] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState("7,8"); // 기본값 7,8월

  useEffect(() => {
    const init = async () => {
      const m = await fetchJson('members.json');
      const h = await fetchJson('history.json');
      if (m) setMembers(m.data);
      if (h) setHistory(h);
    };
    init();
  }, []);

  const generate = () => {
    if (!history || !members.length) {
      alert("데이터를 불러오는 중입니다. 잠시만 기다려주세요.");
      return;
    }

    const months = selectedMonths.split(',').map(m => parseInt(m.trim()));
    const targetDates = getSundays(2026, months); // 2026년 기준
    let newRecords = [];
    
    // 가장 최근 당번 기록 가져오기 (2주 연속 방지용)
    let lastWeek = history.data[history.data.length - 1].records.slice(-1)[0].allNames;

    for (let date of targetDates) {
      let found = false;
      let attempts = 0;
      while (!found && attempts < 500) {
        attempts++;
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
    const newHistory = [...history.data, { sessionId: `Session_${selectedMonths}월`, records: currentSchedule }];
    const ok = await updateJson('history.json', newHistory, history.sha);
    if (ok) alert("GitHub에 성공적으로 저장되었습니다!");
  };

  // CSV 다운로드 기능
  const downloadCSV = () => {
    let csvContent = "날짜,설거지1,설거지2,식기정리1,식기정리2\n";
    currentSchedule.forEach(s => {
      csvContent += `${s.date},${s.dish[0]},${s.dish[1]},${s.wipe[0]},${s.wipe[1]}\n`;
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `당번명단_${selectedMonths}월.csv`;
    link.click();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>🗓️ 일요일 당번 관리자</h1>
      
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <label>생성할 월 (쉼표로 구분): </label>
        <input 
          value={selectedMonths} 
          onChange={(e) => setSelectedMonths(e.target.value)}
          placeholder="예: 9,10"
          style={{ padding: '5px', width: '80px' }}
        />
        <button onClick={generate} style={{ marginLeft: '10px', padding: '5px 15px', cursor: 'pointer' }}>당번 생성</button>
      </div>

      {currentSchedule.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <button onClick={confirm} style={{ padding: '10px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', marginRight: '10px', cursor: 'pointer' }}>
            GitHub에 확정 저장
          </button>
          <button onClick={downloadCSV} style={{ padding: '10px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            엑셀(CSV) 다운로드
          </button>
        </div>
      )}

      <div>
        {currentSchedule.map(s => (
          <div key={s.date} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
            <strong>{s.date}</strong>
            <span>🥣 {s.dish.join(', ')} | 🥢 {s.wipe.join(', ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;