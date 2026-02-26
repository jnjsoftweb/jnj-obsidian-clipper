import dayjs from 'dayjs';
import { Template, Property } from '../types/types';

export async function generateFrontmatter(properties: Property[]): Promise<string> {
	let frontmatter = '---\n';
	for (const property of properties) {
		frontmatter += `${property.name}:`;

		switch (property.type) {
			case 'multitext':
				let items: string[];
				if (property.value.trim().startsWith('["') && property.value.trim().endsWith('"]')) {
					try {
						items = JSON.parse(property.value);
					} catch (e) {
						// If parsing fails, fall back to splitting by comma
						items = property.value.split(',').map(item => item.trim());
					}
				} else {
					// Split by comma, but keep wikilinks intact
					items = property.value.split(/,(?![^\[]*\]\])/).map(item => item.trim());
				}
				items = items.filter(item => item !== '');
				if (items.length > 0) {
					frontmatter += '\n';
					items.forEach(item => {
						frontmatter += `  - "${item}"\n`;
					});
				} else {
					frontmatter += '\n';
				}
				break;
			case 'number':
				const numericValue = property.value.replace(/[^\d.-]/g, '');
				frontmatter += numericValue ? ` ${parseFloat(numericValue)}\n` : '\n';
				break;
			case 'checkbox':
				frontmatter += ` ${property.value.toLowerCase() === 'true' || property.value === '1'}\n`;
				break;
			case 'date':
			case 'datetime':
				if (property.value.trim() !== '') {
					frontmatter += ` "${property.value}"\n`;
				} else {
					frontmatter += '\n';
				}
				break;
			default: // Text
				frontmatter += property.value.trim() !== '' ? ` "${property.value}"\n` : '\n';
		}
	}
	frontmatter += '---\n';
	return frontmatter;
}

/**
 * Obsidian URI 안전 최대 길이.
 * Windows 프로토콜 핸들러 경유 시 vault 파라미터 유실 방지를 위해
 * vault 파라미터를 content 앞에 배치하고, 이 임계값 초과 시 content를 잘라낸다.
 */
const MAX_OBSIDIAN_URL_LENGTH = 20000;

/**
 * Obsidian에 노트를 저장한다.
 * vault 파라미터를 content 앞에 배치해, URL이 길어도 vault가 올바르게 전달되도록 한다.
 */
export async function saveToObsidian(
	fileContent: string,
	noteName: string,
	path: string,
	vault: string,
	behavior: string,
	specificNoteName?: string,
	dailyNoteFormat?: string
): Promise<void> {
	let content = fileContent;

	// Ensure path ends with a slash
	if (path && !path.endsWith('/')) {
		path += '/';
	}

	// vault 파라미터는 content 앞에 — URL 잘림 시에도 vault는 보존
	const vaultParam = vault ? `&vault=${encodeURIComponent(vault)}` : '';

	let fileName: string;
	let appendMode = false;

	if (behavior === 'append-specific' || behavior === 'append-daily') {
		if (behavior === 'append-specific') {
			fileName = specificNoteName!;
		} else {
			fileName = dayjs().format(dailyNoteFormat!);
		}
		appendMode = true;
		// Add newlines at the beginning to separate from existing content
		content = '\n\n' + content;
	} else {
		fileName = noteName;
	}

	const fileParam = `obsidian://new?file=${encodeURIComponent(path + fileName)}`;
	const appendParam = appendMode ? '&append=true' : '';
	// 순서: file → append? → vault → content
	const baseUrl = `${fileParam}${appendParam}${vaultParam}`;

	// URL이 너무 길면 content를 잘라낸다
	const fullUrl = `${baseUrl}&content=${encodeURIComponent(content)}`;
	let obsidianUrl: string;

	if (fullUrl.length > MAX_OBSIDIAN_URL_LENGTH) {
		console.warn(`[saveToObsidian] URL 길이 초과(${fullUrl.length}자). content를 잘라냅니다.`);
		const truncatedContent = truncateToFitUrl(baseUrl, content, MAX_OBSIDIAN_URL_LENGTH);
		obsidianUrl = `${baseUrl}&content=${encodeURIComponent(truncatedContent)}`;
	} else {
		obsidianUrl = fullUrl;
	}

	const isTruncated = fullUrl.length > MAX_OBSIDIAN_URL_LENGTH;
	console.log('[saveToObsidian] vault:', vault || '(없음)');
	console.log('[saveToObsidian] path+file:', path + fileName);
	console.log('[saveToObsidian] baseUrl (content 제외):', baseUrl);
	console.log('[saveToObsidian] URL 길이:', obsidianUrl.length, isTruncated ? '⚠ content 잘림' : '(정상)');

	// 팝업 종료 후에도 확인 가능하도록 로컬 스토리지에 기록
	// 배경 서비스 워커 콘솔에서 chrome.storage.local.get('debug_last_save', console.log) 로 확인
	chrome.storage.local.set({
		debug_last_save: {
			vault: vault || '(없음)',
			pathPlusFile: path + fileName,
			baseUrl,
			obsidianUrlLength: obsidianUrl.length,
			truncated: isTruncated,
			timestamp: new Date().toISOString()
		}
	});

	return new Promise<void>((resolve, reject) => {
		chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
			if (chrome.runtime.lastError) {
				console.error('[saveToObsidian] tabs.query 오류:', chrome.runtime.lastError.message);
				reject(new Error(chrome.runtime.lastError.message));
				return;
			}
			const currentTab = tabs[0];
			if (currentTab && currentTab.id) {
				chrome.tabs.update(currentTab.id, { url: obsidianUrl }, () => {
					if (chrome.runtime.lastError) {
						console.error('[saveToObsidian] tabs.update 오류:', chrome.runtime.lastError.message);
						reject(new Error(chrome.runtime.lastError.message));
					} else {
						resolve();
					}
				});
			} else {
				reject(new Error('활성 탭을 찾을 수 없습니다.'));
			}
		});
	});
}

/**
 * baseUrl + content 인코딩 결과가 maxLength를 넘지 않도록 content를 잘라낸다.
 * 잘린 경우 말미에 안내 메시지를 추가한다.
 */
function truncateToFitUrl(baseUrl: string, content: string, maxLength: number): string {
	const SUFFIX = '\n\n---\n> [!warning] 내용 일부가 URL 길이 제한으로 잘렸습니다.';
	const overhead = baseUrl.length + '&content='.length + encodeURIComponent(SUFFIX).length;
	const budget = maxLength - overhead;

	// 이진 탐색으로 잘라낼 지점 결정
	let lo = 0;
	let hi = content.length;
	while (lo < hi) {
		const mid = Math.floor((lo + hi + 1) / 2);
		if (encodeURIComponent(content.slice(0, mid)).length <= budget) {
			lo = mid;
		} else {
			hi = mid - 1;
		}
	}

	return content.slice(0, lo) + SUFFIX;
}

export function sanitizeFileName(fileName: string): string {
	const isWindows = navigator.platform.indexOf('Win') > -1;
	if (isWindows) {
		fileName = fileName.replace(':', '').replace(/[/\\?%*|"<>]/g, '-');
	} else {
		fileName = fileName.replace(':', '').replace(/[/\\]/g, '-');
	}
	return fileName;
}
