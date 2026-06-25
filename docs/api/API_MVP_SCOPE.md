# API_MVP_SCOPE.md

## 목적

`TOCS_API_SPEC_v1.1.md`를 기준으로 실제 MVP 구현 범위(1차)와 V1+ 범위
(2차)를 분리한다. DB 구조는 변경하지 않으며, API 정책만 보정한다.

판단 기준: 새로운 기능을 더 넣는 것이 아니라, **DB가 실제로 보장하는
것과 API가 추가로 책임져야 하는 것을 명확히 가르는** 기준으로 분리했다.
구현 위험도가 높거나(DB 제약 우회 트랜잭션 필요), 정책이 아직
확정되지 않았던 영역은 1차에서 제외했다.

---

## 1차 범위 — MVP Core

API가 책임지는 로직이 단순하거나(DB 제약을 그대로 전달), 이번 검토로
정책이 명확히 확정된 영역만 포함한다.

### Formula API
- [x] 1.1 Formula 생성
- [x] 1.2 Formula 단건 조회
- [x] 1.3 Formula 목록 조회
- [x] 1.4 Formula 수정 (메타데이터만: content, note, unit)
- [x] 1.5 Formula 상태 조회

### Company / Participant API
- [x] 2.1 회사 등록
- [x] 2.2 회사 조회/목록
- [x] 2.3 Formula 참여자 추가
- [ ] 2.4 참여자 순서 관리 -> V2 보류

### Payment API
- [x] 3.1 입출금 예정 등록
- [x] 3.2 실제 입출금 기록
- [x] 3.3 완료취소 (재취소 시도는 409로 거부, MVP 확정)
- [x] 3.4 미수/미지급 조회

### Invoice API
- [x] 4.1 계산서 등록
- [x] 4.2 계산서 상태 조회
- [x] 4.3 formulas.invoice_status 동기화 (API 필수 책임)

### Logistics API
- [x] 5.1 운송 정보 등록
- [x] 5.2 운송비 등록 (실제 지급은 3.2로 별도 기록)
- [x] 5.3 운송 상태 변경

### Share API
- [x] 6.1 정액 Share 등록
- [x] 6.2 정률 Share 등록
- [x] 6.3 Share 변경 시 Snapshot 재계산 (항상 새 Version 생성으로 확정)

### Version API
- [x] 7.1 새 버전 생성 (재시도는 MVP: 1회 재시도 + 즉시 실패 메시지로 최소 구현)
- [x] 7.2 버전 목록
- [x] 7.3 버전 상세
- [x] 7.4 최신 snapshot 조회

### Cancel / Close API
- [x] 8.1 Formula 취소 (전체 취소만, 부분 취소는 V2 보류)
- [x] 8.2 Formula 종결
- [x] 8.3 취소/종결 차이 문서화
- [ ] 8.4 Cancel Undo / Close Undo -> MVP 금지 (엔드포인트 자체를 제공하지 않음)
- [x] 8.5 Closed Formula Settlement Policy (DL-033)

### Closed Settlement API (DL-033)
- [x] 3.2 추가 payment record — Closed Formula에서 허용
- [x] 3.3 payment record cancel + 재입금 — Closed Formula에서 허용
- [ ] Settlement 전용 payment-schedules (`POST .../settlement/payment-schedules`)
- [ ] Settlement 정산 메모 (`POST .../settlement/notes` → audit_logs)
- [x] 4.3 invoice sync — Closed Formula에서 AMOUNT_MATCHED일 때만 formula 컬럼 반영

### Dashboard / KPI API
- [x] 9.1 Confirmed KPI 조회 (우선순위 1)
- [x] 9.3 Receivable/Payable 조회 (우선순위 1)
- [x] 9.2 Expected KPI 조회 (우선순위 2, Version API 완료 후)
- [x] 9.4 Participant KPI 조회 (우선순위 3, 가장 복잡)

---

## 2차 범위 — V1+ (V2 보류)

