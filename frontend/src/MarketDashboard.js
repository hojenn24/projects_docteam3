import React, { useState, useEffect, useRef } from 'react';
import WC from 'wordcloud';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend,
  Treemap,
} from 'recharts';
import { TrendingUp, Activity, X } from 'lucide-react';

// ── 정적 폴백 데이터 ──────────────────────────────────
const ALL_KEYWORDS = [
  ['강아지',     95], ['고양이',     88], ['반려동물',   82], ['동물병원',   76],
  ['강아지사료', 72], ['반려견',     68], ['고양이모래', 65], ['펫',         60],
  ['강아지보험', 55], ['강아지간식', 58], ['예방접종',   54], ['애견',       50],
  ['강아지훈련', 46], ['반려묘',     44], ['노령견',     40], ['분리불안',   38],
  ['강아지옷',   35], ['동결건조',   32], ['화식',       30], ['펫시터',     28],
  ['중성화',     26], ['건강검진',   48], ['사상충',     24], ['진드기',     22],
  ['배변패드',   42], ['강아지샴푸', 36], ['하네스',     20], ['이동가방',   34],
];

const STATIC_HIERARCHY = {
  "반려동물 식품": {
    color: '#FB7185', value: 18.4,
    treemap: [
      { name: '강아지간식',       size: 28310, color: '#FB7185' },
      { name: '강아지사료',       size: 33600, color: '#f43f5e' },
      { name: '반려동물영양제',   size: 11860, color: '#fda4af' },
      { name: '강아지관련영양제', size: 14170, color: '#fecdd3' },
      { name: '강아지이유식',     size: 3170,  color: '#fb7185' },
      { name: '개껌',             size: 4380,  color: '#f87171' },
      { name: '화식',             size: 3140,  color: '#fca5a5' },
      { name: '습식사료',         size: 2140,  color: '#fecaca' },
      { name: '노령견사료',       size: 1200,  color: '#fee2e2' },
    ],
  },
  "미용위생": {
    color: '#4ADE80', value: 16.0,
    treemap: [
      { name: '배변패드',    size: 22000, color: '#4ADE80' },
      { name: '강아지샴푸', size: 18000, color: '#22c55e' },
      { name: '고양이모래', size: 15000, color: '#86efac' },
      { name: '물티슈',     size: 9000,  color: '#bbf7d0' },
      { name: '귀세정제',   size: 5000,  color: '#4ade80' },
      { name: '벤토나이트', size: 7500,  color: '#16a34a' },
      { name: '두부모래',   size: 4500,  color: '#15803d' },
      { name: '칫솔',       size: 3200,  color: '#166534' },
    ],
  },
  "서비스업": {
    color: '#22D3EE', value: 12.2,
    treemap: [
      { name: '반려견유치원', size: 14000, color: '#22D3EE' },
      { name: '애견호텔',    size: 9500,  color: '#06b6d4' },
      { name: '사회화훈련',  size: 8000,  color: '#67e8f9' },
      { name: '복종훈련',    size: 3500,  color: '#a5f3fc' },
      { name: '방문미용',    size: 7200,  color: '#0e7490' },
      { name: '강아지미용',  size: 11000, color: '#0891b2' },
    ],
  },
  "일반용품": {
    color: '#34D399', value: 25.3,
    treemap: [
      { name: '노즈워크',   size: 12000, color: '#34D399' },
      { name: '스크래쳐',  size: 8500,  color: '#6ee7b7' },
      { name: '터그장난감', size: 6200,  color: '#a7f3d0' },
      { name: '목줄',       size: 9800,  color: '#10b981' },
      { name: '이동가방',   size: 11000, color: '#059669' },
      { name: '겨울옷',     size: 7300,  color: '#047857' },
      { name: '우비',       size: 4100,  color: '#065f46' },
      { name: '하네스',     size: 8800,  color: '#d1fae5' },
    ],
  },
  "의료건강": {
    color: '#FDE68A', value: 28.1,
    treemap: [
      { name: '24시동물병원', size: 19000, color: '#FDE68A' },
      { name: '응급동물병원', size: 12000, color: '#fbbf24' },
      { name: '사상충약',     size: 8500,  color: '#f59e0b' },
      { name: '진드기약',     size: 8000,  color: '#d97706' },
      { name: '예방접종',     size: 11000, color: '#b45309' },
      { name: '건강검진',     size: 15000, color: '#92400e' },
      { name: '중성화수술',   size: 7000,  color: '#fef3c7' },
    ],
  },
};

const STATIC_BAR = [
  { name: '반려동물 식품', value: 5.2 },
  { name: '미용위생',     value: -2.1 },
  { name: '의료건강',     value: -27.5 },
  { name: '서비스업',     value: -28.9 },
  { name: '일반용품',     value: -29.1 },
];

