import React, { useState, useEffect } from 'react';
import { fetchJson, updateJson } from './utils/github';
import { getSundays, validate } from './utils/engine';

function App() {
  const [members, setMembers] = useState([]);
  const [history, setHistory] = useState(null);
  const [currentSchedule, setCurrentSchedule] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState("7,8");

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
    if (!history || !members.length) return;

    const months = selectedMonths.split(',').map(m => parseInt(m.trim()));
    const targetDates = getSundays(2026, months);
    let newRecords = [];
    
    // history의 가장 마지막 기록 가져오기
    let lastWeek = history.data[history.data.length - 1].records.slice(-1)[0].allNames;

    for (let date of targetDates) {
      let found = false;
      let attempts = 0;
      while (!found && attempts < 3000) {
        attempts++;
        const shuffled = [...members].sort(() => Math.random() - 0.5);
        // 설거지 가능자 중 2명 추출
        const dish = shuffled.filter(m => m.canDishwash).slice(0, 2).map(m => m.name);
        // 나머지 중 2명 추출 (설거지 조 제외)
        const wipe = shuffled.filter(m => !dish.includes(m.name)).slice(0, 2).map(m => m.name);

        if (validate(dish, wipe, members, history, newRecords)) {
          const record = { date, dish, wipe, allNames: [...dish, ...wipe] };
          newRecords.push(record);
          found = true;
        }
      }
      if (!found) {
        alert(date + " 날짜의 조합을 찾지 못했습니다. 조건을 확인해 주세요.");
        return;
      }
    }
    setCurrentSchedule(newRecords);
  };

  const confirm = async () => {
    const currentYear = 2026; 
    const sessionName = `${currentYear}-${selectedMonths}`;
    const prevYearSessionName = `${currentYear - 1}-${selectedMonths}`;

    // 1. 1년 전 동일 세션 자동 삭제
    let updatedHistoryData = history.data.filter(session => session.sessionId !== prevYearSessionName);

    // 2. 현재 세션 중복 확인 및 덮어쓰기
    const existingIndex = updatedHistoryData.findIndex(session => session.sessionId === sessionName);
    
    let finalHistoryData;
    if (existingIndex !== -1) {
      if (!window.confirm(sessionName + " 데이터가 이미 존재합니다. 덮어쓰시겠습니까?")) return;
      finalHistoryData = [...updatedHistoryData];
      finalHistoryData[existingIndex] = { sessionId: sessionName, records: currentSchedule };
    } else {
      finalHistoryData = [...updatedHistoryData, { sessionId: sessionName, records: currentSchedule }];
    }

    const ok = await updateJson('history.json', finalHistoryData, history.sha);
    if (ok) {
      alert("저장되었습니다. (1년 전 기록이 있다면 자동 삭제되었습니다.)");
      const h = await fetchJson('history.json');
      setHistory(h);
    }
  };

  const downloadForHWP = () => {
    // 한글 메일 머지 형식: 첫 줄 필드 개수, 이후 데이터 순차 나열
    let content = "5\n"; 
    currentSchedule.forEach(s => {
      content += s.date + "\n" + s.dish[0] + "\n" + s.dish[1] + "\n" + s.wipe[0] + "\n" + s.wipe[1] + "\n";
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "mail_merge_" + selectedMonths + ".txt";
    link.click();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', lineHeight: '1.6' }}>
      <h2 style={{ borderBottom: '2px solid #444', paddingBottom: '10px', color: '#222' }}>일요일 당번 관리자</h2>
      
      <div style={{ margin: '20px 0', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
        <label style={{ fontWeight: 'bold' }}>대상 월 입력 (예: 7,8): </label>
        <input 
          style={{ padding: '5px', width: '50px', textAlign: 'center', border: '1px solid #ccc' }}
          value={selectedMonths} 
          onChange={(e) => setSelectedMonths(e.target.value)} 
        />
        <button style={{ marginLeft: '10px', padding: '6px 12px', cursor: 'pointer' }} onClick={generate}>당번 생성</button>
      </div>

      {currentSchedule.length > 0 && (
        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
          <button style={{ padding: '10px 20px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={confirm}>저장</button>
          <button style={{ padding: '10px 20px', backgroundColor: '#1565c0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={downloadForHWP}>한글 메일머지용 다운로드</button>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        {currentSchedule.map(s => (
          <div key={s.date} style={{ borderBottom: '1px solid #ddd', padding: '10px 0' }}>
            <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{s.date}</div>
            <div style={{ color: '#444' }}>
              설거지: <span style={{ color: '#c62828', fontWeight: '500' }}>{s.dish.join(', ')}</span> | 
              닦기: <span style={{ color: '#1565c0', fontWeight: '500' }}>{s.wipe.join(', ')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;