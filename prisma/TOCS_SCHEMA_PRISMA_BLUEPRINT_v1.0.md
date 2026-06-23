# TOCS_SCHEMA_PRISMA_BLUEPRINT_v1.0

## 문서 목적

`prisma/schema.prisma` 실제 파일을 작성하기 전, PostgreSQL 확정
스키마(`tocs_base_schema.sql` + `tocs_supplement.sql` +
`tocs_fix_amount_verified.sql`)를 Prisma 모델로 어떻게 매핑할지
필드 단위로 최종 설계한다.

이 문서는 `PRISMA_MODEL_DESIGN_v1.0.md`(원칙·전략 수준)를 이어받아,
실제 `model`/`enum` 블록을 작성할 때 그대로 옮길 수 있는 구체적인
필드 목록까지 내려간 설계도다. 두 문서는 다음과 같이 역할이
나뉜다.

| 문서 | 수준 |
|---|---|
| `PRISMA_MODEL_DESIGN_v1.0.md` | 원칙 — Prisma의 역할, View 전략, GENERATED 처리 원칙 |
| `TOCS_SCHEMA_PRISMA_BLUEPRINT_v1.0.md` (본 문서) | 실행 — 15개 테이블 필드별 매핑, 관계 방향, dbgenerated 대상 확정 |

PostgreSQL Source of Truth 원칙(DECISION_LOG DL-017)은 본 문서에도
동일하게 적용된다. 이 청사진은 "PostgreSQL이 이미 정의한 것을 Prisma
문법으로 옮기는 작업"이며, 새로운 제약이나 컬럼을 만들지 않는다.

---

# 1. Model 후보 — 15개 테이블

PostgreSQL 테이블 15개를 그대로 1:1 Prisma `model`로 옮긴다. 신규
모델을 추가하지 않으며, 테이블 통합/분리도 하지 않는다.

| # | PostgreSQL 테이블 | Prisma Model 후보명 |
|---|---|---|
| 1 | `companies` | `Company` |
| 2 | `company_contacts` | `CompanyContact` |
| 3 | `items` | `Item` |
| 4 | `formulas` | `Formula` |
| 5 | `formula_participants` | `FormulaParticipant` |
| 6 | `formula_payment_schedules` | `PaymentSchedule` |
| 7 | `formula_payment_records` | `PaymentRecord` |
| 8 | `formula_logistics` | `Logistics` |
| 9 | `formula_logistics_vehicles` | `LogisticsVehicle` |
| 10 | `formula_invoices` | `Invoice` |
| 11 | `formula_shares` | `Share` |
| 12 | `formula_versions` | `FormulaVersion` |
| 13 | `formula_calculation_snapshots` | `CalculationSnapshot` |
| 14 | `formula_status_logs` | `StatusLog` |
| 15 | `audit_logs` | `AuditLog` |

Model 명명 기준: PostgreSQL 테이블명이 `formula_` 접두어를 가진
경우가 많아 Prisma에서는 접두어를 생략하고 의미 단위로 축약했다
(예: `formula_payment_schedules` → `PaymentSchedule`). 모든 Model은
`@@map("실제_테이블명")`으로 원본에 정확히 연결되므로, 이름 축약이
DB 매핑에 영향을 주지 않는다.

---

# 2. Enum 후보 — 10개

| # | PostgreSQL ENUM | Prisma Enum 후보명 | 값 (정확히 일치, 추가/축소 없음) |
|---|---|---|---|
| 1 | `trade_type` | `TradeType` | `DOMESTIC`, `IMPORT`, `EXPORT`, `MIXED` |
| 2 | `role_group` | `RoleGroup` | `SUPPLIER`, `BUYER`, `CARRIER`, `FINANCIAL`, `OTHER` |
| 3 | `nature_group` | `NatureGroup` | `MANUFACTURER`, `DISTRIBUTOR`, `LOGISTICS`, `FINANCIAL_INSTITUTION`, `OTHER` |
| 4 | `payment_group` | `PaymentGroup` | `PREPAYMENT`, `CREDIT`, `POST_SETTLEMENT`, `INSTALLMENT`, `PARTIAL`, `OTHER` |
| 5 | `payment_direction` | `PaymentDirection` | `IN`, `OUT` |
| 6 | `payment_status` | `PaymentStatus` | `PENDING`, `PARTIAL`, `COMPLETED`, `CANCELED` |
| 7 | `logistics_cost_type` | `LogisticsCostType` | `INCLUDED_IN_BUY_PRICE`, `INCLUDED_IN_SELL_PRICE`, `SEPARATE_COST` |
| 8 | `invoice_status` | `InvoiceStatus` | `NOT_ISSUED`, `ISSUED`, `RECEIVED`, `AMOUNT_MATCHED`, `AMOUNT_MISMATCHED`, `CANCELED`, `REVISION_REQUIRED` |
| 9 | `trade_status` | `TradeStatus` | `DRAFT`, `IN_PROGRESS`, `COMPLETED`, `CANCELED` |
| 10 | `status_target` | `StatusTarget` | `TRADE_STATUS`, `DELIVERY_STATUS`, `CASH_IN_STATUS`, `CASH_OUT_STATUS`, `INVOICE_STATUS`, `LOGISTICS_STATUS` |

