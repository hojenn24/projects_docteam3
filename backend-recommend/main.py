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
import glob
import threading
import logging

# ════════════════════════════════════════════════════════════
# logging
# ════════════════════════════════════════════════════════════
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("paw-data")

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
# 2. MySQL 연결
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
# 3. MongoDB 연결
# ════════════════════════════════════════════════════════════
tunnel = SSHTunnelForwarder(
    ("192.168.0.165", 22),
    ssh_username="root",
    ssh_password="pass123#",
    remote_bind_address=("127.0.0.1", 27017),
    local_bind_address=("127.0.0.1", 27018),
)

# 주의: 현재 구조 유지 요청에 따라 살려두되, 가능하면 이것도 startup으로 옮기는 것이 더 안전함
tunnel.start()
logger.info(f"✅ SSH 터널 연결 완료 → 포트 {tunnel.local_bind_port}")

mongo_client = AsyncIOMotorClient(
    f"mongodb://teamys:pass123%23@127.0.0.1:{tunnel.local_bind_port}/?authSource=admin"
)
mongo_db = mongo_client.pet_data

MONGODB_URL = "mongodb://192.168.0.165:27017"
client = AsyncIOMotorClient(MONGODB_URL)
db = client.pet_data

@app.get("/api/facilities")
async def get_facilities_root():
    collection = db.mongo_facility
    data = await collection.find({}, {"_id": 0}).to_list(1000)
    return {
        "status": "success",
        "count": len(data),
        "data": data
    }

# ════════════════════════════════════════════════════════════
# 4. CSV 로드 및 전처리 (safe lazy loading)
# ════════════════════════════════════════════════════════════
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

CATEGORY_MAP = {
    "동물병원": "의료건강", "동물약국": "의료건강",
    "미용": "미용돌봄", "위탁관리": "미용돌봄",
    "반려동물용품": "일반용품", "카페": "일반용품",
    "식당": "일반용품", "펜션": "일반용품",
    "호텔": "일반용품", "여행지": "일반용품",
    "박물관": "일반용품", "미술관": "일반용품",
    "문예회관": "일반용품",
}

HYGIENE_KEYWORDS = ["목욕", "샴푸", "위생", "세척", "청결", "세탁", "그루밍"]
CATEGORIES = ["의료건강", "위생", "일반용품", "미용돌봄"]

CSV_REQUIRED_COLUMNS = [
    "시설명", "카테고리3", "시도 명칭", "시군구 명칭",
    "위도", "경도", "도로명주소", "전화번호"
]

_df_global: Optional[pd.DataFrame] = None
_df_loaded: bool = False
_df_source_path: Optional[str] = None
_df_lock = threading.Lock()

def classify_facility(place_desc: str) -> str:
    t = str(place_desc)
    if any(k in t for k in [
        "동물병원", "동물약국", "동물의료", "수의", "진료",
        "응급", "중성화", "예방접종", "건강검진", "수술전문"
    ]):
        return "의료건강"
    if any(k in t for k in [
        "미용", "목욕", "그루밍", "셀프목욕", "스파", "살롱"
    ]):
        return "미용위생"
    if any(k in t for k in [
        "호텔", "유치원", "위탁", "놀이방",
        "펜션", "훈련", "교육", "사료", "간식", "용품", "분양"
    ]):
        return "돌봄교육"
    return "놀이문화시설"

def assign_category(row):
    if any(kw in str(row.get("시설명", "")) for kw in HYGIENE_KEYWORDS):
        return "위생"
    return CATEGORY_MAP.get(row.get("카테고리3"), "일반용품")

def build_empty_facility_df() -> pd.DataFrame:
    cols = CSV_REQUIRED_COLUMNS + ["4개_카테고리"]
    return pd.DataFrame(columns=cols)

def get_candidate_data_dirs():
    env_dir = os.getenv("CSV_DATA_DIR")
    candidates = []

    if env_dir:
        candidates.append(env_dir)

    candidates.extend([
        os.path.join(BASE_DIR, "data"),
        "/app/data",
        BASE_DIR,
        "/app",
    ])

    # 중복 제거
    seen = set()
    result = []
    for path in candidates:
        norm = os.path.abspath(path)
        if norm not in seen:
            seen.add(norm)
            result.append(norm)
    return result

