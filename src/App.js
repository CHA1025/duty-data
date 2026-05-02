import React, { useState, useEffect } from 'react';
import { fetchJson, updateJson } from './utils/github';
import { getSundays, generateSchedule } from './utils/engine';

function App() {
  const [members, setMembers] = useState([]);
  const [history, setHistory] = useState(null);
  const [currentSchedule, setCurrentSchedule] = useState([]);
  const [selectedYear, setSelectedYear] = useState(2026);
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

  const handleGenerate = () => {
    const sessionName = `${selectedYear}년 ${selectedMonths}월`;
    // 엔진에 현재 세션 이름을 전달하여 중복 계산을 방지합니다.
    const result = generateSchedule(
      getSundays(selectedYear, selectedMonths.split(',').map(m => parseInt(m.trim()))), 
      members, 
      history,
      sessionName
    );
    setCurrentSchedule(result);
    setIsConfirmed(false);
  };

  const handleManualChange = (date, group, index, newName) => {
    const updated = currentSchedule.map(s => {
      if (s.date === date) {
        const newGroup = [...s[group]];
        newGroup[index] = newName;
        return { ...s, [group]: newGroup, allNames: group === 'dish' ? [...newGroup, ...s.wipe] : [...s.dish, ...newGroup] };
      }
      return s;
    });
    setCurrentSchedule(updated);
  };

  const confirm = async () => {
    const sessionName = `${selectedYear}년 ${selectedMonths}월`;
    const prevYearSessionName = `${selectedYear - 1}년 ${selectedMonths}월`;
    let updatedHistoryData = history.data.filter(s => s.sessionId !== prevYearSessionName);
    const idx = updatedHistoryData.findIndex(s => s.sessionId === sessionName);
    
    if (idx !== -1 && !window.confirm("이미 존재하는 기록입니다. 덮어쓰시겠습니까?")) return;
    
    if (idx !== -1) updatedHistoryData[idx] = { sessionId: sessionName, records: currentSchedule };
    else updatedHistoryData.push({ sessionId: sessionName, records: currentSchedule });

    if (await updateJson('history.json', updatedHistoryData, history.sha)) {
      alert("성공적으로 저장되었습니다.");
      setIsConfirmed(true);
      setHistory(await fetchJson('history.json'));
    }
  };

  const download = () => {
    let content = "5\n";
    currentSchedule.forEach(s => { content += `${s.date}\n${s.dish[0]}\n${s.dish[1]}\n${s.wipe[0]}\n${s.wipe[1]}\n`; });
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `주일당번_${selectedYear}_${selectedMonths}.txt`;
    link.click();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '850px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ borderBottom: '2px solid #333', paddingBottom: '10px' }}>주일 당번 관리</h2>
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
        <div>
          <strong>연도/월 설정: </strong>
          <input type="number" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} style={{ width: '65px', padding: '5px' }} />
          <span> 년 </span>
          <input value={selectedMonths} onChange={e => setSelectedMonths(e.target.value)} style={{ width: '60px', padding: '5px' }} />
          <span> 월</span>
          <button onClick={handleGenerate} style={{ marginLeft: '12px', padding: '6px 16px', cursor: 'pointer' }}>당번 자동 생성</button>
        </div>
        
        <div style={{ borderLeft: '1px solid #ccc', paddingLeft: '20px' }}>
          <strong>기록 관리: </strong>
          <select onChange={e => {
            const session = history.data.find(s => s.sessionId === e.target.value);
            if (session) { 
              setCurrentSchedule(session.records); 
              setIsConfirmed(true); 
              const yearMatch = e.target.value.match(/(\d{4})년/);
              const monthMatch = e.target.value.match(/년\s+(.*)월/);
              if (yearMatch) setSelectedYear(parseInt(yearMatch[1]));
              if (monthMatch) setSelectedMonths(monthMatch[1]);
            }
          }} style={{ padding: '5px' }}>
            <option value="">기록 불러오기</option>
            {history?.data.map(s => <option key={s.sessionId} value={s.sessionId}>{s.sessionId}</option>)}
          </select>
        </div>
      </div>

      {currentSchedule.length > 0 && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead>
              <tr style={{ background: '#eee' }}>
                <th style={{ border: '1px solid #ccc', padding: '10px' }}>날짜</th>
                <th style={{ border: '1px solid #ccc', padding: '10px' }}>설거지 조</th>
                <th style={{ border: '1px solid #ccc', padding: '10px' }}>식기닦기 조</th>
              </tr>
            </thead>
            <tbody>
              {currentSchedule.map(s => (
                <tr key={s.date}>
                  <td style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{s.date}</td>
                  <td style={{ border: '1px solid #ccc', padding: '10px' }}>
                    {s.dish.map((name, i) => (
                      <select key={i} value={name} onChange={e => handleManualChange(s.date, 'dish', i, e.target.value)} style={{ margin: '2px' }}>
                        {members.filter(m => m.canDishwash).map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                      </select>
                    ))}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '10px' }}>
                    {s.wipe.map((name, i) => (
                      <select key={i} value={name} onChange={e => handleManualChange(s.date, 'wipe', i, e.target.value)} style={{ margin: '2px' }}>
                        {members.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                      </select>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: '15px' }}>
            <button onClick={confirm} style={{ padding: '10px 25px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>저장하기</button>
            {isConfirmed && (
              <button onClick={download} style={{ padding: '10px 25px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>한글(HWP) 파일 다운로드</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;