# TOCS DB Schema v1.6 — Round 6 정합성 검증 요약
2026-06-18

## 적용 순서
```
1. v1.5 schema + v1.5 supplement 적용 완료 상태 확인
2. tocs_migration_supplement_v1_6.sql 실행
3. Prisma schema 수정 (quantity NOT NULL, invoiceAmount → externalInvoiceAmount)
4. prisma migrate dev (스키마 drift 감지 시 --create-only 후 검토)
5. prisma generate
```

## 변경 항목 요약

| # | 항목 | 유형 | 핵심 내용 |
|---|------|------|-----------|
| B-1 | quantity NOT NULL | 제약 강화 | NULL로 인한 조용한 0원 계산 방지 |
| B-2 | formula_shares 복합 FK | 정합성 | participant가 동일 formula 소속 보장 |
| B-3 | snapshot 복합 FK | 정합성 | version이 동일 formula 소속 보장 |
| B-4 | direction 일치 트리거 | 정합성 | schedule/record 방향 불일치 차단 |
| B-5 | invoice participant/company 일치 트리거 | 정합성 | participant가 명시된 company 소속 보장 |
| B-6 | invoice_amount → external_invoice_amount | 명칭/역할 | 외부 원본 금액 vs 시스템 계산값 구분 |
| 추가-1 | start/end point Partial Unique Index | 정합성 | Formula당 시작점/종료점 각 최대 1개 |
| 추가-2 | sequence_order > 0 CHECK | 정합성 | 순서값 양수 강제 |

## DB 레벨 vs API 레벨 검증 분담 원칙 (이번 검토로 확정)

```
DB 레벨 (CHECK/복합FK/트리거)로 강제:
  - 같은 테이블 내 값 일관성 (CHECK)
  - 테이블 간 formula_id 소속 일치 (복합 FK)
  - 테이블 간 의미적 일치 — direction, company (트리거)
  → 이 세 가지는 "항상 참이어야 하는 불변 규칙"이므로 DB가 보장

API 레벨로 검증:
  - participant_id 간 교차 검증 (schedule.participant_id = record.participant_id)
  → 비즈니스 룰 성격이 강하고, formula 단위 정합성은 이미 복합 FK로 보장되므로
    DB 트리거까지는 과함
```
