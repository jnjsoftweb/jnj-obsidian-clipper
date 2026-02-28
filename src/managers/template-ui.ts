import { Template, Property } from '../types/types';
import { SiteConfig, UserAttribute, ExtractionConfig, PostProcessRule } from '../types/site-config';
import { templates, editingTemplateIndex, saveTemplateSettings, getTemplates, setEditingTemplateIndex } from './template-manager';
import { initializeIcons, getPropertyTypeIcon } from '../icons/icons';
import { escapeValue, escapeHtml, unescapeValue } from '../utils/string-utils';
import { generalSettings } from '../utils/storage-utils';
import { updateUrl } from '../utils/routing';
import { handleDragStart, handleDragOver, handleDrop, handleDragEnd } from '../utils/drag-and-drop';

let hasUnsavedChanges = false;

export function resetUnsavedChanges(): void {
	hasUnsavedChanges = false;
}

export function updateTemplateList(loadedTemplates?: Template[]): void {
	const templateList = document.getElementById('template-list');
	if (!templateList) {
		console.error('Template list element not found');
		return;
	}
	
	const templatesToUse = loadedTemplates || templates;
	
	templateList.innerHTML = '';
	templatesToUse.forEach((template, index) => {
		if (template && template.name && template.id) {
			const li = document.createElement('li');
			li.innerHTML = `
				<div class="drag-handle">
					<i data-lucide="grip-vertical"></i>
				</div>
				<span class="template-name">${template.name}</span>
				<button type="button" class="delete-template-btn clickable-icon" aria-label="Delete template">
					<i data-lucide="trash-2"></i>
				</button>
			`;
			li.dataset.id = template.id;
			li.dataset.index = index.toString();
			li.draggable = true;
			li.addEventListener('click', (e) => {
				const target = e.target as HTMLElement;
				if (!target.closest('.delete-template-btn')) {
					showTemplateEditor(template);
				}
			});
			const deleteBtn = li.querySelector('.delete-template-btn');
			if (deleteBtn) {
				deleteBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					deleteTemplate(template.id);
				});
			}
			if (index === editingTemplateIndex) {
				li.classList.add('active');
			}
			templateList.appendChild(li);
		} else {
			console.error('Invalid template at index', index, ':', template);
		}
	});
	initializeIcons(templateList);
}

