/**
 * AI Chat Extractor
 *
 * ai-chat-exporter의 content.js 로직을 TypeScript로 이식한 모듈.
 * 외부 라이브러리 의존성 없음 — content.js 번들 크기를 최소화하기 위해
 * Turndown 대신 자체 DOM 파서를 사용한다.
 *
 * 실행 컨텍스트
 *   - detectUser / scrollAllTurns / extractAIChatContent : content script (DOM 접근 필요)
 *   - buildAIChatVariables                               : popup (변수 맵 조립)
 */

import { SiteConfig, ChatFormat, UserAttribute } from '../types/site-config';
import { Template } from '../types/types';

// ──────────────────────────────────────────────
// 사용자 메시지 판별
// ──────────────────────────────────────────────

/**
 * 메시지 요소가 사용자 발화인지 판별한다.
 * UserAttribute 유니온 타입의 4가지 전략을 순서대로 시도한다.
 */
export function detectUser(
	msg: Element,
	userAttr: UserAttribute,
	index: number
): boolean {
	// 전략 1: 속성값 매칭 (ChatGPT, Claude)
	if ('attr' in userAttr) {
		return msg.getAttribute(userAttr.attr) === userAttr.value;
	}

	// 전략 2: 태그명 매칭 (Gemini — user-query / model-response 커스텀 엘리먼트)
	if ('tag' in userAttr) {
		return msg.tagName.toLowerCase() === userAttr.tag.toLowerCase();
	}

	// 전략 3: 컨테이너 내부 클래스 매칭 (Google AI Studio)
	if ('containerSelector' in userAttr) {
		let isUser = index % 2 === 0;
		const container = msg.querySelector(userAttr.containerSelector);
		if (container) {
			if (userAttr.userClass.some(c => container.classList.contains(c))) isUser = true;
			if (userAttr.aiClass.some(c => container.classList.contains(c))) isUser = false;
		}
		return isUser;
	}

	// 전략 4: HTML 문자열 키워드 매칭 (Genspark)
	if ('htmlMatch' in userAttr) {
		const html = msg.outerHTML.toLowerCase();
		return userAttr.htmlMatch.some(keyword => html.includes(keyword));
	}

	// 폴백: 홀수 인덱스 = 사용자
	return index % 2 === 0;
}

// ──────────────────────────────────────────────
// 가상 스크롤 대응 (Google AI Studio)
// ──────────────────────────────────────────────

/**
 * 뷰포트 밖에 있는 메시지를 순서대로 스크롤하여 DOM 렌더링을 유도한다.
 * Google AI Studio처럼 가상 스크롤을 사용하는 사이트에서 필요하다.
 *
 * @deprecated extractAIChatContent() 내부에서 scrollAndExtract()로 대체됨.
 *             CDK Virtual Scroll 환경에서는 스크롤 후 DOM 콘텐츠가 재활용되므로
 *             이 함수 단독 사용 후 DOM을 재조회하면 빈 콘텐츠가 반환된다.
 */
export async function scrollAllTurns(messageSelector: string): Promise<void> {
	const turns = Array.from(document.querySelectorAll(messageSelector));
	for (const turn of turns) {
		turn.scrollIntoView({ behavior: 'instant', block: 'center' });
		await new Promise(r => setTimeout(r, 300));
	}
	// 렌더링 완료 후 맨 위로 복귀
	if (turns[0]) {
		turns[0].scrollIntoView({ behavior: 'instant', block: 'start' });
		await new Promise(r => setTimeout(r, 300));
	}
}

/**
 * 가상 스크롤 전용: 뷰포트 단위로 스크롤하면서 보이는 메시지를 즉시 추출한다.
 *
 * CDK Virtual Scroll은 화면 밖으로 스크롤된 요소의 DOM 콘텐츠를 재활용(recycle)하기
 * 때문에, 스크롤 완료 후 DOM을 다시 조회하면 일부 메시지가 비어 있다.
 * 이 함수는 각 뷰포트 위치에서 보이는 요소를 즉시 추출해 문제를 해결한다.
 *
 * 동작 방식:
 *   1. 맨 위에서 시작 — 뷰포트 높이만큼 단계적으로 아래로 스크롤
 *   2. 각 위치에서 현재 DOM에 렌더링된 메시지를 추출 (콘텐츠 기반 중복 제거)
 *   3. 스크롤 위치가 변하지 않으면(하단 도달) 또는 연속 빈 스크롤이 3회이면 종료
 *   4. 맨 위로 복귀
 */