**중요 — `trade_status`가 3곳에 재사용됨**: `formulas.trade_status`,
`formulas.delivery_status`, `formulas.logistics_status` 3개 컬럼이
모두 `trade_status` ENUM 하나를 공유한다(별도 ENUM이 아님). Prisma
`enum TradeStatus`도 동일하게 3개 필드에서 재사용한다.

**`payment_status`도 2곳에 재사용됨**: `formulas.cash_in_status`,
`formulas.cash_out_status`가 동일 ENUM을 공유한다(`formula_payment_schedules.status`,
`formula_payment_records.status`, `formula_logistics_vehicles.settlement_status`도
같은 ENUM).

이 재사용 구조를 Prisma `enum` 선언에서도 그대로 유지한다 — 컬럼별로
별도 enum을 새로 만들지 않는다.

---

# 3. Model별 필드 매핑 설계

각 표는 `PostgreSQL 컬럼 → Prisma 필드명(camelCase) → 타입/속성`
순으로 정리한다. `@map`은 모든 필드에 적용하되, 표에서는 컬럼명이
필드명과 1:1 변환(snake_case→camelCase) 관계임을 전제로 생략 표기한
경우도 `@map` 자체는 반드시 코드에 명시한다.

## 3.1 Company (`companies`)

| 컬럼 | 필드 | 타입/속성 |
|---|---|---|
| id | id | `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| company_name | companyName | `String` |
| business_reg_no | businessRegNo | `String? @unique` |
| representative_name | representativeName | `String?` |
| main_phone | mainPhone | `String?` |
| hq_address | hqAddress | `String?` |
| is_active | isActive | `Boolean @default(true)` |
| memo | memo | `String?` |
| created_at | createdAt | `DateTime @default(now())` |
| updated_at | updatedAt | `DateTime @updatedAt` |

관계: `CompanyContact[]`, `FormulaParticipant[]`(역할 무관, 단순 참여
이력), `PaymentSchedule[]`(counterparty), `PaymentRecord[]`(counterparty),
`Logistics[]`(4개 역할 — 4.2절 참조), `Invoice[]`(issuer/receiver — 별도
관계명 필요), `Share[]`(target).

## 3.2 CompanyContact (`company_contacts`)

| 컬럼 | 필드 | 타입/속성 |
|---|---|---|
| id | id | `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| company_id | companyId | `String @db.Uuid` |
| contact_name | contactName | `String` |
| title | title | `String?` |
| phone | phone | `String?` |
| email | email | `String?` |
| branch_address | branchAddress | `String?` |
| is_primary | isPrimary | `Boolean @default(false)` |
| is_active | isActive | `Boolean @default(true)` |
| memo | memo | `String?` |
| created_at / updated_at | createdAt / updatedAt | 동일 패턴 |

관계: `Company` (N:1, `onDelete: Cascade` — PostgreSQL `ON DELETE
CASCADE`와 일치시켜야 함).

## 3.3 Item (`items`)

