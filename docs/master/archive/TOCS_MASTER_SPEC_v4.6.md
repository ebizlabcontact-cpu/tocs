# TOCS_MASTER_SPEC_v4.6

## 0. 문서 목적
본 문서는 TOCS(Trading Operation Control System)의 최상위 기준 문서다. 모든 기획, 설계, 개발, AI 프롬프트, QA 검토는 본 문서를 기준으로 한다.

---

## 1. TOCS 핵심 정의
TOCS는 Formula First Architecture 기반의 현금흐름 중심 Control System이다. 일반 ERP/CRM/거래관리 시스템이 아니라 Formula를 중심으로 돈 흐름, 세무 흐름, 물류 흐름, 정산 흐름, 수익 흐름을 통제한다.

```text
Formula → Derived Data → Accumulated/Aggregated Data → Dashboard → KPI/Management Indicators
```

모든 KPI와 경영지표는 Formula에서 파생된다.

---

## 2. Formula 정의
Formula는 TOCS의 최상위 핵심 단위이자 운영 원장(Source of Truth)이다.

Formula = 돈 흐름 + 세무 흐름 + 물류 흐름 + 정산 흐름 + 수익 흐름

Formula 구조 변경은 파생 데이터, 누적 집계, 대시보드, KPI에 직접 영향을 주므로 최고 수준 검토 대상이다.

---

## 3. Formula 기본 구조 원칙

### 3.1 Formula 1개 = 품목 1개
V1 기준 Formula 1개에는 품목 1개만 연결한다. 다품목 거래는 품목별 Formula를 별도로 생성한다. V1에서는 `formula_items` 테이블을 생성하지 않는다.

### 3.2 Deal / Order 중심 구조 금지
Deal, Order, Project, Pipeline, Campaign 등 별도 최상위 Entity를 생성하지 않는다. Formula가 원장이며 모든 하위 데이터는 Formula에 연결한다.

---

## 4. Company / Role 구조
모든 참여자는 Company(Entity)로 관리한다. Company 자체는 고정 역할을 갖지 않는다. 역할은 Formula 내부의 `formula_participants`에서 결정된다.

역할 그룹: Supplier, Buyer, Carrier, Financial/Payment, Other  
성격 그룹: Manufacturer, Distributor, Logistics, Financial Institution, Other  
결제 그룹: 선입금, 여신, 사후정산, 분할, 부분, 기타

회사 정보: 사업자등록번호, 대표자명, 대표번호, 본점주소, 분점 및 물류지 주소  
담당자 정보: 담당자명, 직함, 연락처, 이메일

---

## 5. Formula Action Sheet v1

### 5.1 입력 순서
```text
품목 → 매입처/매출처 → 매입단가/매출단가 → 수량 → 입출금 → 운송 → 셰어 → 상태
```

### 5.2 거래 구분
국내, 수입, 수출, 혼합. 국내 거래 선택 시 출발국가, 도착국가, 환율 관련 필드는 숨김 또는 비활성화한다.

### 5.3 국가 / 통화 / 환율
출발국가, 도착국가, 기준통화, 환율통화, 출발국가환율, 도착국가환율. 환율은 계약시 환율 기준이며 수정환율, 변경사유, 변경이력을 저장할 수 있어야 한다.

### 5.4 거래 정보
품목, 단위, 수량, 매입처, 매출처, 매입단가, 매출단가, 총매입, 총매출, 비용, 셰어, 이익, 이익률, 내용, 비고.

---

## 6. Formula Participants / 거래 라인 구조
A > B > C > D 구조는 `formula_participants` 라인 구조와 `sequence_order`로 표현한다.

예시:
```text
1 CJ제일제당: buy 0 / sell 710
2 지오웍스: buy 710 / sell 1010
3 네이처인사이트: buy 1010 / sell 1200
4 에코앤리사이클: buy 1200 / sell 0
```

규칙: 매입가 0 허용, 매출가 0 허용, 시작점 매입가 0 가능, 종료점 매출가 0 가능. 참여자 순서 변경, 중간 회사 추가/삭제/변경 시 Formula Version 또는 스냅샷을 남긴다.

---

## 7. 입출금 엔진
TOCS KPI는 실제 은행 입출금 기준이다. 확정매출은 거래 생성 기준이나 계산서 기준이 아니라 실제 은행 입금액 기준으로 계산한다.

