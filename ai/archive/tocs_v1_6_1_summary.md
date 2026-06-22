# TOCS DB Schema v1.6.1 — Round 7 최종 검증 요약
2026-06-18

## 적용 방법

**v1.6 supplement는 사용하지 말 것.** 대신 `tocs_migration_supplement_v1_6_1.sql` 단일 파일을 실행한다 (v1.5 schema + v1.5 supplement 적용 완료 상태 전제).

이 파일은 트랜잭션(`BEGIN ~ COMMIT`)으로 묶여 있어 중간 실패 시 전체 롤백된다.

```
실행 순서 (파일 내부에 이미 구현됨):
  STEP 1.  의존 View 6개 DROP
  STEP 2.  quantity NOT NULL + Generated Column 재생성
  STEP 3.  formula_shares 복합 FK
  STEP 4.  formula_calculation_snapshots 복합 FK
  STEP 5.  payment direction 일치 트리거
  STEP 6.  invoice participant/company 일치 트리거
  STEP 7.  invoice_amount → external_invoice_amount
  STEP 8.  amount_verified 자동 계산 트리거 (신규)
  STEP 9.  Partial Unique Index + CHECK
  STEP 10. View 6개 재생성
```

## Round 7 검증 결과 요약

| # | 검토 항목 | 결론 |
|---|-----------|------|
| 1 | 복합 FK 참조 가능 여부 | **가능.** `uq_fp_id_formula` 선행 제약 존재로 5개 복합 FK 모두 유효 |
| 2 | Formula.quantity ↔ Participant.quantity | **다를 수 있음을 허용.** DB 미강제. API에서 상속+경고. Version/Snapshot 생성은 기존 정책 유지 |
| 3 | Migration 실행 순서 | **결함 발견 및 수정.** View DROP 누락으로 DROP COLUMN 실패하던 문제 → v1.6.1에서 해결 |
| 4 | status_target ENUM | **이미 정상.** PAYMENT_STATUS/RECEIVE_STATUS 잔존 없음. 6개 값 확정 상태 유지 |
| 5 | external_invoice_amount 검증 | **트리거로 amount_verified만 자동화.** invoice_status 전환은 API 레이어 담당으로 분리 |

## 핵심 결함 수정 내용 (Round 7의 가장 중요한 발견)

```
문제: v1.6 supplement.sql을 그대로 실행하면
      "DROP COLUMN total_buy_amount" 단계에서
      View 의존성 때문에 트랜잭션 전체가 실패함.

원인: v_participant_confirmed_kpi, v_formula_profit_engine 등이
      fp.total_buy_amount / fp.total_sell_amount를 직접 참조.

해결: v1.6.1에서 트랜잭션 시작 시 의존 View 6개를 먼저 DROP하고,
      Generated Column 작업 완료 후 마지막에 동일한 정의로 재생성.
      BEGIN/COMMIT으로 원자성 보장.
```

## DB 검증 원칙 최종 확정 (Round 4~7 누적)

```
CHECK Constraint  → 같은 테이블 내 컬럼 간 불변 규칙
복합 FK           → 테이블 간 formula_id 소속 일치
트리거            → 테이블 간 의미적 일치 (direction, company)
                     + 파생값 자동 계산 (amount_verified)
API 레이어        → 비즈니스 판단이 필요한 영역
                     (participant_id 교차검증, quantity 허용오차 경고,
                      invoice_status 최종 전환 결정)
```