| 컬럼 | 필드 | 타입/속성 |
|---|---|---|
| id | id | `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| item_code | itemCode | `String? @unique` |
| item_name | itemName | `String` |
| default_unit | defaultUnit | `String?` |
| category | category | `String?` |
| is_active | isActive | `Boolean @default(true)` |
| memo | memo | `String?` |

관계: `Formula[]`.

## 3.4 Formula (`formulas`) — 가장 복잡한 Model

| 컬럼 | 필드 | 타입/속성 | 비고 |
|---|---|---|---|
| id | id | `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` | |
| formula_no | formulaNo | `String @unique @default(dbgenerated("generate_formula_no()"))` | **8장 dbgenerated 대상 1** |
| trade_type | tradeType | `TradeType` | |
| item_id | itemId | `String @db.Uuid` | |
| unit | unit | `String?` | |
| quantity | quantity | `Decimal @db.Decimal(18,4)` | |
| base_currency | baseCurrency | `String @default("KRW")` | |
| foreign_currency | foreignCurrency | `String?` | |
| departure_country | departureCountry | `String?` | |
| arrival_country | arrivalCountry | `String?` | |
| contract_exchange_rate | contractExchangeRate | `Decimal? @db.Decimal(18,6)` | |
| adjusted_exchange_rate | adjustedExchangeRate | `Decimal? @db.Decimal(18,6)` | |
| exchange_rate_change_reason | exchangeRateChangeReason | `String?` | |
| content | content | `String?` | |
| note | note | `String?` | |
| trade_status | tradeStatus | `TradeStatus @default(DRAFT)` | |
| delivery_status | deliveryStatus | `TradeStatus @default(DRAFT)` | 동일 enum 재사용 |
| cash_in_status | cashInStatus | `PaymentStatus @default(PENDING)` | |
| cash_out_status | cashOutStatus | `PaymentStatus @default(PENDING)` | |
| invoice_status | invoiceStatus | `InvoiceStatus @default(NOT_ISSUED)` | |
| logistics_status | logisticsStatus | `TradeStatus @default(DRAFT)` | |
| is_closed | isClosed | `Boolean @default(false)` | |
| closed_at | closedAt | `DateTime?` | |
| created_by | createdBy | `String?` | |
| created_at / updated_at | createdAt / updatedAt | 동일 패턴 | |

관계: `Item`(N:1), `FormulaParticipant[]`, `PaymentSchedule[]`,
`PaymentRecord[]`, `Logistics[]`, `Invoice[]`, `Share[]`,
`FormulaVersion[]`, `CalculationSnapshot[]`, `StatusLog[]`.

**제외 컬럼**: 없음(이 테이블 자체에는 GENERATED 컬럼이 없다 —
GENERATED는 `formula_participants`, `formula_invoices`에 있음).

**CHECK 존재 사실만 주석 표기 (7장 참조)**: `chk_closed_at_consistency`,
`chk_domestic_no_exchange`, `chk_closed_requires_all_completed`.

## 3.5 FormulaParticipant (`formula_participants`)

| 컬럼 | 필드 | 타입/속성 | 비고 |
|---|---|---|---|
| id | id | `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` | |
| formula_id | formulaId | `String @db.Uuid` | |
| company_id | companyId | `String @db.Uuid` | |
| sequence_order | sequenceOrder | `Int @db.SmallInt` | `chk_sequence_order_positive` 존재 (Prisma 미표현) |
| role_group | roleGroup | `RoleGroup` | |
| nature_group | natureGroup | `NatureGroup?` | |
| payment_group | paymentGroup | `PaymentGroup?` | |
| buy_unit_price | buyUnitPrice | `Decimal @default(0) @db.Decimal(18,4)` | |
| sell_unit_price | sellUnitPrice | `Decimal @default(0) @db.Decimal(18,4)` | |
| quantity | quantity | `Decimal @db.Decimal(18,4)` | NOT NULL 확정(Round 7) |
| ~~total_buy_amount~~ | — | **모델에서 제외** | GENERATED 컬럼 (6장) |
| ~~total_sell_amount~~ | — | **모델에서 제외** | GENERATED 컬럼 (6장) |
| direct_cost_amount | directCostAmount | `Decimal @default(0) @db.Decimal(18,2)` | |
| is_start_point | isStartPoint | `Boolean @default(false)` | Partial Unique Index 존재 (7장) |
| is_end_point | isEndPoint | `Boolean @default(false)` | Partial Unique Index 존재 (7장) |
| memo | memo | `String?` | |

관계: `Formula`(N:1), `Company`(N:1), `PaymentSchedule[]`,
`PaymentRecord[]`, `Share[]`, `Invoice[]`(issuer/receiver 양방향).

**복합 UNIQUE (Prisma 표현 가능)**: `@@unique([formulaId, sequenceOrder])`,
`@@unique([id, formulaId], name: "uq_fp_id_formula")` — 이 둘은 단일
테이블 내 복합 UNIQUE이므로 Prisma가 표현 가능하다(7개 복합 FK와는
다른 범주임에 주의).

## 3.6 PaymentSchedule (`formula_payment_schedules`)

| 컬럼 | 필드 | 타입/속성 |
|---|---|---|
| id | id | `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| formula_id | formulaId | `String @db.Uuid` |
| participant_id | participantId | `String? @db.Uuid` |
| direction | direction | `PaymentDirection` |
| payment_type | paymentType | `PaymentGroup @default(OTHER)` |
| counterparty_company_id | counterpartyCompanyId | `String? @db.Uuid` |
| scheduled_amount | scheduledAmount | `Decimal @db.Decimal(18,2)` |
| scheduled_date | scheduledDate | `DateTime? @db.Date` |
| status | status | `PaymentStatus @default(PENDING)` |
| memo | memo | `String?` |

관계: `Formula`(N:1), `FormulaParticipant`(N:1, nullable),
`Company`(N:1, nullable, counterparty), `PaymentRecord[]`.

**복합 UNIQUE**: `@@unique([id, formulaId], name: "uq_fps_id_formula")`.

## 3.7 PaymentRecord (`formula_payment_records`)

