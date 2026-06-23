# TOCS DB 적용 순서 (DB_APPLY_ORDER.md) — 최종 확정본

## 목적

새로운 PostgreSQL 16 데이터베이스에서 TOCS 스키마를 처음부터 누락 없이
재현하기 위한 최종 운영 파일 체계와 적용 순서를 정의한다.

이 문서가 가리키는 3개 파일만으로 현재 검증된 전체 DB 구조(테이블 15개,
View 6개, Trigger 3개, 복합 FK 5개, Partial Index, Sequence, 채번 함수)가
빠짐없이 재현되어야 한다.

---

## 운영 적용 대상 (이 3개만 사용)

```
1. db/schema/tocs_base_schema.sql
2. db/schema/tocs_supplement.sql
3. db/fixes/tocs_fix_amount_verified.sql
```

### 1. tocs_base_schema.sql

테이블, ENUM 타입, 기본 FK, Sequence(`formula_seq`), 채번 함수
(`generate_formula_no()`), 기본 인덱스만 포함한다.

View, Trigger, 복합 FK, GENERATED 컬럼 재정의, cash_in/cash_out을 포함한
종결 CHECK는 이 파일에 포함하지 않는다(2번 파일에서 처리).

### 2. tocs_supplement.sql

base 적용 후에만 의미를 갖는 모든 것을 포함한다:

- cash_in/cash_out 포함 종결 CHECK (`chk_closed_requires_all_completed`)
- GENERATED 컬럼 2종 (`formula_participants.total_buy/sell_amount`,
  `formula_invoices.total_amount`)
- 선행 복합 UNIQUE 4건, 복합 FK 5건 (MATCH SIMPLE, 교차 formula 오염 방지)
- Trigger 3건: `trg_check_record_direction`,
  `trg_check_invoice_participant_company`, `trg_sync_invoice_amount_verified`
- `invoice_amount` → `external_invoice_amount` RENAME
- Partial Unique Index 2건, `sequence_order` CHECK, Partial Index 다수
- **View 6개** (v1.6.2 기준 — `v_formula_profit_engine`에
  `formula_versions.version_no DESC` 기반 latest snapshot 선택 로직 병합 완료.
  아래 "변경 이력" 참조)

이 파일은 `BEGIN ~ COMMIT` 단일 트랜잭션으로 묶여 있어, 중간 실패 시 전체
롤백되어 부분 적용 상태가 남지 않는다.

### 3. tocs_fix_amount_verified.sql

`sync_invoice_amount_verified()` 함수와 `trg_sync_invoice_amount_verified`
트리거를 다시 `CREATE OR REPLACE` 한다. 2번 파일이 이미 같은 정의를
포함하므로, 이 파일은 **멱등(idempotent)**하게 동일 내용을 한 번 더
적용하는 것뿐이며 충돌이나 손상을 일으키지 않는다.

별도 3단계로 유지하는 이유: TEST-001 최초 실행 당시 `amount_verified` NULL
오류가 실제로 발생했던 이력을 보존하고, 향후 동일 함수를 다시 점검해야 할
때 이 파일 하나만 재실행하여 안전하게 복구할 수 있는 명시적 진입점을
남겨두기 위함이다.

---

## Apply Commands

```powershell
docker cp .\db\schema\tocs_base_schema.sql tocs-postgres:/tmp/tocs_base_schema.sql
docker exec -it tocs-postgres psql -U tocs -d tocs_db -P pager=off -f /tmp/tocs_base_schema.sql

docker cp .\db\schema\tocs_supplement.sql tocs-postgres:/tmp/tocs_supplement.sql
docker exec -it tocs-postgres psql -U tocs -d tocs_db -P pager=off -f /tmp/tocs_supplement.sql

docker cp .\db\fixes\tocs_fix_amount_verified.sql tocs-postgres:/tmp/tocs_fix_amount_verified.sql
docker exec -it tocs-postgres psql -U tocs -d tocs_db -P pager=off -f /tmp/tocs_fix_amount_verified.sql
```

---

## 변경 이력 — tocs_supplement.sql v1.6.2

`v_formula_profit_engine`의 `expected_base` CTE가 "최신 snapshot" 선택
기준을 변경했다.

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| 1차 정렬 기준 | `created_at DESC` 단독 | `formula_versions.version_no DESC` |
| JOIN 구조 | `formula_calculation_snapshots` 단독 | `formula_calculation_snapshots` LEFT JOIN `formula_versions` |
| tie-breaker | 없음 | `created_at DESC, id DESC` (보조 정렬) |

