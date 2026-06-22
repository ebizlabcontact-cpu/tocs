# TOCS TEST-003 Seed/Verify SQL 생성 요청

현재 상태:

- tocs_base_schema.sql 적용 완료
- tocs_supplement.sql 적용 완료
- tocs_fix_amount_verified.sql 적용 완료
- TEST-001 PASS
- TEST-002 PASS

다음은 TEST-003 외상거래 검증이다.

목표:

1. schedule은 존재하지만 record가 없는 외상거래 검증
2. confirmed_revenue/payment/net_profit은 0으로 나와야 함
3. scheduled_revenue/payment은 예정금액으로 나와야 함
4. receivable/payable은 예정금액 전체로 나와야 함
5. receive_rate/payment_rate는 0으로 나와야 함
6. can_close는 FALSE로 나와야 함

전제:

- TEST-001, TEST-002와 UUID 충돌 금지
- 기존 데이터 수정 금지
- 새 Formula 사용
- 새 Company 사용
- PostgreSQL 16 순수 SQL
- BEGIN ~ COMMIT 포함
- docker cp + psql -f 방식으로 실행 가능
- 모든 숫자는 코드로 독립 재계산 후 작성
- Verify SQL에는 PASS/FAIL 자동 판정 포함

시나리오:

거래 흐름:

Supplier Credit Co
→ GioWorks Credit
→ Buyer Credit Co

품목:

Credit Raw Material

수량:

5,000 kg

단가:

Supplier Credit Co sell = 400
GioWorks Credit buy = 400
GioWorks Credit sell = 650
Buyer Credit Co buy = 650

예상 계산:

GioWorks 예상매입 = 5,000 × 400 = 2,000,000
GioWorks 예상매출 = 5,000 × 650 = 3,250,000
예상비용 = 100,000
예상셰어 = 50,000
GioWorks 예상순이익 = 3,250,000 - 2,000,000 - 100,000 - 50,000 = 1,100,000

입금 Schedule:

Buyer Credit Co → GioWorks Credit
3,250,000
payment_type = CREDIT
record 없음

출금 Schedule:

GioWorks Credit → Supplier Credit Co
2,000,000
payment_type = CREDIT
record 없음

확정 KPI 예상:

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

주의:

- 확정순이익은 실입금 - 실출금이다.
- record가 없으므로 확정순이익은 0이어야 한다.
- 예상순이익은 snapshot 기준 1,100,000이어야 한다.
- 외상 상태이므로 미수금/미지급금이 전액 잡혀야 한다.