export function showTemplateEditor(template: Template | null): void {
	let editingTemplate: Template;

	if (!template) {
		editingTemplate = {
			id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
			name: 'New template',
			behavior: 'create',
			noteNameFormat: '{{title}}',
			path: 'Clippings',
			noteContentFormat: '{{content}}',
			properties: [],
			triggers: []
		};
		templates.push(editingTemplate);
		setEditingTemplateIndex(templates.length - 1);
		saveTemplateSettings().then(() => {
			updateTemplateList();
		}).catch(error => {
			console.error('Failed to save new template:', error);
		});
	} else {
		editingTemplate = template;
		setEditingTemplateIndex(templates.findIndex(t => t.id === editingTemplate.id));
	}

	// Ensure properties is always an array
	if (!editingTemplate.properties) {
		editingTemplate.properties = [];
	}

	const templateEditorTitle = document.getElementById('template-editor-title');
	const templateName = document.getElementById('template-name') as HTMLInputElement;
	const templateProperties = document.getElementById('template-properties');

	if (templateEditorTitle) templateEditorTitle.textContent = 'Edit template';
	if (templateName) templateName.value = editingTemplate.name;
	if (templateProperties) templateProperties.innerHTML = '';

	const pathInput = document.getElementById('template-path-name') as HTMLInputElement;
	if (pathInput) pathInput.value = editingTemplate.path;

	const behaviorSelect = document.getElementById('template-behavior') as HTMLSelectElement;
	
	if (behaviorSelect) behaviorSelect.value = editingTemplate.behavior || 'create';
	const specificNoteName = document.getElementById('specific-note-name') as HTMLInputElement;
	if (specificNoteName) specificNoteName.value = editingTemplate.specificNoteName || '';
	const dailyNoteFormat = document.getElementById('daily-note-format') as HTMLInputElement;
	if (dailyNoteFormat) dailyNoteFormat.value = editingTemplate.dailyNoteFormat || 'YYYY-MM-DD';
	const noteNameFormat = document.getElementById('note-name-format') as HTMLInputElement;
	if (noteNameFormat) noteNameFormat.value = editingTemplate.noteNameFormat || '{{title}}';

	const noteContentFormat = document.getElementById('note-content-format') as HTMLTextAreaElement;
	if (noteContentFormat) noteContentFormat.value = editingTemplate.noteContentFormat || '';

	const templateModelInput = document.getElementById('template-model') as HTMLInputElement;
	if (templateModelInput) templateModelInput.value = editingTemplate.model ?? '';

	updateBehaviorFields();

	if (behaviorSelect) {
		behaviorSelect.addEventListener('change', updateBehaviorFields);
	}

	if (editingTemplate && Array.isArray(editingTemplate.properties)) {
		editingTemplate.properties.forEach(property => addPropertyToEditor(property.name, property.value, property.type, property.id));
	}

	const triggersTextarea = document.getElementById('url-patterns') as HTMLTextAreaElement;
	if (triggersTextarea) triggersTextarea.value = editingTemplate && editingTemplate.triggers ? editingTemplate.triggers.join('\n') : '';

	const templateEditor = document.getElementById('template-editor');
	if (templateEditor) templateEditor.style.display = 'block';
	const templatesSection = document.getElementById('templates-section');
	if (templatesSection) templatesSection.style.display = 'block';
	const generalSection = document.getElementById('general-section');
	if (generalSection) generalSection.style.display = 'none';

	document.querySelectorAll('.sidebar li[data-section]').forEach(item => item.classList.remove('active'));
	document.querySelectorAll('#template-list li').forEach(item => item.classList.remove('active'));
	if (editingTemplateIndex !== -1) {
		const activeTemplateItem = document.querySelector(`#template-list li[data-id="${templates[editingTemplateIndex].id}"]`);
		if (activeTemplateItem) {
			activeTemplateItem.classList.add('active');
		}
	}

	if (templatesSection) templatesSection.classList.add('active');
	if (generalSection) generalSection.classList.remove('active');

	updateTemplateList();

	if (!editingTemplate.id) {
		const templateNameField = document.getElementById('template-name') as HTMLInputElement;
		if (templateNameField) {
			templateNameField.focus();
			templateNameField.select();
		}
	}

	resetUnsavedChanges();

	if (templateName) {
		templateName.addEventListener('input', () => {
			if (editingTemplateIndex !== -1 && templates[editingTemplateIndex]) {
				templates[editingTemplateIndex].name = templateName.value;
				updateTemplateList();
			}
		});
	}

	const vaultSelect = document.getElementById('template-vault') as HTMLSelectElement;
	if (vaultSelect) {
		vaultSelect.innerHTML = '<option value="">Last used</option>';
		generalSettings.vaults.forEach(vault => {
			const option = document.createElement('option');
			option.value = vault;
			option.textContent = vault;
			vaultSelect.appendChild(option);
		});
		vaultSelect.value = editingTemplate.vault || '';
	}

	populateAIChatFields(editingTemplate);

	// userAttribute 판별 방식 변경 시 동적 필드 재렌더링
	const userAttrTypeSelect = document.getElementById('chat-user-attr-type') as HTMLSelectElement;
	if (userAttrTypeSelect) {
		const newSelect = userAttrTypeSelect.cloneNode(true) as HTMLSelectElement;
		userAttrTypeSelect.replaceWith(newSelect);
		newSelect.addEventListener('change', () => renderUserAttrFields());
	}

	updateUrl('templates', editingTemplate.id);
}