| 컬럼 | 필드 | 타입/속성 |
|---|---|---|
| id | id | `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| formula_id | formulaId | `String @db.Uuid` |
| payment_schedule_id | paymentScheduleId | `String? @db.Uuid` |
| participant_id | participantId | `String? @db.Uuid` |
| direction | direction | `PaymentDirection` |
| counterparty_company_id | counterpartyCompanyId | `String? @db.Uuid` |
| actual_amount | actualAmount | `Decimal @db.Decimal(18,2)` |
| actual_date | actualDate | `DateTime @db.Date` |
| bank_name | bankName | `String?` |
| account_name | accountName | `String?` |
| account_no | accountNo | `String?` |
| bank_account_memo | bankAccountMemo | `String?` |
| confirmed_by | confirmedBy | `String?` |
| confirmed_at | confirmedAt | `DateTime?` |
| status | status | `PaymentStatus @default(PENDING)` |
| is_canceled | isCanceled | `Boolean @default(false)` |
| canceled_at | canceledAt | `DateTime?` |
| cancel_reason | cancelReason | `String?` |
| memo | memo | `String?` |

관계: `Formula`(N:1), `PaymentSchedule`(N:1, nullable), `FormulaParticipant`
(N:1, nullable), `Company`(N:1, nullable, counterparty).

**Trigger 존재 사실만 주석 표기**: `trg_check_record_direction`이
`direction`/`payment_schedule_id` 관련 정합성을 강제한다(Prisma
미표현, 7장).

## 3.8 Logistics (`formula_logistics`)

| 컬럼 | 필드 | 타입/속성 |
|---|---|---|
| id | id | `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| formula_id | formulaId | `String @db.Uuid` |
| carrier_company_id | carrierCompanyId | `String @db.Uuid` |
| departure_company_id | departureCompanyId | `String? @db.Uuid` |
| arrival_company_id | arrivalCompanyId | `String? @db.Uuid` |
| cost_bearer_company_id | costBearerCompanyId | `String? @db.Uuid` |
| cost_type | costType | `LogisticsCostType @default(SEPARATE_COST)` |
| departure_location | departureLocation | `String?` |
| arrival_location | arrivalLocation | `String?` |
| item_description | itemDescription | `String?` |
| transport_quantity | transportQuantity | `Decimal? @db.Decimal(18,4)` |
| vehicle_count | vehicleCount | `Int? @db.SmallInt` |
| total_logistics_cost | totalLogisticsCost | `Decimal @default(0) @db.Decimal(18,2)` |
| scheduled_date | scheduledDate | `DateTime? @db.Date` |
| memo | memo | `String?` |

**관계 설계 — 4개의 Company FK, 각각 다른 관계명 필요**:

```
carrierCompany    Company @relation("LogisticsCarrier",    fields: [carrierCompanyId],    references: [id])
departureCompany  Company @relation("LogisticsDeparture",  fields: [departureCompanyId],  references: [id])
arrivalCompany    Company @relation("LogisticsArrival",    fields: [arrivalCompanyId],    references: [id])
costBearerCompany Company @relation("LogisticsCostBearer", fields: [costBearerCompanyId], references: [id])
```

Company 측에도 4개의 역방향 관계(`logisticsAsCarrier`,
`logisticsAsDeparture`, `logisticsAsArrival`, `logisticsAsCostBearer`)가
필요하다. 이는 Round 4에서 확정된 4주체 구조(carrier/departure/
arrival/cost_bearer)를 Prisma가 그대로 반영하는 것이며 임의 추가가
아니다.

**CHECK 존재 사실만 주석 표기**: `chk_logistics_cost_bearer`(7장).

## 3.9 LogisticsVehicle (`formula_logistics_vehicles`)

| 컬럼 | 필드 | 타입/속성 |
|---|---|---|
| id | id | `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| logistics_id | logisticsId | `String @db.Uuid` |
| vehicle_no | vehicleNo | `String?` |
| driver_name | driverName | `String?` |
| driver_phone | driverPhone | `String?` |
| vehicle_cost | vehicleCost | `Decimal? @db.Decimal(18,2)` |
| transport_status | transportStatus | `TradeStatus @default(DRAFT)` |
| settlement_status | settlementStatus | `PaymentStatus @default(PENDING)` |
| memo | memo | `String?` |

관계: `Logistics`(N:1).

## 3.10 Invoice (`formula_invoices`)

| 컬럼 (최종 상태, RENAME 반영) | 필드 | 타입/속성 | 비고 |
|---|---|---|---|
| id | id | `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` | |
| formula_id | formulaId | `String @db.Uuid` | |
| issuer_company_id | issuerCompanyId | `String @db.Uuid` | |
| receiver_company_id | receiverCompanyId | `String @db.Uuid` | |
| issuer_participant_id | issuerParticipantId | `String? @db.Uuid` | |
| receiver_participant_id | receiverParticipantId | `String? @db.Uuid` | |
| sequence_order | sequenceOrder | `Int? @db.SmallInt` | |
| invoice_no | invoiceNo | `String?` | |
| invoice_date | invoiceDate | `DateTime? @db.Date` | |
| external_invoice_amount | externalInvoiceAmount | `Decimal? @db.Decimal(18,2)` | RENAME 반영(원래 `invoice_amount`) |
| supply_amount | supplyAmount | `Decimal? @db.Decimal(18,2)` | |
| tax_amount | taxAmount | `Decimal? @db.Decimal(18,2)` | |
| ~~total_amount~~ | — | **모델에서 제외** | GENERATED 컬럼 (6장) |
| status | status | `InvoiceStatus @default(NOT_ISSUED)` | |
| amount_verified | amountVerified | `Boolean @default(false)` | Trigger가 자동 계산(7장), 모델 필드 자체는 유지(쓰기는 Trigger가 덮어씀을 주석으로 명시) |
| memo | memo | `String?` | |

**관계 설계 — Company 2개 + Participant 2개, 전부 다른 관계명 필요**:

```
issuerCompany        Company             @relation("InvoiceIssuerCompany",        fields: [issuerCompanyId],       references: [id])
receiverCompany      Company             @relation("InvoiceReceiverCompany",      fields: [receiverCompanyId],     references: [id])
issuerParticipant    FormulaParticipant? @relation("InvoiceIssuerParticipant",    fields: [issuerParticipantId],   references: [id])
receiverParticipant  FormulaParticipant? @relation("InvoiceReceiverParticipant",  fields: [receiverParticipantId], references: [id])
```

**Trigger 존재 사실만 주석 표기**: `trg_check_invoice_participant_company`,
`trg_sync_invoice_amount_verified`(둘 다 7장).

## 3.11 Share (`formula_shares`)

| 컬럼 | 필드 | 타입/속성 |
|---|---|---|
| id | id | `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| formula_id | formulaId | `String @db.Uuid` |
| participant_id | participantId | `String? @db.Uuid` |
| target_company_id | targetCompanyId | `String? @db.Uuid` |
| share_basis | shareBasis | `String @default("DIRECT")` |
| share_method | shareMethod | `String @default("DIRECT_INPUT")` |
| share_rate | shareRate | `Decimal? @db.Decimal(8,4)` |
| share_amount | shareAmount | `Decimal @default(0) @db.Decimal(18,2)` |
| memo | memo | `String?` |

