import React, { useState, useEffect } from 'react';
import { fetchJson, updateJson } from './utils/github';
import { getSundays, generateSchedule } from './utils/engine';

// 날짜를 YYYY-MM-DD 에서 MM/DD 형식으로 변환하는 헬퍼 함수
const formatShortDate = (dateString) => {
  if (!dateString) return '';
  const [, month, day] = dateString.split('-'); // 2026-05-03 -> ['2026', '05', '03']
  return `${month}/${day}`;
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
      alert("월을 입력해주세요. (예: 7,8)");
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

  // ★ 이 함수가 사용자님의 한글 양식에 맞춰 업데이트된 부분입니다 ★
  const download = () => {
    if (currentSchedule.length === 0) {
      alert("생성된 당번 데이터가 없습니다.");
      return;
    }

    // 1. 달별 데이터 분리 및 5주 단위 패딩 (색상 밀림 방지)
    const months = [...new Set(currentSchedule.map(s => s.date.split('-')[1]))];
    const padRecords = (records) => {
      const padded = [...records];
      while (padded.length < 5) {
        padded.push({ date: "", dish: ["", ""], wipe: ["", ""] });
      }
      return padded.slice(0, 5); // 무조건 5주일치로 고정
    };

    const month1Recs = padRecords(currentSchedule.filter(s => s.date.split('-')[1] === months[0]));
    const month2Recs = padRecords(currentSchedule.filter(s => s.date.split('-')[1] === (months[1] || "")));
    const finalRecords = [...month1Recs, ...month2Recs];

    // 2. 전체 필드 개수 50개 선언 (10주 * 5개 필드)
    let content = "50\r\n";

    // 3. 데이터 문자열 생성 (한글의 제목 버림 특성 때문에 두 번 반복)[cite: 1]
    const makeDataString = (recs) => {
      return recs.map(s => {
        const d = s.date ? formatShortDate(s.date) : "";
        return `${d}\r\n${s.dish[0]}\r\n${s.dish[1]}\r\n${s.wipe[0]}\r\n${s.wipe[1]}`;
      }).join("\r\n") + "\r\n";
    };

    const dataBlock = makeDataString(finalRecords);
    content += dataBlock; // 제목용 (한글이 읽고 버림)[cite: 1]
    content += dataBlock; // 실제 데이터

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `주일당번_${selectedYear}_${selectedMonths}.txt`;
    link.click();
  };

  return (
    <div style={{ padding: '15px', maxWidth: '850px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ borderBottom: '2px solid #333', paddingBottom: '10px', marginTop: '10px' }}>주일 당번 관리</h2>
      
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '20px', 
        marginBottom: '20px', 
        padding: '15px', 
        background: '#f8f9fa', 
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <div style={{ flex: '1 1 300px' }}>
          <strong style={{ display: 'block', marginBottom: '8px' }}>연도/월 설정:</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            <input 
              type="number" 
              value={selectedYear} 
              onChange={e => setSelectedYear(parseInt(e.target.value))} 
              style={{ width: '70px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} 
            />
            <span> 년 </span>
            <input 
              value={selectedMonths} 
              onChange={e => setSelectedMonths(e.target.value)} 
              placeholder="예: 7,8"
              style={{ width: '70px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} 
            />
            <span> 월</span>
            <button 
              onClick={handleGenerate} 
              style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: '#e9ecef', border: '1px solid #ced4da', borderRadius: '4px', marginLeft: '5px' }}>
              생성하기
            </button>
          </div>
        </div>
        
        <div style={{ flex: '1 1 200px' }}>
          <strong style={{ display: 'block', marginBottom: '8px' }}>기록 관리:</strong>
          <select 
            onChange={e => {
              const session = history.data.find(s => s.sessionId === e.target.value);
              if (session) { 
                setCurrentSchedule(session.records); 
                setIsConfirmed(true); 
                const yearMatch = e.target.value.match(/(\d{4})년/);
                const monthMatch = e.target.value.match(/년\s+(.*)월/);
                if (yearMatch) setSelectedYear(parseInt(yearMatch[1]));
                if (monthMatch) setSelectedMonths(monthMatch[1]);
              }
            }} 
            style={{ padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="">기록 불러오기</option>
            {history?.data.map(s => <option key={s.sessionId} value={s.sessionId}>{s.sessionId}</option>)}
          </select>
        </div>
      </div>

      {currentSchedule.length > 0 && (
        <>
          <div style={{ overflowX: 'auto', marginBottom: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ borderBottom: '2px solid #dee2e6', padding: '12px', whiteSpace: 'nowrap' }}>날짜</th>
                  <th style={{ borderBottom: '2px solid #dee2e6', padding: '12px', borderLeft: '1px solid #e9ecef' }}>설거지 조</th>
                  <th style={{ borderBottom: '2px solid #dee2e6', padding: '12px', borderLeft: '1px solid #e9ecef' }}>식기닦기 조</th>
                </tr>
              </thead>
              <tbody>
                {currentSchedule.map(s => (
                  <tr key={s.date} style={{ borderBottom: '1px solid #e9ecef' }}>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      {formatShortDate(s.date)}
                    </td>
                    <td style={{ padding: '10px', borderLeft: '1px solid #e9ecef' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                        {s.dish.map((name, i) => (
                          <select key={`dish-${i}`} value={name} onChange={e => handleManualChange(s.date, 'dish', i, e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '80px' }}>
                            {members.filter(m => m.canDishwash).map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                          </select>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '10px', borderLeft: '1px solid #e9ecef' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                        {s.wipe.map((name, i) => (
                          <select key={`wipe-${i}`} value={name} onChange={e => handleManualChange(s.date, 'wipe', i, e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '80px' }}>
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

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center', marginBottom: '30px' }}>
            <button onClick={confirm} style={{ padding: '12px 24px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', flex: '1 1 auto', maxWidth: '200px' }}>
              저장하기
            </button>
            {isConfirmed && (
              <button onClick={download} style={{ padding: '12px 24px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', flex: '1 1 auto', maxWidth: '250px' }}>
                한글(HWP) 양식 다운로드
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;