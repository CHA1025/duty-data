import React, { useState, useEffect } from 'react';
import { fetchJson, updateJson } from './utils/github';
import { getSundays, generateSchedule } from './utils/engine';

const formatShortDate = (dateString) => {
  if (!dateString || !dateString.includes('-')) return dateString || '';
  const parts = dateString.split('-');
  return `${parts[1]}/${parts[2]}`;
};

function App() {
  const [members, setMembers] = useState([]);
  const [history, setHistory] = useState(null);
  const [currentSchedule, setCurrentSchedule] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const m = await fetchJson('members.json');
        const h = await fetchJson('history.json');
        if (m) setMembers(m.data);
        if (h) setHistory(h);
      } catch (err) {
        console.error("데이터 로딩 실패:", err);
      }
    };
    init();
  }, []);

  const handleGenerate = () => {
    if (!selectedMonths) {
      alert("월을 입력해주세요 (예: 7,8)");
      return;
    }
    const sessionName = `${selectedYear}년 ${selectedMonths}월`;
    const result = generateSchedule(
      getSundays(selectedYear, selectedMonths.split(',').map(m => parseInt(m.trim()))), 
      members, 
      history,
      sessionName
    );
    setCurrentSchedule(result);
    setIsConfirmed(false);
  };

  const confirm = async () => {
    if (!history || !history.data) return;

    const sessionName = `${selectedYear}년 ${selectedMonths}월`;
    const prevYearSessionName = `${selectedYear - 1}년 ${selectedMonths}월`;
    
    let updatedHistoryData = history.data.filter(s => s.sessionId !== prevYearSessionName);
    const idx = updatedHistoryData.findIndex(s => s.sessionId === sessionName);
    
    if (idx !== -1 && !window.confirm("이미 존재하는 기록입니다. 덮어쓰시겠습니까?")) return;
    
    const newSession = { sessionId: sessionName, records: currentSchedule };
    if (idx !== -1) updatedHistoryData[idx] = newSession;
    else updatedHistoryData.push(newSession);

    const success = await updateJson('history.json', updatedHistoryData, history.sha);
    if (success) {
      alert("성공적으로 저장되었습니다.");
      setIsConfirmed(true);
      const newHistory = await fetchJson('history.json');
      setHistory(newHistory);
    }
  };

  const download = () => {
    let content = "5\r\n날짜\r\n설거지1\r\n설거지2\r\n식기닦기1\r\n식기닦기2\r\n";
    currentSchedule.forEach(s => {
      content += `${formatShortDate(s.date)}\r\n${s.dish[0]}\r\n${s.dish[1]}\r\n${s.wipe[0]}\r\n${s.wipe[1]}\r\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `주일당번_${selectedYear}_${selectedMonths}.txt`;
    link.click();
  };

  return (
    <div style={{ padding: '15px', maxWidth: '850px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ borderBottom: '2px solid #333', paddingBottom: '10px' }}>주일 당번 관리</h2>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
        <div style={{ flex: '1 1 250px' }}>
          <strong>설정:</strong> {selectedYear}년 
          <input value={selectedMonths} onChange={e => setSelectedMonths(e.target.value)} placeholder="7,8" style={{ width: '60px', margin: '0 5px', padding: '5px' }} />월
          <button onClick={handleGenerate} style={{ marginLeft: '10px', padding: '5px 10px' }}>생성</button>
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <strong>기록:</strong>
          <select onChange={e => {
            const session = history?.data?.find(s => s.sessionId === e.target.value);
            if (session) { 
              setCurrentSchedule(session.records); 
              setIsConfirmed(true);
            }
          }} style={{ padding: '5px', marginLeft: '5px' }}>
            <option value="">기록 불러오기</option>
            {history?.data?.map(s => <option key={s.sessionId} value={s.sessionId}>{s.sessionId}</option>)}
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
          <thead>
            <tr style={{ background: '#eee' }}>
              <th style={{ padding: '10px', border: '1px solid #ccc' }}>날짜</th>
              <th style={{ padding: '10px', border: '1px solid #ccc' }}>설거지</th>
              <th style={{ padding: '10px', border: '1px solid #ccc' }}>식기닦기</th>
            </tr>
          </thead>
          <tbody>
            {currentSchedule.map((s, idx) => (
              <tr key={idx}>
                <td style={{ padding: '10px', border: '1px solid #ccc', textAlign: 'center', whiteSpace: 'nowrap' }}>{formatShortDate(s.date)}</td>
                <td style={{ padding: '10px', border: '1px solid #ccc', textAlign: 'center' }}>{s.dish.join(', ')}</td>
                <td style={{ padding: '10px', border: '1px solid #ccc', textAlign: 'center' }}>{s.wipe.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {currentSchedule.length > 0 && (
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <button onClick={confirm} style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px' }}>저장</button>
          {isConfirmed && <button onClick={download} style={{ padding: '10px 20px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '4px' }}>HWP 다운로드</button>}
        </div>
      )}
    </div>
  );
}

export default App;