관계: `Formula`(N:1), `FormulaParticipant`(N:1, nullable),
`Company`(N:1, nullable, target).

비고: `share_basis`/`share_method`는 PostgreSQL에서 `VARCHAR`(자유
문자열)이며 ENUM이 아니다. Prisma도 `String`으로 그대로 따른다 —
임의로 enum화하지 않는다(요청 범위 밖의 개선에 해당).

## 3.12 FormulaVersion (`formula_versions`)

| 컬럼 | 필드 | 타입/속성 |
|---|---|---|
| id | id | `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| formula_id | formulaId | `String @db.Uuid` |
| version_no | versionNo | `Int @db.SmallInt` |
| changed_by | changedBy | `String?` |
| change_reason | changeReason | `String?` |
| snapshot | snapshot | `Json` |
| created_at | createdAt | `DateTime @default(now())` |

관계: `Formula`(N:1), `CalculationSnapshot[]`.

**복합 UNIQUE**: `@@unique([formulaId, versionNo])`(기존),
`@@unique([id, formulaId], name: "uq_fv_id_formula")`(복합 FK 지원용).

**비고 — version_no는 자동 증가 아님**: `version_no`에는 Sequence나
DEFAULT가 없다(API_SPEC_v1.1 핵심 정책 8). Prisma 필드에도 `@default`를
부여하지 않는다 — Service Layer가 `MAX(version_no)+1`을 계산해 명시적
으로 채워야 한다.

## 3.13 CalculationSnapshot (`formula_calculation_snapshots`)

| 컬럼 | 필드 | 타입/속성 |
|---|---|---|
| id | id | `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| formula_id | formulaId | `String @db.Uuid` |
| formula_version_id | formulaVersionId | `String? @db.Uuid` |
| quantity | quantity | `Decimal @db.Decimal(18,4)` |
| total_buy_amount | totalBuyAmount | `Decimal @db.Decimal(18,2)` |
| total_sell_amount | totalSellAmount | `Decimal @db.Decimal(18,2)` |
| total_cost | totalCost | `Decimal @default(0) @db.Decimal(18,2)` |
| total_share | totalShare | `Decimal @default(0) @db.Decimal(18,2)` |
| net_profit | netProfit | `Decimal @db.Decimal(18,2)` |
| profit_rate | profitRate | `Decimal? @db.Decimal(8,4)` |
| exchange_rate_used | exchangeRateUsed | `Decimal? @db.Decimal(18,6)` |
| snapshot_data | snapshotData | `Json` |
| created_at | createdAt | `DateTime @default(now())` |

관계: `Formula`(N:1), `FormulaVersion`(N:1, nullable).

**주의 — 이 테이블의 `total_buy_amount`/`total_sell_amount`/`total_share`는
GENERATED 컬럼이 아니다**: `formula_participants`의 동일 이름 컬럼과
혼동하지 않는다. 여기는 일반 컬럼(API가 직접 계산해 INSERT)이므로
모델에서 제외하지 않는다.

## 3.14 StatusLog (`formula_status_logs`)

