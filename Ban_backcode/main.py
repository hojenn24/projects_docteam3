"""
Paw-Data 반려동물 거주지 추천 서비스 - FastAPI 백엔드
실행: uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

# ════════════════════════════════════════════════════════════
# 0. Import
# ════════════════════════════════════════════════════════════
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import create_engine, text
from motor.motor_asyncio import AsyncIOMotorClient
from sshtunnel import SSHTunnelForwarder
import pandas as pd
import os

# ════════════════════════════════════════════════════════════
# 1. FastAPI 앱 (단 1개)
# ════════════════════════════════════════════════════════════
app = FastAPI(title="Paw-Data API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ════════════════════════════════════════════════════════════
# 2. MySQL 연결 (192.168.0.164)
# ════════════════════════════════════════════════════════════
DB_HOST = "192.168.0.164"   
DB_PORT = 3306
DB_USER = "root"  
DB_PASS = "pass123#"   
DB_NAME = "petdb"

DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASS}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)



# ════════════════════════════════════════════════════════════
# 3. MongoDB 연결 (192.168.0.165) — SSH 터널 경유
# ════════════════════════════════════════════════════════════
tunnel = SSHTunnelForwarder(
    ("192.168.0.165", 22),
    ssh_username="root",
    ssh_password="pass123#",
    remote_bind_address=("127.0.0.1", 27017),
    local_bind_address= ("127.0.0.1", 27018),
)

tunnel.start()
print(f"✅ SSH 터널 연결 완료 → 포트 {tunnel.local_bind_port}")

mongo_client = AsyncIOMotorClient(
    f"mongodb://teamys:pass123%23@127.0.0.1:{tunnel.local_bind_port}/?authSource=admin"
)
mongo_db = mongo_client.pet_data

MONGODB_URL = "mongodb://192.168.0.165:27017"
client      = AsyncIOMotorClient(MONGODB_URL)

db = client.pet_data  # pet_project → pet_data

@app.get("/api/facilities")
async def get_facilities():
    collection = db.mongo_facility  # market_trends → mongo_facility
    data = await collection.find(
        {},                          # 조건 없이 전체 조회
        {"_id": 0}                   # _id 필드 제외 (JSON 직렬화 오류 방지)
    ).to_list(1000)                  # 최대 1000건
    return {
        "status":  "success",
        "count":   len(data),
        "data":    data
    }


# ════════════════════════════════════════════════════════════
# 4. CSV 로드 및 전처리
# ════════════════════════════════════════════════════════════
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR,
    "한국문화정보원_전국 반려동물 동반 가능 문화시설 위치 데이터_20250324.csv")


def classify_facility(place_desc: str) -> str:
    t = str(place_desc)
    if any(k in t for k in [
        '동물병원', '동물약국', '동물의료', '수의', '진료',
        '응급', '중성화', '예방접종', '건강검진', '수술전문'
    ]):
        return '의료건강'
    if any(k in t for k in [
        '미용', '목욕', '그루밍', '셀프목욕', '스파', '살롱'
    ]):
        return '미용위생'
    if any(k in t for k in [
        '호텔', '유치원', '위탁', '놀이방',
        '펜션', '훈련', '교육', '사료', '간식', '용품', '분양'
    ]):
        return '돌봄교육'
    return '놀이문화시설'


CATEGORY_MAP = {
    "동물병원": "의료건강", "동물약국": "의료건강",
    "미용": "미용돌봄",     "위탁관리": "미용돌봄",
    "반려동물용품": "일반용품", "카페": "일반용품",
    "식당": "일반용품",     "펜션": "일반용품",
    "호텔": "일반용품",     "여행지": "일반용품",
    "박물관": "일반용품",   "미술관": "일반용품",
    "문예회관": "일반용품",
}
HYGIENE_KEYWORDS = ["목욕", "샴푸", "위생", "세척", "청결", "세탁", "그루밍"]
CATEGORIES = ["의료건강", "위생", "일반용품", "미용돌봄"]

def assign_category(row):
    if any(kw in str(row["시설명"]) for kw in HYGIENE_KEYWORDS):
        return "위생"
    return CATEGORY_MAP.get(row["카테고리3"], "일반용품")

def load_data():
    df = pd.read_csv(CSV_PATH, encoding="utf-8-sig")
    df["4개_카테고리"] = df.apply(assign_category, axis=1)
    df = df[df["시도 명칭"] == "서울특별시"].copy()
    df = df.dropna(subset=["위도", "경도"])
    df["위도"] = pd.to_numeric(df["위도"], errors="coerce")
    df["경도"] = pd.to_numeric(df["경도"], errors="coerce")
    df = df.dropna(subset=["위도", "경도"])
    print(f"✅ CSV 로드 완료 — 서울 시설 수: {len(df):,}")
    return df

df_global = load_data()

def compute_gu_scores():
    scores = {}
    for gu in df_global["시군구 명칭"].unique():
        gu_df = df_global[df_global["시군구 명칭"] == gu]
        scores[gu] = {cat: len(gu_df[gu_df["4개_카테고리"] == cat]) for cat in CATEGORIES}
    return scores

GU_RAW_COUNTS = compute_gu_scores()
CAT_MAX = {cat: max(v[cat] for v in GU_RAW_COUNTS.values()) or 1 for cat in CATEGORIES}

def build_gu_base_data():
    """App.js BASE_DATA 구조와 동일한 형태로 반환"""
    base = {}
    for gu, counts in GU_RAW_COUNTS.items():
        base[gu] = {
            "hospital":  round(counts["의료건강"] / CAT_MAX["의료건강"] * 100, 1),
            "park":      round(counts["일반용품"] / CAT_MAX["일반용품"] * 100, 1),
            "transport": round(counts["미용돌봄"] / CAT_MAX["미용돌봄"] * 100, 1),
            "quiet":     round(counts["위생"]     / CAT_MAX["위생"]     * 100, 1),
        }
    return base

GU_BASE_DATA = build_gu_base_data()

# ── 시장 분석 CSV 로드 (test.py 실행 결과물) ─────────────────
def load_market_csv(filename):
    path = os.path.join(BASE_DIR, filename)
    if os.path.exists(path):
        return pd.read_csv(path, encoding="utf-8-sig")
    return None

df_current  = load_market_csv("integrated_current.csv")
df_compare  = load_market_csv("integrated_compare.csv")
df_estimated= load_market_csv("integrated_estimated.csv")

# ════════════════════════════════════════════════════════════
# 5. 요청/응답 모델
# ════════════════════════════════════════════════════════════
class WeightRequest(BaseModel):
    park:      float = 3.0
    hospital:  float = 3.0
    transport: float = 3.0
    quiet:     float = 3.0

class GuScore(BaseModel):
    name:      str
    score:     float
    rank:      int
    hospital:  float
    park:      float
    transport: float
    quiet:     float

class FacilityItem(BaseModel):
    name:     str
    category: str
    cat3:     str
    lat:      float
    lng:      float
    address:  Optional[str]
    phone:    Optional[str]

# ════════════════════════════════════════════════════════════
# 6. API 엔드포인트
# ════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"status": "ok", "message": "Paw-Data API 정상 동작"}

@app.get("/api/mongo/facilities")
async def get_mongo_facilities(
    gu_name: Optional[str] = Query(None),
    limit:   int           = Query(5000),
):
    # ── Step 1: MySQL에서 서울 시설 facility_id 목록 조회 ────
    with engine.connect() as conn:
        if gu_name:
            rows = conn.execute(text("""
                SELECT f.facility_id
                FROM   facility f
                JOIN   address  a ON f.address_id  = a.address_id
                JOIN   sigungu  s ON a.sigungu_id  = s.sigungu_id
                JOIN   sido     sd ON s.sido_id    = sd.sido_id
                WHERE  sd.sido_name   = '서울특별시'
                  AND  s.sigungu_name = :gu
            """), {"gu": gu_name}).fetchall()
        else:
            rows = conn.execute(text("""
                SELECT f.facility_id
                FROM   facility f
                JOIN   address  a ON f.address_id = a.address_id
                JOIN   sigungu  s ON a.sigungu_id = s.sigungu_id
                JOIN   sido     sd ON s.sido_id   = sd.sido_id
                WHERE  sd.sido_name = '서울특별시'
            """)).fetchall()

    seoul_ids = [row.facility_id for row in rows]
    print(f"✅ 서울 facility_id 수: {len(seoul_ids)}")

    if not seoul_ids:
        return {"status": "success", "count": 0, "data": []}

    # ── Step 2: MongoDB에서 서울 facility_id만 조회 ──────────
    collection = mongo_db.mongo_facility
    data = await collection.find(
        {"facility_id": {"$in": seoul_ids}},
        {
            "_id":                  0,
            "facility_id":          1,
            "facility_name":        1,
            "place_description":    1,
            "location.coordinates": 1,
        }
    ).to_list(limit)

    result = []
    for doc in data:
        coords = doc.get("location", {}).get("coordinates", [])
        if len(coords) < 2:
            continue

        place_desc = doc.get("place_description", "")

        result.append({
            "lng":      float(coords[0]),
            "lat":      float(coords[1]),
            "name":     doc.get("facility_name",     ""),
            "category": classify_facility(place_desc),
        })

    return {"status": "success", "count": len(result), "data": result}


@app.get("/api/mongo/sample")
async def get_mongo_sample():
    """mongo_facility 샘플 1건 조회 — 필드명 확인용"""
    doc = await mongo_db.mongo_facility.find_one({}, {"_id": 0})
    return doc


# ── GeoJSON 서빙 ─────────────────────────────────────────────
@app.get("/seoul_gu.geojson")
def serve_geojson():
    path = os.path.join(BASE_DIR, "seoul_gu.geojson")
    if not os.path.exists(path):
        return {"error": "seoul_gu.geojson 파일이 없습니다"}
    return FileResponse(path, media_type="application/json")


# ── 자치구 BASE_DATA 제공 ─────────────────────────────────────
@app.get("/api/gu_data")
def get_gu_data():
    """App.js BASE_DATA 대체 — DB 기반 실데이터"""
    return GU_BASE_DATA


# ── 자치구 추천 ───────────────────────────────────────────────
@app.post("/api/recommend")
def recommend_gu(weights: WeightRequest):
    wd = {"park": weights.park, "hospital": weights.hospital,
          "transport": weights.transport, "quiet": weights.quiet}
    total_w = sum(wd.values())

    results = []
    for gu, data in GU_BASE_DATA.items():
        score = (sum(data[k] * wd[k] for k in wd) / total_w) if total_w > 0 else 0
        results.append({
            "name":      gu,
            "score":     round(score, 1),
            "hospital":  data["hospital"],
            "park":      data["park"],
            "transport": data["transport"],
            "quiet":     data["quiet"],
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1

    return [GuScore(**r) for r in results]


# ── 자치구별 시설 목록 ────────────────────────────────────────
@app.get("/api/facilities/{gu_name}", response_model=list[FacilityItem])
def get_facilities(
    gu_name:  str,
    category: Optional[str] = Query(None),
    limit:    int            = Query(500),
):
    gu_df = df_global[df_global["시군구 명칭"] == gu_name]
    if category:
        gu_df = gu_df[gu_df["4개_카테고리"] == category]
    return [
        FacilityItem(
            name=str(row["시설명"]),
            category=str(row["4개_카테고리"]),
            cat3=str(row["카테고리3"]),
            lat=float(row["위도"]),
            lng=float(row["경도"]),
            address=str(row["도로명주소"]) if pd.notna(row["도로명주소"]) else None,
            phone=str(row["전화번호"])     if pd.notna(row["전화번호"])   else None,
        )
        for _, row in gu_df.head(limit).iterrows()
    ]


@app.get("/api/facilities/map/{gu_name}")
async def get_facilities_map(
    gu_name: str,
    limit:   int = Query(500),
):
    mongo_cursor = mongo_db.mongo_facility.find(
        {},
        {"_id": 0, "facility_id": 1, "location.coordinates": 1}
    )
    mongo_docs = await mongo_cursor.to_list(100000)

    coord_map = {}
    for doc in mongo_docs:
        fid    = doc.get("facility_id")
        coords = doc.get("location", {}).get("coordinates", [])
        if fid and len(coords) == 2:
            coord_map[fid] = {"lng": coords[0], "lat": coords[1]}

    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT
                f.facility_id,
                f.facility_name,
                f.phone,
                f.indoor_yn,
                f.outdoor_yn,
                f.parking_yn,
                cm.category_main_name   AS category,
                cs.category_sub_name    AS category_sub,
                adr.road_name           AS address,
                s.sigungu_name
            FROM   facility f
            JOIN   address      adr ON f.address_id      = adr.address_id
            JOIN   category_sub cs  ON f.category_sub_id = cs.category_sub_id
            JOIN   category_main cm ON cs.category_main_id = cm.category_main_id
            JOIN   sigungu      s   ON adr.sigungu_id    = s.sigungu_id
            WHERE  s.sigungu_name = :gu
            LIMIT  :lim
        """), {"gu": gu_name, "lim": limit}).fetchall()

    result = []
    for row in rows:
        coords = coord_map.get(row.facility_id)
        if not coords:
            continue
        result.append({
            "facility_id":   row.facility_id,
            "name":          row.facility_name,
            "category":      row.category,
            "category_sub":  row.category_sub,
            "address":       row.address,
            "phone":         row.phone,
            "indoor_yn":     row.indoor_yn,
            "outdoor_yn":    row.outdoor_yn,
            "parking_yn":    row.parking_yn,
            "lat":           coords["lat"],
            "lng":           coords["lng"],
        })

    return {
        "status":         "success",
        "gu":             gu_name,
        "total_mysql":    len(rows),
        "matched":        len(result),
        "unmatched":      len(rows) - len(result),
        "data":           result,
    }