function updateBehaviorFields(): void {
	const behaviorSelect = document.getElementById('template-behavior') as HTMLSelectElement;
	const specificNoteContainer = document.getElementById('specific-note-container');
	const dailyNoteFormatContainer = document.getElementById('daily-note-format-container');
	const noteNameFormatContainer = document.getElementById('note-name-format-container');
	const propertiesContainer = document.getElementById('properties-container');
	const propertiesWarning = document.getElementById('properties-warning');

	if (behaviorSelect) {
		const selectedBehavior = behaviorSelect.value;
		if (specificNoteContainer) specificNoteContainer.style.display = selectedBehavior === 'append-specific' ? 'block' : 'none';
		if (dailyNoteFormatContainer) dailyNoteFormatContainer.style.display = selectedBehavior === 'append-daily' ? 'block' : 'none';
		if (noteNameFormatContainer) noteNameFormatContainer.style.display = selectedBehavior === 'create' ? 'block' : 'none';
		
		if (selectedBehavior === 'append-specific' || selectedBehavior === 'append-daily') {
			if (propertiesContainer) propertiesContainer.style.display = 'none';
			if (propertiesWarning) propertiesWarning.style.display = 'block';
		} else {
			if (propertiesContainer) propertiesContainer.style.display = 'block';
			if (propertiesWarning) propertiesWarning.style.display = 'none';
		}
	}
}

export function deleteTemplate(templateId: string): void {
	const index = templates.findIndex(t => t.id === templateId);
	if (index !== -1) {
		if (confirm(`Are you sure you want to delete the template "${templates[index].name}"?`)) {
			templates.splice(index, 1);

			if (editingTemplateIndex === index) {
				if (templates.length > 0) {
					const newIndex = Math.max(0, index - 1);
					showTemplateEditor(templates[newIndex]);
				} else {
					clearTemplateEditor();
				}
			} else if (editingTemplateIndex > index) {
				setEditingTemplateIndex(editingTemplateIndex - 1);
			}
			
			saveTemplateSettings();
			updateTemplateList();
		}
	}
}

export function addPropertyToEditor(name: string = '', value: string = '', type: string = 'text', id: string | null = null): void {
	const templateProperties = document.getElementById('template-properties');
	if (!templateProperties) return;

	const propertyId = id || Date.now().toString() + Math.random().toString(36).slice(2, 11);
	const propertyDiv = document.createElement('div');
	propertyDiv.className = 'property-editor';
	propertyDiv.innerHTML = `
		<div class="drag-handle">
			<i data-lucide="grip-vertical"></i>
		</div>
		<div class="property-select">
			<div class="property-selected" data-value="${type}">
				<i data-lucide="${getPropertyTypeIcon(type)}"></i>
			</div>
			<select class="property-type" id="${propertyId}-type">
				<option value="text">Text</option>
				<option value="multitext">List</option>
				<option value="number">Number</option>
				<option value="checkbox">Checkbox</option>
				<option value="date">Date</option>
				<option value="datetime">Date & time</option>
			</select>
		</div>
		<input type="text" class="property-name" id="${propertyId}-name" value="${name}" placeholder="Property name">
		<input type="text" class="property-value" id="${propertyId}-value" value="${escapeHtml(unescapeValue(value))}" placeholder="Property value">
		<button type="button" class="remove-property-btn clickable-icon" aria-label="Remove property">
			<i data-lucide="trash-2"></i>
		</button>
	`;
	propertyDiv.dataset.id = propertyId;
	templateProperties.appendChild(propertyDiv);

	propertyDiv.addEventListener('mousedown', (event) => {
		const target = event.target as HTMLElement;
		if (!target.closest('input, select, button')) {
			propertyDiv.setAttribute('draggable', 'true');
			templateProperties.querySelectorAll('.property-editor').forEach((el) => {
				if (el !== propertyDiv) {
					el.setAttribute('draggable', 'true');
				}
			});
		}
	});

	const resetDraggable = () => {
		propertyDiv.removeAttribute('draggable');
		templateProperties.querySelectorAll('.property-editor').forEach((el) => {
			el.removeAttribute('draggable');
		});
	};

	propertyDiv.addEventListener('dragend', resetDraggable);
	propertyDiv.addEventListener('mouseup', resetDraggable);

	const propertySelect = propertyDiv.querySelector('.property-select');
	if (!propertySelect) return;

	const propertySelected = propertySelect.querySelector('.property-selected');
	const hiddenSelect = propertySelect.querySelector('select');

	if (hiddenSelect) {
		hiddenSelect.value = type;

		hiddenSelect.addEventListener('change', function() {
			if (propertySelected) updateSelectedOption(this.value, propertySelected as HTMLElement);
		});
	}

	const removePropertyBtn = propertyDiv.querySelector('.remove-property-btn');
	if (removePropertyBtn) {
		removePropertyBtn.addEventListener('click', () => {
			templateProperties.removeChild(propertyDiv);
		});
	}

	propertyDiv.addEventListener('dragstart', handleDragStart);
	propertyDiv.addEventListener('dragover', handleDragOver);
	propertyDiv.addEventListener('drop', handleDrop);
	propertyDiv.addEventListener('dragend', handleDragEnd);

	if (propertySelected) updateSelectedOption(type, propertySelected as HTMLElement);

	initializeIcons(propertyDiv);
}