def score_csv_file(path: str) -> tuple:
    """
    점수가 작은 파일이 우선.
    1) 파일명에 문화시설/반려동물 키워드 포함 우선
    2) 수정시간 최신 우선
    3) 파일명 사전순
    """
    name = os.path.basename(path)
    keyword_bonus = 0
    keywords = ["반려동물", "문화시설", "시설", "pet", "facility"]
    if any(k in name for k in keywords):
        keyword_bonus = -10

    try:
        mtime = os.path.getmtime(path)
    except Exception:
        mtime = 0

    return (keyword_bonus, -mtime, name)

def find_csv_file() -> Optional[str]:
    found_files = []

    for data_dir in get_candidate_data_dirs():
        pattern = os.path.join(data_dir, "*.csv")
        files = glob.glob(pattern)
        if files:
            logger.info(f"📦 CSV 탐색: {data_dir} → {len(files)}개 발견")
            found_files.extend(files)

    if not found_files:
        logger.warning("❌ CSV 파일을 찾지 못했습니다.")
        return None

    # 중복 제거 후 우선순위 정렬
    found_files = sorted(set(found_files), key=score_csv_file)
    selected = found_files[0]

    logger.info(f"✅ CSV 후보 목록: {found_files}")
    logger.info(f"✅ 선택된 CSV: {selected}")
    return selected

def load_data_from_csv() -> pd.DataFrame:
    global _df_source_path

    csv_path = find_csv_file()
    if not csv_path:
        logger.warning("CSV 없음 → 빈 DataFrame으로 대체")
        _df_source_path = None
        return build_empty_facility_df()

    try:
        df = pd.read_csv(csv_path, encoding="utf-8-sig")
    except UnicodeDecodeError:
        df = pd.read_csv(csv_path, encoding="cp949")
    except Exception as e:
        logger.exception(f"CSV 읽기 실패: {csv_path}, error={e}")
        _df_source_path = None
        return build_empty_facility_df()

    missing_cols = [col for col in CSV_REQUIRED_COLUMNS if col not in df.columns]
    if missing_cols:
        logger.error(f"CSV 필수 컬럼 누락: {missing_cols}")
        _df_source_path = csv_path
        return build_empty_facility_df()

    try:
        df["4개_카테고리"] = df.apply(assign_category, axis=1)
        df = df[df["시도 명칭"] == "서울특별시"].copy()

        df["위도"] = pd.to_numeric(df["위도"], errors="coerce")
        df["경도"] = pd.to_numeric(df["경도"], errors="coerce")
        df = df.dropna(subset=["위도", "경도"])

        _df_source_path = csv_path
        logger.info(f"✅ CSV 로드 완료: {csv_path}")
        logger.info(f"✅ 서울 시설 수: {len(df):,}")
        return df

    except Exception as e:
        logger.exception(f"CSV 전처리 실패: {csv_path}, error={e}")
        _df_source_path = csv_path
        return build_empty_facility_df()

def get_df(force_reload: bool = False) -> pd.DataFrame:
    global _df_global, _df_loaded

    if _df_loaded and not force_reload and _df_global is not None:
        return _df_global

    with _df_lock:
        if _df_loaded and not force_reload and _df_global is not None:
            return _df_global

        _df_global = load_data_from_csv()
        _df_loaded = True
        return _df_global

@app.on_event("startup")
async def startup_event():
    """
    서버 시작 시 preload를 시도하되 실패해도 절대 죽지 않음.
    실제 사용은 get_df() 기반 lazy loading 유지.
    """
    try:
        df = get_df()
        logger.info(f"🚀 startup CSV preload 완료: {len(df):,}건")
    except Exception as e:
        logger.exception(f"startup CSV preload 실패, 서버는 계속 실행됩니다: {e}")

# ════════════════════════════════════════════════════════════
# 5. 요청/응답 모델
# ════════════════════════════════════════════════════════════
class WeightRequest(BaseModel):
    park: float = 3.0
    hospital: float = 3.0
    transport: float = 3.0
    quiet: float = 3.0

class GuScore(BaseModel):
    name: str
    score: float
    rank: int
    hospital: float
    park: float
    transport: float
    quiet: float

class FacilityItem(BaseModel):
    name: str
    category: str
    cat3: str
    lat: float
    lng: float
    address: Optional[str]
    phone: Optional[str]

# ════════════════════════════════════════════════════════════
# 6. API 엔드포인트
# ════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"status": "ok", "message": "Paw-Data API 정상 동작"}

