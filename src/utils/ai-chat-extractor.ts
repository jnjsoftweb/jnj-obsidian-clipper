/**
 * AI Chat Extractor
 *
 * 실행 컨텍스트별 역할:
 *
 *   content script (DOM 접근):
 *     - extractAIChatContent() → QASession 추출 (html + markdown 보관)
 *
 *   popup (순수 함수):
 *     - formatQASession()      → QASession + ChatFormat → 최종 마크다운
 *     - buildAIChatVariables() → 마크다운 → {{변수}} 맵
 *
 * 분리 원칙:
 *   추출(extraction)과 포맷팅(formatting)을 분리한다.
 *   content script는 QASession(중간 표현)만 생성하고,
 *   popup이 ChatFormat 설정에 따라 마크다운을 최종 조립한다.
 */

import { SiteConfig, ChatFormat, UserAttribute, ExtractionConfig, PostProcessRule, MessageContent, QAPair, QASession } from '../types/site-config';
import { Template } from '../types/types';

// ──────────────────────────────────────────────
// 레거시: 사용자 메시지 판별
// ──────────────────────────────────────────────

export function detectUser(
	msg: Element,
	userAttr: UserAttribute,
	index: number
): boolean {
	if ('attr' in userAttr) {
		return msg.getAttribute(userAttr.attr) === userAttr.value;
	}
	if ('tag' in userAttr) {
		return msg.tagName.toLowerCase() === userAttr.tag.toLowerCase();
	}
	if ('containerSelector' in userAttr) {
		let isUser = index % 2 === 0;
		const container = msg.querySelector(userAttr.containerSelector);
		if (container) {
			if (userAttr.userClass.some(c => container.classList.contains(c))) isUser = true;
			if (userAttr.aiClass.some(c => container.classList.contains(c))) isUser = false;
		}
		return isUser;
	}
	if ('htmlMatch' in userAttr) {
		const html = msg.outerHTML.toLowerCase();
		return userAttr.htmlMatch.some(keyword => html.includes(keyword));
	}
	return index % 2 === 0;
}

// ──────────────────────────────────────────────
// 가상 스크롤 대응
// ──────────────────────────────────────────────

export async function scrollAllTurns(messageSelector: string): Promise<void> {
	const turns = Array.from(document.querySelectorAll(messageSelector));
	for (const turn of turns) {
		turn.scrollIntoView({ behavior: 'instant', block: 'center' });
		await new Promise(r => setTimeout(r, 300));
	}
	if (turns[0]) {
		turns[0].scrollIntoView({ behavior: 'instant', block: 'start' });
		await new Promise(r => setTimeout(r, 300));
	}
}

// ──────────────────────────────────────────────
// DOM → 마크다운 변환 (자체 파서, content script 전용)
// ──────────────────────────────────────────────

export function convertAIChatToMarkdown(
	element: Element,
	ignoreSelector?: string
): string {
	const clone = element.cloneNode(true) as Element;
	const selector = ignoreSelector ?? "button, svg, img, [aria-hidden='true'], .sr-only";
	clone.querySelectorAll(selector).forEach(el => el.remove());

	clone.querySelectorAll('pre').forEach(pre => {
		const { lang, text } = extractCodeBlock(pre);
		const mdCode = `\n\n\`\`\`${lang}\n${text.replace(/\n$/, '')}\n\`\`\`\n\n`;
		let wrapper: Element = pre;
		while (wrapper.parentElement && wrapper.parentElement !== clone) {
			const parentLen = wrapper.parentElement.textContent?.trim().length ?? 0;
			const preLen = pre.textContent?.trim().length ?? 0;
			if (parentLen <= preLen + 50) wrapper = wrapper.parentElement;
			else break;
		}
		const placeholder = document.createElement('div');
		placeholder.className = 'processed-code-block';
		placeholder.textContent = mdCode;
		wrapper.replaceWith(placeholder);
	});

	return parseDOMToMarkdown(clone).replace(/\n{3,}/g, '\n\n').trim();
}