function updateSelectedOption(value: string, propertySelected: HTMLElement): void {
	const iconName = getPropertyTypeIcon(value);
	propertySelected.innerHTML = `<i data-lucide="${iconName}"></i>`;
	propertySelected.setAttribute('data-value', value);
	initializeIcons(propertySelected);
}

export function updateTemplateFromForm(): void {
	if (editingTemplateIndex === -1) return;

	const template = templates[editingTemplateIndex];
	if (!template) {
		console.error('Template not found');
		return;
	}

	const behaviorSelect = document.getElementById('template-behavior') as HTMLSelectElement;
	if (behaviorSelect) template.behavior = behaviorSelect.value;

	const pathInput = document.getElementById('template-path-name') as HTMLInputElement;
	if (pathInput) template.path = pathInput.value;

	const noteNameFormat = document.getElementById('note-name-format') as HTMLInputElement;
	if (noteNameFormat) template.noteNameFormat = noteNameFormat.value;

	const specificNoteName = document.getElementById('specific-note-name') as HTMLInputElement;
	if (specificNoteName) template.specificNoteName = specificNoteName.value;

	const dailyNoteFormat = document.getElementById('daily-note-format') as HTMLInputElement;
	if (dailyNoteFormat) template.dailyNoteFormat = dailyNoteFormat.value;

	const noteContentFormat = document.getElementById('note-content-format') as HTMLTextAreaElement;
	if (noteContentFormat) template.noteContentFormat = noteContentFormat.value;

	const templateModelInput = document.getElementById('template-model') as HTMLInputElement;
	template.model = templateModelInput?.value.trim() || undefined;

	const propertyElements = document.querySelectorAll('#template-properties .property-editor');
	template.properties = Array.from(propertyElements).map(prop => {
		const nameInput = prop.querySelector('.property-name') as HTMLInputElement;
		const valueInput = prop.querySelector('.property-value') as HTMLInputElement;
		const typeSelect = prop.querySelector('.property-select .property-selected') as HTMLElement;
		return {
			id: (prop as HTMLElement).dataset.id || Date.now().toString() + Math.random().toString(36).slice(2, 11),
			name: nameInput.value,
			value: escapeValue(valueInput.value),
			type: typeSelect.getAttribute('data-value') || 'text'
		};
	});

	const triggersTextarea = document.getElementById('url-patterns') as HTMLTextAreaElement;
	if (triggersTextarea) template.triggers = triggersTextarea.value.split('\n').filter(Boolean);

	const vaultSelect = document.getElementById('template-vault') as HTMLSelectElement;
	if (vaultSelect) template.vault = vaultSelect.value || undefined;

	readAIChatFields(template);

	hasUnsavedChanges = true;
}