# ── 자치구 목록 ───────────────────────────────────────────────
@app.get("/api/gu_list")
def get_gu_list():
    return {"gus": sorted(df_global["시군구 명칭"].unique().tolist())}


# ── 상권 분석 대시보드 데이터 ─────────────────────────────────
@app.get("/api/dashboard")
def get_dashboard():
    try:
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT
                    s.sigungu_name AS name,
                    SUM(CASE WHEN cs.category_main_id = 1 THEN 1 ELSE 0 END) AS 의료건강,
                    SUM(CASE WHEN cs.category_sub_id = 6 THEN 1 ELSE 0 END) AS 위생,
                    SUM(CASE WHEN cs.category_sub_id = 5 THEN 1 ELSE 0 END) AS 일반용품,
                    SUM(CASE WHEN cs.category_main_id = 4
                        AND cs.category_sub_id NOT IN (5,6) THEN 1 ELSE 0 END) AS 미용돌봄,
                    COALESCE(r.registered_count, 0) AS 반려동물수
                FROM facility f
                JOIN address a ON f.address_id = a.address_id
                JOIN sigungu s ON a.sigungu_id = s.sigungu_id
                JOIN category_sub cs ON f.category_sub_id = cs.category_sub_id
                LEFT JOIN registration r ON s.sigungu_id = r.sigungu_id
                WHERE s.sido_id = 9
                GROUP BY s.sigungu_name, r.registered_count
                ORDER BY 의료건강 DESC
            """)).fetchall()
            return [dict(row._mapping) for row in rows]
    except Exception as e:
        return {"error": str(e)}


# ── 시장 분석: 워드클라우드 키워드 ───────────────────────────
@app.get("/api/market/keywords")
def get_market_keywords():
    if df_current is None:
        return []
    df_sorted = df_current.nlargest(30, "현재_총")
    return [[row["키워드"], int(row["현재_총"] // 500)] for _, row in df_sorted.iterrows()]


# ── 시장 분석: 분야별 비중 (도넛 차트) ───────────────────────
@app.get("/api/market/share")
def get_market_share():
    if df_current is None:
        return {}

    COLORS = {
        "1_반려동물먹거리": "#FB7185",
        "2_미용위생":       "#4ADE80",
        "3_서비스업":       "#22D3EE",
        "4_공산품":         "#34D399",
        "5_의료건강":       "#FDE68A",
    }
    NAME_MAP = {
        "1_반려동물먹거리": "반려동물 식품",
        "2_미용위생":       "미용위생",
        "3_서비스업":       "서비스업",
        "4_공산품":         "일반용품",
        "5_의료건강":       "의료건강",
    }

    total = df_current["현재_총"].sum()
    result = {}

    for cat in df_current["분야"].unique():
        cat_df  = df_current[df_current["분야"] == cat]
        cat_sum = cat_df["현재_총"].sum()
        display = NAME_MAP.get(cat, cat)
        color   = COLORS.get(cat, "#999")

        treemap = [
            {"name": row["키워드"], "size": int(row["현재_총"]), "color": color}
            for _, row in cat_df.nlargest(8, "현재_총").iterrows()
        ]
        result[display] = {
            "color":   color,
            "value":   round(cat_sum / total * 100, 1) if total > 0 else 0,
            "treemap": treemap,
        }
    return result


# ── 시장 분석: 성장률 (바 차트) ─────────────────────────────
@app.get("/api/market/growth")
def get_market_growth():
    if df_compare is None:
        return []

    NAME_MAP = {
        "1_반려동물먹거리": "반려동물 식품",
        "2_미용위생":       "미용위생",
        "3_서비스업":       "서비스업",
        "4_공산품":         "일반용품",
        "5_의료건강":       "의료건강",
    }
    return [
        {
            "name":  NAME_MAP.get(row["분야"], row["분야"]),
            "value": float(row["최근3개월_성장률"]),
        }
        for _, row in df_compare.sort_values("최근3개월_성장률", ascending=False).iterrows()
    ]


# ── 시장 분석: 월별 추이 (라인 차트) ────────────────────────
@app.get("/api/market/trend")
def get_market_trend():
    if df_estimated is None:
        return []

    CAT_MAP = {
        "1_반려동물먹거리": "식품",
        "5_의료건강":       "의료",
        "4_공산품":         "일반용품",
    }
    df_est = df_estimated.copy()
    df_est["날짜_dt"] = pd.to_datetime(df_est["날짜"])
    df_est = df_est[df_est["분야"].isin(CAT_MAP.keys())]

    monthly = df_est.groupby(["날짜", "분야"])["추정_총검색량"].mean().reset_index()
    pivot   = monthly.pivot(index="날짜", columns="분야", values="추정_총검색량").reset_index()
    pivot   = pivot.rename(columns=CAT_MAP)
    pivot   = pivot.rename(columns={"날짜": "date"})
    pivot   = pivot.fillna(0)

    return pivot.tail(12).to_dict(orient="records")


# ── 시장 분석: RAW 데이터 (프론트엔드 직접 연동용) ───────────
@app.get("/api/market/compare")
def get_market_compare():
    if df_compare is None:
        return []
    df = df_compare.rename(columns={
        "분야":             "category",
        "총검색량":         "total_search_volume",
        "최근3개월_성장률": "growth_rate_last_3months",
    })
    return df.to_dict(orient="records")


@app.get("/api/market/current")
def get_market_current():
    if df_current is None:
        return []
    return df_current.to_dict(orient="records")


@app.get("/api/market/estimated")
def get_market_estimated():
    if df_estimated is None:
        return []
    return df_estimated.to_dict(orient="records")


# ── 자치구 통계 요약 ─────────────────────────────────────────
@app.get("/api/summary")
def get_summary():
    summary = {}
    for gu, counts in GU_RAW_COUNTS.items():
        summary[gu] = {"total": sum(counts.values()), **counts}
    return summary


# ── 전체 연동 상태 확인 ───────────────────────────────────────
@app.get("/api/health")
async def health_check():
    result = {
        "backend": "✅ 정상",
        "csv":     f"✅ 서울 시설 {len(df_global):,}건",
        "market_csv": "✅ 로드됨" if df_current is not None else "❌ 없음 (integrated_current.csv 필요)",
        "mysql":   "❌ 미확인",
        "mongodb": "❌ 미확인",
    }
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        result["mysql"] = "✅ 연결 정상"
    except Exception as e:
        result["mysql"] = f"❌ 실패: {str(e)[:60]}"

    try:
        count = await mongo_db.mongo_facility.count_documents({})
        result["mongodb"] = f"✅ 연결 정상 (문서 수: {count:,})"
    except Exception as e:
        result["mongodb"] = f"❌ 실패: {str(e)[:60]}"

    return result