| 컬럼 | 필드 | 타입/속성 |
|---|---|---|
| id | id | `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| formula_id | formulaId | `String @db.Uuid` |
| status_target | statusTarget | `StatusTarget` |
| prev_status | prevStatus | `String?` |
| new_status | newStatus | `String` |
| changed_by | changedBy | `String?` |
| change_reason | changeReason | `String?` |
| created_at | createdAt | `DateTime @default(now())` |

관계: `Formula`(N:1).

비고: `prev_status`/`new_status`는 `VARCHAR`(자유 문자열)이며 ENUM이
아니다(실제 상태 ENUM 6종 중 어느 것이든 텍스트로 기록되기 때문).
Prisma도 `String`으로 따른다.

## 3.15 AuditLog (`audit_logs`)

| 컬럼 | 필드 | 타입/속성 |
|---|---|---|
| id | id | `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| table_name | tableName | `String` |
| record_id | recordId | `String? @db.Uuid` |
| action | action | `String` |
| changed_by | changedBy | `String?` |
| old_data | oldData | `Json?` |
| new_data | newData | `Json?` |
| ip_address | ipAddress | `String?` |
| created_at | createdAt | `DateTime @default(now())` |

관계 없음(범용 로그 테이블, 특정 Model과 FK로 연결되지 않음 —
`record_id`는 다형적 참조이므로 Prisma `@relation`을 만들지 않는다).

---

# 4. `@@map` / `@map` 적용 기준

- **모든 Model**: `@@map("실제_PostgreSQL_테이블명")`을 예외 없이
  적용한다(1장 표 기준).
- **모든 필드**: PostgreSQL 컬럼명이 `camelCase` 변환과 다른 경우
  (즉 거의 전부) `@map("실제_컬럼명")`을 적용한다. 변환 규칙은
  `snake_case → camelCase` 1:1 대응이며, 줄임말 임의 변경(예:
  `id`를 `recordId`로 바꾸는 등)은 하지 않는다.
- **Enum 값 자체는 `@map` 불필요**: PostgreSQL ENUM 값과 Prisma enum
  값을 동일 문자열로 선언하므로 매핑이 필요 없다(2장 표의 값을 그대로
  사용).

---

# 5. 관계 필드 설계 — 다중 FK 충돌 주의 항목

같은 두 테이블 사이에 FK가 2개 이상 존재하는 경우, Prisma는 관계명
(`@relation("이름")`)을 명시하지 않으면 어떤 FK를 기준으로 관계를
구성할지 모호해진다. 아래 4곳이 이에 해당하며, 반드시 명시적
관계명을 부여해야 한다.

| 테이블 쌍 | FK 개수 | 관계명 후보 |
|---|---|---|
| `Logistics` ↔ `Company` | 4개 (carrier/departure/arrival/cost_bearer) | `LogisticsCarrier`, `LogisticsDeparture`, `LogisticsArrival`, `LogisticsCostBearer` |
| `Invoice` ↔ `Company` | 2개 (issuer/receiver) | `InvoiceIssuerCompany`, `InvoiceReceiverCompany` |
| `Invoice` ↔ `FormulaParticipant` | 2개 (issuer/receiver) | `InvoiceIssuerParticipant`, `InvoiceReceiverParticipant` |
| `PaymentSchedule`/`PaymentRecord` ↔ `Company` | 각 1개(counterparty)이나 `Company`가 `companies`로서 여러 모델과 관계를 맺으므로 역방향 관계명 충돌 주의 | `PaymentScheduleCounterparty`, `PaymentRecordCounterparty` |

`Company` Model 입장에서는 위 관계들의 역방향 필드(`logisticsAsCarrier[]`
등)도 전부 선언해야 Prisma가 양방향 관계를 정상적으로 구성한다.

---

# 6. Prisma 모델에서 제외할 컬럼 — GENERATED 3개

| 테이블 | 컬럼 | 계산식 (PostgreSQL) |
|---|---|---|
| `formula_participants` | `total_buy_amount` | `quantity * buy_unit_price` |
| `formula_participants` | `total_sell_amount` | `quantity * sell_unit_price` |
| `formula_invoices` | `total_amount` | `COALESCE(supply_amount,0) + COALESCE(tax_amount,0)` |

이 3개는 Prisma Model 필드 목록에 **포함하지 않는다**(이미
`PRISMA_MODEL_DESIGN_v1.0.md` 2.2절에서 확정한 원칙). 값이 필요한
조회는 Repository가 별도의 raw 조회 메서드로 처리한다(코드 구현은
본 문서 범위 밖).

---

# 7. Prisma에서 표현하지 않을 DB 객체 — 전체 목록

이 목록은 추측이 아니라 `tocs_base_schema.sql`/`tocs_supplement.sql`을
직접 검색해 확인한 것이다(개수 일치 재검증 완료).

## 7.1 Trigger (3개)

| Trigger | 대상 테이블 | 역할 |
|---|---|---|
| `trg_check_record_direction` | `formula_payment_records` | direction이 schedule과 일치하는지 강제 |
| `trg_check_invoice_participant_company` | `formula_invoices` | participant의 company_id 일치 강제 |
| `trg_sync_invoice_amount_verified` | `formula_invoices` | `amount_verified` 자동 계산 |

