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
  status        VARCHAR(20)   NOT NULL DEFAULT '접수'
                              CHECK (status IN ('접수', '검토중', '기획중', '완료')),
  due_date      DATE          DEFAULT NULL,
  jira_link     TEXT          DEFAULT NULL,
  jira_key      VARCHAR(50)   UNIQUE DEFAULT NULL,  -- 지라 티켓 키 (중복 방지)
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

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