| 항목 | 보류 사유 |
|---|---|
| 2.4 참여자 순서 변경 API | UNIQUE(formula_id, sequence_order) swap 트랜잭션 위험도 높음. MVP는 생성 시점 순서 확정으로 충분. |
| Cancel Undo / Close Undo | DB가 기술적으로 막지 않지만, 회계적 일관성 위험. 승인 절차 동반 설계 필요. |
| Reopen (`is_closed TRUE → FALSE`) | DL-033 MVP 제외. Settlement ledger 보정으로 대체. |
| Adjustment Formula entity | DL-033 MVP 제외. V2에서 계약 조건 변경 시 별도 검토. |
| Formula 부분 취소(상태별 개별 취소) | 비즈니스 의미 미정의. DB ENUM은 허용하나 API 정책 부재. |
| Version 재시도 고급 정책(다회 재시도 + exponential backoff) | 실제 동시 요청 빈도 관측 후 결정. MVP는 1회 재시도로 최소 구현. |

---

## MVP 금지 항목 (V2 보류와는 구분 — "절대 제공하지 않음")

다음은 V2에서 "재검토"가 아니라, MVP 단계에서 API가 명시적으로
거부해야 하는 동작이다. DB가 허용하더라도 API Layer가 막는다.

1. Formula 수정 API로 quantity/contract_exchange_rate/
   adjusted_exchange_rate 변경 — 반드시 Version API를 거쳐야 한다.
2. `is_closed = TRUE`인 Formula의 **일반 속성 수정(1.4)** — Close 이후
   content/note/unit 포함 전면 거부. 정산 메모는 8.5 Settlement API만.
3. `is_closed = TRUE`인 Formula에 대한 **Version/Share/Participant 변경**
   — 원본 거래 수정으로 거부(DL-033).
4. `is_closed = TRUE`인 Formula에 대한 **일반 payment-schedules(3.1)**
   — Settlement API(8.5) 경로만 허용.
5. Closed Formula **invoice sync** — `derived_invoice_status ≠ AMOUNT_MATCHED`일
   때 `formulas.invoice_status` UPDATE 금지.
6. 기존 payment record `actual_amount` 직접 UPDATE — cancel + 신규 record만.
7. 이미 is_canceled = TRUE인 payment record의 재취소 요청 — 409.
8. Cancel Undo / Close Undo / Reopen — 엔드포인트 미제공.
9. Adjustment Formula top-level entity — MVP 미구현.
10. Formula 부분 취소 — 8.1은 전체 취소만 처리.

---

## 의존관계 기반 구현 순서 (MVP Core 내부)

```
1단계: Formula API + Company/Participant API
        (다른 모든 API의 전제조건)

2단계: Payment API
        (KPI/Profit Engine의 데이터 원천)

3단계: Invoice API (4.3 동기화 책임 포함)
        (Close API의 전제조건 - invoice_status=AMOUNT_MATCHED 필요)

4단계: Version API (7.1 재시도 정책 포함)
        (Share API 6.3이 내부적으로 이 API를 호출하므로 선행 필요)

5단계: Share API
        (Version API 의존)

6단계: Cancel / Close API
        (다른 모든 상태가 갖춰진 후에야 의미 있음)

7단계: Logistics API, Dashboard/KPI API
        (9.1/9.3 먼저, 9.2는 Version API 이후, 9.4는 마지막)
```

---

## 문서 동기화 공백 (별도 처리 필요)

이번 검토에서 "단가/수량/참여자/운송비/환율/셰어 변경 = Version 생성
대상"이라는 분류 규칙이 과거 대화에서만 확정되었고, 정식 문서
(TOCS_MASTER_SPEC.md, DECISION_LOG.md)에는 아직 반영되지 않은
상태임을 grep으로 직접 확인했다. 이는 API 구현 착수 전 별도로
정식 문서에 반영해야 하는 항목이며, 이번 MVP 범위 분리 작업과는
별개의 후속 작업으로 분류한다.
