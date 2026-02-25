import { SiteConfig, ChatFormat } from './site-config';

export interface Template {
	id: string;
	name: string;
	behavior: string;
	noteNameFormat: string;
	path: string;
	noteContentFormat: string;
	properties: Property[];
	triggers?: string[];
	specificNoteName?: string;
	dailyNoteFormat?: string;
	vault?: string;
	// AI chat 전용 필드 (선택적 — 값이 있으면 AI chat 템플릿으로 동작)
	siteConfig?: SiteConfig;
	chatFormat?: ChatFormat;
	emoji?: string;
	authorLabel?: string;
	titlePrefix?: string;
}

export interface Property {
	id: string;
	name: string;
	value: string;
	type: string;
}

export interface ExtractedContent {
	[key: string]: string;
}