import React, { useState, useEffect } from 'react';
import { fetchJson, updateJson } from './utils/github';
import { getSundays, generateSchedule } from './utils/engine';

function App() {
  const [members, setMembers] = useState([]);
  const [history, setHistory] = useState(null);
  const [currentSchedule, setCurrentSchedule] = useState([]);
  const [selectedYear, setSelectedYear] = useState(2026); // 연도 선택 상태 추가
  const [selectedMonths, setSelectedMonths] = useState("7,8");
  const [isConfirmed, setIsConfirmed] = useState(false);

  useEffect(() => {
    const init = async () => {
      const m = await fetchJson('members.json');
      const h = await fetchJson('history.json');
      if (m) setMembers(m.data);
      if (h) setHistory(h);
    };
    init();
  }, []);

  // 저장된 기록 불러오기
  const handleLoadSession = (sessionId) => {
    const session = history.data.find(s => s.sessionId === sessionId);
    if (session) {
      setCurrentSchedule(session.records);
      
      // 세션 이름에서 연도와 월 추출 (예: "2026년 7,8월")
      const yearMatch = sessionId.match(/(\d{4})년/);
      const monthMatch = sessionId.match(/년\s+(.*)월/);
      
      if (yearMatch) setSelectedYear(parseInt(yearMatch[1]));
      if (monthMatch) setSelectedMonths(monthMatch[1]);
      
      setIsConfirmed(true);
      alert(sessionId + " 기록을 불러왔습니다.");
    }
  };

  const handleGenerate = () => {
    const months = selectedMonths.split(',').map(m => parseInt(m.trim()));
    // 선택된 연도(selectedYear)를 사용하여 일요일 계산
    const targetDates = getSundays(selectedYear, months);
    const result = generateSchedule(targetDates, members, history, {});
    setCurrentSchedule(result);
    setIsConfirmed(false);
  };

  const handleManualChange = (date, group, index, newName) => {
    const updated = currentSchedule.map(s => {
      if (s.date === date) {
        const newGroup = [...s[group]];
        newGroup[index] = newName;
        const allNames = group === 'dish' ? [...newGroup, ...s.wipe] : [...s.dish, ...newGroup];
        return { ...s, [group]: newGroup, allNames };
      }
      return s;
    });
    setCurrentSchedule(updated);
  };

  const confirm = async () => {
    // 새로운 명칭 규칙: YYYY년 MM월
    const sessionName = `${selectedYear}년 ${selectedMonths}월`;
    const prevYearSessionName = `${selectedYear - 1}년 ${selectedMonths}월`;

    // 1. 1년 전 기록 자동 삭제
    let updatedHistoryData = history.data.filter(s => s.sessionId !== prevYearSessionName);
    
    // 2. 현재 세션 중복 확인 및 덮어쓰기
    const existingIndex = updatedHistoryData.findIndex(s => s.sessionId === sessionName);
    
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
      alert("저장되었습니다.");
      setIsConfirmed(true);
      const h = await fetchJson('history.json');
      setHistory(h);
    }
  };

  const downloadForHWP = () => {
    let content = "5\n";
    currentSchedule.forEach(s => {
      content += `${s.date}\n${s.dish[0]}\n${s.dish[1]}\n${s.wipe[0]}\n${s.wipe[1]}\n`;
    });
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `mail_merge_${selectedYear}_${selectedMonths}.txt`;
    link.click();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ borderBottom: '2px solid #333', paddingBottom: '10px' }}>일요일 당번 관리자</h2>
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
        <div style={{ flex: 1.5 }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>당번 설정</label>
          <input 
            type="number"
            value={selectedYear} 
            onChange={e => setSelectedYear(parseInt(e.target.value))} 
            style={{ width: '60px', padding: '5px', marginRight: '5px' }} 
          />
          <span>년 </span>
          <input 
            value={selectedMonths} 
            onChange={e => setSelectedMonths(e.target.value)} 
            style={{ width: '60px', padding: '5px', marginLeft: '5px' }} 
            placeholder="7,8" 
          />
          <span>월</span>
          <button onClick={handleGenerate} style={{ marginLeft: '10px', padding: '5px 15px', cursor: 'pointer' }}>자동 생성</button>
        </div>
        
        <div style={{ flex: 1, borderLeft: '1px solid #ccc', paddingLeft: '20px' }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>저장된 기록 불러오기</label>
          <select onChange={e => handleLoadSession(e.target.value)} style={{ padding: '5px', width: '100%' }}>
            <option value="">기록 선택</option>
            {history?.data.map(s => <option key={s.sessionId} value={s.sessionId}>{s.sessionId}</option>)}
          </select>
        </div>
      </div>

      {currentSchedule.length > 0 && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead>
              <tr style={{ background: '#eee' }}>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>날짜</th>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>설거지 조</th>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>식기닦기 조</th>
              </tr>
            </thead>
            <tbody>
              {currentSchedule.map(s => (
                <tr key={s.date}>
                  <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{s.date}</td>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                    {s.dish.map((name, i) => (
                      <select key={i} value={name} onChange={e => handleManualChange(s.date, 'dish', i, e.target.value)} style={{ margin: '2px', padding: '3px' }}>
                        {members.filter(m => m.canDishwash).map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                      </select>
                    ))}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                    {s.wipe.map((name, i) => (
                      <select key={i} value={name} onChange={e => handleManualChange(s.date, 'wipe', i, e.target.value)} style={{ margin: '2px', padding: '3px' }}>
                        {members.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                      </select>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={confirm} style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>저장</button>
            {isConfirmed && (
              <button onClick={downloadForHWP} style={{ padding: '10px 20px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                한글 메일머지 다운로드
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;