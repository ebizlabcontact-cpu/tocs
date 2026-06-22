# DECISION_LOG_v1.6

## 2026-06-18

### DL-001. Formula First Architecture 확정

TOCS는 Formula 중심 시스템으로 설계한다.

모든 KPI와 경영지표는 Formula에서 파생된다.

---

### DL-002. Formula 정의 확정

Formula는 돈 흐름, 세무 흐름, 물류 흐름, 정산 흐름, 수익 흐름을 하나로 묶은 운영 원장이다.

---

### DL-003. Company / Role 분리 확정

모든 참여자는 Company로 관리한다.

Company 자체는 고정 역할을 갖지 않는다.

역할은 Formula 내부에서 결정한다.

---

### DL-004. Formula 1개 = 품목 1개 확정

V1 기준 Formula 1개에는 품목 1개만 연결한다.

다품목 거래는 품목별 Formula를 별도 생성한다.

`formula_items` 테이블은 V1에서 생성하지 않는다.

---

### DL-005. Deal / Order Entity 생성 금지

TOCS는 Deal 중심 시스템이 아니다.

Deal, Order, Project, Pipeline 등 별도 최상위 Entity를 생성하지 않는다.

---

### DL-006. Formula Action Sheet v1 확정

기본 입력 순서는 아래와 같다.

```text
품목
↓
매입처 / 매출처
↓
매입단가 / 매출단가
↓
수량
↓
나머지 설정
```

---

### DL-007. Formula Participants 라인 구조 채택

A > B > C > D 구조는 `formula_participants`와 `sequence_order`로 표현한다.

매입가 0, 매출가 0을 허용한다.

---

### DL-008. 실물 흐름과 세무 흐름 분리 확정

세무 흐름과 실물 흐름은 다를 수 있다.

예시:

```text
세무 흐름: A > B > C > D
실물 흐름: A -------------> D
```

---

### DL-009. 입출금 엔진 다건 구조 확정

입금/출금은 다건 구조를 허용한다.

부분입금, 분할입금, 부분출금, 분할출금을 고려한다.

입금완료/출금완료 후 완료취소가 가능해야 한다.

삭제하지 않고 취소 상태로 이력 보존한다.

---

### DL-010. KPI 계산 기준 확정

확정매출은 실제 은행 입금액 기준으로 계산한다.

거래 기준, 계산서 기준 매출을 대표 KPI의 확정매출로 사용하지 않는다.

---

### DL-011. 확정순이익 계산 기준 확정

확정순이익은 아래 공식으로 계산한다.

```text
확정순이익 = 실입금 - 실출금 - 실제비용 - 실제셰어
```

---

### DL-012. 미수금 / 미지급금 계산 기준 확정

```text
미수금 = 입금예정금액 - 누적입금액
미지급금 = 출금예정금액 - 누적출금액
```

---

### DL-013. 운송비 지급 대상 확정

운송비 지급 대상은 세금계산서를 발행한 운송사업체다.

실제 기사/차주와 세무 정산 대상은 다를 수 있으므로 분리 관리한다.

---

### DL-014. 운송비 처리 유형 확정

운송비는 아래 유형을 지원한다.

- 매입가 포함
- 판매가 포함
- 별도 비용처리

운송비가 매입가 또는 판매가에 포함되어 있어도 실제 지급 주체는 별도 관리한다.

---

### DL-015. 계산서 엔진 원칙 확정

계산서는 거래 진행 조건이 아니라 Formula 종결 조건이다.

```text
계산서 없어도 거래 진행 가능
계산서 없어도 입출금 가능
계산서 없으면 Formula 종결 불가
```

---

### DL-016. 상태관리 원칙 확정

거래상태, 입금상태, 출금상태, 계산서상태, 운송상태를 개별 관리한다.

상태를 단일 Status 하나로 압축하지 않는다.

상태는 수정 가능해야 하며, 완료취소가 가능해야 한다.

모든 상태 변경은 이력으로 남긴다.

---

### DL-017. 종결 규칙 확정

아래 상태가 모두 완료일 때만 Formula 종결이 가능하다.

- 거래상태
- 입금상태
- 출금상태
- 계산서상태
- 운송상태

하나라도 미완료이면 종결 불가.

---

### DL-018. 계산엔진 v1 원칙 확정

순이익 공식:

```text
순이익 = 총매출 - 총매입 - 비용 - 셰어
```

---

### DL-019. 부가세 기준 확정

기본 계산은 부가세 포함 금액 기준으로 한다.

향후 공급가, 부가세, 합계금액, 예상 부가세 기능을 확장 검토한다.

---

### DL-020. 셰어 계산 원칙 확정

셰어는 거래마다 케이스바이케이스다.

직접입력과 차등배분을 우선 지원한다.

우선순위:

1. 직접입력
2. 정액
3. 정률
4. N분배

---

### DL-021. 환율 기준 확정

수입/수출/혼합 거래의 기본 환율은 계약시 환율 기준으로 한다.

단, 환율 변동 가능성을 고려해 수정환율, 변경사유, 변경이력을 저장한다.

---

### DL-022. Formula Version / Snapshot 원칙 확정

Formula 변경 시 신규 버전 또는 스냅샷을 생성한다.

계산 결과 스냅샷을 저장해 과거 데이터 훼손을 방지한다.

---

### DL-023. DB MASTER DESIGN v1 확정

V1 핵심 테이블은 아래 14개로 본다.

1. companies
2. company_contacts
3. items
4. formulas
5. formula_participants
6. formula_payments
7. formula_logistics
8. formula_logistics_vehicles
9. formula_invoices
10. formula_shares
11. formula_versions
12. formula_calculation_snapshots
13. formula_status_logs
14. audit_logs

---

### DL-024. Claude DB Schema Prompt 생성

Claude에게 DB Schema 초안을 요청하기 위한 문서 `CLAUDE_DB_SCHEMA_PROMPT_v1.md`를 생성했다.

---

### DL-025. 개발 체계 확정

- ChatGPT: 기획/QA
- Claude: DB/로직
- v0: UI
- Cursor: 구현
- Vercel: 배포
- Codex: 보조코딩

모든 도구는 TOCS_MASTER_SPEC를 기준으로 작업한다.
