# TOCS_AI_DEV_GUIDE_v1.0

## 목적
TOCS를 v0, Cursor, Claude, Vercel, Codex를 활용해 개발할 때의 초기설정과 작업 순서를 정의한다.

---

## 1. 기본 개발 원칙
모든 AI 도구와 개발자는 아래 문서를 기준으로 작업한다.

```text
/docs/TOCS_MASTER_SPEC.md
/docs/DECISION_LOG.md
/docs/CLAUDE_DB_SCHEMA_PROMPT.md
```

핵심 원칙:
- Formula First Architecture
- Formula 1개 = 품목 1개
- Company 고정 역할 금지
- Deal / Order Entity 생성 금지
- 상태 자동 완료 금지
- 입출금은 Schedule / Record 구조
- 확정 KPI는 실제 은행 입출금 기준

---

## 2. 추천 프로젝트 구조
```text
tocs/
├ app/
├ components/
├ lib/
├ prisma/
├ docs/
│  ├ TOCS_MASTER_SPEC.md
│  ├ DECISION_LOG.md
│  ├ CLAUDE_DB_SCHEMA_PROMPT.md
│  └ TOCS_AI_DEV_GUIDE.md
├ .cursor/
│  └ rules/
│     └ tocs-core.mdc
├ CLAUDE.md
├ package.json
└ README.md
```

---

## 3. Cursor 초기설정
Cursor Rules 경로:
```text
.cursor/rules/tocs-core.mdc
```

규칙 파일에는 TOCS Core Rules를 넣는다. Cursor에게 바로 구현을 지시하지 말고 먼저 문서 확인 → 구현 계획 → 작은 단위 구현 → 빌드 → QA 순서로 진행한다.

Cursor 금지사항:
- 임의 Entity 추가 금지
- Deal/Order 구조 생성 금지
- Formula 구조 변경 금지
- 상태 자동완료 로직 금지
- 임시 하드코딩 정산 금지
- UI 편의 때문에 DB 구조 변경 금지

---

## 4. Claude 초기설정
프로젝트 루트에 `CLAUDE.md`를 생성한다. Claude는 DB와 비즈니스 로직 설계 담당이다.

Claude 첫 요청:
```text
CLAUDE_DB_SCHEMA_PROMPT_v1.1.md 기준으로 PostgreSQL Schema와 Prisma Schema 초안을 작성해줘.
임의 Entity를 추가하지 말고, 필요한 경우 '제안'으로만 분리해줘.
```

Claude 두 번째 요청:
```text
작성한 Schema가 TOCS_MASTER_SPEC와 충돌하는 부분이 있는지 스스로 검토하고 수정안을 제시해줘.
```

Claude 세 번째 요청:
```text
KPI 집계 쿼리와 Formula 종결 조건 로직을 작성해줘.
```

---

## 5. v0 초기설정
v0는 UI 프로토타입 전용이다.

맡길 것:
- Formula Action Sheet
- Formula 상세 화면
- 대시보드
- 회사/품목 관리 기본 화면

맡기지 말 것:
- DB 최종 설계
- 정산 로직
- 입출금 계산 로직
- 상태 종결 로직

v0 시작 프롬프트:
```text
TOCS는 Formula First Architecture 기반의 Trading Operation Control System입니다.
이 화면은 UI 프로토타입입니다. DB 구조나 비즈니스 로직을 임의로 결정하지 마세요.

핵심 화면:
1. Formula Action Sheet
2. Formula Detail
3. Dashboard
4. Company Management
5. Item Management

Formula는 품목 1개, 참여자 다단계 구조, 입출금 Schedule/Record, 운송, 계산서, 셰어, 상태를 포함합니다.
```

UI 방향:
- 컴팩트
- 대표가 30초 안에 판단 가능
- 금액 줄바꿈 금지
- 모바일에서는 카드형 세로 구조
- Formula 거래설정이 최우선
- 운송/셰어/계산서는 탭 또는 아코디언

---

## 6. Vercel / Next.js 운영
추천 스택:
```text
Next.js App Router
TypeScript
Prisma
PostgreSQL
Tailwind
shadcn/ui
Vercel Preview Deployment
```

운영 흐름:
```text
local dev → Git commit → Vercel Preview → QA → main merge → Production Deploy
```

환경변수:
```text
DATABASE_URL
NEXT_PUBLIC_APP_ENV
```

운영 DB와 개발 DB는 반드시 분리한다.

---

## 7. 개발 순서
Phase 1. 문서/스키마
1. docs 배치
2. Claude DB Schema 생성
3. ChatGPT 검토
4. Prisma Schema 확정

Phase 2. 기본 CRUD
1. Company
2. Company Contact
3. Item
4. Formula
5. Formula Participants

Phase 3. Formula Core
1. Payment Schedule
2. Payment Record
3. Logistics
4. Invoice
5. Share
6. Status Log
7. Version / Snapshot

Phase 4. Dashboard
1. 확정매출
2. 확정순이익
3. 미수금
4. 미지급금
5. 회사 필터
6. 기간 필터

Phase 5. QA
1. 실제 거래 5~10건 입력
2. 계산 검증
3. 미수/미지급 검증
4. 종결 조건 검증
5. 완료취소 검증
