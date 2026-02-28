import { Template } from '../types/types';

/**
 * 기본 AI Chat 템플릿 5개 (ChatGPT, Claude, Gemini, Google AI Studio, Genspark).
 * 최초 설치 시 template-manager.ts의 loadTemplates()가 자동 생성한다.
 *
 * ID는 고정 문자열 사용 — 재설치 후에도 중복 생성 방지를 위해
 * loadTemplates()에서 기존 template_list 유무를 확인한다.
 */
export const DEFAULT_AI_CHAT_TEMPLATES: Template[] = [
	{
		id: 'default-ai-chatgpt',
		name: 'ChatGPT',
		emoji: '🤖',
		authorLabel: 'ChatGPT',
		titlePrefix: 'ChatGPT 대화 내역',
		behavior: 'create',
		noteNameFormat: '{{titlePrefix}} — {{title}}',
		path: 'AI/ChatGPT',
		noteContentFormat: '{{chatContent}}',
		properties: [
			{ id: 'p-chatgpt-title', name: 'title', value: '{{title}}', type: 'text' },
			{ id: 'p-chatgpt-source', name: 'source', value: '{{url}}', type: 'text' },
			{ id: 'p-chatgpt-model', name: 'model', value: '{{model}}', type: 'text' },
			{ id: 'p-chatgpt-count', name: 'messageCount', value: '{{messageCount}}', type: 'number' },
			{ id: 'p-chatgpt-created', name: 'createdAt', value: '{{date}}', type: 'date' },
			{ id: 'p-chatgpt-published', name: 'publishedAt', value: '{{date}}', type: 'date' },
			{ id: 'p-chatgpt-tags', name: 'tags', value: 'ai-chat, chatgpt', type: 'multitext' },
			{ id: 'p-chatgpt-desc', name: 'description', value: '{{title}}', type: 'text' },
			{ id: 'p-chatgpt-user', name: 'user', value: '{{user}}', type: 'text' }
		],
		triggers: ['https://chatgpt.com/'],
		siteConfig: {
			hostname: 'chatgpt.com',
			messageSelector: "[data-message-author-role]",
			userAttribute: { attr: 'data-message-author-role', value: 'user' },
			ignoreSelector: "button, svg, img, [aria-hidden='true'], .sr-only"
		},
		chatFormat: {
			userTitleFormat: '> 👤 사용자 (User)',
			aiTitleFormat: '> 🤖 챗GPT (ChatGPT)',
			turnSeparator: '===',
			qaSeparator: '============'
		}
	},
	{
		id: 'default-ai-claude',
		name: 'Claude',
		emoji: '🧠',
		authorLabel: 'Claude',
		titlePrefix: 'Claude 대화 내역',
		behavior: 'create',
		noteNameFormat: '{{titlePrefix}} — {{title}}',
		path: 'AI/Claude',
		noteContentFormat: '{{chatContent}}',
		properties: [
			{ id: 'p-claude-title', name: 'title', value: '{{title}}', type: 'text' },
			{ id: 'p-claude-source', name: 'source', value: '{{url}}', type: 'text' },
			{ id: 'p-claude-model', name: 'model', value: '{{model}}', type: 'text' },
			{ id: 'p-claude-count', name: 'messageCount', value: '{{messageCount}}', type: 'number' },
			{ id: 'p-claude-created', name: 'createdAt', value: '{{date}}', type: 'date' },
			{ id: 'p-claude-published', name: 'publishedAt', value: '{{date}}', type: 'date' },
			{ id: 'p-claude-tags', name: 'tags', value: 'ai-chat, claude', type: 'multitext' },
			{ id: 'p-claude-desc', name: 'description', value: '{{title}}', type: 'text' },
			{ id: 'p-claude-user', name: 'user', value: '{{user}}', type: 'text' }
		],
		triggers: ['https://claude.ai/'],
		siteConfig: {
			hostname: 'claude.ai',
			messageSelector: "[data-testid='user-message'], .font-claude-message, .font-claude-response",
			userAttribute: { attr: 'data-testid', value: 'user-message' },
			ignoreSelector: "button, svg, img, [aria-hidden='true'], .sr-only"
		},
		chatFormat: {
			userTitleFormat: '> 👤 사용자 (User)',
			aiTitleFormat: '> 🧠 클로드 (Claude)',
			turnSeparator: '===',
			qaSeparator: '============'
		}
	},
	{
		id: 'default-ai-gemini',
		name: 'Gemini',
		emoji: '✨',
		authorLabel: '제미나이 (Gemini)',
		titlePrefix: 'Gemini 대화 내역',
		behavior: 'create',
		noteNameFormat: '{{titlePrefix}} — {{title}}',
		path: 'AI/Gemini',
		noteContentFormat: '{{chatContent}}',
		properties: [
			{ id: 'p-gemini-title', name: 'title', value: '{{title}}', type: 'text' },
			{ id: 'p-gemini-source', name: 'source', value: '{{url}}', type: 'text' },
			{ id: 'p-gemini-model', name: 'model', value: '{{model}}', type: 'text' },
			{ id: 'p-gemini-count', name: 'messageCount', value: '{{messageCount}}', type: 'number' },
			{ id: 'p-gemini-created', name: 'createdAt', value: '{{date}}', type: 'date' },
			{ id: 'p-gemini-published', name: 'publishedAt', value: '{{date}}', type: 'date' },
			{ id: 'p-gemini-tags', name: 'tags', value: 'ai-chat, gemini', type: 'multitext' },
			{ id: 'p-gemini-desc', name: 'description', value: '{{title}}', type: 'text' },
			{ id: 'p-gemini-user', name: 'user', value: '{{user}}', type: 'text' }
		],
		triggers: ['https://gemini.google.com/'],
		siteConfig: {
			hostname: 'gemini.google.com',
			messageSelector: 'user-query, model-response',
			userAttribute: { tag: 'user-query' },
			ignoreSelector: "button, svg, img, [aria-hidden='true'], .sr-only"
		},
		chatFormat: {
			userTitleFormat: '> 👤 사용자 (User)',
			aiTitleFormat: '> ✨ 제미나이 (Gemini)',
			turnSeparator: '===',
			qaSeparator: '============'
		}
	},
	{
		id: 'default-ai-aistudio',
		name: 'Google AI Studio',
		emoji: '⚙️',
		authorLabel: 'Google AI Studio',
		titlePrefix: 'Google AI Studio 대화 내역',
		behavior: 'create',
		noteNameFormat: '{{titlePrefix}} — {{title}}',
		path: 'AI/AIStudio',
		noteContentFormat: '{{chatContent}}',
		properties: [
			{ id: 'p-aistudio-title', name: 'title', value: '{{title}}', type: 'text' },
			{ id: 'p-aistudio-source', name: 'source', value: '{{url}}', type: 'text' },
			{ id: 'p-aistudio-model', name: 'model', value: '{{model}}', type: 'text' },
			{ id: 'p-aistudio-count', name: 'messageCount', value: '{{messageCount}}', type: 'number' },
			{ id: 'p-aistudio-created', name: 'createdAt', value: '{{date}}', type: 'date' },
			{ id: 'p-aistudio-published', name: 'publishedAt', value: '{{date}}', type: 'date' },
			{ id: 'p-aistudio-tags', name: 'tags', value: 'ai-chat, ai-studio', type: 'multitext' },
			{ id: 'p-aistudio-desc', name: 'description', value: '{{title}}', type: 'text' },
			{ id: 'p-aistudio-user', name: 'user', value: '{{user}}', type: 'text' }
		],
		triggers: ['https://aistudio.google.com/'],
		siteConfig: {
			hostname: 'aistudio.google.com',
			messageSelector: 'ms-chat-turn',
			userAttribute: { containerSelector: '.chat-turn-container', userClass: ['user'], aiClass: ['model'] },
			contentSelector: '.turn-content',
			ignoreSelector: "button, svg, img, [aria-hidden='true'], .sr-only, .actions-container, .author-label, ms-thought-chunk",
			scrollToLoad: true,
			modelSelector: '.chat-turn-container.model .author-label'
		},
		chatFormat: {
			userTitleFormat: '> 👤 사용자 (User)',
			aiTitleFormat: '> ⚙️ 모델 (Model)',
			turnSeparator: '===',
			qaSeparator: '============'
		}
	},
	{
		id: 'default-ai-genspark',
		name: 'Genspark',
		emoji: '✨',
		authorLabel: 'Genspark',
		titlePrefix: 'Genspark 대화 내역',
		behavior: 'create',
		noteNameFormat: '{{titlePrefix}} — {{title}}',
		path: 'AI/Genspark',
		noteContentFormat: '{{chatContent}}',
		properties: [
			{ id: 'p-genspark-title', name: 'title', value: '{{title}}', type: 'text' },
			{ id: 'p-genspark-source', name: 'source', value: '{{url}}', type: 'text' },
			{ id: 'p-genspark-model', name: 'model', value: '{{model}}', type: 'text' },
			{ id: 'p-genspark-count', name: 'messageCount', value: '{{messageCount}}', type: 'number' },
			{ id: 'p-genspark-created', name: 'createdAt', value: '{{date}}', type: 'date' },
			{ id: 'p-genspark-published', name: 'publishedAt', value: '{{date}}', type: 'date' },
			{ id: 'p-genspark-tags', name: 'tags', value: 'ai-chat, genspark', type: 'multitext' },
			{ id: 'p-genspark-desc', name: 'description', value: '{{title}}', type: 'text' },
			{ id: 'p-genspark-user', name: 'user', value: '{{user}}', type: 'text' }
		],
		triggers: ['https://www.genspark.ai/'],
		siteConfig: {
			hostname: 'www.genspark.ai',
			messageSelector: "article, [class*='message'], [class*='chat-turn'], [class*='bubble']",
			userAttribute: { htmlMatch: ['user', 'query', 'human'] },
			ignoreSelector: "button, svg, img, [aria-hidden='true'], .sr-only",
			deduplicate: true
		},
		chatFormat: {
			userTitleFormat: '> 👤 사용자 (User)',
			aiTitleFormat: '> ✨ 젠스파크 (Genspark)',
			turnSeparator: '===',
			qaSeparator: '============'
		}
	}
];