### 7.1 확인 방식
입금/출금은 실무자가 법인통장 입출금 내역 또는 대표이사 입출금 문자를 확인한 후 수동 완료 처리한다.

### 7.2 단일/분할/부분 모두 대응
선입금, 외상, 분할, 부분 입출금 모두 처리한다. 단순 완료 필드로 축소하지 않는다.

### 7.3 권장 DB 구조
```text
formula_payment_schedules = 받을/줄 예정금액 및 예정일
formula_payment_records = 실제 입금/출금 내역
```

입금: 입금예정금액 → 실제입금내역(다건) → 누적입금 → 입금률 → 미수금  
출금: 출금예정금액 → 실제출금내역(다건) → 누적출금 → 출금률 → 미지급금

### 7.4 완료 / 완료취소
완료 후 완료취소 가능. 삭제하지 않고 취소 상태로 보존한다. 완료 처리와 완료취소는 반드시 이력으로 남긴다.

### 7.5 실제 현장 기준
우리가 지급하는 돈은 선입금 비중이 높고, 우리가 받는 돈은 분할입금 비중이 존재한다. 선입금 약 70%, 분할입금 약 30% 기준으로 고려한다. 미수금 관리가 매우 중요하다.

---

## 8. 운송 엔진
실물 흐름과 세무 흐름은 다를 수 있다.

```text
세무 흐름: A > B > C > D > E
실물 흐름: A -----------------> E
```

운송 정보: 출고지, 입고지, 운송사, 운송료 부담주체, 운송품목, 운송수량, 차량수, 총운송비, 운송예정일.  
차량별 정보: 차량번호, 기사이름, 기사연락처, 차량별 운송비, 차량별 운송상태, 차량별 정산상태.

운송비가 매입가 또는 판매가에 포함되어 있어도 실제 지급 주체는 반드시 존재한다. 운송비 표시 방식은 매입가 포함, 판매가 포함, 별도 비용처리를 지원한다.

운송비 지급 대상은 세금계산서를 발행한 운송사업체다.

```text
carrier_company_id = 세금계산서를 발행한 운송사업체
운송비 지급 대상 = 세금계산서를 발행한 운송사업체
```

---

## 9. 셰어 엔진
셰어는 거래마다 케이스바이케이스다. 직접입력과 차등배분을 우선 지원한다.

셰어 기준: 매출, 이익, 고정금액, 직접입력  
셰어 방식 우선순위: 직접입력, 정액, 정률, N분배

---

## 10. 계산 엔진 v1
기본 공식:

```text
순이익 = 총매출 - 총매입 - 비용 - 셰어
```

총매입 = 수량 × 매입단가  
총매출 = 수량 × 매출단가  
비용 = 운송비 + 수수료 + 기타 직접비용  
셰어 = 직접입력 또는 계산 방식에 따른 배분금액  
이익률 = 순이익 / 총매출

부가세는 기본적으로 포함 금액 기준으로 계산한다. 향후 공급가, 부가세, 합계금액, 예상 부가세 기능을 확장 검토한다.

Formula 수정 또는 신규 버전 생성 시 계산 결과 스냅샷을 저장한다.

---

## 11. 계산서 / 증빙 엔진
계산서는 거래 진행을 막는 락 장치가 아니라 Formula 종결 판단 장치다.

```text
계산서 없어도 거래 진행 가능
계산서 없어도 입출금 가능
계산서 없으면 Formula 종결 불가
```

Formula 참여자 순서 기준으로 계산서 라인을 자동 생성할 수 있다.

```text
A > B > C > D
자동 계산서 라인: A → B, B → C, C → D
```

계산서 상태에는 금액 검증을 포함한다: 미발행, 발행완료, 수취완료, 금액일치, 금액불일치, 취소, 수정발행필요.

증빙은 거래 전 필수조건이 아니다. 파일/증빙 고도화는 V1 핵심 기능에서는 후순위로 둔다.

---

## 12. Formula 상태 관리
Formula는 단일 상태만으로 판단하지 않는다.

개별 상태: 거래상태, 입금상태, 출금상태, 계산서상태, 운송상태.

상태는 자동 완료 처리하지 않는다. 실무자가 확인 후 수동 완료 처리한다. 완료 처리 후 완료취소가 가능해야 한다. 모든 상태 변경은 이력으로 남긴다. 시스템이 자동 판단하는 것은 “종결 가능 여부”이다.

---

