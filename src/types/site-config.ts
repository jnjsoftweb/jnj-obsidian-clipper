/**
 * 사용자 메시지 판별 방법 (4가지 유니온 타입) — 레거시 추출 방식 전용
 *
 * - attr:             속성값 매칭         ChatGPT, Claude
 * - tag:              태그명 매칭         Gemini
 * - containerSelector: 컨테이너 클래스   Google AI Studio
 * - htmlMatch:        HTML 문자열 매칭    Genspark
 */
export type UserAttribute =
	| { attr: string; value: string }
	| { tag: string }
	| { containerSelector: string; userClass: string[]; aiClass: string[] }
	| { htmlMatch: string[] };

// ──────────────────────────────────────────────
// QA 쌍 구조 (추출 결과 중간 표현)
// ──────────────────────────────────────────────

/**
 * 하나의 메시지 내용 — HTML 원문과 사전 변환된 마크다운을 함께 보관한다.
 * HTML은 popup에서 Turndown으로 재변환하거나 원본 검증에 활용할 수 있다.
 */
export interface MessageContent {
	/** ignoreSelector 적용 후 정리된 내부 HTML */
	html: string;
	/** 자체 파서로 변환한 마크다운 (기본 사용값) */
	markdown: string;
}

/**
 * 사용자 발화 1개 + 모델 응답 N개를 하나의 대화 단위로 묶는다.
 * 재생성(regenerate) 등으로 응답이 여러 개일 수 있으므로 model은 배열이다.
 */
export interface QAPair {
	user: MessageContent;
	model: MessageContent[];
}

/** 페이지 전체 대화 = QAPair 배열 */
export type QASession = QAPair[];

// ──────────────────────────────────────────────
// 마크다운 사후 보정 규칙
// ──────────────────────────────────────────────

/**
 * 마크다운 문자열에 적용할 정규식 치환 규칙.
 * ChatFormat.postProcessRules 배열에 순서대로 적용된다.
 *
 * @example
 * // 줄 끝 공백 제거
 * { pattern: '\\s+$', flags: 'gm', replacement: '' }
 * // 리스트 아이템 사이의 빈 줄 제거
 * { pattern: '(- [^\\n]+)\\n{2,}(?=-)', flags: 'gm', replacement: '$1\n' }
 */
export interface PostProcessRule {
	/** 정규식 패턴 문자열 (RegExp 생성자에 전달) */
	pattern: string;
	/** 정규식 플래그 (예: 'gm', 'gi') */
	flags: string;
	/** 치환 문자열 ($1, $2 등 캡처 그룹 참조 가능) */
	replacement: string;
	/** 규칙 설명 (UI 표시용, 선택 사항) */
	label?: string;
}

// ──────────────────────────────────────────────
// 구조적 DOM 추출 설정 (신규)
// ──────────────────────────────────────────────

/**
 * AI chat DOM 추출 설정 — 사용자/모델 메시지를 명시적 선택자로 분리하는 신규 방식.
 * SiteConfig.extractionConfig 에 지정하면 레거시(messageSelector + userAttribute) 대신 이 설정이 사용된다.
 *
 * 추출 순서:
 *   1. rootSelector (없으면 document 전체)에서
 *   2. userMessageSelector, modelMessageSelectors 로 각 메시지 요소를 수집
 *   3. DOM 위치 순서(compareDocumentPosition)로 정렬 → 대화 순서 보존
 *   4. ignoreSelector 로 UI 잡음 제거 후 마크다운 변환
 */
export interface ExtractionConfig {
	/**
	 * 1-1. 루트 선택자 — 추출 대상 최소 포함 영역.
	 * 지정하지 않으면 document 전체를 탐색한다.
	 */
	rootSelector?: string;

	/**
	 * 1-2. 제외 선택자 — 제거할 UI 요소 (버튼·아이콘 등).
	 * 지정하지 않으면 SiteConfig.ignoreSelector 가 폴백으로 사용된다.
	 */
	ignoreSelector?: string;

	/**
	 * 1-3. 사용자 메시지 선택자 (단일 CSS 선택자).
	 * 복수의 요소와 매칭되어도 무방하다.
	 */
	userMessageSelector: string;

	/**
	 * 1-4. 모델 메시지 선택자 목록.
	 * 복잡한 레이아웃에서 여러 선택자가 필요한 경우 배열로 지정한다.
	 * 각 선택자로 찾은 요소를 합친 후 DOM 순서로 정렬한다.
	 */
	modelMessageSelectors: string[];

	/** AI 모델명을 추출할 CSS 선택자 (없으면 template.authorLabel 폴백) */
	modelSelector?: string;

	/** 중복 메시지 제거 여부 (Genspark 등 동일 내용이 반복되는 사이트) */
	deduplicate?: boolean;
}

// ──────────────────────────────────────────────
// AI chat 사이트별 DOM 추출 설정
// ──────────────────────────────────────────────

/**
 * AI chat 사이트별 DOM 추출 설정.
 *
 * extractionConfig 가 있으면 신규 구조적 추출을 사용한다.
 * 없으면 messageSelector + userAttribute 레거시 방식으로 폴백한다.
 */
export interface SiteConfig {
	/** URL 매칭용 hostname (예: "chatgpt.com") */
	hostname: string;

	// ── 레거시 추출 필드 ────────────────────────────────────────────
	/** [레거시] 전체 메시지 CSS 선택자 */
	messageSelector?: string;
	/** [레거시] 사용자 메시지 판별 방법 */
	userAttribute?: UserAttribute;
	/** [레거시] 메시지 내 실제 콘텐츠 영역 선택자 */
	contentSelector?: string;
	/** 제거할 UI 요소 선택자 (extractionConfig.ignoreSelector 가 없을 때 폴백) */
	ignoreSelector?: string;
	/** 중복 메시지 제거 (extractionConfig.deduplicate 가 없을 때 폴백) */
	deduplicate?: boolean;
	/** 가상 스크롤 대응 여부 (Google AI Studio) */
	scrollToLoad?: boolean;
	/** [레거시] AI 모델명 추출 선택자 (extractionConfig.modelSelector 가 없을 때 폴백) */
	modelSelector?: string;

	// ── 신규 구조적 추출 ────────────────────────────────────────────
	/** 신규 구조적 추출 설정 — 지정 시 레거시 필드 무시 */
	extractionConfig?: ExtractionConfig;
}

// ──────────────────────────────────────────────
// AI chat 대화 출력 형식
// ──────────────────────────────────────────────

/**
 * AI chat 대화의 마크다운 출력 형식.
 */
export interface ChatFormat {
	/** 사용자 메시지 헤딩 (예: "> 👤 사용자 (User)") */
	userTitleFormat: string;
	/** AI 메시지 헤딩 (예: "> 🤖 ChatGPT") */
	aiTitleFormat: string;
	/** Q&A 내부 구분자 — 사용자→AI 사이 */
	turnSeparator: string;
	/** Q&A 세트 구분자 — AI→다음 사용자 사이 */
	qaSeparator: string;
	/**
	 * 마크다운 상단에 `# document.title` H1 포함 여부 (기본값: true).
	 * {{title}} 변수는 이 H1에서 추출되므로, false 로 설정하면 {{title}} 이 빈 값이 된다.
	 */
	includeTitle?: boolean;
	/**
	 * 2. 마크다운 사후 보정 규칙 목록 — 배열 순서대로 순차 적용된다.
	 */
	postProcessRules?: PostProcessRule[];
}