function clearTemplateEditor(): void {
	setEditingTemplateIndex(-1);
	const templateEditorTitle = document.getElementById('template-editor-title');
	const templateName = document.getElementById('template-name') as HTMLInputElement;
	const templateProperties = document.getElementById('template-properties');
	if (templateEditorTitle) templateEditorTitle.textContent = 'New template';
	if (templateName) templateName.value = '';
	if (templateProperties) templateProperties.innerHTML = '';
	const pathInput = document.getElementById('template-path-name') as HTMLInputElement;
	if (pathInput) pathInput.value = 'Clippings';
	const triggersTextarea = document.getElementById('url-patterns') as HTMLTextAreaElement;
	if (triggersTextarea) triggersTextarea.value = '';
	const templateEditor = document.getElementById('template-editor');
	if (templateEditor) templateEditor.style.display = 'none';
}

export function initializeAddPropertyButton(): void {
	const addPropertyBtn = document.getElementById('add-property-btn');
	if (addPropertyBtn) {
		addPropertyBtn.removeEventListener('click', handleAddProperty);
		addPropertyBtn.addEventListener('click', handleAddProperty);
	} else {
		console.error('Add property button not found');
	}
}

function handleAddProperty(): void {
	addPropertyToEditor();
	if (editingTemplateIndex !== -1) {
		updateTemplateFromForm();
	}
}

// ──────────────────────────────────────────────────────
// AI Chat 설정 UI 함수
// ──────────────────────────────────────────────────────

function populateAIChatFields(template: Template): void {
	const emojiInput = document.getElementById('chat-emoji') as HTMLInputElement;
	const authorLabelInput = document.getElementById('chat-author-label') as HTMLInputElement;
	const titlePrefixInput = document.getElementById('chat-title-prefix') as HTMLInputElement;

	if (emojiInput) emojiInput.value = template.emoji ?? '';
	if (authorLabelInput) authorLabelInput.value = template.authorLabel ?? '';
	if (titlePrefixInput) titlePrefixInput.value = template.titlePrefix ?? '';

	const sc = template.siteConfig;

	const hostnameInput = document.getElementById('chat-hostname') as HTMLInputElement;
	const messageSelectorInput = document.getElementById('chat-message-selector') as HTMLInputElement;
	const contentSelectorInput = document.getElementById('chat-content-selector') as HTMLInputElement;
	const ignoreSelectorInput = document.getElementById('chat-ignore-selector') as HTMLInputElement;
	const deduplicateCheckbox = document.getElementById('chat-deduplicate') as HTMLInputElement;
	const scrollToLoadCheckbox = document.getElementById('chat-scroll-to-load') as HTMLInputElement;

	if (sc) {
		if (hostnameInput) hostnameInput.value = sc.hostname ?? '';
		if (messageSelectorInput) messageSelectorInput.value = sc.messageSelector ?? '';
		if (contentSelectorInput) contentSelectorInput.value = sc.contentSelector ?? '';
		if (ignoreSelectorInput) ignoreSelectorInput.value = sc.ignoreSelector ?? '';
		if (deduplicateCheckbox) deduplicateCheckbox.checked = sc.deduplicate ?? false;
		if (scrollToLoadCheckbox) scrollToLoadCheckbox.checked = sc.scrollToLoad ?? false;

		// userAttribute 판별 방식 결정 (레거시 필드가 있을 때만 처리)
		if (sc.userAttribute) {
			let attrType = 'attr';
			if ('tag' in sc.userAttribute) attrType = 'tag';
			else if ('containerSelector' in sc.userAttribute) attrType = 'containerSelector';
			else if ('htmlMatch' in sc.userAttribute) attrType = 'htmlMatch';

			const typeSelect = document.getElementById('chat-user-attr-type') as HTMLSelectElement;
			if (typeSelect) typeSelect.value = attrType;
			renderUserAttrFields(sc.userAttribute);
		}
	} else {
		if (hostnameInput) hostnameInput.value = '';
		if (messageSelectorInput) messageSelectorInput.value = '';
		if (contentSelectorInput) contentSelectorInput.value = '';
		if (ignoreSelectorInput) ignoreSelectorInput.value = '';
		if (deduplicateCheckbox) deduplicateCheckbox.checked = false;
		if (scrollToLoadCheckbox) scrollToLoadCheckbox.checked = false;
		// 판별 방식을 기본값(attr)으로 리셋하여 이전 템플릿의 선택이 남지 않도록 한다
		const typeSelect = document.getElementById('chat-user-attr-type') as HTMLSelectElement;
		if (typeSelect) typeSelect.value = 'attr';
		renderUserAttrFields();
	}

	// ExtractionConfig fields
	const rootSelectorInput = document.getElementById('chat-root-selector') as HTMLInputElement;
	const userMsgSelectorInput = document.getElementById('chat-user-message-selector') as HTMLInputElement;
	const modelMsgSelectorsTA = document.getElementById('chat-model-message-selectors') as HTMLTextAreaElement;
	const extractionIgnoreInput = document.getElementById('chat-extraction-ignore-selector') as HTMLInputElement;
	const extractionModelSelectorInput = document.getElementById('chat-extraction-model-selector') as HTMLInputElement;
	const extractionDeduplicateCheckbox = document.getElementById('chat-extraction-deduplicate') as HTMLInputElement;
	const ec = sc?.extractionConfig;
	if (rootSelectorInput) rootSelectorInput.value = ec?.rootSelector ?? '';
	if (userMsgSelectorInput) userMsgSelectorInput.value = ec?.userMessageSelector ?? '';
	if (modelMsgSelectorsTA) modelMsgSelectorsTA.value = (ec?.modelMessageSelectors ?? []).join('\n');
	if (extractionIgnoreInput) extractionIgnoreInput.value = ec?.ignoreSelector ?? '';
	if (extractionModelSelectorInput) extractionModelSelectorInput.value = ec?.modelSelector ?? '';
	if (extractionDeduplicateCheckbox) extractionDeduplicateCheckbox.checked = ec?.deduplicate ?? false;

}