const STATIC_LINE = [
  { date: '2024.01', 식품: 11000, 의료: 13000, 일반용품: 28000 },
  { date: '2024.04', 식품: 12000, 의료: 15000, 일반용품: 32000 },
  { date: '2024.07', 식품: 13500, 의료: 28000, 일반용품: 41000 },
  { date: '2024.10', 식품: 12500, 의료: 22000, 일반용품: 30000 },
  { date: '2025.01', 식품: 11000, 의료: 21000, 일반용품: 24000 },
  { date: '2025.04', 식품: 14000, 의료: 26000, 일반용품: 20000 },
];

const card = {
  background: '#fff', borderRadius: 24, padding: 24,
  boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #F1F5F9',
};

// ── 워드클라우드 ─────────────────────────────────────
function WordCloud({ words }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const colors = ['#FB7185','#4ADE80','#22D3EE','#FDE68A','#34D399','#A78BFA','#F97316'];
    const opts = {
      list: words, gridSize: 1, weightFactor: 1.8,
      color: () => colors[Math.floor(Math.random() * colors.length)],
      rotateRatio: 0.3, backgroundColor: 'transparent',
    };
    const img = new Image();
    img.src = '/MAIN.png';
    img.onload = () => {
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = 380; maskCanvas.height = 380;
      maskCanvas.getContext('2d').drawImage(img, 0, 0, 380, 380);
      WC(canvas, { ...opts, fontFamily: '"Noto Sans KR", sans-serif', maskCanvas });
    };
    img.onerror = () => WC(canvas, { ...opts, fontFamily: 'sans-serif' });
  }, [words]);
  return <canvas ref={canvasRef} width={420} height={380} style={{ maxWidth:'100%', maxHeight:'100%' }}/>;
}

