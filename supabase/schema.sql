-- ============================================================
-- Op-Planner: Supabase 스키마
-- Supabase SQL 편집기에 붙여넣어 실행하세요.
-- ============================================================

-- 요청 테이블
CREATE TABLE IF NOT EXISTS requests (
  id            SERIAL PRIMARY KEY,
  request_date  DATE          NOT NULL DEFAULT CURRENT_DATE,
  request_team  VARCHAR(100)  NOT NULL DEFAULT '',
  requester     VARCHAR(100)  NOT NULL DEFAULT '',
  title         VARCHAR(500)  NOT NULL DEFAULT '',
  summary       TEXT          DEFAULT '',
  priority      VARCHAR(10)   NOT NULL DEFAULT '★'
                              CHECK (priority IN ('★', '★★', '★★★')),
  assignee      VARCHAR(100)  DEFAULT '',
  status        VARCHAR(20)   NOT NULL DEFAULT '대기'
                              CHECK (status IN ('대기', '검토중', '기획중', '완료', '보류')),
  start_date    DATE          DEFAULT NULL,  -- 기획 시작일자
  due_date      DATE          DEFAULT NULL,  -- 기획 완료 예정일
  deploy_date   DATE          DEFAULT NULL,  -- 배포 예정일
  jira_link     TEXT          DEFAULT NULL,
  jira_key      VARCHAR(50)   UNIQUE DEFAULT NULL,  -- 지라 티켓 키 (중복 방지)
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 마이그레이션 (이미 requests 테이블이 있는 기존 DB에 적용)
-- ============================================================
ALTER TABLE requests ADD COLUMN IF NOT EXISTS deploy_date DATE DEFAULT NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT NULL;

-- 기존 status 체크 제약 제거 (제약 이름이 다를 수 있어 이름에 의존하지 않고 탐색 후 제거)
-- 현재 제약은 '대기'조차 허용하지 않음 — 먼저 풀어야 아래 UPDATE가 통과됨
DO $$
DECLARE con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'requests'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE requests DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

-- 기존 '접수' 상태를 새 워크플로우의 시작 상태인 '대기'로 이관
UPDATE requests SET status = '대기' WHERE status = '접수';

-- 새 체크 제약 추가
ALTER TABLE requests ADD CONSTRAINT requests_status_check
  CHECK (status IN ('대기', '검토중', '기획중', '완료', '보류'));
ALTER TABLE requests ALTER COLUMN status SET DEFAULT '대기';

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON requests;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) 활성화 - 필요시 정책 세분화 가능
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- 개발/프로토타입용 전체 허용 정책 (운영 시 사용자 인증 기반으로 교체 권장)
CREATE POLICY "allow_all" ON requests FOR ALL USING (true) WITH CHECK (true);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_requests_status    ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_assignee  ON requests(assignee);
CREATE INDEX IF NOT EXISTS idx_requests_due_date  ON requests(due_date);
CREATE INDEX IF NOT EXISTS idx_requests_jira_key  ON requests(jira_key);

-- ============================================================
-- 서비스(Pharo-Sort) 자체 피드백/개선요청
-- (기획팀원이 Pharo-Sort 사용 중 발견한 불편한 점을 남기면, AI가 MCP로 가져와 바로 수정)
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback (
  id                  SERIAL PRIMARY KEY,
  user_name           VARCHAR(50)   NOT NULL,
  page                VARCHAR(50)   NOT NULL,
  type                VARCHAR(20)   NOT NULL DEFAULT '버그'
                                    CHECK (type IN ('버그', '개선요청', '신규기능')),
  title               VARCHAR(300)  NOT NULL,
  description         TEXT          DEFAULT '',
  related_request_id  INT           DEFAULT NULL,
  status              VARCHAR(20)   NOT NULL DEFAULT '접수'
                                    CHECK (status IN ('접수', '확인중', '반영완료', '반려')),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON feedback;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON feedback FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

-- ============================================================
-- 팀원별 개인 Jira API 토큰
-- (수동 등록 요청 → Jira 이슈 생성 시, 실제 실행한 사람 계정으로 등록되도록 함)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_jira_credentials (
  user_name       VARCHAR(50)  PRIMARY KEY,
  jira_email      VARCHAR(255) NOT NULL,
  jira_api_token  TEXT         NOT NULL,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON user_jira_credentials;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON user_jira_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_jira_credentials ENABLE ROW LEVEL SECURITY;

-- 개발/프로토타입용 전체 허용 정책 (운영 시 사용자 인증 기반으로 교체 권장)
CREATE POLICY "allow_all" ON user_jira_credentials FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 샘플 데이터 (선택적으로 실행)
-- ============================================================
INSERT INTO requests (request_date, request_team, requester, title, summary, priority, assignee, status, due_date)
VALUES
  ('2026-04-01', '마케팅', '김민준', '[이벤트] 5월 황금연휴 프로모션 랜딩페이지 기획', '5월 1~5일 황금연휴 대상 할인 이벤트 랜딩 및 팝업 기획 요청', '★★★', '이지수', '기획중', '2026-04-18'),
  ('2026-04-03', '운영', '박서연', '[UX] 마이페이지 주문내역 UI 개선', '주문내역 필터 및 상세보기 UX 개선 요청', '★★', '최현우', '검토중', '2026-04-22'),
  ('2026-04-05', '마케팅', '이준혁', '[콘텐츠] 브랜드 스토리 페이지 신규 제작', '브랜드 히스토리 및 가치관을 담은 About Us 페이지 기획', '★', '이지수', '접수', '2026-04-30'),
  ('2026-04-07', '운영', '정하은', '[기능] 쿠폰 발급 자동화 프로세스 설계', '특정 구매 조건 달성 시 쿠폰 자동 발급 로직 기획', '★★★', '박도현', '기획중', '2026-04-15'),
  ('2026-03-28', 'CS', '한지원', '[공지] 배송 정책 변경 안내 페이지', '배송비 무료 기준 변경에 따른 고객 안내 페이지 기획', '★★', '최현우', '완료', '2026-04-05'),
  ('2026-04-09', '마케팅', '오민서', '[SNS] 인스타그램 연계 이벤트 기획', '팔로우 & 좋아요 이벤트 상세 기획 및 당첨자 안내 프로세스', '★', '박도현', '접수', '2026-05-01');
