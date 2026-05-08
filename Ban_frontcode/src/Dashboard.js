import React, { useState, useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './Dashboard.css';

// ── 서울 25개 구 데이터 ────────────────────────────────
const GU_COLORS = {
  '강남구':'#E24B4A','서초구':'#378ADD','송파구':'#EF9F27','마포구':'#D4537E',
  '용산구':'#4CAF50','성동구':'#9C27B0','광진구':'#FF5722','종로구':'#00BCD4',
  '중구':'#795548','동작구':'#607D8B','관악구':'#F06292','영등포구':'#26A69A',
  '강동구':'#AB47BC','서대문구':'#42A5F5','성북구':'#66BB6A','은평구':'#FFA726',
  '양천구':'#EC407A','강서구':'#7E57C2','노원구':'#26C6DA','도봉구':'#D4E157',
  '동대문구':'#FF7043','중랑구':'#8D6E63','강북구':'#78909C','구로구':'#29B6F6',
  '금천구':'#9CCC65',
};

const GU_DATA = {
  '강남구':   { center:[37.5172,127.0473], neighborhoods:[
    {name:'역삼동',  의료건강:15,위생:12,일반용품:6,미용돌봄:3,반려동물수:1800},
    {name:'삼성동',  의료건강:12,위생:10,일반용품:5,미용돌봄:2,반려동물수:1500},
    {name:'논현동',  의료건강:11,위생:9, 일반용품:4,미용돌봄:4,반려동물수:1200},
  ]},
  '서초구':   { center:[37.4837,127.0324], neighborhoods:[
    {name:'서초동',  의료건강:13,위생:11,일반용품:5,미용돌봄:2,반려동물수:1600},
    {name:'방배동',  의료건강:10,위생:8, 일반용품:4,미용돌봄:3,반려동물수:1300},
    {name:'반포동',  의료건강:12,위생:10,일반용품:6,미용돌봄:2,반려동물수:1400},
  ]},
  '송파구':   { center:[37.5145,127.1059], neighborhoods:[
    {name:'잠실동',  의료건강:11,위생:11,일반용품:7,미용돌봄:1,반려동물수:1700},
    {name:'문정동',  의료건강:10,위생:8, 일반용품:5,미용돌봄:1,반려동물수:1100},
    {name:'가락동',  의료건강:8, 위생:7, 일반용품:4,미용돌봄:3,반려동물수:900},
  ]},
  '마포구':   { center:[37.5663,126.9010], neighborhoods:[
    {name:'합정동',  의료건강:9, 위생:8, 일반용품:5,미용돌봄:4,반려동물수:1100},
    {name:'망원동',  의료건강:8, 위생:7, 일반용품:4,미용돌봄:5,반려동물수:950},
    {name:'연남동',  의료건강:7, 위생:9, 일반용품:6,미용돌봄:6,반려동물수:1050},
  ]},
  '용산구':   { center:[37.5326,126.9906], neighborhoods:[
    {name:'이태원동',의료건강:10,위생:9, 일반용품:5,미용돌봄:3,반려동물수:1200},
    {name:'한남동',  의료건강:12,위생:8, 일반용품:4,미용돌봄:2,반려동물수:1400},
    {name:'서빙고동',의료건강:7, 위생:6, 일반용품:3,미용돌봄:2,반려동물수:800},
  ]},
  '성동구':   { center:[37.5633,127.0371], neighborhoods:[
    {name:'성수동',  의료건강:9, 위생:10,일반용품:6,미용돌봄:5,반려동물수:1300},
    {name:'왕십리동',의료건강:8, 위생:7, 일반용품:4,미용돌봄:3,반려동물수:1000},
    {name:'금호동',  의료건강:7, 위생:6, 일반용품:3,미용돌봄:2,반려동물수:850},
  ]},
  '광진구':   { center:[37.5385,127.0823], neighborhoods:[
    {name:'건대입구',의료건강:8, 위생:9, 일반용품:7,미용돌봄:4,반려동물수:1150},
    {name:'구의동',  의료건강:7, 위생:7, 일반용품:5,미용돌봄:3,반려동물수:950},
    {name:'자양동',  의료건강:6, 위생:6, 일반용품:4,미용돌봄:2,반려동물수:800},
  ]},
  '종로구':   { center:[37.5735,126.9790], neighborhoods:[
    {name:'삼청동',  의료건강:6, 위생:5, 일반용품:4,미용돌봄:3,반려동물수:700},
    {name:'혜화동',  의료건강:7, 위생:6, 일반용품:3,미용돌봄:2,반려동물수:750},
    {name:'사직동',  의료건강:5, 위생:5, 일반용품:3,미용돌봄:2,반려동물수:600},
  ]},
  '중구':     { center:[37.5640,126.9975], neighborhoods:[
    {name:'명동',    의료건강:8, 위생:7, 일반용품:5,미용돌봄:2,반려동물수:900},
    {name:'충무로',  의료건강:7, 위생:6, 일반용품:4,미용돌봄:2,반려동물수:750},
    {name:'황학동',  의료건강:6, 위생:5, 일반용품:3,미용돌봄:1,반려동물수:600},
  ]},
  '동작구':   { center:[37.5124,126.9393], neighborhoods:[
    {name:'사당동',  의료건강:9, 위생:8, 일반용품:5,미용돌봄:3,반려동물수:1100},
    {name:'노량진동',의료건강:7, 위생:7, 일반용품:4,미용돌봄:2,반려동물수:900},
    {name:'상도동',  의료건강:8, 위생:7, 일반용품:4,미용돌봄:3,반려동물수:950},
  ]},
  '관악구':   { center:[37.4784,126.9516], neighborhoods:[
    {name:'신림동',  의료건강:8, 위생:7, 일반용품:5,미용돌봄:3,반려동물수:1000},
    {name:'봉천동',  의료건강:7, 위생:6, 일반용품:4,미용돌봄:2,반려동물수:850},
    {name:'남현동',  의료건강:6, 위생:5, 일반용품:3,미용돌봄:2,반려동물수:700},
  ]},
  '영등포구': { center:[37.5264,126.8963], neighborhoods:[
    {name:'여의도동',의료건강:10,위생:9, 일반용품:6,미용돌봄:2,반려동물수:1300},
    {name:'영등포동',의료건강:8, 위생:8, 일반용품:5,미용돌봄:3,반려동물수:1000},
    {name:'당산동',  의료건강:7, 위생:7, 일반용품:4,미용돌봄:3,반려동물수:900},
  ]},
  '강동구':   { center:[37.5301,127.1238], neighborhoods:[
    {name:'천호동',  의료건강:9, 위생:8, 일반용품:5,미용돌봄:3,반려동물수:1100},
    {name:'암사동',  의료건강:7, 위생:7, 일반용품:4,미용돌봄:2,반려동물수:900},
    {name:'길동',    의료건강:8, 위생:6, 일반용품:4,미용돌봄:2,반려동물수:850},
  ]},
  '서대문구': { center:[37.5791,126.9368], neighborhoods:[
    {name:'홍제동',  의료건강:7, 위생:7, 일반용품:4,미용돌봄:3,반려동물수:900},
    {name:'신촌동',  의료건강:9, 위생:8, 일반용품:6,미용돌봄:4,반려동물수:1100},
    {name:'남가좌동',의료건강:6, 위생:5, 일반용품:3,미용돌봄:2,반려동물수:700},
  ]},
  '성북구':   { center:[37.5894,127.0167], neighborhoods:[
    {name:'길음동',  의료건강:7, 위생:7, 일반용품:4,미용돌봄:3,반려동물수:900},
    {name:'정릉동',  의료건강:6, 위생:6, 일반용품:3,미용돌봄:2,반려동물수:750},
    {name:'돈암동',  의료건강:8, 위생:7, 일반용품:5,미용돌봄:3,반려동물수:1000},
  ]},
  '은평구':   { center:[37.6026,126.9291], neighborhoods:[
    {name:'응암동',  의료건강:6, 위생:6, 일반용품:4,미용돌봄:3,반려동물수:850},
    {name:'녹번동',  의료건강:7, 위생:6, 일반용품:3,미용돌봄:2,반려동물수:800},
    {name:'불광동',  의료건강:7, 위생:7, 일반용품:4,미용돌봄:3,반려동물수:900},
  ]},
  '양천구':   { center:[37.5270,126.8561], neighborhoods:[
    {name:'목동',    의료건강:10,위생:9, 일반용품:6,미용돌봄:3,반려동물수:1300},
    {name:'신정동',  의료건강:7, 위생:7, 일반용품:4,미용돌봄:2,반려동물수:900},
    {name:'신월동',  의료건강:6, 위생:6, 일반용품:3,미용돌봄:2,반려동물수:750},
  ]},
  '강서구':   { center:[37.5509,126.8495], neighborhoods:[
    {name:'화곡동',  의료건강:8, 위생:7, 일반용품:5,미용돌봄:3,반려동물수:1000},
    {name:'방화동',  의료건강:6, 위생:6, 일반용품:3,미용돌봄:2,반려동물수:750},
    {name:'마곡동',  의료건강:9, 위생:8, 일반용품:6,미용돌봄:3,반려동물수:1200},
  ]},
  '노원구':   { center:[37.6541,127.0568], neighborhoods:[
    {name:'상계동',  의료건강:7, 위생:7, 일반용품:4,미용돌봄:3,반려동물수:1000},
    {name:'중계동',  의료건강:8, 위생:7, 일반용품:5,미용돌봄:3,반려동물수:1050},
    {name:'공릉동',  의료건강:6, 위생:6, 일반용품:3,미용돌봄:2,반려동물수:800},
  ]},
  '도봉구':   { center:[37.6688,127.0471], neighborhoods:[
    {name:'쌍문동',  의료건강:6, 위생:6, 일반용품:4,미용돌봄:2,반려동물수:800},
    {name:'방학동',  의료건강:5, 위생:5, 일반용품:3,미용돌봄:2,반려동물수:700},
    {name:'창동',    의료건강:7, 위생:6, 일반용품:4,미용돌봄:2,반려동물수:850},
  ]},
  '동대문구': { center:[37.5744,127.0397], neighborhoods:[
    {name:'전농동',  의료건강:7, 위생:6, 일반용품:4,미용돌봄:2,반려동물수:850},
    {name:'회기동',  의료건강:8, 위생:7, 일반용품:5,미용돌봄:3,반려동물수:1000},
    {name:'장안동',  의료건강:6, 위생:6, 일반용품:3,미용돌봄:2,반려동물수:750},
  ]},
  '중랑구':   { center:[37.6063,127.0927], neighborhoods:[
    {name:'묵동',    의료건강:6, 위생:6, 일반용품:3,미용돌봄:2,반려동물수:750},
    {name:'신내동',  의료건강:7, 위생:6, 일반용품:4,미용돌봄:2,반려동물수:850},
    {name:'면목동',  의료건강:7, 위생:7, 일반용품:4,미용돌봄:3,반려동물수:900},
  ]},
  '강북구':   { center:[37.6396,127.0257], neighborhoods:[
    {name:'미아동',  의료건강:6, 위생:6, 일반용품:3,미용돌봄:2,반려동물수:750},
    {name:'번동',    의료건강:5, 위생:5, 일반용품:3,미용돌봄:2,반려동물수:650},
    {name:'수유동',  의료건강:7, 위생:6, 일반용품:4,미용돌봄:2,반려동물수:850},
  ]},
  '구로구':   { center:[37.4954,126.8877], neighborhoods:[
    {name:'구로동',  의료건강:7, 위생:7, 일반용품:4,미용돌봄:2,반려동물수:900},
    {name:'신도림동',의료건강:8, 위생:7, 일반용품:5,미용돌봄:3,반려동물수:1000},
    {name:'개봉동',  의료건강:6, 위생:5, 일반용품:3,미용돌봄:2,반려동물수:700},
  ]},
  '금천구':   { center:[37.4600,126.9001], neighborhoods:[
    {name:'가산동',  의료건강:7, 위생:6, 일반용품:4,미용돌봄:2,반려동물수:850},
    {name:'독산동',  의료건강:6, 위생:5, 일반용품:3,미용돌봄:2,반려동물수:700},
    {name:'시흥동',  의료건강:5, 위생:5, 일반용품:3,미용돌봄:1,반려동물수:600},
  ]},
};

const ALL_GUS = Object.keys(GU_DATA);

const CAT_COLORS = {
  의료건강:'#E24B4A', 위생:'#378ADD', 일반용품:'#EF9F27', 미용돌봄:'#D4537E', 반려동물수:'#FAC775',
};

const CAT_OFFSETS = {
  의료건강:  [ 0.012,  0     ],
  위생:      [-0.012,  0     ],
  일반용품:  [ 0,      0.018 ],
  미용돌봄:  [ 0,     -0.018 ],
  반려동물수:[ 0.008,  0.008 ],
};

const dataLabelPlugin = {
  id: 'dataLabels',
  afterDatasetsDraw(chart, _, opts) {
    if (!opts.show) return;
    const ctx = chart.ctx;
    chart.data.datasets.forEach((ds, i) => {
      if (ds.hidden || ds.type === 'line') return;
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden) return;
      meta.data.forEach((bar, j) => {
        const val = ds.data[j];
        if (!val) return;
        ctx.save();
        ctx.fillStyle = '#1A1A1A';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(val, bar.x, bar.y - 1);
        ctx.restore();
      });
    });
  },
};

