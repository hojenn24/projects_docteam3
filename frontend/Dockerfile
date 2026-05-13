
# ════════════════════════════════════════════════════════════
# Stage 1 — React 앱 빌드 (Node 환경)
# ════════════════════════════════════════════════════════════
FROM node:18-alpine AS builder

WORKDIR /app

# 1. 의존성 목록만 먼저 복사 (레이어 캐시 활용)
COPY package.json ./

# 2. 라이브러리 설치
RUN npm install

# 3. 소스코드 복사
COPY public ./public
COPY src ./src

# 4. 빌드 시 환경변수 주입 — Reverse Proxy 쓰니까 빈 값
ENV REACT_APP_API_URL=""

# 5. React 빌드 실행 → /app/build/ 생성
RUN npm run build


# ════════════════════════════════════════════════════════════
# Stage 2 — Nginx로 빌드 결과 서빙
# ════════════════════════════════════════════════════════════
FROM nginx:1.27-alpine

# 1. nginx 기본 설정 제거 후 우리 설정으로 교체
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 2. Stage 1의 빌드 결과물만 가져와서 nginx 정적 파일 위치에 복사
COPY --from=builder /app/build /usr/share/nginx/html

# 3. 80 포트 노출 명시
EXPOSE 80

# 4. nginx 포그라운드 실행 (PID 1 유지)
CMD ["nginx", "-g", "daemon off;"]