@app.get("/api/mongo/facilities")
async def get_mongo_facilities(
    gu_name: Optional[str] = Query(None),
    limit: int = Query(5000),
):
    with engine.connect() as conn:
        if gu_name:
            rows = conn.execute(text("""
                SELECT f.facility_id
                FROM facility f
                JOIN address a ON f.address_id = a.address_id
                JOIN sigungu s ON a.sigungu_id = s.sigungu_id
                JOIN sido sd ON s.sido_id = sd.sido_id
                WHERE sd.sido_name = '서울특별시'
                  AND s.sigungu_name = :gu
            """), {"gu": gu_name}).fetchall()
        else:
            rows = conn.execute(text("""
                SELECT f.facility_id
                FROM facility f
                JOIN address a ON f.address_id = a.address_id
                JOIN sigungu s ON a.sigungu_id = s.sigungu_id
                JOIN sido sd ON s.sido_id = sd.sido_id
                WHERE sd.sido_name = '서울특별시'
            """)).fetchall()

    seoul_ids = [row.facility_id for row in rows]
    if not seoul_ids:
        return {"status": "success", "count": 0, "data": []}

    collection = mongo_db.mongo_facility
    data = await collection.find(
        {"facility_id": {"$in": seoul_ids}},
        {
            "_id": 0,
            "facility_id": 1,
            "facility_name": 1,
            "place_description": 1,
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
            "lng": float(coords[0]),
            "lat": float(coords[1]),
            "name": doc.get("facility_name", ""),
            "category": classify_facility(place_desc),
        })

    return {"status": "success", "count": len(result), "data": result}

@app.get("/api/mongo/sample")
async def get_mongo_sample():
    doc = await mongo_db.mongo_facility.find_one({}, {"_id": 0})
    return doc

@app.get("/seoul_gu.geojson")
def serve_geojson():
    path = os.path.join(BASE_DIR, "seoul_gu.geojson")
    if not os.path.exists(path):
        return {"error": "seoul_gu.geojson 파일이 없습니다"}
    return FileResponse(path, media_type="application/json")

@app.get("/api/gu_data")
def get_gu_data():
    return GU_BASE_DATA

@app.post("/api/recommend")
def recommend_gu(weights: WeightRequest):
    wd = {
        "park": weights.park,
        "hospital": weights.hospital,
        "transport": weights.transport,
        "quiet": weights.quiet
    }
    total_w = sum(wd.values())

    results = []
    for gu, data in GU_BASE_DATA.items():
        score = (sum(data[k] * wd[k] for k in wd) / total_w) if total_w > 0 else 0
        results.append({
            "name": gu,
            "score": round(score, 1),
            "hospital": data["hospital"],
            "park": data["park"],
            "transport": data["transport"],
            "quiet": data["quiet"],
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1

    return [GuScore(**r) for r in results]

@app.get("/api/facilities/{gu_name}", response_model=list[FacilityItem])
def get_facilities_by_gu(
    gu_name: str,
    category: Optional[str] = Query(None),
    limit: int = Query(500),
):
    df = get_df()

    if df.empty:
        return []

    gu_df = df[df["시군구 명칭"] == gu_name]
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
            phone=str(row["전화번호"]) if pd.notna(row["전화번호"]) else None,
        )
        for _, row in gu_df.head(limit).iterrows()
    ]