function buildChartData(selectedGus, guData, apiData) {
  const labels = [];
  const d = { 의료건강:[], 위생:[], 일반용품:[], 미용돌봄:[], 반려동물수:[] };

  selectedGus.forEach(gu => {
    labels.push(gu);
    if (apiData && apiData[gu]) {
      const row = apiData[gu];
      d.의료건강.push(row.의료건강   || 0);
      d.위생.push(row.위생           || 0);
      d.일반용품.push(row.일반용품   || 0);
      d.미용돌봄.push(row.미용돌봄   || 0);
      d.반려동물수.push(row.반려동물수|| 0);
    } else {
      const nbs = guData[gu]?.neighborhoods || [];
      const avg = (key) => nbs.length ? Math.round(nbs.reduce((s,n)=>s+(n[key]||0),0)/nbs.length) : 0;
      d.의료건강.push(avg('의료건강'));
      d.위생.push(avg('위생'));
      d.일반용품.push(avg('일반용품'));
      d.미용돌봄.push(avg('미용돌봄'));
      d.반려동물수.push(avg('반려동물수'));
    }
  });

  return {
    labels,
    datasets: [
      { type:'bar',  label:'미용돌봄',   data:d.미용돌봄,   backgroundColor:CAT_COLORS.미용돌봄,   yAxisID:'y', order:1, borderRadius:2 },
      { type:'bar',  label:'위생',       data:d.위생,       backgroundColor:CAT_COLORS.위생,       yAxisID:'y', order:2, borderRadius:2 },
      { type:'bar',  label:'의료건강',   data:d.의료건강,   backgroundColor:CAT_COLORS.의료건강,   yAxisID:'y', order:3, borderRadius:2 },
      { type:'bar',  label:'일반용품',   data:d.일반용품,   backgroundColor:CAT_COLORS.일반용품,   yAxisID:'y', order:4, borderRadius:2 },
      {
        type:'line', label:'반려동물수', data:d.반려동물수,
        borderColor:CAT_COLORS.반려동물수, backgroundColor:CAT_COLORS.반려동물수,
        pointBackgroundColor:CAT_COLORS.반려동물수, pointBorderColor:'#fff',
        pointBorderWidth:2, pointRadius:6, pointStyle:'rectRot',
        tension:0.35, yAxisID:'y1', order:0, borderWidth:2.5,
      },
    ],
  };
}

