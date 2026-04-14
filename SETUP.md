# Op-Planner 설치 및 실행 가이드

## 1. 의존성 설치

```bash
cd op-planner
npm install
```

## 2. Supabase 설정

### 2-1. Supabase 프로젝트 생성
1. [https://supabase.com](https://supabase.com) 접속 → 무료 계정으로 프로젝트 생성
2. 프로젝트 생성 완료 후 **Settings → API** 에서 아래 값 복사
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2-2. 데이터베이스 스키마 적용
1. Supabase 대시보드 → **SQL Editor** → `New query`
2. `supabase/schema.sql` 전체 내용 붙여넣기 → **Run** 클릭

## 3. 환경 변수 설정

`.env.local.example` 파일을 복사해 `.env.local` 로 이름 변경 후 값 입력:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Jira 연동 사용 시 입력 (없으면 수동 등록만 동작)
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=ATATT3xFfGF0...
JIRA_TARGET_LABEL=planning-request
```

## 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 **http://localhost:3000** 접속

## 5. Jira API 토큰 발급

1. [https://id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) 접속
2. **Create API token** 클릭 → 이름 입력 → 복사
3. `.env.local` 의 `JIRA_API_TOKEN` 에 붙여넣기

## 6. Jira 라벨 설정

지라 티켓에 아래 라벨을 추가하면 Op-Planner가 자동으로 수집합니다:
- 기본 라벨: `planning-request`
- `.env.local` 의 `JIRA_TARGET_LABEL` 값을 변경하면 커스터마이징 가능
- 여러 라벨: `JIRA_TARGET_LABEL=planning-request,기획요청,op-request`

## 7. 운영 배포 (Vercel 권장)

```bash
npm run build   # 빌드 확인
```

Vercel 배포 시 환경 변수를 Vercel 대시보드 → Settings → Environment Variables 에 동일하게 입력하세요.

---

## 주요 기능 요약

| 기능 | 설명 |
|------|------|
| 요청 등록 | 수기 요청을 폼으로 등록 |
| 지라 동기화 | 헤더 버튼으로 Jira에서 대상 라벨 이슈 자동 수집 |
| 인라인 상태 변경 | 그리드에서 직접 상태 드롭다운 변경 |
| 지연 강조 | 완료 예정일 초과 시 행 빨간색 하이라이트 + D+N 배지 |
| 워크로드 패널 | 담당자별 진행 건수 시각화 (클릭 시 필터 적용) |
| 필터/검색 | 팀·상태·담당자·우선순위·키워드 복합 필터 |
