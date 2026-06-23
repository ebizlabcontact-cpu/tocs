# TOCS DB Schema Merge Report — 최종 확정본

## 검토 배경

ChatGPT가 생성한 병합본(`tocs_supplement.sql`, `DB_APPLY_ORDER_v5.2.md`,
`TOCS_DB_SCHEMA_MERGE_REPORT_v5.2.md`)과 Claude가 생성한 병합본을
다음 10개 기준으로 코드 레벨 직접 대조했다. 추측 없이 모든 판정은
Python 정규식 추출 또는 `diff` 명령의 실제 출력 결과에만 근거한다.

---

## 결과 요약

| # | 검토 기준 | ChatGPT 본 | Claude 본 | 판정 |
|---|---|---|---|---|
| 1 | 변경 대상이 `v_formula_profit_engine` 하나뿐인가 | ✓ | ✓ | 동일 |
| 2 | 다른 View/Table/Trigger/Function/Index 무변경 | ✓ | ✓ | 동일 |
| 3 | `expected_base`가 `fcs`/`fv` JOIN하는가 | ✓ | ✓ | 동일 |
| 4 | `ORDER BY fcs.formula_id, fv.version_no DESC, fcs.created_at DESC, fcs.id DESC` | ✓ 정확 일치 | ✓ 정확 일치 | 동일 |
| 5 | 옛 `created_at DESC` 단독 기준 제거 | ✓ | ✓ | 동일 |
| 6 | 외부 SELECT 컬럼 구조 동일 | ✓ 6개 alias 일치 | ✓ 6개 alias 일치 | 동일 |
| 7 | DB_APPLY_ORDER에서 patch 운영 제외 | ✓ | ✓ | 동일 |
| 8 | 운영 적용 순서 3개 파일만 포함 | ✓ | ✓ | 동일 |
| 9 | `tocs_diagnose_and_fix.sql` archive 분류 | ✗ 누락 | ✗ 누락 | **양쪽 모두 결함 — 최종본에서 보강** |
| 10 | `tocs_patch_profit_engine_latest_version.sql` archive 분류 | ✓ | ✓ | 동일 |

---

## Supplement 파일 비교 — 코드 동일성 검증

`diff` 명령으로 두 파일을 직접 비교한 결과, 차이는 `expected_base` CTE
내부의 **주석(comment) 텍스트 길이**뿐이었다. 주석을 전부 제거한 뒤
재비교한 결과 두 파일은 **350줄 전체가 글자 단위로 100% 일치**했다.

```
strip_comments(ChatGPT 본) == strip_comments(Claude 본)  ->  True
```

Trigger 3개, Function 3개, ALTER TABLE 대상 9개 테이블, Index 16개 —
모두 두 파일에서 완전히 동일한 목록으로 확인되었다.

**결론: 두 supplement 파일 사이에 기능적 오류나 차이는 없다.**
최종본은 Claude 본(주석이 더 상세하여 향후 유지보수 시 원인/근거/검증
이력을 추가 설명 없이 파악 가능)을 그대로 사용하며, 코드 변경은
전혀 가하지 않았다(`diff` 결과 0줄 차이로 재확인).

---

## 문서 비교 — 발견된 차이와 처리

### 차이 1: 필수 회귀 테스트 목록 완전성

ChatGPT 본은 `TEST-001, 006, 009, 010` 4개를 명시했다. 이는 유효한
회귀 셋이지만, 실제로 `v_formula_profit_engine`을 직접 조회하여 patch
변경사항을 검증하는 TEST-011과 TEST-011B를 누락했다.

```
grep -l "v_formula_profit_engine" tocs_verify_test*.sql
-> test001 ~ test011b 전체 12개 파일에서 확인됨
```

TEST-011/011B는 V1→V2→V3 다중 버전 생성 + 동시성 방어 시나리오에서
`v_formula_profit_engine`이 최신(V3) snapshot을 정확히 반영하는지
검증하는, patch의 직접적인 검증 대상이다. 최종본은 이 2개를 필수
회귀 셋에 추가했다(`TEST-001/006/009/010/011/011B`, 총 6개).

Claude 본은 구체적인 필수 셋을 명시하지 않고 "선택적 전체 재실행"만
언급했다는 점에서, 명확한 최소 셋을 제시한 ChatGPT 본보다 실무
가이드로서는 약했다. 최종본은 이 부분도 보강했다.

### 차이 2: `tocs_diagnose_and_fix.sql` 분류 누락 (양쪽 공통 결함)

검토 기준 9가 명시적으로 요구했음에도, ChatGPT 문서와 Claude 문서
모두 이 파일을 전혀 언급하지 않았다. 파일 존재 여부를 직접 확인한 결과
`/mnt/user-data/outputs/tocs_diagnose_and_fix.sql`로 실재했다.

최종본은 이 파일을 archive 대상 목록에 추가하고, 운영 대상에서
명시적으로 제외했다.

### 차이 3: Apply Commands 포함 여부

ChatGPT 본은 실제 `docker cp` / `psql -f` 명령어를 포함했고, Claude 본은
파일 설명에 집중하여 명령어를 생략했다. 최종본은 ChatGPT 본의 Apply
Commands를 그대로 채택했다(실무 적용 시 즉시 사용 가능하다는 실익이
명확함).

---

## 최종 산출물

1. `tocs_supplement.sql` — Claude 본 그대로 사용(코드 변경 없음, `diff` 0줄 확인)
2. `DB_APPLY_ORDER.md` — 양쪽 강점 통합 + 9번 기준 결함 보강
3. 본 Merge Report
4. Archive 이동 대상 목록 (아래)
5. 운영 적용 대상 목록 (아래)

---

## Archive 이동 대상 목록

```
db/patches/archive/tocs_patch_profit_engine_latest_version.sql
db/patches/archive/tocs_diagnose_and_fix.sql
```

## 운영 적용 대상 목록

```
db/schema/tocs_base_schema.sql
db/schema/tocs_supplement.sql
db/fixes/tocs_fix_amount_verified.sql
```

---

## 판단 기준 적용 확인

이번 검토는 "더 많은 기능이 들어간 파일"을 정답으로 삼지 않았다.
실제로 두 supplement 파일은 기능적으로 완전히 동일했으며, 코드 변경은
가하지 않았다. 문서 2종에서 발견된 차이는 모두 "TEST-009 patch가
정확히 반영되었는가"라는 본 기준과는 무관한, 운영 가이드의 완전성
문제(회귀 테스트 누락, archive 대상 누락)였으며, 이 부분만 사실에
근거하여 보강했다.