**원인**: 같은 트랜잭션 내 연속 INSERT되는 snapshot들의 `created_at`이
동일해질 수 있어(`DISTINCT ON`의 동일 정렬키 그룹 선택은 PostgreSQL이
"unspecified"로 규정), TEST-009에서 최신 버전(V2)이 아닌 이전 버전(V1)이
선택되는 실패가 실제로 재현되었다.

**수정 근거**: `formula_versions.version_no`는 `UNIQUE(formula_id, version_no)`로
보장되는 단조 증가 값이므로 동시성에 노출되지 않는다.

이 변경은 원래 별도 패치 파일(`tocs_patch_profit_engine_latest_version.sql`)로
존재했으나, 이번 정리 작업으로 `tocs_supplement.sql`에 영구 병합되었다.
`profit_base` CTE와 외부 SELECT/FROM/JOIN 구조는 글자 단위로 변경 없음을
확인했으며, `expected_base` CTE만 교체되었다.

---

## 필수 회귀 테스트 (Required Regression Check)

클린 재구축 후 아래 최소 회귀 셋을 반드시 실행한다.

```
TEST-001   amount_verified + 기본 KPI
TEST-006   Close Flow
TEST-009   Version Snapshot latest-selection 로직 (patch 직접 검증 대상)
TEST-010   Cancel Flow
TEST-011   Concurrency Defense — Version 1→2 + latest snapshot 반영 (patch 직접 검증 대상)
TEST-011B  TEST-011 재생성판 — 동일 검증 (patch 직접 검증 대상)
```

TEST-011/011B를 최소 셋에 포함하는 이유: 두 테스트의 Verify SQL이
`v_formula_profit_engine`을 직접 조회하여 V1→V2→V3 다중 버전 환경에서
최신 snapshot이 정확히 반영되는지 검증하는, patch 변경 사항의 **직접
검증 대상**이기 때문이다(grep으로 직접 확인: `tocs_verify_test011.sql`,
`tocs_verify_test011b.sql` 모두 해당 View를 조회함).

(선택) 전체 회귀가 필요하면 TEST-001~011B 전체를 순차 재실행한다.

---

## Archive 대상 목록

다음 파일들은 운영 적용 대상이 아니며, archive로 이동하여 변경 이력
보존 목적으로만 보관한다. 운영 적용 순서(위 3개 파일)에는 포함하지 않는다.

| 파일 | Archive 사유 |
|---|---|
| `tocs_patch_profit_engine_latest_version.sql` | `tocs_supplement.sql` v1.6.2에 영구 병합 완료. 단독 재실행 금지. |
| `tocs_diagnose_and_fix.sql` | `amount_verified` NULL 오류의 1회성 진단/복구 스크립트. 동일 수정 내용이 `tocs_fix_amount_verified.sql`(운영 적용 대상)에 이미 포함되어 있으므로 중복 실행 불필요. |

권장 archive 경로:

```text
db/patches/archive/tocs_patch_profit_engine_latest_version.sql
db/patches/archive/tocs_diagnose_and_fix.sql
```

---

## Production Rule

- `tocs_patch_profit_engine_latest_version.sql`을 `tocs_supplement.sql` 병합 후
  별도로 다시 적용하지 않는다.
- `tocs_diagnose_and_fix.sql`을 운영 적용 순서에 포함하지 않는다. 진단이
  다시 필요한 경우 `tocs_fix_amount_verified.sql`을 재실행한다(멱등).
- 두 파일이 저장소에 남아 있다면 archive 위치에서만 보관한다.

---

## 적용 순서 검증 체크리스트 (새 DB 구축 시)

```
[ ] 1. tocs_base_schema.sql 실행 — 에러 없이 완료
[ ] 2. tocs_supplement.sql 실행 — 에러 없이 완료 (BEGIN~COMMIT 전체 성공)
[ ] 3. tocs_fix_amount_verified.sql 실행 — 에러 없이 완료
[ ] 4. \d formula_invoices 로 amount_verified DEFAULT FALSE, trigger 등록 확인
[ ] 5. SELECT pg_get_viewdef('v_formula_profit_engine'::regclass, true);
       으로 expected_base가 formula_versions를 LEFT JOIN하고 있는지 확인
[ ] 6. 필수 회귀 테스트(TEST-001/006/009/010/011/011B) 순차 재실행
```