export function renderPostProcessRules(container: HTMLElement | null, rules?: PostProcessRule[]): void {
	if (!container) return;
	container.innerHTML = '';
	(rules ?? []).forEach(rule => addPostProcessRuleRow(container, rule));
}

export function addPostProcessRuleRow(container: HTMLElement, rule?: PostProcessRule): void {
	const row = document.createElement('div');
	row.className = 'post-process-rule-row';
	row.innerHTML = `
		<input type="text" class="rule-label" placeholder="설명 (선택)" value="${escapeHtml(rule?.label ?? '')}" />
		<input type="text" class="rule-pattern" placeholder="패턴 (regex)" value="${escapeHtml(rule?.pattern ?? '')}" />
		<input type="text" class="rule-flags" placeholder="플래그 (예: gm)" value="${escapeHtml(rule?.flags ?? 'gm')}" />
		<input type="text" class="rule-replacement" placeholder="치환 문자열" value="${escapeHtml(rule?.replacement ?? '')}" />
		<button type="button" class="remove-rule-btn clickable-icon" aria-label="규칙 제거"><i data-lucide="trash-2"></i></button>
	`;
	const removeBtn = row.querySelector('.remove-rule-btn');
	if (removeBtn) {
		removeBtn.addEventListener('click', () => container.removeChild(row));
	}
	container.appendChild(row);
	initializeIcons(row);
}

