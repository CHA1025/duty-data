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

  const handleLoadSession = (sessionId) => {
    const session = history.data.find(s => s.sessionId === sessionId);
    if (session) {
      setCurrentSchedule(session.records);
      const yearMatch = sessionId.match(/(\d{4})년/);
      const monthMatch = sessionId.match(/년\s+(.*)월/);
      if (yearMatch) setSelectedYear(parseInt(yearMatch[1]));
      if (monthMatch) setSelectedMonths(monthMatch[1]);
      setIsConfirmed(true);
    }
  };

  const handleGenerate = () => {
    const result = generateSchedule(getSundays(selectedYear, selectedMonths.split(',').map(m => parseInt(m.trim()))), members, history);
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
    const existingIndex = updatedHistoryData.findIndex(s => s.sessionId === sessionName);
    
    if (existingIndex !== -1 && !window.confirm("데이터를 덮어쓰시겠습니까?")) return;
    
    if (existingIndex !== -1) updatedHistoryData[existingIndex] = { sessionId: sessionName, records: currentSchedule };
    else updatedHistoryData.push({ sessionId: sessionName, records: currentSchedule });

    const ok = await updateJson('history.json', updatedHistoryData, history.sha);
    if (ok) {
      alert("저장되었습니다.");
      setIsConfirmed(true);
      setHistory(await fetchJson('history.json'));
    }
  };

  const downloadForHWP = () => {
    let content = "5\n";
    currentSchedule.forEach(s => { content += `${s.date}\n${s.dish[0]}\n${s.dish[1]}\n${s.wipe[0]}\n${s.wipe[1]}\n`; });
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `주일당번_${selectedYear}_${selectedMonths}.txt`;
    link.click();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ borderBottom: '2px solid #333', paddingBottom: '10px' }}>주일 당번 관리</h2>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
        <div>
          <label>연도: </label>
          <input type="number" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} style={{ width: '60px' }} />
          <label style={{ marginLeft: '10px' }}>월: </label>
          <input value={selectedMonths} onChange={e => setSelectedMonths(e.target.value)} style={{ width: '60px' }} />
          <button onClick={handleGenerate} style={{ marginLeft: '10px' }}>당번 생성</button>
        </div>
        <div style={{ borderLeft: '1px solid #ccc', paddingLeft: '20px' }}>
          <select onChange={e => handleLoadSession(e.target.value)}>
            <option value="">기록 불러오기</option>
            {history?.data.map(s => <option key={s.sessionId} value={s.sessionId}>{s.sessionId}</option>)}
          </select>
        </div>
      </div>
      {currentSchedule.length > 0 && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead><tr style={{ background: '#eee' }}><th style={{ border: '1px solid #ccc', padding: '8px' }}>날짜</th><th style={{ border: '1px solid #ccc', padding: '8px' }}>설거지 조</th><th style={{ border: '1px solid #ccc', padding: '8px' }}>식기닦기 조</th></tr></thead>
            <tbody>
              {currentSchedule.map(s => (
                <tr key={s.date}>
                  <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>{s.date}</td>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                    {s.dish.map((name, i) => (
                      <select key={i} value={name} onChange={e => handleManualChange(s.date, 'dish', i, e.target.value)}>
                        {members.filter(m => m.canDishwash).map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                      </select>
                    ))}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                    {s.wipe.map((name, i) => (
                      <select key={i} value={name} onChange={e => handleManualChange(s.date, 'wipe', i, e.target.value)}>
                        {members.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                      </select>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={confirm} style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px' }}>저장</button>
          {isConfirmed && <button onClick={downloadForHWP} style={{ marginLeft: '10px', padding: '10px 20px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '4px' }}>한글 다운로드</button>}
        </>
      )}
    </div>
  );
}

export default App;