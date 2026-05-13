import { MapContainer, TileLayer, GeoJSON, CircleMarker, Marker, Popup, useMapEvents } from 'react-leaflet';
import { useState, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Dashboard from './Dashboard';
import MarketDashboard from './MarketDashboard';

// ════════════════════════════════════════════════════════════
// 상수 (컴포넌트 바깥)
// ════════════════════════════════════════════════════════════
//const API = "http://192.168.0.47:8000";  // 백엔드 서버 주소
//const API = process.env.REACT_APP_API_URL;
const API = process.env.REACT_APP_API_URL || "http://192.168.0.178:8000";  // ✅ fallback 추가
const CAT_COLORS = {
  '의료건강':           '#E53935',
  '미용위생':              '#8E24AA',
  '돌봄교육':              '#1E88E5',
  '놀이문화시설': '#43A047',
};

const BASE_DATA = {
  '강남구': { hospital:98, park:90, transport:95, quiet:60 },
  '서초구': { hospital:96, park:92, transport:93, quiet:65 },
  '마포구': { hospital:91, park:88, transport:90, quiet:70 },
  '용산구': { hospital:92, park:88, transport:88, quiet:68 },
  '송파구': { hospital:91, park:90, transport:90, quiet:72 },
  '성동구': { hospital:88, park:86, transport:85, quiet:75 },
  '광진구': { hospital:83, park:88, transport:82, quiet:78 },
  '종로구': { hospital:90, park:85, transport:87, quiet:62 },
  '중구':   { hospital:84, park:75, transport:88, quiet:60 },
  '동작구': { hospital:84, park:84, transport:82, quiet:80 },
  '관악구': { hospital:80, park:80, transport:80, quiet:76 },
  '영등포구':{ hospital:83, park:78, transport:88, quiet:65 },
  '강동구': { hospital:82, park:86, transport:80, quiet:82 },
  '서대문구':{ hospital:82, park:80, transport:80, quiet:78 },
  '성북구': { hospital:80, park:82, transport:78, quiet:80 },
  '은평구': { hospital:73, park:78, transport:75, quiet:85 },
  '양천구': { hospital:78, park:76, transport:78, quiet:82 },
  '강서구': { hospital:76, park:78, transport:76, quiet:80 },
  '노원구': { hospital:74, park:82, transport:74, quiet:84 },
  '도봉구': { hospital:72, park:80, transport:72, quiet:86 },
  '동대문구':{ hospital:79, park:72, transport:80, quiet:72 },
  '중랑구': { hospital:70, park:74, transport:72, quiet:80 },
  '강북구': { hospital:68, park:74, transport:70, quiet:84 },
  '구로구': { hospital:71, park:72, transport:74, quiet:76 },
  '금천구': { hospital:66, park:68, transport:70, quiet:74 },
};

const GU_CENTERS = {
  '강남구':[37.5172,127.0473],'서초구':[37.4837,127.0324],'마포구':[37.5663,126.9010],
  '용산구':[37.5326,126.9906],'송파구':[37.5145,127.1059],'성동구':[37.5633,127.0371],
  '광진구':[37.5385,127.0823],'종로구':[37.5735,126.9790],'중구':[37.5640,126.9975],
  '동작구':[37.5124,126.9393],'관악구':[37.4784,126.9516],'영등포구':[37.5264,126.8963],
  '강동구':[37.5301,127.1238],'서대문구':[37.5791,126.9368],'성북구':[37.5894,127.0167],
  '은평구':[37.6026,126.9291],'양천구':[37.5270,126.8561],'강서구':[37.5509,126.8495],
  '노원구':[37.6541,127.0568],'도봉구':[37.6688,127.0471],'동대문구':[37.5744,127.0397],
  '중랑구':[37.6063,127.0927],'강북구':[37.6396,127.0257],'구로구':[37.4954,126.8877],
  '금천구':[37.4600,126.9001],
};

const SLIDER_CONFIG = [
  { key:'park',      label:'놀이문화시설',        icon:'🌳', color:'#4CAF50' },
  { key:'hospital',  label:'의료건강',        icon:'🏥', color:'#2196F3' },
  { key:'transport', label:'돌봄교육',        icon:'🚌', color:'#FF9800' },
  { key:'quiet',     label:'미용위생', icon:'🏠', color:'#9C27B0' },
];

const CARD_DETAILS = [
  { key:'park',      icon:'🌳', label:'놀이문화시설' },
  { key:'quiet',     icon:'🏡', label:'의료건강' },
  { key:'hospital',  icon:'🏥', label:'돌봄교육' },
  { key:'transport', icon:'🚌', label:'미용위생' },
];

const tooltipStyle = `
  .leaflet-tooltip.custom-tooltip {
    background: rgba(0,0,0,0.65) !important; color: #fff !important;
    border: none !important; border-radius: 8px !important;
    padding: 4px 10px !important; font-size: 13px !important;
    font-weight: 600 !important; box-shadow: none !important; white-space: nowrap !important;
  }
  .leaflet-tooltip.custom-tooltip::before { display:none !important; }
`;

const tabBtnStyle = (active) => ({
  padding: '8px 22px', border: 'none', borderRadius: 10,
  fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
  background: active ? '#1A1A1A' : '#fff',
  color:      active ? '#fff'    : '#555',
  boxShadow:  active ? '0 2px 8px rgba(0,0,0,.18)' : 'none',
});

const SUB_TEXT = {
  map:       '항목별 가중치 조절로 나에게 맞는 동네를 찾아보세요',
  dashboard: '행정동별 반려동물 상권 분석 데이터',
  market:    '데이터 기반 반려동물 시장 계층 분석 대시보드',
};

// ── 헬퍼 함수 ─────────────────────────────────────────────
function ZoomOnClick() {
  useMapEvents({ click(e) { e.target.setView(e.latlng, e.target.getZoom() + 1); } });
  return null;
}

function FlyToRegion({ target }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (target && GU_CENTERS[target]) map.flyTo(GU_CENTERS[target], 13, { duration: 1 });
  }, [target, map]);
  return null;
}