export function readPostProcessRules(container: HTMLElement | null): PostProcessRule[] {
	if (!container) return [];
	const rules: PostProcessRule[] = [];
	container.querySelectorAll('.post-process-rule-row').forEach(row => {
		const label = (row.querySelector('.rule-label') as HTMLInputElement)?.value.trim();
		const pattern = (row.querySelector('.rule-pattern') as HTMLInputElement)?.value.trim();
		const flags = (row.querySelector('.rule-flags') as HTMLInputElement)?.value.trim();
		const replacement = (row.querySelector('.rule-replacement') as HTMLInputElement)?.value ?? '';
		if (pattern) {
			const r: PostProcessRule = { pattern, flags: flags || 'g', replacement };
			if (label) r.label = label;
			rules.push(r);
		}
	});
	return rules;
}
function renderUserAttrFields(existingAttr?: UserAttribute): void {
	const container = document.getElementById('user-attr-fields');
	if (!container) return;

	const typeSelect = document.getElementById('chat-user-attr-type') as HTMLSelectElement;
	const type = typeSelect?.value ?? 'attr';

	let html = '';

	if (type === 'attr') {
		const attr = existingAttr && 'attr' in existingAttr ? existingAttr.attr : '';
		const value = existingAttr && 'attr' in existingAttr ? existingAttr.value : '';
		html = `
			<div class="setting-item">
				<label for="user-attr-attr">속성명</label>
				<input type="text" id="user-attr-attr" placeholder="data-message-author-role" value="${escapeHtml(attr)}" />
			</div>
			<div class="setting-item">
				<label for="user-attr-value">속성값</label>
				<input type="text" id="user-attr-value" placeholder="user" value="${escapeHtml(value)}" />
			</div>
		`;
	} else if (type === 'tag') {
		const tag = existingAttr && 'tag' in existingAttr ? existingAttr.tag : '';
		html = `
			<div class="setting-item">
				<label for="user-attr-tag">태그명</label>
				<input type="text" id="user-attr-tag" placeholder="user-query" value="${escapeHtml(tag)}" />
			</div>
		`;
	} else if (type === 'containerSelector') {
		const cs = existingAttr && 'containerSelector' in existingAttr ? existingAttr : null;
		html = `
			<div class="setting-item">
				<label for="user-attr-container">컨테이너 선택자</label>
				<input type="text" id="user-attr-container" placeholder=".turn-content" value="${escapeHtml(cs?.containerSelector ?? '')}" />
			</div>
			<div class="setting-item">
				<label for="user-attr-user-class">사용자 클래스 (쉼표 구분)</label>
				<input type="text" id="user-attr-user-class" placeholder="human-turn" value="${escapeHtml(cs?.userClass.join(', ') ?? '')}" />
			</div>
			<div class="setting-item">
				<label for="user-attr-ai-class">AI 클래스 (쉼표 구분)</label>
				<input type="text" id="user-attr-ai-class" placeholder="model-response" value="${escapeHtml(cs?.aiClass.join(', ') ?? '')}" />
			</div>
		`;
	} else if (type === 'htmlMatch') {
		const hm = existingAttr && 'htmlMatch' in existingAttr ? existingAttr.htmlMatch : [];
		html = `
			<div class="setting-item">
				<label for="user-attr-html-match">HTML 키워드 (쉼표 구분)</label>
				<div class="setting-item-description">사용자 메시지의 HTML에 포함된 키워드</div>
				<input type="text" id="user-attr-html-match" placeholder="user-message, from-user" value="${escapeHtml(hm.join(', '))}" />
			</div>
		`;
	}

	container.innerHTML = html;
}

function readUserAttribute(type: string): UserAttribute {
	if (type === 'attr') {
		const attr = (document.getElementById('user-attr-attr') as HTMLInputElement)?.value ?? '';
		const value = (document.getElementById('user-attr-value') as HTMLInputElement)?.value ?? '';
		return { attr, value };
	} else if (type === 'tag') {
		const tag = (document.getElementById('user-attr-tag') as HTMLInputElement)?.value ?? '';
		return { tag };
	} else if (type === 'containerSelector') {
		const containerSelector = (document.getElementById('user-attr-container') as HTMLInputElement)?.value ?? '';
		const userClassStr = (document.getElementById('user-attr-user-class') as HTMLInputElement)?.value ?? '';
		const aiClassStr = (document.getElementById('user-attr-ai-class') as HTMLInputElement)?.value ?? '';
		const userClass = userClassStr.split(',').map(s => s.trim()).filter(Boolean);
		const aiClass = aiClassStr.split(',').map(s => s.trim()).filter(Boolean);
		return { containerSelector, userClass, aiClass };
	} else {
		const htmlMatchStr = (document.getElementById('user-attr-html-match') as HTMLInputElement)?.value ?? '';
		const htmlMatch = htmlMatchStr.split(',').map(s => s.trim()).filter(Boolean);
		return { htmlMatch };
	}
}