## 7.2 View (6개)

`v_formula_confirmed_kpi`, `v_participant_confirmed_kpi`,
`v_formula_profit_engine`, `v_formula_invoice_status`,
`v_payment_unmatched`, `v_formula_closeable`
(9장에서 `$queryRaw` 대상으로 별도 정리)

## 7.3 Partial Index (9개)

| Index | 대상 | 조건 |
|---|---|---|
| `uq_fp_one_start_point` | `formula_participants` | `WHERE is_start_point = TRUE` (Partial Unique) |
| `uq_fp_one_end_point` | `formula_participants` | `WHERE is_end_point = TRUE` (Partial Unique) |
| `idx_companies_reg_no` | `companies` | `WHERE business_reg_no IS NOT NULL` |
| `idx_fpr_account_no` | `formula_payment_records` | `WHERE account_no IS NOT NULL` |
| `idx_fl_departure` | `formula_logistics` | `WHERE departure_company_id IS NOT NULL` |
| `idx_fl_arrival` | `formula_logistics` | `WHERE arrival_company_id IS NOT NULL` |
| `idx_fl_cost_bearer` | `formula_logistics` | `WHERE cost_bearer_company_id IS NOT NULL` |
| `idx_fi_issuer_participant` | `formula_invoices` | `WHERE issuer_participant_id IS NOT NULL` |
| `idx_fi_receiver_participant` | `formula_invoices` | `WHERE receiver_participant_id IS NOT NULL` |

Prisma `@@index`는 조건부(`WHERE`) 절을 지원하지 않으므로 전부
SQL 파일 전담이다.

## 7.4 CHECK Constraint (10개)

`chk_closed_at_consistency`, `chk_domestic_no_exchange`,
`chk_scheduled_amount_positive`, `chk_actual_amount_positive`,
`chk_cancel_consistency`, `chk_confirmed_consistency`,
`chk_issuer_receiver_different`, `chk_closed_requires_all_completed`,
`chk_sequence_order_positive`, `chk_logistics_cost_bearer`

## 7.5 복합 FK MATCH SIMPLE (7개)

`fk_schedule_participant_formula`, `fk_record_schedule_formula`,
`fk_record_participant_formula`, `fk_share_participant_formula`,
`fk_snapshot_version_formula`, `fk_invoice_issuer_participant_formula`,
`fk_invoice_receiver_participant_formula`

이 7개는 "참조하는 row가 동일 `formula_id`에 속하는지"까지 강제하는
복합 조건이며, Prisma `@relation`은 단일 컬럼 FK만 표현 가능하므로
Prisma 모델에는 단일 컬럼 FK로만 나타난다. 실제 정합성 강제는
PostgreSQL이 전담한다.

---

# 8. `dbgenerated()`가 필요한 필드

| Model | 필드 | dbgenerated 대상 함수/표현식 | 비고 |
|---|---|---|---|
| 전 Model | `id` | `gen_random_uuid()` | 15개 테이블 공통 |
| `Formula` | `formulaNo` | `generate_formula_no()` | 직접 지정 금지 |

**일반화 — 전 Model의 `id` 필드**: 15개 테이블 전부 `id UUID PRIMARY
KEY DEFAULT gen_random_uuid()` 패턴을 공유한다. 따라서 모든 Model의
`id` 필드는 `@default(dbgenerated("gen_random_uuid()"))`를 사용한다
(Prisma 표준 `@default(uuid())`는 Prisma 자체 UUID 생성 함수를
호출하는 것이라 PostgreSQL의 `gen_random_uuid()`와 다른 함수이므로
사용하지 않는다 — DB가 생성하는 것을 Prisma가 그대로 신뢰해야 함을
재확인).

`version_no`는 **dbgenerated 대상이 아니다**(3.12절 — 자동 생성
메커니즘이 DB에 없으므로 Prisma도 기본값을 부여하지 않는다. 이 점이
`formula_no`와 정확히 대조되는 지점이며 혼동하지 않아야 한다).

---

# 9. Repository에서 `$queryRaw`로 조회할 View 목록

| View | 조회 책임 모듈 | 비고 |
|---|---|---|
| `v_formula_confirmed_kpi` | Dashboard (9.1, 9.3) | |
| `v_participant_confirmed_kpi` | Dashboard (9.4) | |
| `v_formula_profit_engine` | Dashboard (9.2), Version (7.4) | `version_no DESC` 기준 최신 snapshot(v1.6.2 patch 반영 상태) |
| `v_formula_invoice_status` | Invoice (4.2, 4.3 동기화) | |
| `v_payment_unmatched` | Payment (3.4 보조) | |
| `v_formula_closeable` | Cancel/Close (8.2 선검증) | |

(이 표는 `PRISMA_MODEL_DESIGN_v1.0.md` 3.3절과 동일 — 청사진 완결성을
위해 본 문서에도 재기재함. 실제 코드 구현은 두 문서 모두의 범위
밖이다.)

---

# 10. `schema.prisma` 작성 전 위험 요소 점검

