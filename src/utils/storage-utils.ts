import { ChatFormat } from '../types/site-config';

const DEFAULT_CHAT_FORMAT: ChatFormat = {
	userTitleFormat: '> 👤 사용자 (User)',
	aiTitleFormat: '> {{siteEmoji}} {{aiLabel}}',
	turnSeparator: '===',
	qaSeparator: '============',
	includeTitle: true,
	postProcessRules: [
		{ label: '줄 끝 공백 제거', pattern: '\\s+$', flags: 'gm', replacement: '' },
		{ label: '리스트 아이템 사이 빈 줄 제거', pattern: '(- [^\\n]+)\\n{2,}(?=-)', flags: 'gm', replacement: '$1\n' },
		{ label: '제목 앞 줄바꿈', pattern: '([^\\n])\\n(#{1,6} )', flags: 'gm', replacement: '$1\n\n$2' },
		{ label: '제목 뒤 줄바꿈', pattern: '(#{1,6} [^\\n]+)\\n([^\\n#])', flags: 'gm', replacement: '$1\n\n$2' }
	]
};

export interface GeneralSettings {
	showMoreActionsButton: boolean;
	user: string;
	vaults: string[];
	chatFormat: ChatFormat;
}

export let generalSettings: GeneralSettings = {
	showMoreActionsButton: true,
	user: 'ilinkrun@gmail.com',
	vaults: [],
	chatFormat: { ...DEFAULT_CHAT_FORMAT }
};

export function setLocalStorage(key: string, value: any): Promise<void> {
	return new Promise((resolve) => {
		chrome.storage.local.set({ [key]: value }, () => {
			resolve();
		});
	});
}

export function getLocalStorage(key: string): Promise<any> {
	return new Promise((resolve) => {
		chrome.storage.local.get(key, (result) => {
			resolve(result[key]);
		});
	});
}

export async function loadGeneralSettings(): Promise<GeneralSettings> {
	const data = await chrome.storage.sync.get(['general_settings', 'vaults']);
	const saved = data.general_settings ?? {};
	const savedCf = saved.chatFormat ?? {};

	generalSettings = {
		showMoreActionsButton: saved.showMoreActionsButton ?? true,
		user: saved.user ?? 'ilinkrun@gmail.com',
		vaults: data.vaults || [],
		chatFormat: {
			userTitleFormat: savedCf.userTitleFormat ?? DEFAULT_CHAT_FORMAT.userTitleFormat,
			aiTitleFormat:   savedCf.aiTitleFormat   ?? DEFAULT_CHAT_FORMAT.aiTitleFormat,
			turnSeparator:   savedCf.turnSeparator   ?? DEFAULT_CHAT_FORMAT.turnSeparator,
			qaSeparator:     savedCf.qaSeparator     ?? DEFAULT_CHAT_FORMAT.qaSeparator,
			includeTitle:    savedCf.includeTitle    ?? DEFAULT_CHAT_FORMAT.includeTitle,
			postProcessRules: savedCf.postProcessRules ?? DEFAULT_CHAT_FORMAT.postProcessRules
		}
	};

	return generalSettings;
}

export async function saveGeneralSettings(settings?: Partial<GeneralSettings>): Promise<void> {
	generalSettings = { ...generalSettings, ...settings };

	await chrome.storage.sync.set({
		general_settings: {
			showMoreActionsButton: generalSettings.showMoreActionsButton,
			user: generalSettings.user,
			chatFormat: generalSettings.chatFormat
		},
		vaults: generalSettings.vaults
	});
}