// ── 트리맵 커스텀 셀 ─────────────────────────────────
function CustomTreemapContent(props) {
  const { x, y, width, height, name, size, color } = props;
  if (!width || !height || width < 20 || height < 15) return null;
  return (
    <g>
      <rect x={x+1} y={y+1} width={width-2} height={height-2} fill={color} rx={6} opacity={0.9}/>
      {width > 55 && height > 28 && (
        <text x={x+width/2} y={y+height/2-5} textAnchor="middle"
          fill="#fff" fontSize={Math.min(13, width/5)} fontWeight={700}
          style={{ pointerEvents:'none' }}>{name}</text>
      )}
      {width > 70 && height > 44 && (
        <text x={x+width/2} y={y+height/2+11} textAnchor="middle"
          fill="rgba(255,255,255,0.85)" fontSize={Math.min(11, width/6)}
          style={{ pointerEvents:'none' }}>{Number(size).toLocaleString()}</text>
      )}
    </g>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────
export default function MarketDashboard({ API }) {
  const [selectedMain, setSelectedMain] = useState(null);
  const [modal, setModal]               = useState(false);
  const [compareData, setCompareData]   = useState([]);
  const [currentData, setCurrentData]   = useState([]);
  const [estimatedData, setEstimatedData] = useState([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    if (!API) { setLoading(false); return; }
    Promise.all([
      fetch(`${API}/api/market/compare`).then(r => r.json()).catch(() => []),
      fetch(`${API}/api/market/current`).then(r => r.json()).catch(() => []),
      fetch(`${API}/api/market/estimated`).then(r => r.json()).catch(() => []),
    ]).then(([compare, current, estimated]) => {
      setCompareData(Array.isArray(compare)    ? compare    : []);
      setCurrentData(Array.isArray(current)    ? current    : []);
      setEstimatedData(Array.isArray(estimated) ? estimated : []);
    }).catch(e => console.error('시장분석 API 오류:', e))
      .finally(() => setLoading(false));
  }, [API]);

  const CAT_LABEL = {
    '1_반려동물먹거리': '반려동물 식품',
    '2_미용위생':      '미용위생',
    '3_서비스업':      '서비스업',
    '4_공산품':        '일반용품',
    '5_의료건강':      '의료건강',
  };
  const CAT_COLOR = {
    '1_반려동물먹거리': '#FB7185',
    '2_미용위생':      '#4ADE80',
    '3_서비스업':      '#22D3EE',
    '4_공산품':        '#34D399',
    '5_의료건강':      '#FDE68A',
  };

  // ── 도넛: API 우선, 없으면 정적 ──
  const safeCompare = Array.isArray(compareData) ? compareData : [];
  const totalVol    = safeCompare.reduce((s, r) => s + (r.total_search_volume || 0), 0);
  const pieData = safeCompare.length > 0
    ? safeCompare.map(r => ({
        name:  CAT_LABEL[r.category] || r.category,
        value: totalVol ? Math.round(r.total_search_volume / totalVol * 1000) / 10 : 0,
        color: CAT_COLOR[r.category] || '#aaa',
      }))
    : Object.keys(STATIC_HIERARCHY).map(k => ({
        name: k, value: STATIC_HIERARCHY[k].value, color: STATIC_HIERARCHY[k].color,
      }));

  // ── 성장률 바: API 우선, 없으면 정적 ──
  const barDataApi = safeCompare.length > 0
    ? safeCompare.map(r => ({
        name:  CAT_LABEL[r.category] || r.category,
        value: r.growth_rate_last_3months || 0,
      }))
    : STATIC_BAR;

  // ── 워드클라우드: API 우선, 없으면 정적 ──
  const wordData = currentData.length > 0
    ? currentData
        .filter(r => r.type === '대표')
        .map(r => [r.keyword, Math.min(Math.max(r.current_total / 500, 5), 100)])
        .filter(([, v]) => v > 0)
    : ALL_KEYWORDS;

  // ── 라인차트: API 우선, 없으면 정적 ──
  const lineDataApi = (() => {
    if (estimatedData.length === 0) return STATIC_LINE;
    const dateMap = {};
    estimatedData.forEach(r => {
      const label = CAT_LABEL[r.category] || r.category;
      if (!dateMap[r.date]) dateMap[r.date] = { date: r.date };
      dateMap[r.date][label] = (dateMap[r.date][label] || 0) + r.estimated_total_search_volume;
    });
    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
  })();

  // ── 트리맵: API 우선, 없으면 정적 ──
  const getTreemapData = (catLabel) => {
    if (currentData.length === 0) return STATIC_HIERARCHY[catLabel]?.treemap || [];

    const rawCat = Object.entries(CAT_LABEL).find(([, v]) => v === catLabel)?.[0];
    if (!rawCat) return STATIC_HIERARCHY[catLabel]?.treemap || [];

    const PALETTES = {
      '1_반려동물먹거리': ['#FB7185','#f43f5e','#fda4af','#fecdd3','#f87171','#fca5a5','#fecaca','#fee2e2'],
      '2_미용위생':      ['#4ADE80','#22c55e','#86efac','#bbf7d0','#16a34a','#15803d','#166534','#a3e635'],
      '3_서비스업':      ['#22D3EE','#06b6d4','#67e8f9','#a5f3fc','#0e7490','#0891b2','#7dd3fc','#38bdf8'],
      '4_공산품':        ['#34D399','#6ee7b7','#a7f3d0','#10b981','#059669','#047857','#065f46','#d1fae5'],
      '5_의료건강':      ['#FDE68A','#fbbf24','#f59e0b','#d97706','#b45309','#92400e','#fcd34d','#fde047'],
    };
    const palette = PALETTES[rawCat] || ['#aaa'];
    const grouped = {};
    currentData.filter(r => r.category === rawCat).forEach(r => {
      const g = r.group || '기타';
      if (!grouped[g]) grouped[g] = 0;
      grouped[g] += r.current_total || 0;
    });
    const result = Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .map(([name, size], i) => ({ name, size, color: palette[i % palette.length] }));
    return result.length > 0 ? result : (STATIC_HIERARCHY[catLabel]?.treemap || []);
  };

  const handlePieClick = (entry) => { setSelectedMain(entry.name); setModal(true); };

  const cat = selectedMain
    ? {
        treemap: getTreemapData(selectedMain),
        color: pieData.find(p => p.name === selectedMain)?.color || STATIC_HIERARCHY[selectedMain]?.color,
      }
    : null;

  if (loading) return (
    <div style={{ textAlign:'center', padding:80, color:'#888', fontSize:16 }}>
      📊 시장 데이터 로딩 중...
    </div>
  );

  return (
    <>
      {/* ── 상단: 도넛차트 + 워드클라우드 ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <div style={{ ...card, height:440 }}>
          <div style={{ fontWeight:900, fontSize:16, color:'#1E293B', marginBottom:4 }}>
            분야별 키워드 평균 검색량
          </div>
          <div style={{ fontSize:12, color:'#fff', background:'#1A1A1A', borderRadius:8,
            padding:'4px 10px', marginBottom:4, display:'inline-block', fontWeight:600 }}>
            👆 항목을 클릭하면 세부 검색량을 볼 수 있어요
          </div>
          <ResponsiveContainer width="100%" height="88%">
            <PieChart>
              <Pie data={pieData} innerRadius={75} outerRadius={135}
                paddingAngle={3} dataKey="value" onClick={handlePieClick}
                style={{ cursor:'pointer', outline:'none' }}
                label={({ name, value }) => `${value}%`} labelLine>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color}
                    stroke={selectedMain===entry.name ? '#1A1A1A' : 'none'}
                    strokeWidth={selectedMain===entry.name ? 3 : 0}
                    opacity={selectedMain && selectedMain!==entry.name ? 0.45 : 1}/>
                ))}
              </Pie>
              <Tooltip formatter={v => `${v}%`}/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ ...card, height:440, display:'flex', flexDirection:'column' }}>
          <div style={{ fontWeight:900, fontSize:16, color:'#1E293B', marginBottom:2 }}>
            반려동물 키워드 검색량
          </div>
          <div style={{ fontSize:12, color:'#94A3B8', marginBottom:8 }}>
            전체 반려동물 관련 키워드 검색량 기준
          </div>
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <WordCloud words={wordData.length > 0 ? wordData : ALL_KEYWORDS}/>
          </div>
        </div>
      </div>

      {/* ── 하단: 성장률 + 검색량 추이 ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <div style={{ ...card, height:420 }}>
          <h2 style={{ fontWeight:900, fontSize:16, marginBottom:20, display:'flex', alignItems:'center', gap:8 }}>
            <TrendingUp size={18} color="#FB7185"/> 분야별 최근 3개월 성장률 (%)
          </h2>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={barDataApi} layout="vertical" margin={{ left:20, right:50 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9"/>
              <XAxis type="number" hide/>
              <YAxis dataKey="name" type="category" width={100}
                tick={{ fontSize:12, fontWeight:700 }} axisLine={false} tickLine={false}/>
              <Tooltip formatter={v => `${v}%`} cursor={{ fill:'#F8FAFC' }}/>
              <Bar dataKey="value" radius={[0,10,10,0]} barSize={28}
                label={{
                  fontSize:12, fontWeight:700,
                  position: (entry) => entry.value >= 0 ? 'right' : 'left',
                  formatter: v => `${v>0?'+':''}${v}%`,
                  fill: '#333',
                }}>
                {barDataApi.map((entry, i) => (
                  <Cell key={i} fill={entry.value > 0 ? '#FB7185' : '#60A5FA'}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ ...card, height:420 }}>
          <h2 style={{ fontWeight:900, fontSize:16, marginBottom:20, display:'flex', alignItems:'center', gap:8 }}>
            <Activity size={18} color="#10B981"/> 월별 추정 검색량 추이
          </h2>
          <ResponsiveContainer width="100%" height="80%">
            <LineChart data={lineDataApi} margin={{ top:10, right:30, left:10, bottom:10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
              <XAxis dataKey="date" tick={{ fontSize:11 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={v => Number(v).toLocaleString()}/>
              <Legend verticalAlign="top" height={36}/>
              {Object.values(CAT_LABEL).map((label, i) => {
                const colors = ['#FB7185','#4ADE80','#22D3EE','#34D399','#FDE68A'];
                return (
                  <Line key={label} type="monotone" dataKey={label}
                    stroke={colors[i]} strokeWidth={3} dot={{ r:3 }} activeDot={{ r:7 }}/>
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 트리맵 팝업 모달 ── */}
      {modal && cat && (
        <div onClick={() => setModal(false)} style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
          display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:1000, backdropFilter:'blur(4px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background:'#fff', borderRadius:24, padding:32,
            width:'min(700px, 92vw)', maxHeight:'88vh',
            overflow:'auto', boxShadow:'0 24px 60px rgba(0,0,0,0.25)',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:cat.color, letterSpacing:2, marginBottom:6 }}>
                  세부 키워드 검색량
                </div>
                <div style={{ fontSize:22, fontWeight:900, color:'#1E293B' }}>
                  {selectedMain} — 그룹별 세부 키워드 검색량
                </div>
              </div>
              <button onClick={() => setModal(false)} style={{
                background:'#F1F5F9', border:'none', borderRadius:10,
                width:38, height:38, display:'flex', alignItems:'center',
                justifyContent:'center', cursor:'pointer', flexShrink:0,
              }}>
                <X size={18} color="#64748B"/>
              </button>
            </div>
            <div style={{ height:500, borderRadius:16, overflow:'hidden' }}>
              <ResponsiveContainer width="100%" height="100%">
                <Treemap data={cat.treemap} dataKey="size" nameKey="name"
                  aspectRatio={1} isAnimationActive={false}
                  content={<CustomTreemapContent/>}>
                  <Tooltip formatter={v => [Number(v).toLocaleString(), '검색량']}
                    contentStyle={{ borderRadius:10, border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.15)' }}/>
                </Treemap>
              </ResponsiveContainer>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:16 }}>
              {cat.treemap.map(item => (
                <div key={item.name} style={{
                  display:'flex', alignItems:'center', gap:6,
                  background:'#F8FAFC', borderRadius:8, padding:'4px 10px',
                  fontSize:12, fontWeight:600,
                }}>
                  <span style={{ width:10, height:10, borderRadius:3, background:item.color, flexShrink:0 }}/>
                  <span style={{ color:'#475569' }}>{item.name}</span>
                  <span style={{ color:'#94A3B8' }}>{Number(item.size).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}