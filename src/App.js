import React, { useState, useEffect } from 'react';
import { fetchJson, updateJson } from './utils/github';
import { getSundays, generateSchedule } from './utils/engine';

const formatShortDate = (dateString) => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : dateString;
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
      const m = await fetchJson('members.json');
      const h = await fetchJson('history.json');
      if (m) setMembers(m.data);
      if (h) setHistory(h);
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

  const handleManualChange = (date, group, index, newName) => {
    const updated = currentSchedule.map(s => {
      if (s.date === date) {
        const newGroup = [...s[group]];
        newGroup[index] = newName;
        return { 
          ...s, 
          [group]: newGroup, 
          allNames: group === 'dish' ? [...newGroup, ...s.wipe] : [...s.dish, ...newGroup] 
        };
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
    if (currentSchedule.length === 0) return;

    // 1. 달별 데이터 분리 및 5주 단위 패딩 (색상 밀림 방지 로직)
    const months = [...new Set(currentSchedule.map(s => s.date.split('-')[1]))];
    const padRecords = (records) => {
      const padded = [...records];
      while (padded.length < 5) {
        padded.push({ date: "", dish: ["", ""], wipe: ["", ""] });
      }
      return padded.slice(0, 5); 
    };

    const month1Recs = padRecords(currentSchedule.filter(s => s.date.split('-')[1] === months[0]));
    const month2Recs = padRecords(currentSchedule.filter(s => s.date.split('-')[1] === (months[1] || "")));
    const finalRecords = [...month1Recs, ...month2Recs];

    // 2. 전체 필드 개수 50개 선언 (10주 * 5개 필드)[cite: 1]
    let content = "50\r\n";

    const makeDataBlock = (recs) => {
      return recs.map(s => {
        const d = s.date ? formatShortDate(s.date) : "";
        return `${d}\r\n${s.dish[0]}\r\n${s.dish[1]}\r\n${s.wipe[0]}\r\n${s.wipe[1]}`;
      }).join("\r\n") + "\r\n";
    };

    const dataBlock = makeDataBlock(finalRecords);
    content += dataBlock; // 제목용 더미 (버림)[cite: 1]
    content += dataBlock; // 실제 데이터

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
        <div style={{ flex: '1 1 280px' }}>
          <strong>연도/월:</strong> {selectedYear}년 
          <input value={selectedMonths} onChange={e => setSelectedMonths(e.target.value)} placeholder="7,8" style={{ width: '60px', margin: '0 5px', padding: '5px' }} />월
          <button onClick={handleGenerate} style={{ padding: '5px 10px', marginLeft: '5px' }}>생성</button>
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <strong>기록:</strong>
          <select onChange={e => {
            const session = history?.data?.find(s => s.sessionId === e.target.value);
            if (session) { 
              setCurrentSchedule(session.records); 
              setIsConfirmed(true);
            }
          }} style={{ padding: '5px', marginLeft: '5px', width: '150px' }}>
            <option value="">불러오기</option>
            {history?.data?.map(s => <option key={s.sessionId} value={s.sessionId}>{s.sessionId}</option>)}
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '450px', border: '1px solid #ddd' }}>
          <thead style={{ background: '#eee' }}>
            <tr>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>날짜</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>설거지</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>식기닦기</th>
            </tr>
          </thead>
          <tbody>
            {currentSchedule.map((s, idx) => (
              <tr key={idx} style={{ textAlign: 'center' }}>
                <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{formatShortDate(s.date)}</td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {s.dish.map((name, i) => (
                      <select key={i} value={name} onChange={e => handleManualChange(s.date, 'dish', i, e.target.value)}>
                        {members.filter(m => m.canDishwash).map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                      </select>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {s.wipe.map((name, i) => (
                      <select key={i} value={name} onChange={e => handleManualChange(s.date, 'wipe', i, e.target.value)}>
                        {members.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                      </select>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button onClick={confirm} style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>저장하기</button>
        {isConfirmed && <button onClick={download} style={{ padding: '10px 20px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>한글 양식 다운로드</button>}
      </div>
    </div>
  );
}

export default App;