function extractCodeBlock(pre: Element): { lang: string; text: string } {
	const codeTag = pre.querySelector('code');
	const cmContent = pre.querySelector('.cm-content, [class*="cm-content"]');
	let text = codeTag?.textContent ?? cmContent?.textContent ?? pre.textContent ?? '';
	let lang = '';
	if (codeTag?.className) {
		const m = codeTag.className.match(/language-(\w+)/);
		if (m) lang = m[1];
	}
	if (!lang) {
		const fullText = pre.textContent?.trim() ?? '';
		const idx = fullText.indexOf(text.trim());
		if (idx > 0) {
			const header = fullText.slice(0, idx).trim();
			if (header && /^[a-zA-Z0-9_+#.-]+$/.test(header) && header.length <= 20) lang = header.toLowerCase();
		}
	}
	if (!lang) {
		const codeBlockEl = pre.closest('code-block') ?? pre.closest('.code-block');
		if (codeBlockEl) {
			const decoration = codeBlockEl.querySelector('.code-block-decoration > span');
			if (decoration) {
				const langText = decoration.textContent?.trim() ?? '';
				if (langText && /^[a-zA-Z0-9_+#. -]+$/i.test(langText) && langText.length <= 20) lang = langText.toLowerCase();
			}
		}
	}
	return { lang, text };
}

function parseDOMToMarkdown(node: Node): string {
	if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
	if (node.nodeType !== Node.ELEMENT_NODE) return '';
	const el = node as Element;
	if (el.className === 'processed-code-block') return el.textContent ?? '';
	const tag = el.tagName.toLowerCase();
	if (tag === 'table') return convertTableToMarkdown(el);
	let children = '';
	for (const child of Array.from(el.childNodes)) children += parseDOMToMarkdown(child);
	switch (tag) {
		case 'h1': return `\n# ${children.trim()}\n\n`;
		case 'h2': return `\n## ${children.trim()}\n\n`;
		case 'h3': return `\n### ${children.trim()}\n\n`;
		case 'h4': return `\n#### ${children.trim()}\n\n`;
		case 'h5': return `\n##### ${children.trim()}\n\n`;
		case 'h6': return `\n###### ${children.trim()}\n\n`;
		case 'p':  return children.trim() ? `\n${children.trim()}\n\n` : '';
		case 'strong': case 'b': return `**${children}**`;
		case 'em': case 'i': return `*${children}*`;
		case 'code': return `\`${children}\``;
		case 'li': return `\n- ${children.trim()}`;
		case 'ul': case 'ol': return `\n${children}\n`;
		case 'a': return `[${children}](${el.getAttribute('href') ?? ''})`;
		case 'br': return '\n';
		case 'hr': return '\n---\n';
		case 'blockquote': return children.split('\n').map(l => `> ${l}`).join('\n');
		default: return children;
	}
}

function convertTableToMarkdown(table: Element): string {
	let md = '\n\n';
	table.querySelectorAll('tr').forEach((row, rowIndex) => {
		const cells = Array.from(row.querySelectorAll('th, td'));
		const texts = cells.map(c => c.textContent?.trim() ?? '');
		md += `| ${texts.join(' | ')} |\n`;
		if (rowIndex === 0) md += `| ${texts.map(() => '---').join(' | ')} |\n`;
	});
	return md + '\n';
}

// ──────────────────────────────────────────────
// QA 쌍 추출 (content script 전용)
// ──────────────────────────────────────────────

interface MessageEntry { el: Element; isUser: boolean; }

/**
 * DOM 요소 하나를 MessageContent(html + markdown)로 변환한다.
 * ignoreSelector를 적용한 후 innerHTML(html)과 변환된 마크다운(markdown)을 반환한다.
 */
function toMessageContent(el: Element, ignoreSelector: string | undefined): MessageContent {
	const selector = ignoreSelector ?? "button, svg, img, [aria-hidden='true'], .sr-only";
	const clone = el.cloneNode(true) as Element;
	clone.querySelectorAll(selector).forEach(e => e.remove());
	return {
		html: clone.innerHTML,
		markdown: convertAIChatToMarkdown(el, ignoreSelector)
	};
}

/**
 * DOM 순서로 정렬된 메시지 목록을 QAPair 배열로 그룹핑한다.
 *
 * 그룹핑 규칙:
 *   - 사용자 메시지가 나오면 새 QAPair를 시작한다.
 *   - 모델 메시지는 가장 최근 QAPair의 model 배열에 추가한다.
 *   - 모델 응답이 복수인 경우(재생성 등) 모두 같은 model 배열에 포함된다.
 */
function groupIntoQAPairs(
	messages: MessageEntry[],
	ignoreSelector: string | undefined,
	deduplicate: boolean
): { session: QASession; messageCount: number } {
	const session: QASession = [];
	const seenTexts = deduplicate ? new Set<string>() : null;
	let currentPair: QAPair | null = null;
	let messageCount = 0;

	for (const { el, isUser } of messages) {
		const content = toMessageContent(el, ignoreSelector);
		if (!content.markdown) continue;

		if (seenTexts) {
			if (seenTexts.has(content.markdown)) continue;
			seenTexts.add(content.markdown);
		}

		messageCount++;

		if (isUser) {
			if (currentPair) session.push(currentPair);
			currentPair = { user: content, model: [] };
		} else {
			if (!currentPair) {
				// 첫 사용자 메시지 없이 모델 메시지가 먼저 나온 경우
				currentPair = { user: { html: '', markdown: '' }, model: [] };
			}
			currentPair.model.push(content);
		}
	}

	if (currentPair) session.push(currentPair);
	return { session, messageCount };
}

/** extractionConfig 기반 신규 추출 */
async function extractWithConfig(
	siteConfig: SiteConfig
): Promise<{ session: QASession; messageCount: number; modelName: string }> {
	const config = siteConfig.extractionConfig!;
	const root: ParentNode = config.rootSelector
		? (document.querySelector(config.rootSelector) ?? document)
		: document;
	const ignoreSelector = config.ignoreSelector ?? siteConfig.ignoreSelector;

	const userEls: MessageEntry[] = Array.from(root.querySelectorAll(config.userMessageSelector))
		.map(el => ({ el, isUser: true }));

	const seenEls = new Set<Element>();
	const modelEls: MessageEntry[] = config.modelMessageSelectors
		.flatMap(sel => Array.from(root.querySelectorAll(sel)))
		.filter(el => { if (seenEls.has(el)) return false; seenEls.add(el); return true; })
		.map(el => ({ el, isUser: false }));

	const allMessages = [...userEls, ...modelEls].sort((a, b) =>
		a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
	);

	const deduplicate = config.deduplicate ?? siteConfig.deduplicate ?? false;
	const { session, messageCount } = groupIntoQAPairs(allMessages, ignoreSelector, deduplicate);

	const modelSel = config.modelSelector ?? siteConfig.modelSelector;
	const modelName = modelSel ? (document.querySelector(modelSel)?.textContent?.trim() ?? '') : '';

	return { session, messageCount, modelName };
}

/** messageSelector + userAttribute 레거시 추출 */
async function extractLegacy(
	siteConfig: SiteConfig
): Promise<{ session: QASession; messageCount: number; modelName: string }> {
	const messages: MessageEntry[] = Array.from(document.querySelectorAll(siteConfig.messageSelector!))
		.map((msg, index) => ({
			el: siteConfig.contentSelector ? (msg.querySelector(siteConfig.contentSelector) ?? msg) : msg,
			isUser: detectUser(msg, siteConfig.userAttribute!, index),
		}));

	const { session, messageCount } = groupIntoQAPairs(
		messages, siteConfig.ignoreSelector, siteConfig.deduplicate ?? false
	);

	const modelName = siteConfig.modelSelector
		? (document.querySelector(siteConfig.modelSelector)?.textContent?.trim() ?? '')
		: '';

	return { session, messageCount, modelName };
}

// ──────────────────────────────────────────────
// 대화 추출 엔트리포인트 (content script 전용)
// ──────────────────────────────────────────────

/**
 * 페이지에서 QASession을 추출한다. content script 전용.
 *
 * @returns session     - QAPair 배열 (각 QAPair: user + model[] MessageContent)
 * @returns messageCount - 총 메시지 수
 * @returns modelName   - DOM에서 추출한 모델명 (없으면 빈 문자열)
 * @returns pageTitle   - document.title (popup에서 마크다운 조립 시 사용)
 */
export async function extractAIChatContent(
	siteConfig: SiteConfig,
	_chatFormat: ChatFormat
): Promise<{ session: QASession; messageCount: number; modelName: string; pageTitle: string }> {
	if (siteConfig.scrollToLoad) {
		const scrollSelector = siteConfig.extractionConfig
			? [
				siteConfig.extractionConfig.userMessageSelector,
				...siteConfig.extractionConfig.modelMessageSelectors
			].join(', ')
			: siteConfig.messageSelector!;
		await scrollAllTurns(scrollSelector);
	}

	const result = siteConfig.extractionConfig
		? await extractWithConfig(siteConfig)
		: await extractLegacy(siteConfig);

	return { ...result, pageTitle: document.title };
}

// ──────────────────────────────────────────────
// 마크다운 사후 보정 (팝업/content 공용 순수 함수)
// ──────────────────────────────────────────────

function applyPostProcessRules(markdown: string, rules: PostProcessRule[]): string {
	let result = markdown;
	for (const rule of rules) {
		try {
			result = result.replace(new RegExp(rule.pattern, rule.flags), rule.replacement);
		} catch (e) {
			console.warn(`[PostProcess] 잘못된 정규식 "${rule.pattern}":`, e);
		}
	}
	return result;
}

// ──────────────────────────────────────────────
// QASession → 마크다운 포맷팅 (popup 컨텍스트)
// ──────────────────────────────────────────────

/**
 * QASession과 ChatFormat 설정으로 최종 마크다운을 조립한다. popup 전용.
 *
 * 조립 순서:
 *   (includeTitle) # pageTitle
 *   qaSeparator
 *   [QAPair마다]
 *     userTitleFormat  + user.markdown
 *     turnSeparator
 *     aiTitleFormat    + model[0].markdown
 *     (turnSeparator   + model[1].markdown ...)  ← 응답 복수 시
 *   qaSeparator  (쌍 사이)
 *   qaSeparator  (마지막)
 *
 * postProcessRules 적용 후 반환한다.
 */
/** chatFormat 문자열에서 {{key}} 변수를 치환한다 (aiTitleFormat에서 {{siteEmoji}}/{{aiLabel}} 사용 가능). */
function resolveFormat(format: string, vars: Record<string, string>): string {
	return format.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[`{{${key}}}`] ?? match);
}

export function formatQASession(
	session: QASession,
	chatFormat: ChatFormat,
	pageTitle: string,
	extraVars?: Record<string, string>
): string {
	if (session.length === 0) return '';

	const vars = extraVars ?? {};
	const userTitle = resolveFormat(chatFormat.userTitleFormat, vars);
	const aiTitle   = resolveFormat(chatFormat.aiTitleFormat, vars);

	let body = '';
	for (let i = 0; i < session.length; i++) {
		const pair = session[i];

		// Q&A 쌍 구분자 (첫 번째 쌍 앞에는 넣지 않음)
		if (i > 0 && chatFormat.qaSeparator) body += `${chatFormat.qaSeparator}\n\n`;

		// 사용자 메시지
		if (pair.user.markdown) {
			body += `${userTitle}\n\n${pair.user.markdown}\n\n`;
		}

		// 사용자→모델 구분자
		if (pair.model.length > 0 && chatFormat.turnSeparator) {
			body += `${chatFormat.turnSeparator}\n\n`;
		}

		// 모델 응답 (복수 응답 지원)
		pair.model.forEach((modelMsg, idx) => {
			if (idx > 0 && chatFormat.turnSeparator) body += `${chatFormat.turnSeparator}\n\n`;
			body += `${aiTitle}\n\n${modelMsg.markdown}\n\n`;
		});
	}

	// 전체 래핑
	const includeTitle = chatFormat.includeTitle !== false;
	let md = '';
	if (includeTitle && pageTitle) md += `# ${pageTitle}\n\n`;
	if (chatFormat.qaSeparator) md += `${chatFormat.qaSeparator}\n\n`;
	md += body;
	if (chatFormat.qaSeparator) md += `${chatFormat.qaSeparator}\n\n`;

	// 사후 보정
	if (chatFormat.postProcessRules?.length) {
		md = applyPostProcessRules(md, chatFormat.postProcessRules);
	}

	return md;
}

// ──────────────────────────────────────────────
// 변수 맵 생성 (popup 컨텍스트)
// ──────────────────────────────────────────────

/**
 * formatQASession() 결과(마크다운)를 popup의 currentVariables 맵으로 변환한다.
 */
export function buildAIChatVariables(
	markdown: string,
	messageCount: number,
	template: Template,
	modelName?: string
): Record<string, string> {
	// formatQASession이 추가한 `# pageTitle` H1에서 제목 추출
	const firstH1Match = markdown.match(/^# (.+)$/m);
	const title = firstH1Match ? firstH1Match[1].trim() : '';
	const model = template.model || modelName || template.authorLabel || template.name;

	return {
		'{{chatContent}}':  markdown,
		'{{messageCount}}': String(messageCount),
		'{{model}}':        model,
		'{{title}}':        title,
		'{{titlePrefix}}':  template.titlePrefix ?? '',
		'{{aiLabel}}':      template.authorLabel ?? '',
		'{{siteEmoji}}':    template.emoji ?? '',
	};
}
