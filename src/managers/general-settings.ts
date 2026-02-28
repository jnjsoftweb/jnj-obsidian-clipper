import { handleDragStart, handleDragOver, handleDrop, handleDragEnd } from '../utils/drag-and-drop';
import { initializeIcons } from '../icons/icons';
import { getCommands } from '../utils/hotkeys';
import { initializeToggles } from '../utils/ui-utils';
import { generalSettings,loadGeneralSettings, saveGeneralSettings } from '../utils/storage-utils';
import { renderPostProcessRules, addPostProcessRuleRow, readPostProcessRules } from './template-ui';

export function updateVaultList(): void {
	const vaultList = document.getElementById('vault-list') as HTMLUListElement;
	if (!vaultList) return;

	vaultList.innerHTML = '';
	generalSettings.vaults.forEach((vault, index) => {
		const li = document.createElement('li');
		li.innerHTML = `
			<div class="drag-handle">
				<i data-lucide="grip-vertical"></i>
			</div>
			<span>${vault}</span>
			<button type="button" class="remove-vault-btn clickable-icon" aria-label="Remove vault">
				<i data-lucide="trash-2"></i>
			</button>
		`;
		li.dataset.index = index.toString();
		li.draggable = true;
		li.addEventListener('dragstart', handleDragStart);
		li.addEventListener('dragover', handleDragOver);
		li.addEventListener('drop', handleDrop);
		li.addEventListener('dragend', handleDragEnd);
		const removeBtn = li.querySelector('.remove-vault-btn') as HTMLButtonElement;
		removeBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			removeVault(index);
		});
		vaultList.appendChild(li);
	});

	initializeIcons(vaultList);
}

export function addVault(vault: string): void {
	generalSettings.vaults.push(vault);
	saveGeneralSettings();
	updateVaultList();
}

export function removeVault(index: number): void {
	generalSettings.vaults.splice(index, 1);
	saveGeneralSettings();
	updateVaultList();
}

export function initializeGeneralSettings(): void {
	loadGeneralSettings().then(() => {
		updateVaultList();
		initializeShowMoreActionsToggle();
		initializeUserInput();
		initializeVaultInput();
		initializeKeyboardShortcuts();
		initializeChatFormatSettings();
		initializeToggles();
	});
}

function initializeChatFormatSettings(): void {
	const cf = generalSettings.chatFormat;
	const container = document.getElementById('general-post-process-rules-list');
	const userTitleInput = document.getElementById('general-chat-user-title') as HTMLInputElement;
	const aiTitleInput = document.getElementById('general-chat-ai-title') as HTMLInputElement;
	const turnSepInput = document.getElementById('general-chat-turn-separator') as HTMLInputElement;
	const qaSepInput = document.getElementById('general-chat-qa-separator') as HTMLInputElement;
	const includeTitleCb = document.getElementById('general-chat-include-title') as HTMLInputElement;

	if (userTitleInput) userTitleInput.value = cf.userTitleFormat;
	if (aiTitleInput) aiTitleInput.value = cf.aiTitleFormat;
	if (turnSepInput) turnSepInput.value = cf.turnSeparator;
	if (qaSepInput) qaSepInput.value = cf.qaSeparator;
	if (includeTitleCb) includeTitleCb.checked = cf.includeTitle ?? true;

	renderPostProcessRules(container, cf.postProcessRules);

	function saveChatFormat(): void {
		const rules = readPostProcessRules(document.getElementById('general-post-process-rules-list'));
		saveGeneralSettings({
			chatFormat: {
				userTitleFormat: userTitleInput?.value ?? '',
				aiTitleFormat: aiTitleInput?.value ?? '',
				turnSeparator: turnSepInput?.value ?? '',
				qaSeparator: qaSepInput?.value ?? '',
				includeTitle: includeTitleCb?.checked ?? true,
				postProcessRules: rules,
			}
		});
	}

	[userTitleInput, aiTitleInput, turnSepInput, qaSepInput].forEach(el => {
		if (el) el.addEventListener('change', saveChatFormat);
	});
	if (includeTitleCb) includeTitleCb.addEventListener('change', saveChatFormat);

	// postProcessRules 컨테이너: 필드 변경 시 저장 (event delegation)
	if (container) {
		container.addEventListener('change', saveChatFormat);
		// 규칙 삭제 버튼 클릭 후 DOM 반영 이후 저장
		container.addEventListener('click', (e) => {
			if ((e.target as HTMLElement).closest('.remove-rule-btn')) {
				setTimeout(saveChatFormat, 0);
			}
		});
	}

	// + 규칙 추가 버튼
	const addRuleBtn = document.getElementById('general-add-post-process-rule-btn');
	if (addRuleBtn) {
		addRuleBtn.addEventListener('click', () => {
			const c = document.getElementById('general-post-process-rules-list');
			if (c) {
				addPostProcessRuleRow(c);
				saveChatFormat();
			}
		});
	}
}

function initializeShowMoreActionsToggle(): void {
	const ShowMoreActionsToggle = document.getElementById('show-more-actions-toggle') as HTMLInputElement;
	if (ShowMoreActionsToggle) {
		ShowMoreActionsToggle.checked = generalSettings.showMoreActionsButton;
		ShowMoreActionsToggle.addEventListener('change', () => {
			saveGeneralSettings({ showMoreActionsButton: ShowMoreActionsToggle.checked });
		});
	}
}

function initializeUserInput(): void {
	const userInput = document.getElementById('user-input') as HTMLInputElement;
	if (userInput) {
		userInput.value = generalSettings.user;
		userInput.addEventListener('change', () => {
			saveGeneralSettings({ user: userInput.value.trim() });
		});
	}
}

function initializeVaultInput(): void {
	const vaultInput = document.getElementById('vault-input') as HTMLInputElement;
	if (vaultInput) {
		vaultInput.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				const newVault = vaultInput.value.trim();
				if (newVault) {
					addVault(newVault);
					vaultInput.value = '';
				}
			}
		});
	}
}

function initializeKeyboardShortcuts(): void {
	const shortcutsList = document.getElementById('keyboard-shortcuts-list');
	if (!shortcutsList) return;

	getCommands().then(commands => {
		commands.forEach(command => {
			const shortcutItem = document.createElement('div');
			shortcutItem.className = 'shortcut-item';
			shortcutItem.innerHTML = `
				<span>${command.description}</span>
				<span class="setting-hotkey">${command.shortcut || 'Not set'}</span>
			`;
			shortcutsList.appendChild(shortcutItem);
		});
	});
}
