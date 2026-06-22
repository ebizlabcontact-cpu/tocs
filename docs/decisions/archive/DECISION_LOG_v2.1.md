# DECISION_LOG_v2.1

## 2026-06-22

### DL-027. TEST-004 PASS 확정

수입/환율 거래 검증이 통과했다.

확정 사항:

- trade_type = IMPORT 사용 가능
- foreign_currency = USD 저장 가능
- contract_exchange_rate 기준 계산
- adjusted_exchange_rate는 참고값으로 저장
- V1 기준 participant 단가/금액은 기준통화(KRW) 환산값으로 저장
- 원본 외화 단가와 외화 금액은 memo 또는 snapshot_data에 보존

---

### DL-028. TEST-005 PASS 확정

물류비 / 운송비 귀속 검증이 통과했다.

확정 사항:

- formula_logistics 구조 정상
- carrier_company_id 정상
- departure_company_id / arrival_company_id 정상
- cost_bearer_company_id 정상
- total_logistics_cost > 0일 때 cost_bearer_company_id 필수 제약 정상
- SEPARATE_COST 사용 정상
- 운송비 지급 record가 confirmed_payment에 반영됨
- expected_cost와 logistics_cost 일치 검증 완료

---

### DL-029. TEST-006 PASS 확정

Formula 종결 검증이 통과했다.

확정 사항:

- 6개 상태가 모두 완료되면 can_close = TRUE
- is_closed = TRUE 저장 가능
- closed_at NOT NULL 저장 가능
- chk_closed_requires_all_completed 통과
- chk_closed_at_consistency 통과
- formula_status_logs 기록 가능
- audit_logs 기록 가능

---

### DL-030. formulas.invoice_status 정책 확정

formulas.invoice_status는 DB가 자동 갱신하지 않는다.

현재 V1 정책:

```text
formula_invoices
↓
v_formula_invoice_status
↓
API Layer 판단
↓
formulas.invoice_status 갱신
```

Seed SQL에서는 API Layer 역할을 대체하기 위해 formulas.invoice_status를 직접 명시한다.

---

### DL-031. 상태 로그 / 감사 로그 정책 확정

V1 DB 레벨에서는 status log와 audit log를 자동 생성하지 않는다.

API Layer에서 상태 변경 시 트랜잭션으로 아래를 함께 처리한다.

```text
formulas UPDATE
formula_status_logs INSERT
audit_logs INSERT
```

---

### DL-032. 환율/통화 V1 정책 확정

V1에서는 participant 단가와 금액은 기준통화 환산값으로 저장한다.

외화 원단가, 원금액, 사용 환율은 memo 또는 snapshot_data에 보존한다.

V2 개선 후보:

- original_unit_price
- original_currency
- exchange_rate_used
- converted_unit_price
- converted_amount

---

### DL-033. TEST-007 우선순위 확정

다음 테스트는 Share Engine 검증이다.

이유:

- formula_shares는 아직 실제 PostgreSQL 검증이 부족함
- expected_share 반영 여부 확인 필요
- Share 지급 record가 confirmed_payment에 반영되는지 확인 필요