function readAIChatFields(template: Template): void {
	const emoji = (document.getElementById('chat-emoji') as HTMLInputElement)?.value.trim();
	const authorLabel = (document.getElementById('chat-author-label') as HTMLInputElement)?.value.trim();
	const titlePrefix = (document.getElementById('chat-title-prefix') as HTMLInputElement)?.value;

	template.emoji = emoji || undefined;
	template.authorLabel = authorLabel || undefined;
	template.titlePrefix = titlePrefix || undefined;

	const hostname = (document.getElementById('chat-hostname') as HTMLInputElement)?.value.trim();

	if (!hostname) {
		// 호스트명 없음 = AI Chat 모드 비활성화
		template.siteConfig = undefined;
		return;
	}

	const typeSelect = document.getElementById('chat-user-attr-type') as HTMLSelectElement;
	const type = typeSelect?.value ?? 'attr';

	const contentSelector = (document.getElementById('chat-content-selector') as HTMLInputElement)?.value.trim();
	const ignoreSelector = (document.getElementById('chat-ignore-selector') as HTMLInputElement)?.value.trim();
	const deduplicate = (document.getElementById('chat-deduplicate') as HTMLInputElement)?.checked;
	const scrollToLoad = (document.getElementById('chat-scroll-to-load') as HTMLInputElement)?.checked;

	const siteConfig: SiteConfig = {
		hostname,
		messageSelector: (document.getElementById('chat-message-selector') as HTMLInputElement)?.value.trim() ?? '',
		userAttribute: readUserAttribute(type),
		...(contentSelector ? { contentSelector } : {}),
		...(ignoreSelector ? { ignoreSelector } : {}),
		...(deduplicate ? { deduplicate: true } : {}),
		...(scrollToLoad ? { scrollToLoad: true } : {}),
	};

	// ExtractionConfig (new structural extraction — takes precedence when present)
	const userMsgSel = (document.getElementById('chat-user-message-selector') as HTMLInputElement)?.value.trim();
	const modelMsgRaw = (document.getElementById('chat-model-message-selectors') as HTMLTextAreaElement)?.value ?? '';
	const modelMsgSelectors = modelMsgRaw.split('\n').map(s => s.trim()).filter(Boolean);
	if (userMsgSel || modelMsgSelectors.length > 0) {
		const rootSel = (document.getElementById('chat-root-selector') as HTMLInputElement)?.value.trim();
		const extIgnore = (document.getElementById('chat-extraction-ignore-selector') as HTMLInputElement)?.value.trim();
		const extModelSel = (document.getElementById('chat-extraction-model-selector') as HTMLInputElement)?.value.trim();
		const extDedup = (document.getElementById('chat-extraction-deduplicate') as HTMLInputElement)?.checked;
		const extractionConfig: ExtractionConfig = {
			userMessageSelector: userMsgSel,
			modelMessageSelectors: modelMsgSelectors,
			...(rootSel ? { rootSelector: rootSel } : {}),
			...(extIgnore ? { ignoreSelector: extIgnore } : {}),
			...(extModelSel ? { modelSelector: extModelSel } : {}),
			...(extDedup ? { deduplicate: true } : {}),
		};
		siteConfig.extractionConfig = extractionConfig;
	} else {
		siteConfig.extractionConfig = undefined;
	}

	template.siteConfig = siteConfig;
}
