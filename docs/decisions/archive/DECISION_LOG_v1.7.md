# DECISION_LOG_v1.7

## 2026-06-18

### DL-001. Formula First Architecture 확정
TOCS는 Formula 중심 시스템으로 설계한다. 모든 KPI와 경영지표는 Formula에서 파생된다.

### DL-002. Formula 정의 확정
Formula는 돈 흐름, 세무 흐름, 물류 흐름, 정산 흐름, 수익 흐름을 하나로 묶은 운영 원장이다.

### DL-003. Company / Role 분리 확정
모든 참여자는 Company로 관리한다. Company 자체는 고정 역할을 갖지 않는다. 역할은 Formula 내부에서 결정한다.

### DL-004. Formula 1개 = 품목 1개 확정
V1 기준 Formula 1개에는 품목 1개만 연결한다. 다품목 거래는 품목별 Formula를 별도 생성한다. `formula_items` 테이블은 V1에서 생성하지 않는다.

### DL-005. Deal / Order Entity 생성 금지
TOCS는 Deal 중심 시스템이 아니다. Deal, Order, Project, Pipeline 등 별도 최상위 Entity를 생성하지 않는다.

### DL-006. Formula Action Sheet v1 확정
기본 입력 순서는 품목 → 매입처/매출처 → 매입단가/매출단가 → 수량 → 나머지 설정이다.

### DL-007. Formula Participants 라인 구조 채택
A > B > C > D 구조는 `formula_participants`와 `sequence_order`로 표현한다. 매입가 0, 매출가 0을 허용한다.

### DL-008. 실물 흐름과 세무 흐름 분리 확정
세무 흐름과 실물 흐름은 다를 수 있다.

### DL-009. 입출금 엔진 다건 구조 확정
입금/출금은 단일/분할/부분 등 필요한 모든 케이스를 처리할 수 있도록 설계한다.

### DL-010. Payment Schedule / Payment Record 구조 채택
`formula_payment_schedules`는 예정 입출금, `formula_payment_records`는 실제 입출금 내역으로 설계한다.

### DL-011. 입출금 완료취소 허용
입금완료/출금완료 후 완료취소가 가능해야 한다. 삭제하지 않고 취소 상태로 이력 보존한다.

### DL-012. KPI 계산 기준 확정
확정매출은 실제 은행 입금액 기준으로 계산한다.

### DL-013. 확정순이익 계산 기준 확정
확정순이익 = 실입금 - 실출금 - 실제비용 - 실제셰어.

### DL-014. 미수금 / 미지급금 계산 기준 확정
미수금 = 입금예정금액 - 누적입금액. 미지급금 = 출금예정금액 - 누적출금액.

### DL-015. 운송비 지급 대상 확정
운송비 지급 대상은 세금계산서를 발행한 운송사업체다.

### DL-016. 운송비 처리 유형 확정
매입가 포함, 판매가 포함, 별도 비용처리를 지원한다.

### DL-017. 계산서 엔진 원칙 확정
계산서는 거래 진행 조건이 아니라 Formula 종결 조건이다.

### DL-018. 계산서 금액일치 검증 추가
계산서 상태에는 금액일치/금액불일치 검증을 포함한다.

### DL-019. 상태관리 원칙 확정
거래상태, 입금상태, 출금상태, 계산서상태, 운송상태를 개별 관리한다.

### DL-020. 상태 수동 처리 원칙 확정
상태는 자동 완료 처리하지 않는다. 실무자가 확인 후 수동 완료 처리한다. 시스템은 종결 가능 여부만 판단한다.

### DL-021. 종결 규칙 확정
거래상태, 입금상태, 출금상태, 계산서상태, 운송상태가 모두 완료일 때만 Formula 종결이 가능하다.

### DL-022. 계산엔진 v1 원칙 확정
순이익 = 총매출 - 총매입 - 비용 - 셰어.

### DL-023. 부가세 기준 확정
기본 계산은 부가세 포함 금액 기준으로 한다.

### DL-024. 셰어 계산 원칙 확정
셰어는 거래마다 케이스바이케이스다. 직접입력과 차등배분을 우선 지원한다.

### DL-025. 환율 기준 확정
수입/수출/혼합 거래의 기본 환율은 계약시 환율 기준으로 한다.

### DL-026. Formula Version / Audit Log 구분 확정
Formula Version은 Formula 내부 변경 이력이다. Audit Log는 포뮬러 외 시스템 전체 변경 감사 로그다.

### DL-027. 회사 필터 기반 조회 확정
기본 관리 주체는 주식회사 지오웍스다. 다만 대시보드에서 보고 싶은 회사를 필터로 선택해 해당 회사 기준 데이터를 볼 수 있어야 한다.

### DL-028. V1 보류 기능 확정
거래이슈 자동 감지 고도화, 권한 구조 고도화, 파일/증빙 고도화, 은행 API 연동, 환율 API 연동, AI 리포트, ERP 연동, 거래처 포털은 V1 핵심 구현에서 제외한다.

### DL-029. DB MASTER DESIGN v1.1 확정
V1 핵심 테이블은 15개로 본다: companies, company_contacts, items, formulas, formula_participants, formula_payment_schedules, formula_payment_records, formula_logistics, formula_logistics_vehicles, formula_invoices, formula_shares, formula_versions, formula_calculation_snapshots, formula_status_logs, audit_logs.

### DL-030. 개발 체계 확정
ChatGPT, Claude, v0, Cursor, Vercel, Codex 역할 분담을 확정한다. 모든 도구는 TOCS_MASTER_SPEC를 기준으로 작업한다.