## 13. Formula 종결 규칙
거래상태, 입금상태, 출금상태, 계산서상태, 운송상태가 모두 완료일 때만 Formula는 종결될 수 있다. 하나라도 미완료이면 종결할 수 없다. 미종결 Formula는 추적관리 대상이다.

---

## 14. Formula Version / Audit Log 구분
Formula Version은 Formula 내부 변경 이력이다. 대상: 단가, 수량, 참여자, 운송비, 환율, 셰어, 계산 결과 스냅샷.

Audit Log는 포뮬러 외 시스템 전체 변경 감사 로그다. 대상: 회사 정보, 품목 정보, 사용자 설정, 시스템 설정, 기타 전체 변경.

---

## 15. KPI 엔진
TOCS KPI는 현금흐름 중심이다.

```text
확정매출 = 실제 은행 입금액
확정출금 = 실제 은행 출금액
확정순이익 = 실입금 - 실출금 - 실제비용 - 실제셰어
미수금 = 입금예정금액 - 누적입금액
미지급금 = 출금예정금액 - 누적출금액
```

예상 KPI는 Formula 기준으로 별도 관리한다. 확정 KPI와 예상 KPI를 혼합하지 않는다.

대표 KPI 우선순위:
S급: 실입금/확정매출, 확정순이익, 미수금, 미지급금  
A급: 예상매출, 예상순이익, 진행중 Formula, 종결 Formula, 미종결 Formula, 거래이슈 수  
B급: 거래처별 실적, 품목별 실적, 운송사별 미지급금, 목표달성률, 성장률

---

## 16. 대시보드 조회 기준
기본 관리 주체는 주식회사 지오웍스다. 다만 특정 회사 고정이 아니라, 대시보드에서 보고 싶은 회사를 필터로 선택해 해당 회사 기준 데이터를 볼 수 있어야 한다.

선택 회사 기준 조회 항목: 매입, 매출, 실입금, 실출금, 미수금, 미지급금, 순이익, 거래현황.

---

## 17. V1 보류 기능
거래이슈 자동 감지 고도화, 권한 구조 고도화, 파일/증빙 고도화, 은행 API 연동, 환율 API 연동, AI 리포트, ERP 연동, 거래처 포털은 V1 핵심 구현에서 제외한다.

---

## 18. 실제 거래 검증 사례
```text
A.CJ제일제당 → B.지오웍스 → C.네이처인사이트 → D.에코앤리사이클
```

부가세 포함, 선입금 구조, 단계별 세금계산서 발행, 실물 A→D 직송, 지오웍스 운송비 부담 및 판매가 포함, 매입 없는 회사 허용, 매출 없는 최종 회사 허용.

---

## 19. DB MASTER DESIGN v1.1
V1 핵심 테이블:
1. companies
2. company_contacts
3. items
4. formulas
5. formula_participants
6. formula_payment_schedules
7. formula_payment_records
8. formula_logistics
9. formula_logistics_vehicles
10. formula_invoices
11. formula_shares
12. formula_versions
13. formula_calculation_snapshots
14. formula_status_logs
15. audit_logs

ERD 핵심 관계:
```text
companies
 ├─ company_contacts
 ├─ formula_participants
 ├─ formula_payment_schedules
 ├─ formula_payment_records
 ├─ formula_logistics
 ├─ formula_invoices
 └─ formula_shares

items
 └─ formulas

formulas
 ├─ formula_participants
 ├─ formula_payment_schedules
 ├─ formula_payment_records
 ├─ formula_logistics
 ├─ formula_invoices
 ├─ formula_shares
 ├─ formula_versions
 ├─ formula_calculation_snapshots
 ├─ formula_status_logs
 └─ audit_logs
```

---

## 20. 개발 체계
ChatGPT: 기획, QA, 구조 검토  
Claude: DB, 계산엔진, 비즈니스 로직 설계  
v0: UI 프로토타입  
Cursor: 실제 구현  
Vercel: 배포 및 프리뷰  
Codex: 보조 코딩

개발 흐름:
```text
TOCS_MASTER_SPEC → Claude 설계 → v0 UI 초안 → Cursor 통합 구현 → Vercel Preview → ChatGPT QA → Cursor 수정 → Vercel 운영 배포
```

---

## 21. 다음 단계
1. Claude DB Schema 생성
2. ChatGPT DB 검토
3. Prisma Schema 확정
4. API 설계
5. v0 UI 설계
6. Cursor 구현
