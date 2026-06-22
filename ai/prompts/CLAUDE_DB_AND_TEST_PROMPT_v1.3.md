# CLAUDE_DB_AND_TEST_PROMPT_v1.3

## 목적

Claude는 본 문서를 기준으로 TOCS DB/API/TEST 후속 작업을 수행한다.

DB 구조는 실제 PostgreSQL 16 환경에서 base + supplement + fix 적용 및 TEST-001/TEST-002 통과를 확인했다.

---

# 1. 절대 준수 원칙

- Formula First Architecture
- Formula = Source of Truth
- Formula 1개 = 품목 1개
- Deal / Order Entity 생성 금지
- Company 고정 역할 금지
- 역할은 formula_participants에서 결정
- 확정 KPI는 실제 은행 입출금 기준
- 예상 KPI와 확정 KPI 혼합 금지
- 상태 자동 완료 금지
- 계산서는 거래 진행 조건이 아니라 종결 조건
- PostgreSQL Schema = Source of Truth
- Prisma = ORM 매핑 도구

---

# 2. 최종 DB 파일 체계

최종 운영 파일:

```text
tocs_base_schema.sql
tocs_supplement.sql
tocs_fix_amount_verified.sql
```

기존 v1.5/v1.6.1 다단계 파일 체계는 폐기한다.

---

# 3. 실제 검증 완료

## TEST-001 PASS

검증 항목:

- Formula 생성
- Participants 생성
- Payment Schedule / Record
- Invoice amount_verified
- Profit Engine
- Closeable Engine
- Participant KPI

## TEST-002 PASS

검증 항목:

- 분할입금
- 부분출금
- 완료취소 후 재입금
- is_canceled = TRUE 레코드 KPI 제외
- 미수금
- 미지급금
- 입금률
- 출금률
- 확정순이익
- v_payment_unmatched 0건
- PASS/FAIL 자동 검증 9개 지표 전부 PASS

---

# 4. amount_verified 정책

`amount_verified`는 사용자 입력값이 아니라 시스템 자동 계산값이다.

`sync_invoice_amount_verified()` 함수는 어떤 경우에도 NULL을 반환하면 안 된다.

방어 원칙:

```text
NEW.amount_verified = COALESCE(comparison_result, FALSE)
```

---

# 5. 다음 테스트 생성 기준

다음 테스트는 TEST-003 외상거래다.

요구사항:

- 새 Formula 사용
- TEST-001, TEST-002와 UUID 충돌 금지
- 기존 데이터와 충돌 금지
- PostgreSQL 16 순수 SQL
- BEGIN ~ COMMIT 포함
- docker cp + psql -f 방식으로 실행 가능
- Verify SQL에는 PASS/FAIL 자동 판정 포함
- 모든 사용자 제시 숫자는 먼저 독립 재계산 후 Seed 작성

---

# 6. TEST-003 목표

외상거래 검증.

핵심 검증:

```text
schedule 존재
record 없음
→ receivable/payable 계산

record가 뒤늦게 일부 들어오면
→ partial 회수/지급 계산
```

첫 번째 TEST-003은 순수 외상 상태를 검증한다.

---

# 7. TEST-003 권장 시나리오

거래 흐름:

```text
Supplier Credit Co
→ GioWorks Credit
→ Buyer Credit Co
```

품목:

```text
Credit Raw Material
```

수량:

```text
5,000 kg
```

단가:

```text
Supplier Credit Co sell = 400
GioWorks Credit buy = 400
GioWorks Credit sell = 650
Buyer Credit Co buy = 650
```

예상:

```text
GioWorks 예상매입 = 2,000,000
GioWorks 예상매출 = 3,250,000
예상비용 = 100,000
예상셰어 = 50,000
예상순이익 = 1,100,000
```

입금 Schedule:

```text
Buyer Credit Co → GioWorks Credit
3,250,000
payment_type = CREDIT
record 없음
```

출금 Schedule:

```text
GioWorks Credit → Supplier Credit Co
2,000,000
payment_type = CREDIT
record 없음
```

확정 KPI 예상:

```text
confirmed_revenue = 0
confirmed_payment = 0
confirmed_net_profit = 0
scheduled_revenue = 3,250,000
scheduled_payment = 2,000,000
receivable = 3,250,000
payable = 2,000,000
receive_rate = 0
payment_rate = 0
can_close = FALSE
```

산출물:

1. tocs_seed_test003.sql
2. tocs_verify_test003.sql

Verify SQL 필수 출력:

1. v_formula_confirmed_kpi
2. v_formula_profit_engine
3. v_participant_confirmed_kpi
4. v_payment_unmatched
5. v_formula_closeable
6. expected vs actual PASS/FAIL 표

---

# 8. 금지사항

- 새 기능 제안 금지
- Schema 변경 금지
- 새로운 최상위 Entity 추가 금지
- TEST-001/TEST-002 데이터 수정 금지
- 예상 KPI와 확정 KPI 혼합 금지