function computeScore(selectedGus, guData, apiData) {
  if (!selectedGus.length) return { score:0, animals:'0마리', isGood:false, topCategory:'-' };
  let total=0, count=0, animalTotal=0;
  const catTotals = { 의료건강:0, 위생:0, 일반용품:0, 미용돌봄:0 };

  selectedGus.forEach(gu => {
    if (apiData && apiData[gu]) {
      const row = apiData[gu];
      catTotals.의료건강 += row.의료건강||0;
      catTotals.위생     += row.위생||0;
      catTotals.일반용품 += row.일반용품||0;
      catTotals.미용돌봄 += row.미용돌봄||0;
      animalTotal += row.반려동물수||0;
      total += (row.의료건강||0)+(row.위생||0)+(row.일반용품||0)+(row.미용돌봄||0);
      count++;
    } else {
      (guData[gu]?.neighborhoods || []).forEach(n => {
        catTotals.의료건강 += n.의료건강||0;
        catTotals.위생     += n.위생||0;
        catTotals.일반용품 += n.일반용품||0;
        catTotals.미용돌봄 += n.미용돌봄||0;
        animalTotal += n.반려동물수||0;
        total += (n.의료건강||0)+(n.위생||0)+(n.일반용품||0)+(n.미용돌봄||0);
        count++;
      });
    }
  });
  if (!count) return { score:0, animals:'0마리', isGood:false, topCategory:'-' };
  const topCategory = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0][0];
  const avg = Math.min(100, Math.round((total/count)/300*100));
  return { score:avg, animals:Math.round(animalTotal/count).toLocaleString()+'마리', isGood:avg>=55, topCategory };
}