function calcScore(data, weights) {
  const total = Object.values(weights).reduce((a,b)=>a+b, 0);
  if (total === 0) return 0;
  return Math.round(Object.keys(weights).reduce((sum,k) => sum + (data[k]||0)*weights[k], 0) / total);
}

function scoreToFace(score) {
  if (score >= 88) return { img:'/face-good.png', color:'#43A047', label:'최고예요!' };
  if (score >= 80) return { img:'/face-soso.png', color:'#FB8C00', label:'좋아요!' };
  return { img:'/face-bad.png', color:'#E53935', label:'아쉬워요' };
}

function makeIcon(rank, score, hovered = false) {
  const { img, color } = scoreToFace(score);
  const size   = hovered ? 56 : 40;
  const shadow = hovered ? '0 6px 20px rgba(0,0,0,.3)' : '0 2px 8px rgba(0,0,0,.2)';
  return L.divIcon({
    className: 'custom-pin',
    html: `
      <div style="width:${size}px;height:${size}px;background:#fff;
        border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        display:flex;align-items:center;justify-content:center;
        box-shadow:${shadow};border:3px solid ${color};cursor:pointer;">
        <div style="transform:rotate(45deg);width:${size*0.65}px;height:${size*0.65}px;
          border-radius:50%;overflow:hidden;background:transparent;
          display:flex;align-items:center;justify-content:center;">
          <img src="${img}" alt="" style="width:100%;height:100%;object-fit:contain;display:block;"/>
        </div>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size],
  });
}

// ════════════════════════════════════════════════════════════
// 메인 컴포넌트
// ════════════════════════════════════════════════════════════
export default function App() {

  // ── 상태 선언 (모두 컴포넌트 안에) ──────────────────────
  const [tab,            setTab]            = useState('map');
  const [geojson,        setGeojson]        = useState(null);
  const [geoKey,         setGeoKey]         = useState(0);
  const [weights,        setWeights]        = useState({ park:3, hospital:3, transport:3, quiet:3 });
  const [appliedWeights, setAppliedWeights] = useState({ park:3, hospital:3, transport:3, quiet:3 });
  const [scores,         setScores]         = useState({});
  const [topList,        setTopList]        = useState([]);
  const [selected,       setSelected]       = useState(null);
  const [showFormula,    setShowFormula]     = useState(false);
  const [mongoMarkers,   setMongoMarkers]   = useState([]);   // ✅ 컴포넌트 안
  const [showMongo,      setShowMongo]      = useState(false); // ✅ 컴포넌트 안
  const [baseData, setBaseData] = useState(BASE_DATA);      // ✅ BASE_DATA로 교체


  
  // ── GeoJSON 로드 ─────────────────────────────────────────
  useEffect(() => {
    fetch(`/seoul_gu.geojson`)
      .then(r => r.json())
      .then(d => { setGeojson(d); setGeoKey(k=>k+1); })
      .catch(() => {
        fetch('/seoul_gu.geojson')
          .then(r => r.json())
          .then(d => { setGeojson(d); setGeoKey(k=>k+1); });
      });
  }, []);

  // ── 점수 계산 ─────────────────────────────────────────────
  useEffect(() => {
    const s = {};
    Object.entries(BASE_DATA).forEach(([n,d]) => { s[n] = calcScore(d, appliedWeights); });
    setScores(s);
    setTopList(Object.entries(s).sort((a,b)=>b[1]-a[1]).slice(0,5));
    setGeoKey(k=>k+1);
  }, [appliedWeights]);

  // ── 함수 정의 (모두 컴포넌트 안에) ──────────────────────

  const handleRecommend = () => {
    fetch(`${API}/api/recommend`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(weights),
    })
      .then(r => r.json())
      .then(data => {
        const s = {};
        data.forEach(d => { s[d.name] = d.score; });
        setScores(s);
        setTopList(data.slice(0,5).map(d => [d.name, d.score]));
        setGeoKey(k=>k+1);
      })
      .catch(() => setAppliedWeights({...weights}));
  };

  const loadMongoFacilities = () => {
    fetch(`${API}/api/mongo/facilities?limit=2000`)
      .then(r => r.json())
      .then(res => {
        setMongoMarkers(res.data || []);
        setShowMongo(true);
        console.log(`✅ MongoDB 시설 ${res.count}건 로드`);
      })
      .catch(err => console.error('MongoDB 로드 실패:', err));
  };

  const loadFacilitiesMap = (guName) => {
    fetch(`${API}/api/facilities/map/${encodeURIComponent(guName)}`)
      .then(r => r.json())
      .then(res => {
        setMongoMarkers(res.data || []);
        setShowMongo(true);
        console.log(`✅ ${guName} 시설 ${res.matched}건 표시`);
      })
      .catch(err => console.error('시설 로드 실패:', err));
  };

  const style = (feature) => {
    const name  = feature.properties.SIG_KOR_NM || feature.properties.name;
    const score = scores[name] || 60;
    return {
      fillColor: score>=88 ? '#43A047' : score>=80 ? '#81C784' : score>=72 ? '#C8E6C9' : '#E8F5E9',
      fillOpacity: 0.55, color:'#aaa', weight:1,
    };
  };

  const onEachFeature = (feature, layer) => {
    const name = feature.properties.SIG_KOR_NM || feature.properties.name;
    layer.on({
      click: () => {
        const data = BASE_DATA[name] || {};   // ✅ BASE_DATA 사용
        setSelected({ name, score: scores[name], ...data });
        loadFacilitiesMap(name);
      },
      mouseover: e => e.target.setStyle({ fillOpacity:0.8, weight:2, color:'#555' }),
      mouseout:  e => e.target.setStyle({ fillOpacity:0.55, weight:1, color:'#aaa' }),
    });
  };

  // ── 렌더링 ───────────────────────────────────────────────
  return (
    <div style={{ fontFamily:'sans-serif', background:'#E9E9E9', minHeight:'100vh', padding:'16px 20px' }}>
      <style>{tooltipStyle}</style>

      {/* 탭 */}
      <div style={{ display:'flex', justifyContent:'center', gap:8, marginBottom:16 }}>
        <button style={tabBtnStyle(tab==='map')}       onClick={() => setTab('map')}>🗺️ 거주지 추천 지도</button>
        <button style={tabBtnStyle(tab==='dashboard')} onClick={() => setTab('dashboard')}>📊 상권 분석 대시보드</button>
        <button style={tabBtnStyle(tab==='market')}    onClick={() => setTab('market')}>📈 시장 분석</button>
      </div>

      {/* 헤더 */}
      <div style={{ textAlign:'center', marginBottom:16 }}>
        <div style={{ fontSize:60, fontWeight:800, color:'#1A1A1A', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
          <img src="/MAIN.png" alt="강아지" style={{ width:130, height:120, objectFit:'contain' }}/>
          Paw-Data
          <img src="/paw-print.png" alt="" style={{ width:70, height:100, objectFit:'contain', filter:'brightness(0)' }}/>
        </div>
        <p style={{ color:'#888', fontSize:12, marginTop:4 }}>{SUB_TEXT[tab]}</p>
      </div>

      {/* 거주지 추천 지도 */}
      {tab === 'map' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:14, marginBottom:14 }}>

            {/* 슬라이더 패널 */}
            <div style={{ background:'#fff', borderRadius:20, padding:20, boxShadow:'0 2px 10px rgba(0,0,0,.07)' }}>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:16, color:'#222' }}>⚖️ 가중치 설정</div>
              {SLIDER_CONFIG.map(({ key, label, icon, color }) => (
                <div key={key} style={{ marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:18 }}>{icon}</span>
                      <span style={{ fontSize:13, fontWeight:600, color:'#333' }}>{label}</span>
                    </div>
                    <span style={{ fontSize:13, fontWeight:700, color, background:`${color}18`, borderRadius:8, padding:'2px 8px' }}>{weights[key]}</span>
                  </div>
                  <input type="range" min={0} max={5} value={weights[key]}
                    onChange={e => setWeights(w=>({...w,[key]:Number(e.target.value)}))}
                    style={{ width:'100%', accentColor:color, height:4 }}
                  />
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#BBB', marginTop:2 }}>
                    <span>0 무관</span><span>5 매우 중요</span>
                  </div>
                </div>
              ))}

              <button onClick={handleRecommend}
                style={{ width:'100%', padding:'11px', background:'#333', color:'#fff',
                  border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', marginTop:4 }}>
                🔍 나에게 맞는 거주지 찾기
              </button>

              <button onClick={() => setShowFormula(true)}
                style={{ width:'100%', padding:'11px', background:'#F8F8F8', color:'#333',
                  border:'2px solid #E0E0E0', borderRadius:12, fontSize:14, fontWeight:700,
                  cursor:'pointer', marginTop:8, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <img src="/bone.png" alt="bone" style={{ width:20, height:20, objectFit:'contain' }}/>
                가중치 계산 수식 보기
              </button>

              <button
                onClick={showMongo
                  ? () => { setShowMongo(false); setMongoMarkers([]); }
                  : loadMongoFacilities}
                style={{ width:'100%', padding:'11px', marginTop:8,
                  background: showMongo ? '#E53935' : '#1565C0',
                  color:'#fff', border:'none', borderRadius:12,
                  fontSize:13, fontWeight:700, cursor:'pointer' }}>
                {showMongo ? '📍 시설 숨기기' : '📍 반려동물 시설 표시'}
              </button>
            </div>

            {/* 지도 */}
            <div style={{ background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,.07)' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #F0F0F0', fontWeight:700, fontSize:14, color:'#333' }}>
                🗺️ GIS 지도
              </div>
              <div style={{ height:520 }}>
                <MapContainer center={[37.545,126.986]} zoom={11}
                  minZoom={10} maxZoom={18}
                  maxBounds={[[37.2,126.4],[37.9,127.5]]}
                  maxBoundsViscosity={1.0}
                  style={{ height:'100%', width:'100%' }}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"/>
                  <ZoomOnClick/>
                  <FlyToRegion target={selected?.name}/>
                  {geojson && <GeoJSON key={geoKey} data={geojson} style={style} onEachFeature={onEachFeature}/>}

                  {Object.entries(scores).map(([name, score]) => {
                    const pos = GU_CENTERS[name];
                    if (!pos || score < 78) return null;
                    const r = (score - 70) * 0.9;
                    return [
                      <CircleMarker key={name+'-o'} center={pos} radius={r+6}
                        pathOptions={{ color:'none', fillColor:'#FF5722', fillOpacity:0.06 }}/>,
                      <CircleMarker key={name+'-i'} center={pos} radius={r}
                        pathOptions={{ color:'none', fillColor:'#FF3D00', fillOpacity:0.15 }}/>,
                    ];
                  })}

                  {topList.map(([name], i) => {
                    const pos   = GU_CENTERS[name];
                    const score = scores[name];
                    const { img, color, label } = scoreToFace(score);
                    if (!pos) return null;
                    return (
                      <Marker key={name} position={pos}
                        icon={makeIcon(i, score)}
                        eventHandlers={{
                          mouseover: e => e.target.setIcon(makeIcon(i, score, true)),
                          mouseout:  e => e.target.setIcon(makeIcon(i, score, false)),
                        }}>
                        <Popup>
                          <div style={{ textAlign:'center', padding:'4px 8px', minWidth:150 }}>
                            <img src={img} alt={name} style={{ width:52, height:52, objectFit:'contain', borderRadius:'50%', display:'block', margin:'0 auto' }}/>
                            <div style={{ fontWeight:700, fontSize:15, margin:'4px 0' }}>{name}</div>
                            <div style={{ fontSize:22, fontWeight:800, color }}>{score}점</div>
                            <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{label}</div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}

                  {showMongo && mongoMarkers.map((f, i) => (
                    <CircleMarker
                      key={`fac-${i}`}
                      center={[f.lat, f.lng]}
                      radius={3}
                      pathOptions={{
                        color:       CAT_COLORS[f.category] || '#FF5722',
                        fillColor:   CAT_COLORS[f.category] || '#FF5722',
                        fillOpacity: 0.8,
                        weight:      1.5,
                      }}
                    >
                      <Popup>
                        <div style={{ fontSize:13, minWidth:180 }}>
                          <div style={{ fontWeight:700, marginBottom:4 }}>{f.name || '시설명 없음'}</div>
                          <div style={{ color: CAT_COLORS[f.category] || '#666', fontWeight:600, marginBottom:4 }}>
                            {f.category || ''}{f.category_sub ? ` · ${f.category_sub}` : ''}
                          </div>
                          <div style={{ color:'#555', fontSize:11 }}>{f.address || ''}</div>
                          <div style={{ color:'#888', fontSize:11 }}>{f.phone || ''}</div>
                          {(f.indoor_yn || f.outdoor_yn || f.parking_yn) && (
                            <div style={{ marginTop:6, fontSize:11, display:'flex', gap:8 }}>
                              {f.indoor_yn  && <span>실내: {f.indoor_yn}</span>}
                              {f.outdoor_yn && <span>실외: {f.outdoor_yn}</span>}
                              {f.parking_yn && <span>주차: {f.parking_yn}</span>}
                            </div>
                          )}
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}

                </MapContainer>
                              {/* ← 범례 추가 */}
                {showMongo && (
                  <div style={{
                    display:'flex', gap:16, padding:'8px 16px',
                    background:'#fafafa', borderTop:'1px solid #eee',
                    flexWrap:'wrap'
                  }}>
                    {Object.entries(CAT_COLORS).map(([cat, color]) => (
                      <div key={cat} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                        <div style={{
                          width:10, height:10, borderRadius:'50%',
                          background:color, flexShrink:0
                        }}/>
                        <span style={{ color:'#555' }}>{cat}</span>
                      </div>
                    ))}
                  </div>
                )}

              </div>  {/* 지도 div 닫기 */}
                
              
            </div>
          </div>

          {/* 추천 카드 */}
          <div style={{ background:'#fff', borderRadius:20, padding:20, boxShadow:'0 2px 10px rgba(0,0,0,.07)' }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:14, color:'#222' }}>🏆 추천 지역 정보 제공</div>
            <div style={{ fontSize:10, fontWeight:700, marginBottom:14, color:'#222' }}>🐾지역 클릭 후 지도 이동!</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
              {topList.map(([name, score], i) => {
                const d = BASE_DATA[name] || { hospital:0, park:0, transport:0, quiet:0 };
                return (
                  <div key={name} onClick={() => setSelected({name,score,...d})}
                    style={{
                      background: selected?.name===name ? '#FFF3E0' : '#FAFAFA',
                      borderRadius:14, padding:14, cursor:'pointer',
                      border: selected?.name===name ? '2px solid #FF9800' : '2px solid #EFEFEF',
                      transition:'.15s'
                    }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                      <div style={{ background:i===0?'#E53935':i<3?'#EF5350':'#BDBDBD',
                        color:'#fff', borderRadius:'50%', width:20, height:20,
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{i+1}</div>
                      <span style={{ fontWeight:700, fontSize:13 }}>{name}</span>
                    </div>
                    <div style={{ fontSize:24, fontWeight:800, color:i===0?'#E53935':'#333', marginBottom:8 }}>{score}점</div>
                    <div style={{ borderTop:'1px solid #F0F0F0', paddingTop:8 }}>
                      {CARD_DETAILS.map(({key,icon,label}) => (
                        <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:11, color:'#666', marginBottom:3 }}>
                          <span>{icon} {label}</span>
                          <span style={{ fontWeight:700, color:'#444' }}>{d[key]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ✅ 추가된 부분: 상권 분석 대시보드 */}
      {tab === 'dashboard' && <Dashboard API={API} />}

      {/* ✅ 추가된 부분: 시장 분석 */}
      {tab === 'market' && <MarketDashboard API={API} />}

      {showFormula && (
      <div onClick={() => setShowFormula(false)} style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
        display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
        <div onClick={e => e.stopPropagation()} style={{
          background:'#fff', borderRadius:20, padding:32, width:'min(680px,90vw)',
          boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>

          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
            <img src="/bone.png" alt="bone" style={{ width:28, height:28, objectFit:'contain' }}/>
            <span style={{ fontSize:18, fontWeight:900 }}>가중치 계산 수식</span>
          </div>

          {/* 수식 */}
          <div style={{ background:'#F8F8F8', borderRadius:14, padding:20, marginBottom:16, textAlign:'center' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#333', marginBottom:8 }}>점수 계산식</div>
            <div style={{ fontSize:20, fontWeight:900, color:'#1A1A1A', fontFamily:'monospace' }}>
              Score = Σ ( 항목값 × 가중치 ) / Σ 가중치
            </div>
          </div>

          {/* 설명 */}
          <div style={{ fontSize:13, color:'#555', lineHeight:1.8, marginBottom:16 }}>
            <div style={{ marginBottom:8 }}>
              각 항목(공원·병원·교통·조용한 지역)의 기본 점수에 슬라이더로 설정한 가중치를 곱한 후,<br/>
              전체 가중치의 합으로 나눠 최종 점수를 산출합니다.
            </div>
            <div style={{ background:'#FFF3E0', borderRadius:10, padding:12, fontFamily:'monospace', fontSize:12, textAlign:'center' }}>
              예) 공원(90)×3 + 병원(98)×5 + 교통(95)×2 + 조용함(60)×1<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;────────────────────────────── = <b>89점</b><br/>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;3 + 5 + 2 + 1
            </div>
          </div>

          {/* 항목 설명 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
            {[
              { icon:'🌳', label:'공원/산책로',    key:'park' },
              { icon:'🏥', label:'동물병원 접근성', key:'hospital' },
              { icon:'🚌', label:'생활 편의성',    key:'transport' },
              { icon:'🏠', label:'조용한 지역',    key:'quiet' },
            ].map(({ icon, label, key }) => (
              <div key={key} style={{ background:'#F8F8F8', borderRadius:10, padding:'8px 12px',
                display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
                <span>{icon}</span>
                <span style={{ fontWeight:600 }}>{label}</span>
                <span style={{ marginLeft:'auto', fontWeight:800, color:'#333' }}>{weights[key]}</span>
              </div>
            ))}
          </div>

          <button onClick={() => setShowFormula(false)} style={{
            width:'100%', padding:'11px', background:'#1A1A1A', color:'#fff',
            border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer' }}>
            닫기
          </button>
        </div>
      </div>
    )}
      
    </div>
  );
}