async function scrollAndExtract(
	siteConfig: SiteConfig
): Promise<Array<{ isUser: boolean; content: string }>> {
	// CDK virtual scroll 컨테이너 우선 탐지, 없으면 window 사용
	const viewport = document.querySelector<HTMLElement>('cdk-virtual-scroll-viewport');

	const getScrollTop = (): number =>
		viewport ? viewport.scrollTop : window.scrollY;
	const setScrollTop = (y: number): void => {
		if (viewport) viewport.scrollTop = y;
		else window.scrollTo(0, y);
	};
	const getViewportHeight = (): number =>
		viewport ? viewport.clientHeight : window.innerHeight;

	// 맨 위로 스크롤 후 렌더링 대기
	setScrollTop(0);
	await new Promise(r => setTimeout(r, 400));

	const seenContent = new Set<string>();
	const collected: Array<{ isUser: boolean; content: string }> = [];

	let prevScrollTop = -1;
	let consecutiveEmpty = 0;
	let iterations = 0;
	const MAX_ITERATIONS = 300; // 무한 루프 방지

	while (consecutiveEmpty < 3 && iterations < MAX_ITERATIONS) {
		iterations++;
		const currentScrollTop = getScrollTop();

		// 스크롤 위치가 변하지 않으면 하단 도달로 판단
		if (currentScrollTop <= prevScrollTop && prevScrollTop !== -1) break;
		prevScrollTop = currentScrollTop;

		// 현재 뷰포트에 렌더링된 메시지 추출
		const visibleMsgs = Array.from(
			document.querySelectorAll<Element>(siteConfig.messageSelector)
		);
		let foundNew = false;

		for (const msg of visibleMsgs) {
			const contentEl = siteConfig.contentSelector
				? (msg.querySelector(siteConfig.contentSelector) ?? msg)
				: msg;
			const content = convertAIChatToMarkdown(contentEl, siteConfig.ignoreSelector);
			if (!content || seenContent.has(content)) continue;

			seenContent.add(content);
			const isUser = detectUser(msg, siteConfig.userAttribute, collected.length);
			collected.push({ isUser, content });
			foundNew = true;
		}

		if (foundNew) consecutiveEmpty = 0;
		else consecutiveEmpty++;

		// 다음 뷰포트 위치로 스크롤
		setScrollTop(currentScrollTop + getViewportHeight());
		await new Promise(r => setTimeout(r, 300));
	}

	// 맨 위로 복귀
	setScrollTop(0);
	await new Promise(r => setTimeout(r, 200));

	return collected;
}

// ──────────────────────────────────────────────
// DOM → 마크다운 변환 (자체 파서)
// ──────────────────────────────────────────────

/**
 * AI chat 메시지 DOM 요소를 마크다운 문자열로 변환한다.
 *
 * 처리 순서:
 *   1. 불필요한 UI 요소 제거 (버튼, SVG 등)
 *   2. <pre> 코드 블록 처리 — 언어 감지 포함
 *   3. 재귀적 DOM 순회로 태그를 마크다운 문법으로 번역
 *   4. 연속 줄바꿈 정리
 */