아래 7개 항목은 설계 시점에 식별된 위험 요소이며, 동시에
`schema.prisma` 작성 직전 반드시 확인해야 하는 **필수 체크리스트**다.
삭제·축소하지 않고 그대로 유지한다.

```
[ ] 10.1 관계명 누락 위험 — Logistics/Invoice 다중 FK 4곳
[ ] 10.2 GENERATED 컬럼 누락 시도 위험 — 3개 컬럼이 모델에 없는지
[ ] 10.3 version_no @default 오용 위험 — @default 미부여 확인
[ ] 10.4 Decimal 정밀도(@db.Decimal(p,s)) 누락 위험 — 전체 NUMERIC 컬럼 대조
[ ] 10.5 ON DELETE CASCADE 일치 위험 — 전체 FK onDelete 옵션 대조
[ ] 10.6 ENUM 값 추가/변경 시 동기화 순서 — PostgreSQL 선행, Prisma 후행
[ ] 10.7 Prisma Migrate 미사용 원칙 — generate만 사용, migrate dev/deploy 금지
```

## 10.1 관계명 누락 위험 (5장 직결)

`Logistics`↔`Company` 4개 FK, `Invoice`↔`Company` 2개 FK,
`Invoice`↔`FormulaParticipant` 2개 FK를 관계명 없이 작성하면 Prisma
가 "Ambiguous relation" 에러로 generate 자체를 거부한다. **이 4곳은
schema.prisma 작성 시 1순위로 점검해야 한다.**

## 10.2 GENERATED 컬럼 누락 시도 위험

`formula_participants.total_buy_amount` 등을 실수로 모델 필드에
추가하고 Prisma Client로 쓰기를 시도하면, PostgreSQL이 즉시 에러를
던진다(GENERATED 컬럼은 쓰기 불가). 코드 리뷰 시 "GENERATED 3개가
모델에 없는지"를 체크리스트 항목으로 둘 필요가 있다.

## 10.3 `version_no`에 실수로 `@default` 부여 위험

`formula_no`와 패턴이 유사해 보여 `version_no`에도 `@default`를
주는 실수가 발생하기 쉽다. 8장에서 명시했듯 `version_no`는 DB
Sequence가 없으므로 `@default`를 절대 부여하지 않는다 — 부여하면
오히려 Prisma가 매번 동일하거나 NULL인 값을 시도해 `UNIQUE(formula_id,
version_no)` 위반을 유발할 수 있다.

## 10.4 `Decimal` 정밀도(`@db.Decimal(p,s)`) 누락 위험

모든 `NUMERIC(p,s)` 컬럼에 `@db.Decimal(p,s)`를 정확히 일치시켜야
한다. 누락 시 Prisma가 기본 정밀도를 추정하면서 실제 컬럼과 다른
스케일로 라운딩하는 값을 보낼 위험이 있다(예: `share_rate
NUMERIC(8,4)`를 `@db.Decimal(10,2)`로 잘못 선언하면 정률 셰어 계산이
미묘하게 틀어질 수 있음).

## 10.5 `ON DELETE CASCADE` 일치 위험

`company_contacts.company_id`, `formula_participants.formula_id` 등
일부 FK는 PostgreSQL에서 `ON DELETE CASCADE`가 명시되어 있다. Prisma
관계 선언 시 `onDelete: Cascade`를 빠뜨리면 Prisma Client의 타입
힌트와 실제 DB 동작이 어긋나(타입은 "삭제 막힘"을 암시하지만 실제로는
연쇄 삭제됨) 개발자가 오해할 수 있다. 전체 FK를 순회하며 `ON DELETE`
옵션 일치 여부를 점검해야 한다.

## 10.6 ENUM 값 추가/변경 시 동기화 순서

PostgreSQL ENUM이 먼저 변경되고 Prisma `enum`이 뒤따라야 한다(2장).
이 순서가 거꾸로 되면("Prisma enum을 먼저 바꾸고 generate 후 DB에는
반영 안 됨") 런타임에 "invalid input value for enum" 에러가
발생한다. 이는 코드 구현 단계의 운영 절차 문제이므로 본 문서는
위험 존재 사실만 기록한다.

## 10.7 Prisma Migrate 미사용 원칙의 지속적 준수

`PRISMA_MODEL_DESIGN_v1.0.md` 5장에서 확정한 "Prisma Migrate
사용 금지" 원칙이 schema.prisma 작성 단계에서도 동일하게 적용되어야
한다. `prisma generate`만 사용하고, `prisma db pull`로 실제 DB를
역추출해 schema.prisma를 검증하는 방식은 권장되나(읽기 전용이므로
Source of Truth를 침해하지 않음), `migrate dev/deploy`는 여전히
사용하지 않는다.

---

# 11. 본 문서의 범위 밖

실제 `schema.prisma` 파일 작성, `prisma generate` 실행, Repository/
Service 코드 구현은 이 청사진이 승인된 이후의 별도 작업이며 본 문서
범위에 포함되지 않는다.
