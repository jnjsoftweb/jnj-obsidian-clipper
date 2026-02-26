/**
 * 사용자 메시지 판별 방법 (4가지 유니온 타입)
 *
 * - attr:            속성값 매칭         ChatGPT, Claude
 * - tag:             태그명 매칭         Gemini
 * - containerSelector: 컨테이너 클래스   Google AI Studio
 * - htmlMatch:       HTML 문자열 매칭    Genspark
 */
export type UserAttribute =
	| { attr: string; value: string }
	| { tag: string }
	| { containerSelector: string; userClass: string[]; aiClass: string[] }
	| { htmlMatch: string[] };

/**
 * AI chat 사이트별 DOM 추출 설정
 */
export interface SiteConfig {
	/** URL 매칭용 hostname (예: "chatgpt.com") */
	hostname: string;
	/** 메시지 요소 CSS 셀렉터 */
	messageSelector: string;
	/** 사용자 메시지 판별 방법 */
	userAttribute: UserAttribute;
	/** 실제 내용 영역 셀렉터 (없으면 messageSelector 요소 전체 사용) */
	contentSelector?: string;
	/** 제거할 UI 요소 셀렉터 (버튼, 아이콘 등) */
	ignoreSelector?: string;
	/** 중복 메시지 제거 여부 (Genspark 등) */
	deduplicate?: boolean;
	/** 가상 스크롤 대응 여부 (Google AI Studio) */
	scrollToLoad?: boolean;
	/** AI 모델명을 추출할 CSS 셀렉터 (없으면 template.authorLabel 사용) */
	modelSelector?: string;
}

/**
 * AI chat 대화 출력 형식
 */
export interface ChatFormat {
	/** 사용자 메시지 헤딩 (예: "### 👤 사용자 (User)") */
	userTitleFormat: string;
	/** AI 메시지 헤딩 (예: "### 🤖 ChatGPT") */
	aiTitleFormat: string;
	/** Q&A 내부 구분자 — 사용자→AI 사이 (예: "---") */
	turnSeparator: string;
	/** Q&A 세트 구분자 — AI→다음 사용자 사이 (예: "---") */
	qaSeparator: string;
}