export function convertAIChatToMarkdown(
	element: Element,
	ignoreSelector?: string
): string {
	const clone = element.cloneNode(true) as Element;

	// 1. 불필요한 UI 요소 제거
	const selector = ignoreSelector ?? "button, svg, img, [aria-hidden='true'], .sr-only";
	clone.querySelectorAll(selector).forEach(el => el.remove());

	// 2. <pre> 코드 블록 처리
	clone.querySelectorAll('pre').forEach(pre => {
		const { lang, text } = extractCodeBlock(pre);
		const mdCode = `\n\n\`\`\`${lang}\n${text.replace(/\n$/, '')}\n\`\`\`\n\n`;

		// pre를 감싸는 wrapper를 찾아 통째로 교체 (ChatGPT의 툴바 포함 div 제거 목적)
		let wrapper: Element = pre;
		while (wrapper.parentElement && wrapper.parentElement !== clone) {
			const parentLen = wrapper.parentElement.textContent?.trim().length ?? 0;
			const preLen = pre.textContent?.trim().length ?? 0;
			if (parentLen <= preLen + 50) {
				wrapper = wrapper.parentElement;
			} else {
				break;
			}
		}

		const placeholder = document.createElement('div');
		placeholder.className = 'processed-code-block';
		placeholder.textContent = mdCode;
		wrapper.replaceWith(placeholder);
	});

	// 3. DOM → 마크다운
	let markdown = parseDOMToMarkdown(clone);

	// 4. 연속 줄바꿈 정리
	return markdown.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * <pre> 요소에서 언어명과 코드 텍스트를 추출한다.
 *
 * 언어 감지 우선순위:
 *   1. <code class="language-*"> 클래스
 *   2. pre 내부 헤더 텍스트 (ChatGPT — 코드 앞 "bash", "python" 등)
 *   3. .code-block-decoration > span (Gemini)
 */
function extractCodeBlock(pre: Element): { lang: string; text: string } {
	const codeTag = pre.querySelector('code');
	const cmContent = pre.querySelector('.cm-content, [class*="cm-content"]');

	// 코드 텍스트 결정
	let text: string;
	if (codeTag) {
		text = codeTag.textContent ?? '';
	} else if (cmContent) {
		text = cmContent.textContent ?? '';
	} else {
		text = pre.textContent ?? '';
	}

	// 언어 감지 1: <code> 태그 className
	let lang = '';
	if (codeTag?.className) {
		const m = codeTag.className.match(/language-(\w+)/);
		if (m) lang = m[1];
	}

	// 언어 감지 2: pre 내부 헤더 텍스트 (ChatGPT 패턴)
	if (!lang) {
		const fullText = pre.textContent?.trim() ?? '';
		const codeOnly = text.trim();
		const idx = fullText.indexOf(codeOnly);
		if (idx > 0) {
			const header = fullText.slice(0, idx).trim();
			if (header && /^[a-zA-Z0-9_+#.-]+$/.test(header) && header.length <= 20) {
				lang = header.toLowerCase();
			}
		}
	}

	// 언어 감지 3: .code-block-decoration > span (Gemini 패턴)
	if (!lang) {
		const codeBlockEl = pre.closest('code-block') ?? pre.closest('.code-block');
		if (codeBlockEl) {
			const decoration = codeBlockEl.querySelector('.code-block-decoration > span');
			if (decoration) {
				const langText = decoration.textContent?.trim() ?? '';
				if (langText && /^[a-zA-Z0-9_+#. -]+$/i.test(langText) && langText.length <= 20) {
					lang = langText.toLowerCase();
				}
			}
		}
	}

	return { lang, text };
}

/**
 * 재귀적 DOM 순회 — 노드를 마크다운 문법으로 1:1 번역한다.
 */
function parseDOMToMarkdown(node: Node): string {
	if (node.nodeType === Node.TEXT_NODE) {
		return node.textContent ?? '';
	}
	if (node.nodeType !== Node.ELEMENT_NODE) return '';

	const el = node as Element;

	// 코드 블록 플레이스홀더는 그대로 반환
	if (el.className === 'processed-code-block') {
		return el.textContent ?? '';
	}

	const tag = el.tagName.toLowerCase();

	if (tag === 'table') {
		return convertTableToMarkdown(el);
	}

	// 자식 노드 재귀 처리
	let children = '';
	for (const child of Array.from(el.childNodes)) {
		children += parseDOMToMarkdown(child);
	}

	switch (tag) {
		case 'h1': return `\n# ${children.trim()}\n\n`;
		case 'h2': return `\n## ${children.trim()}\n\n`;
		case 'h3': return `\n### ${children.trim()}\n\n`;
		case 'h4': return `\n#### ${children.trim()}\n\n`;
		case 'h5': return `\n##### ${children.trim()}\n\n`;
		case 'h6': return `\n###### ${children.trim()}\n\n`;
		case 'p':  return children.trim() ? `\n${children.trim()}\n\n` : '';
		case 'strong':
		case 'b':  return `**${children}**`;
		case 'em':
		case 'i':  return `*${children}*`;
		case 'code': return `\`${children}\``;
		case 'li': return `\n- ${children.trim()}`;
		case 'ul':
		case 'ol': return `\n${children}\n`;
		case 'a':  return `[${children}](${el.getAttribute('href') ?? ''})`;
		case 'br': return '\n';
		case 'hr': return '\n---\n';
		case 'blockquote':
			return children.split('\n').map(l => `> ${l}`).join('\n');
		default:
			return children;
	}
}

/**
 * <table> 요소를 마크다운 테이블로 변환한다.
 */
function convertTableToMarkdown(table: Element): string {
	let md = '\n\n';
	table.querySelectorAll('tr').forEach((row, rowIndex) => {
		const cells = Array.from(row.querySelectorAll('th, td'));
		const texts = cells.map(c => c.textContent?.trim() ?? '');
		md += `| ${texts.join(' | ')} |\n`;
		if (rowIndex === 0) {
			md += `| ${texts.map(() => '---').join(' | ')} |\n`;
		}
	});
	return md + '\n';
}

// ──────────────────────────────────────────────
// 대화 추출 오케스트레이션 (content script 전용)
// ──────────────────────────────────────────────

/**
 * 현재 페이지에서 AI 대화 전체를 마크다운으로 추출한다.
 * content script 컨텍스트에서만 호출해야 한다 (document 접근 필요).
 *
 * @returns markdown — 조립된 대화 마크다운
 * @returns messageCount — 실제 추출된 메시지 수
 */
export async function extractAIChatContent(
	siteConfig: SiteConfig,
	chatFormat: ChatFormat
): Promise<{ markdown: string; messageCount: number }> {
	let collected: Array<{ isUser: boolean; content: string }>;

	if (siteConfig.scrollToLoad) {
		// 가상 스크롤(AI Studio): 뷰포트 단위로 스크롤하며 즉시 추출
		// scrollAllTurns() 후 DOM 재조회 방식은 CDK Virtual Scroll에서
		// 스크롤 후 콘텐츠가 재활용(recycle)되어 빈 결과를 반환하므로 사용하지 않는다.
		collected = await scrollAndExtract(siteConfig);
	} else {
		// 일반 사이트: DOM 전체를 한 번에 조회 후 추출
		const seenTexts = siteConfig.deduplicate ? new Set<string>() : null;
		collected = [];

		const messageEls = Array.from(document.querySelectorAll(siteConfig.messageSelector));
		messageEls.forEach((msg, index) => {
			const isUser = detectUser(msg, siteConfig.userAttribute, index);

			// contentSelector가 있으면 해당 하위 요소만, 없으면 메시지 전체
			const contentEl = siteConfig.contentSelector
				? (msg.querySelector(siteConfig.contentSelector) ?? msg)
				: msg;

			const content = convertAIChatToMarkdown(contentEl, siteConfig.ignoreSelector);
			if (!content) return;

			// 중복 제거
			if (seenTexts) {
				if (seenTexts.has(content)) return;
				seenTexts.add(content);
			}

			collected.push({ isUser, content });
		});
	}

	// 메시지가 없으면 빈 markdown 반환
	if (collected.length === 0) {
		return { markdown: '', messageCount: 0 };
	}

	// 수집된 메시지로 마크다운 조립
	let prevIsUser: boolean | null = null;
	let body = '';

	for (const { isUser, content } of collected) {
		if (prevIsUser !== null) {
			// 사용자 → AI: turnSeparator (같은 Q&A 쌍 내부)
			// AI → 사용자: qaSeparator (새 Q&A 세트 시작)
			const sep = prevIsUser && !isUser ? chatFormat.turnSeparator : chatFormat.qaSeparator;
			if (sep) body += `${sep}\n\n`;
		}

		const heading = isUser ? chatFormat.userTitleFormat : chatFormat.aiTitleFormat;
		body += `${heading}\n\n${content}\n\n`;
		prevIsUser = isUser;
	}

	// 전체 조립: 제목 → 첫 구분자 → 대화 본문 → 마지막 구분자
	let md = `# ${document.title}\n\n`;
	if (chatFormat.qaSeparator) md += `${chatFormat.qaSeparator}\n\n`;
	md += body;
	if (chatFormat.qaSeparator) md += `${chatFormat.qaSeparator}\n\n`;

	return { markdown: md, messageCount: collected.length };
}

// ──────────────────────────────────────────────
// 변수 맵 생성 (popup 컨텍스트)
// ──────────────────────────────────────────────

/**
 * AI chat 추출 결과를 popup의 currentVariables 맵 형식으로 변환한다.
 * content-extractor.ts의 initializePageContent() 결과와 병합하여 사용한다.
 */
export function buildAIChatVariables(
	markdown: string,
	messageCount: number,
	template: Template
): Record<string, string> {
	return {
		'{{chatContent}}':  markdown,
		'{{messageCount}}': String(messageCount),
		'{{model}}':        template.authorLabel ?? template.name,
		'{{titlePrefix}}':  template.titlePrefix ?? '',
		'{{aiLabel}}':      template.authorLabel ?? '',
		'{{siteEmoji}}':    template.emoji ?? '',
	};
}
