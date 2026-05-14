import { MapContainer, TileLayer, GeoJSON, CircleMarker, Marker, Popup, useMapEvents } from 'react-leaflet';
import { useState, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Dashboard from './Dashboard';
import MarketDashboard from './MarketDashboard';

const API = process.env.REACT_APP_API_URL || "http://192.168.0.178:8000";

const CAT_COLORS = {
  '의료건강': '#E53935',
  '미용위생': '#8E24AA',
  '돌봄교육': '#1E88E5',
  '놀이문화시설': '#43A047',
};

const BASE_DATA = {
  '강남구': { hospital: 98, park: 90, transport: 95, quiet: 60 },
  '서초구': { hospital: 96, park: 92, transport: 93, quiet: 65 },
  '마포구': { hospital: 91, park: 88, transport: 90, quiet: 70 },
  '용산구': { hospital: 92, park: 88, transport: 88, quiet: 68 },
  '송파구': { hospital: 91, park: 90, transport: 90, quiet: 72 },
  '성동구': { hospital: 88, park: 86, transport: 85, quiet: 75 },
  '광진구': { hospital: 83, park: 88, transport: 82, quiet: 78 },
  '종로구': { hospital: 90, park: 85, transport: 87, quiet: 62 },
  '중구': { hospital: 84, park: 75, transport: 88, quiet: 60 },
  '동작구': { hospital: 84, park: 84, transport: 82, quiet: 80 },
  '관악구': { hospital: 80, park: 80, transport: 80, quiet: 76 },
  '영등포구': { hospital: 83, park: 78, transport: 88, quiet: 65 },
  '강동구': { hospital: 82, park: 86, transport: 80, quiet: 82 },
  '서대문구': { hospital: 82, park: 80, transport: 80, quiet: 78 },
  '성북구': { hospital: 80, park: 82, transport: 78, quiet: 80 },
  '은평구': { hospital: 73, park: 78, transport: 75, quiet: 85 },
  '양천구': { hospital: 78, park: 76, transport: 78, quiet: 82 },
  '강서구': { hospital: 76, park: 78, transport: 76, quiet: 80 },
  '노원구': { hospital: 74, park: 82, transport: 74, quiet: 84 },
  '도봉구': { hospital: 72, park: 80, transport: 72, quiet: 86 },
  '동대문구': { hospital: 79, park: 72, transport: 80, quiet: 72 },
  '중랑구': { hospital: 70, park: 74, transport: 72, quiet: 80 },
  '강북구': { hospital: 68, park: 74, transport: 70, quiet: 84 },
  '구로구': { hospital: 71, park: 72, transport: 74, quiet: 76 },
  '금천구': { hospital: 66, park: 68, transport: 70, quiet: 74 },
};

const GU_CENTERS = {
  '강남구': [37.5172, 127.0473],
  '서초구': [37.4837, 127.0324],
  '마포구': [37.5663, 126.9010],
  '용산구': [37.5326, 126.9906],
  '송파구': [37.5145, 127.1059],
  '성동구': [37.5633, 127.0371],
  '광진구': [37.5385, 127.0823],
  '종로구': [37.5735, 126.9790],
  '중구': [37.5640, 126.9975],
  '동작구': [37.5124, 126.9393],
  '관악구': [37.4784, 126.9516],
  '영등포구': [37.5264, 126.8963],
  '강동구': [37.5301, 127.1238],
  '서대문구': [37.5791, 126.9368],
  '성북구': [37.5894, 127.0167],
  '은평구': [37.6026, 126.9291],
  '양천구': [37.5270, 126.8561],
  '강서구': [37.5509, 126.8495],
  '노원구': [37.6541, 127.0568],
  '도봉구': [37.6688, 127.0471],
  '동대문구': [37.5744, 127.0397],
  '중랑구': [37.6063, 127.0927],
  '강북구': [37.6396, 127.0257],
  '구로구': [37.4954, 126.8877],
  '금천구': [37.4600, 126.9001],
};

const SLIDER_CONFIG = [
  { key: 'park', label: '놀이문화시설', icon: '🌳', color: '#4CAF50' },
  { key: 'hospital', label: '의료건강', icon: '🏥', color: '#2196F3' },
  { key: 'transport', label: '돌봄교육', icon: '🚌', color: '#FF9800' },
  { key: 'quiet', label: '미용위생', icon: '🏠', color: '#9C27B0' },
];

const CARD_DETAILS = [
  { key: 'park', icon: '🌳', label: '놀이문화시설' },
  { key: 'quiet', icon: '🏡', label: '미용위생' },
  { key: 'hospital', icon: '🏥', label: '의료건강' },
  { key: 'transport', icon: '🚌', label: '돌봄교육' },
];

function calcScore(data, weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  return Math.round(
    Object.keys(weights).reduce(
      (sum, k) => sum + (data[k] || 0) * weights[k],
      0
    ) / total
  );
}

export default function App() {
  const [tab, setTab] = useState('map');
  const [geojson, setGeojson] = useState(null);

  const [weights, setWeights] = useState({
    park: 3,
    hospital: 3,
    transport: 3,
    quiet: 3
  });

  const [scores, setScores] = useState({});
  const [topList, setTopList] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch('/seoul_gu.geojson')
      .then(r => r.json())
      .then(setGeojson);
  }, []);

  // 🔥 핵심 수정: weights 바로 반영
  useEffect(() => {
    const s = {};

    Object.entries(BASE_DATA).forEach(([name, data]) => {
      s[name] = calcScore(data, weights);
    });

    setScores(s);

    setTopList(
      Object.entries(s)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    );
  }, [weights]);

  const onEachFeature = (feature, layer) => {
    const name = feature.properties.SIG_KOR_NM;

    layer.on({
      click: () => {
        setSelected(name);
      }
    });
  };

  const style = (feature) => {
    const name = feature.properties.SIG_KOR_NM;
    const score = scores[name] || 60;

    return {
      fillColor:
        score > 85 ? '#43A047' :
        score > 75 ? '#81C784' :
        '#C8E6C9',
      fillOpacity: 0.6,
      color: '#aaa',
      weight: 1
    };
  };

  return (
    <div>
      <h2 style={{ textAlign: 'center' }}>애완견동물감자</h2>

      {/* 슬라이더 */}
      <div style={{ padding: 20 }}>
        {SLIDER_CONFIG.map(({ key, label }) => (
          <div key={key}>
            <span>{label}</span>
            <input
              type="range"
              min={0}
              max={5}
              value={weights[key]}
              onChange={(e) =>
                setWeights(prev => ({
                  ...prev,
                  [key]: Number(e.target.value)
                }))
              }
            />
            <span>{weights[key]}</span>
          </div>
        ))}
      </div>

      {/* 지도 */}
      <MapContainer center={[37.55, 126.98]} zoom={11} style={{ height: 500 }}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />

        {geojson && (
          <GeoJSON
            data={geojson}
            style={style}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>

      {/* TOP */}
      <div>
        <h3>TOP 5</h3>
        {topList.map(([name, score]) => (
          <div key={name}>
            {name} - {score}
          </div>
        ))}
      </div>
    </div>
  );
}
