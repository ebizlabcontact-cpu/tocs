/**
 * TOCS Korean UI copy — same key structure as `en.ts`.
 * Product Owner edits Korean values here; keys are code-owned in `en.ts`.
 */
import type { LocaleDictionaryShape } from "@/lib/i18n"

export const ko = {
  common: {
    actions: {
      signIn: "로그인",
      signOut: "로그아웃",
    },
    badges: {
      preview: "미리보기",
    },
  },
  auth: {
    login: {
      title: "TOCS 로그인",
      subtitle: "미리보기 인증 — API 호출 없음",
      email: "이메일",
      password: "비밀번호",
      submit: "로그인 (미리보기)",
      submitting: "로그인 중…",
      demoTitle: "데모 계정",
    },
  },
  shell: {
    nav: {
      sectionLabel: "운영",
      dashboard: "대시보드",
      formulas: "Formula",
      items: "품목",
      companies: "회사",
      calendar: "캘린더",
      reports: "리포트",
      settings: "설정",
    },
    search: {
      placeholder: "Formula, 계산서 검색…",
      tooltip: "검색 — 추후 제공 예정 (미리보기 UI).",
    },
    notifications: {
      tooltip: "알림 — 미리보기에서 사용할 수 없습니다.",
      label: "알림",
    },
    ai: {
      tooltip: "AI 도우미 — 미리보기 셸만 제공됩니다.",
      label: "AI 도우미",
      openLabel: "AI 도우미 열기",
      title: "TOCS 도우미",
      subtitle: "업무에 대해 질문하세요",
      tryAsking: "이렇게 물어보세요",
      inputPlaceholder: "곧 제공 예정…",
      examples: {
        profitDecrease: "이번 달 이익이 왜 줄었나요?",
        unpaidFormulas: "미수금이 있는 Formula를 보여주세요.",
        topProfitCompany: "가장 높은 이익을 낸 회사는?",
        closeableThisWeek: "이번 주 종결 가능한 Formula 목록",
      },
    },
    company: {
      scopeLabel: "운영 범위",
      scopeNote:
        "운영·권한·쓰기·API 범위를 설정합니다. 운영 범위를 바꾸면 접근 가능한 Formula 집합이 달라집니다.",
    },
    dateRange: {
      last7Days: "최근 7일",
      last30Days: "최근 30일",
      thisMonth: "이번 달",
      lastMonth: "지난 달",
      thisYear: "올해",
      custom: "기간 직접 선택",
      startDate: "시작일",
      endDate: "종료일",
      apply: "기간 적용",
      note: "프로토타입 선택기 — UI 상태만 반영됩니다. 실제 기간 필터링은 연동 후 백엔드에서 처리합니다.",
    },
    formulaFirst: {
      title: "Formula 중심",
      body: "모든 수치는 Formula로 거슬러 올라갑니다 — 단일 기준 원장입니다.",
    },
  },

  dashboard: {},
  formulas: {},
  companies: {},
  items: {},
  calendar: {},
  reports: {},
  status: {},
  validation: {},
  tooltips: {},
  comingSoon: {},
} as const satisfies LocaleDictionaryShape