export default function Dashboard({ API }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);
  const dropRef   = useRef(null);

  const [apiData,     setApiData]     = useState(null);
  const [loading,     setLoading]     = useState(!!API);
  const [selectedGus, setSelectedGus] = useState(['강남구','서초구','송파구']);
  const [showLabels,  setShowLabels]  = useState(true);
  const [dropOpen,    setDropOpen]    = useState(false);

  const scoreInfo = computeScore(selectedGus, GU_DATA, apiData);

  useEffect(() => {
    if (!API) { setLoading(false); return; }
    fetch(`${API}/api/dashboard`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => {
        if (!data || !data.length) return;
        const byGu = {};
        data.forEach(row => { byGu[row.name] = row; });
        setApiData(byGu);
      })
      .catch(() => console.warn('⚠️ Dashboard API 실패 → fallback 데이터 사용'))
      .finally(() => setLoading(false));
  }, [API]);

  useEffect(() => {
    if (loading) return;
    Chart.register(dataLabelPlugin);
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    if (!canvasRef.current) return;
    try {
      const chart = new Chart(canvasRef.current, {
        data: buildChartData(selectedGus, GU_DATA, apiData),
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins: {
            dataLabels:{ show:showLabels },
            legend:{ display:false },
            tooltip:{
              callbacks:{
                title:(items)=>items[0].label,
                label:(item)=>{
                  const unit = item.dataset.label==='반려동물수'?'마리':'개';
                  return ` ${item.dataset.label}: ${item.raw.toLocaleString()}${unit}`;
                },
              },
              displayColors:true, boxWidth:10, boxHeight:10, padding:10,
              backgroundColor:'rgba(40,40,40,0.92)',
              titleFont:{weight:'bold',size:12}, bodyFont:{size:12},
              titleColor:'#fff', bodyColor:'#fff',
            },
          },
          scales:{
            y:{ type:'linear', position:'left',
              title:{display:true,text:'단위 : 개',align:'start',font:{size:11},color:'#888'},
              min:0,
              ticks:{font:{size:11},color:'#666'},
              grid:{color:'rgba(0,0,0,0.06)'},
            },
            y1:{ type:'linear', position:'right',
              title:{display:true,text:'단위 : 마리',align:'start',font:{size:11},color:'#888'},
              min:0,
              ticks:{font:{size:11},color:'#666',callback:v=>v.toLocaleString()},
              grid:{drawOnChartArea:false},
            },
            x:{ ticks:{autoSkip:false,font:{size:9},color:'#333',maxRotation:45}, grid:{display:false} },
          },
          animation:{ duration:350 },
        },
      });
      chartRef.current = chart;
    } catch(e) {
      console.error('❌ 차트 생성 실패:', e);
    }
    return () => { if(chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
    // eslint-disable-next-line
  }, [loading, apiData]);

  useEffect(() => {
    if (!chartRef.current) return;
    const nd = buildChartData(selectedGus, GU_DATA, apiData);
    chartRef.current.data.labels = nd.labels;
    chartRef.current.data.datasets = nd.datasets;
    chartRef.current.update();
  }, [selectedGus, apiData]);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.options.plugins.dataLabels.show = showLabels;
    chartRef.current.update();
  }, [showLabels]);

  useEffect(() => {
    const h = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggleGu = (gu) => {
    setSelectedGus(prev => {
      if (prev.includes(gu)) return prev.filter(g => g !== gu);
      if (prev.length >= 3) return prev;
      return [...prev, gu];
    });
  };

  // ── 지도 마커 생성 (배경원 / 카테고리 마커 분리) ──────
  const bgMarkers = [];
  const catMarkers = [];

  selectedGus.forEach(gu => {
    const [lat, lng] = GU_DATA[gu].center;
    const guColor = GU_COLORS[gu];
    const row = apiData && apiData[gu];
    const animalCount = row ? (row.반려동물수 || 0) :
      Math.round(GU_DATA[gu].neighborhoods.reduce((s,n)=>s+n.반려동물수,0)/GU_DATA[gu].neighborhoods.length);

    // 배경 원 (구 이름 표시용)
    bgMarkers.push({
      lat, lng,
      radius: Math.min(50, Math.max(18, animalCount / 1500)),
      color: guColor, fill: guColor, fillOpacity: 0.18, weight: 2, label: gu,
    });

    // 카테고리별 마커
    Object.keys(CAT_OFFSETS).forEach(cat => {
      const val = row ? (row[cat] || 0) :
        Math.round(GU_DATA[gu].neighborhoods.reduce((s,n)=>s+(n[cat]||0),0)/GU_DATA[gu].neighborhoods.length);
      const [dlat, dlng] = CAT_OFFSETS[cat];
      const r = cat==='반려동물수'
        ? Math.min(40, Math.max(5, val / 1500))
        : Math.min(40, Math.max(5, val / 8));
      catMarkers.push({
        lat: lat+dlat, lng: lng+dlng,
        radius: r,
        color: CAT_COLORS[cat], fill: CAT_COLORS[cat], fillOpacity: 0.75, weight: 1.5,
        label: `${gu} ${cat}: ${val.toLocaleString()}${cat==='반려동물수'?'마리':'개'}`,
      });
    });
  });

  return (
    <div style={{ display:'grid', gridTemplateColumns:'210px 1fr 1fr', gap:14, alignItems:'stretch' }}>

      {/* ── 왼쪽 패널 ── */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

        <div className="db-card">
          <div style={{ fontWeight:800, fontSize:14, color:'#1A1A1A', marginBottom:10 }}>
            지역 선택 (최대3개)
          </div>

          <div ref={dropRef} style={{ position:'relative', marginBottom:10 }}>
            <div onClick={()=>setDropOpen(v=>!v)} style={{
              border:'1.5px solid #E0DEDB', borderRadius:10, padding:'8px 12px',
              display:'flex', alignItems:'center', justifyContent:'space-between',
              cursor:'pointer', fontSize:12, fontWeight:600, color:'#555', background:'#fff',
            }}>
              구를 선택하세요
              <span style={{ fontSize:10 }}>▼</span>
            </div>
            {dropOpen && (
              <div style={{
                position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:200,
                background:'#fff', border:'1.5px solid #E0DEDB', borderRadius:10,
                boxShadow:'0 4px 16px rgba(0,0,0,0.14)', maxHeight:240, overflowY:'auto',
              }}>
                {ALL_GUS.map(gu => {
                  const isSel = selectedGus.includes(gu);
                  const isDis = !isSel && selectedGus.length >= 3;
                  return (
                    <div key={gu} onClick={()=>!isDis&&toggleGu(gu)} style={{
                      padding:'7px 12px', fontSize:12, fontWeight:600,
                      display:'flex', alignItems:'center', gap:7, cursor:isDis?'not-allowed':'pointer',
                      background:isSel?'#1A1A1A':'#fff',
                      color:isSel?'#fff':isDis?'#CCC':'#333',
                    }}>
                      <span style={{ width:9,height:9,borderRadius:'50%',background:GU_COLORS[gu],flexShrink:0 }}/>
                      {gu}
                      {isSel && <span style={{ marginLeft:'auto', fontSize:11 }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:14, minHeight:26 }}>
            {selectedGus.map(gu => (
              <div key={gu} style={{
                display:'flex', alignItems:'center', gap:4,
                background:GU_COLORS[gu], color:'#fff',
                borderRadius:20, padding:'3px 9px', fontSize:11, fontWeight:700,
              }}>
                {gu}
                <span onClick={()=>toggleGu(gu)} style={{ cursor:'pointer', fontSize:13 }}>×</span>
              </div>
            ))}
          </div>

          <label className="db-toggle-row" style={{ cursor:'pointer' }}>
            <span className="db-toggle-switch">
              <input type="checkbox" checked={showLabels} onChange={e=>setShowLabels(e.target.checked)}/>
              <span className="db-toggle-track"/>
            </span>
            Show chart labels
          </label>
        </div>

        <div className="db-card">
          <div className="db-score-title">입지친화도</div>
          <div className="db-score-sub">Overall: 추천/비추천</div>
          <div className="db-dog-area">
            <img
              src={scoreInfo.isGood?'/face-good.png':'/face-bad.png'}
              alt="score"
              style={{ width:140, height:130, objectFit:'contain' }}
            />
          </div>
          <div className="db-score-result" style={{
            background:scoreInfo.isGood?'#F0FFF4':'#FFF5F5',
            borderLeftColor:scoreInfo.isGood?'#2E7D32':'#E24B4A',
          }}>
            <div className="db-res-row">
              <span className="db-res-label">Location: </span>
              <span className={scoreInfo.isGood?'db-res-good':'db-res-bad'}>
                {scoreInfo.isGood?'추천':'비추천'}
              </span>
            </div>
            <div className="db-res-row">
              <span className="db-res-label">Risk Level: </span>
              <span className={scoreInfo.isGood?'db-res-good':'db-res-bad'}>
                {scoreInfo.isGood?'낮음':'높음'}
              </span>
            </div>
          </div>
        </div>

        <div className="db-summary-cards">
          <div className="db-s-card">
            <div className="db-s-lbl">Summary</div>
            <div className="db-s-val" style={{ fontSize:11 }}>{scoreInfo.topCategory}</div>
          </div>
          <div className="db-s-card">
            <div className="db-s-lbl">Risk Level</div>
            <div className="db-s-val">{scoreInfo.score}</div>
          </div>
          <div className="db-s-card">
            <div className="db-s-lbl">반려동물</div>
            <div className="db-s-val" style={{ fontSize:11 }}>{scoreInfo.animals}</div>
          </div>
        </div>
      </div>

      {/* ── 가운데: 차트 ── */}
      <div className="db-right" style={{ minWidth:0, display:'flex', flexDirection:'column' }}>
        <div className="db-chart-controls">
          <button className="db-icon-btn" title="차트 저장"
            onClick={()=>{ const a=document.createElement('a'); a.href=canvasRef.current.toDataURL('image/png'); a.download='chart.png'; a.click(); }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v8M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <button className="db-icon-btn" title="도움말"
            onClick={()=>alert('선택한 구의 행정동별 반려동물 관련 시설 수(개)와 반려동물 수(마리)를 나타냅니다.')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M6.5 6c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="8" cy="11" r=".7" fill="currentColor"/>
            </svg>
          </button>
        </div>

        <div className="db-chart-scroll" style={{ flex:1, minHeight:0 }}>
          <div className="db-chart-inner" style={{ height:'100%' }}>
            <canvas ref={canvasRef} role="img" aria-label="구별 반려동물 시설 및 개체수 차트"/>
          </div>
        </div>

        <div className="db-chart-legend">
          {Object.entries(CAT_COLORS).map(([label,color])=>(
            <div key={label} className="db-cl-item">
              <span className={label==='반려동물수'?'db-cl-diamond':'db-cl-circle'} style={{background:color}}/>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 오른쪽: 지도 ── */}
      <div className="db-right" style={{ padding:0, overflow:'hidden', minWidth:0, display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #F0EEEB', fontWeight:700, fontSize:14, color:'#333' }}>
          🗺️ 지역 분포 지도
        </div>

        <div style={{ flex:1, minHeight:0 }}>
          <MapContainer center={[37.535,127.020]} zoom={11} style={{ height:'100%', width:'100%' }}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"/>

            {/* 배경 원 먼저 렌더링 */}
            {bgMarkers.map((m,i) => (
              <CircleMarker key={`bg-${i}`} center={[m.lat,m.lng]} radius={m.radius}
                pathOptions={{ color:m.color, fillColor:m.fill, fillOpacity:m.fillOpacity, weight:m.weight }}>
                <LeafletTooltip>{m.label}</LeafletTooltip>
              </CircleMarker>
            ))}

            {/* 카테고리 마커 나중에 렌더링 (위에 표시됨) */}
            {catMarkers.map((m,i) => (
              <CircleMarker key={`cat-${i}`} center={[m.lat,m.lng]} radius={m.radius}
                pathOptions={{ color:m.color, fillColor:m.fill, fillOpacity:m.fillOpacity, weight:m.weight }}>
                <LeafletTooltip>{m.label}</LeafletTooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <div style={{ padding:'10px 14px', borderTop:'1px solid #F0EEEB' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#888', marginBottom:6 }}>지부 연명</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'5px 12px' }}>
            {selectedGus.map(gu=>(
              <div key={gu} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600 }}>
                <span style={{ width:9,height:9,borderRadius:'50%',background:GU_COLORS[gu],flexShrink:0 }}/>
                {gu}
              </div>
            ))}
            {Object.entries(CAT_COLORS).map(([cat,color])=>(
              <div key={cat} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600 }}>
                <span style={{ width:9,height:9,borderRadius:'50%',background:color,flexShrink:0 }}/>
                {cat}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <span className="db-toggle-switch">
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/>
      <span className="db-toggle-track"/>
    </span>
  );
}