@app.get("/api/facilities/map/{gu_name}")
async def get_facilities_map(
    gu_name: str,
    limit: int = Query(500),
):
    mongo_cursor = mongo_db.mongo_facility.find(
        {},
        {"_id": 0, "facility_id": 1, "location.coordinates": 1}
    )
    mongo_docs = await mongo_cursor.to_list(100000)

    coord_map = {}
    for doc in mongo_docs:
        fid = doc.get("facility_id")
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
                cm.category_main_name AS category,
                cs.category_sub_name AS category_sub,
                adr.road_name AS address,
                s.sigungu_name
            FROM facility f
            JOIN address adr ON f.address_id = adr.address_id
            JOIN category_sub cs ON f.category_sub_id = cs.category_sub_id
            JOIN category_main cm ON cs.category_main_id = cm.category_main_id
            JOIN sigungu s ON adr.sigungu_id = s.sigungu_id
            WHERE s.sigungu_name = :gu
            LIMIT :lim
        """), {"gu": gu_name, "lim": limit}).fetchall()

    result = []
    for row in rows:
        coords = coord_map.get(row.facility_id)
        if not coords:
            continue
        result.append({
            "facility_id": row.facility_id,
            "name": row.facility_name,
            "category": row.category,
            "category_sub": row.category_sub,
            "address": row.address,
            "phone": row.phone,
            "indoor_yn": row.indoor_yn,
            "outdoor_yn": row.outdoor_yn,
            "parking_yn": row.parking_yn,
            "lat": coords["lat"],
            "lng": coords["lng"],
        })

    return {
        "status": "success",
        "gu": gu_name,
        "total_mysql": len(rows),
        "matched": len(result),
        "unmatched": len(rows) - len(result),
        "data": result,
    }

@app.get("/api/gu_list")
def get_gu_list():
    df = get_df()
    if df.empty or "시군구 명칭" not in df.columns:
        return {"gus": []}
    return {"gus": sorted(df["시군구 명칭"].dropna().unique().tolist())}

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

@app.get("/api/market/keywords")
def get_market_keywords():
    if df_current is None:
        return []
    df_sorted = df_current.nlargest(30, "현재_총")
    return [[row["키워드"], int(row["현재_총"] // 500)] for _, row in df_sorted.iterrows()]

@app.get("/api/market/share")
def get_market_share():
    if df_current is None:
        return {}

    COLORS = {
        "1_반려동물먹거리": "#FB7185",
        "2_미용위생": "#4ADE80",
        "3_서비스업": "#22D3EE",
        "4_공산품": "#34D399",
        "5_의료건강": "#FDE68A",
    }
    NAME_MAP = {
        "1_반려동물먹거리": "반려동물 식품",
        "2_미용위생": "미용위생",
        "3_서비스업": "서비스업",
        "4_공산품": "일반용품",
        "5_의료건강": "의료건강",
    }

    total = df_current["현재_총"].sum()
    result = {}

    for cat in df_current["분야"].unique():
        cat_df = df_current[df_current["분야"] == cat]
        cat_sum = cat_df["현재_총"].sum()
        display = NAME_MAP.get(cat, cat)
        color = COLORS.get(cat, "#999")

        treemap = [
            {"name": row["키워드"], "size": int(row["현재_총"]), "color": color}
            for _, row in cat_df.nlargest(8, "현재_총").iterrows()
        ]
        result[display] = {
            "color": color,
            "value": round(cat_sum / total * 100, 1) if total > 0 else 0,
            "treemap": treemap,
        }
    return result

@app.get("/api/market/growth")
def get_market_growth():
    if df_compare is None:
        return []

    NAME_MAP = {
        "1_반려동물먹거리": "반려동물 식품",
        "2_미용위생": "미용위생",
        "3_서비스업": "서비스업",
        "4_공산품": "일반용품",
        "5_의료건강": "의료건강",
    }
    return [
        {
            "name": NAME_MAP.get(row["분야"], row["분야"]),
            "value": float(row["최근3개월_성장률"]),
        }
        for _, row in df_compare.sort_values("최근3개월_성장률", ascending=False).iterrows()
    ]

@app.get("/api/market/trend")
def get_market_trend():
    if df_estimated is None:
        return []

    CAT_MAP = {
        "1_반려동물먹거리": "식품",
        "5_의료건강": "의료",
        "4_공산품": "일반용품",
    }
    df_est = df_estimated.copy()
    df_est["날짜_dt"] = pd.to_datetime(df_est["날짜"])
    df_est = df_est[df_est["분야"].isin(CAT_MAP.keys())]

    monthly = df_est.groupby(["날짜", "분야"])["추정_총검색량"].mean().reset_index()
    pivot = monthly.pivot(index="날짜", columns="분야", values="추정_총검색량").reset_index()
    pivot = pivot.rename(columns=CAT_MAP)
    pivot = pivot.rename(columns={"날짜": "date"})
    pivot = pivot.fillna(0)

    return pivot.tail(12).to_dict(orient="records")

@app.get("/api/market/compare")
def get_market_compare():
    if df_compare is None:
        return []
    df = df_compare.rename(columns={
        "분야": "category",
        "총검색량": "total_search_volume",
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

@app.get("/api/summary")
def get_summary():
    summary = {}
    for gu, counts in GU_RAW_COUNTS.items():
        summary[gu] = {"total": sum(counts.values()), **counts}
    return summary

@app.get("/api/health")
async def health_check():
    df = get_df()

    result = {
        "backend": "✅ 정상",
        "csv": f"✅ 서울 시설 {len(df):,}건" if not df.empty else "⚠️ CSV 없음 또는 로드 실패 (서버는 정상 동작 중)",
        "csv_source": _df_source_path or "N/A",
        "market_csv": "✅ 로드됨" if df_current is not None else "❌ 없음 (integrated_current.csv 필요)",
        "mysql": "❌ 미확인",
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
