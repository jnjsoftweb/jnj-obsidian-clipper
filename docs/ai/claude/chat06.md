"""
frontmatter에 user를 추가해주세요.

현재 웹페이지에서 마크다운을 생성하는 과정을

아래와 같은 마크다운 생성에 관련된 설정을 사이트 템플릿(AI Chat 설정)들에 적용하고 싶어요.
현재 AI Chat 설정과 비교하여, 적용 유연성이 좋은 방향으로 설계하고, 아래의 설정 외에 필요한 사항이 있으면 제안해주세요.

1. html 선택 -> markdown 추출

1-1. 루트 선택자(root selector) 지정
 - 추출하고자 하는 컨텐츠를 모두 포함하는 최소 영역 선택자

1-2. 무시 선택자(exclusion selector) 지정
- 제거할 UI 요소의 선택자

1-3. 사용자 메시지 선택자 지정
- 사용자 채팅(질의) 영역 지정(단일 선택자)

1-4. 모델 메시지 선택자 지정
- 답변이 복수개 있을 수 있으므로 다중 선택자
- 컨텐츠의 html 태그들이 복잡할 수 있으므로 html -> markdown 과정(turndown) 필요


2. markdown 문자열 사후 보정
예: 
- 줄 끝에 있는 공백문자 제거: '\s+$' -> '' 
- 리스트의 공백라인 제거: '-(.+)\n{2,}' -> '-\1'


소스를 수정하도록 해주세요.
"""

  ---                                                                                                                       설계 및 변경 요약
  
  타입 설계 (site-config.ts)                                                                                              

  현재                          →  신규
  ──────────────────────────────────────────────────────────
  messageSelector (단일)         →  ExtractionConfig.userMessageSelector
  userAttribute (4가지 전략)     →  ExtractionConfig.modelMessageSelectors[]
  contentSelector               →  (선택자에 직접 포함)
  ignoreSelector                →  ExtractionConfig.ignoreSelector
  modelSelector (SiteConfig)    →  ExtractionConfig.modelSelector
  deduplicate (SiteConfig)      →  ExtractionConfig.deduplicate

  추가된 신규 타입:

  ┌──────────────────────────────┬─────────────────────────────────────────────────────────────────┐
  │             타입             │                              역할                               │
  ├──────────────────────────────┼─────────────────────────────────────────────────────────────────┤
  │ ExtractionConfig             │ 1-1~1-4 명시적 선택자 설정                                      │
  ├──────────────────────────────┼─────────────────────────────────────────────────────────────────┤
  │ PostProcessRule              │ 2. regex 사후 보정 규칙 (pattern / flags / replacement / label) │
  ├──────────────────────────────┼─────────────────────────────────────────────────────────────────┤
  │ ChatFormat.postProcessRules? │ 보정 규칙 배열                                                  │
  ├──────────────────────────────┼─────────────────────────────────────────────────────────────────┤
  │ ChatFormat.includeTitle?     │ # 제목 H1 포함 여부 (기본 true)                                 │
  └──────────────────────────────┴─────────────────────────────────────────────────────────────────┘

  추출 로직 (ai-chat-extractor.ts)

  - 신규 경로 (extractionConfig 있을 때): user/model 요소를 각각 수집 → compareDocumentPosition으로 DOM 순서 정렬 → 대화  
  순서 보존
  - 레거시 경로 (기존 messageSelector + userAttribute): 기존 로직 유지, 하위 호환
  - applyPostProcessRules(): 규칙 배열을 순서대로 적용, 잘못된 regex는 경고만 출력
  - assembleMarkdown() / wrapMarkdown(): 조립 로직 공통 함수로 분리

  기본 템플릿 변경

  ┌──────────────────┬──────────────────────────────────────────────────────────────────┐
  │      템플릿      │                            추출 방식                             │
  ├──────────────────┼──────────────────────────────────────────────────────────────────┤
  │ ChatGPT          │ extractionConfig (data-message-author-role 속성 직접 필터)       │
  ├──────────────────┼──────────────────────────────────────────────────────────────────┤
  │ Claude           │ extractionConfig (사용자/응답 클래스 분리)                       │
  ├──────────────────┼──────────────────────────────────────────────────────────────────┤
  │ Gemini           │ extractionConfig (user-query / model-response 커스텀 태그)       │
  ├──────────────────┼──────────────────────────────────────────────────────────────────┤
  │ Google AI Studio │ extractionConfig (.chat-turn-container.user/model .turn-content) │
  ├──────────────────┼──────────────────────────────────────────────────────────────────┤
  │ Genspark         │ 레거시 유지 (DOM 구조 불명확, htmlMatch 방식)                    │
  └──────────────────┴──────────────────────────────────────────────────────────────────┘

  사후 보정 공통 규칙 (COMMON_POST_PROCESS_RULES)

  { pattern: '\\s+$',                       flags: 'gm', replacement: ''    },  // 줄 끝 공백
  { pattern: '(- [^\\n]+)\\n{2,}(?=-)',     flags: 'gm', replacement: '$1\n' }  // 리스트 빈줄


=========================

"""
[{"user": {"html": html_source, "markdown: "markdown_content"}, , "model": [{"html": html_source, "markdown: "markdown_content"}, ...]}, {"user": markdown_content, "model": [markdown_content1, markdown_content2, ...]}, ...]
와 같이

{"user": {"html": html_source, "markdown: markdown_content}, , "model": [{"html": html_source, "markdown: markdown_content}, ...]} 를 하나의 대화(QA) 단위로 하는 json 배열을 순차적으로 만들고, 이 데이터에서 주어진 형식(설정)에 맞게 필요한 마크다운 데이터를 추출하는 것은 어떤가요?
"""

---                                                                                                                       아키텍처 변경 요약                                                                                                      
                                                                                                                            데이터 흐름 (전 → 후)                                                                                                                                                                                                                               [전] DOM → content script에서 markdown 완성 → popup 전달                                                                
  [후] DOM → content script에서 QASession(중간 표현) 생성 → popup에서 포맷 조립

  새 타입 (site-config.ts)

  MessageContent { html: string; markdown: string }   // 메시지 1개
  QAPair { user: MessageContent; model: MessageContent[] }  // 대화 1회전
  QASession = QAPair[]                                 // 전체 대화

  역할 분리

  ┌──────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────┐   
  │                 위치                 │                                    역할                                    │   
  ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤   
  │ content script                       │ DOM에서 QASession 추출. 반환: {session, messageCount, modelName,           │   
  │ (extractAIChatContent)               │ pageTitle}                                                                 │   
  ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤   
  │ popup (formatQASession)              │ QASession + ChatFormat → 마크다운 조립 + postProcessRules 적용             │   
  ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤   
  │ popup (buildAIChatVariables)         │ 마크다운 → {{변수}} 맵 (기존과 동일)                                       │   
  └──────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────┘   

  핵심 이점

  1. 모델 응답 복수 지원: model: MessageContent[] 배열로 재생성(regenerate) 응답 여러 개 자연스럽게 처리
  2. 포맷 변경 시 DOM 재접근 불필요: QASession이 남아 있으면 formatQASession()만 재호출
  3. HTML 원본 보존: MessageContent.html에 정리된 HTML 보관 → 향후 popup에서 Turndown 재변환 가능
  4. postProcessRules가 popup에서 실행: 포맷팅 전체가 popup 컨텍스트에서 완결
  5. 번들 크기: content.js 7.78 KiB (이전 8.12 KiB) — 포맷팅 로직이 popup으로 이동하면서 소폭 감소


======================

"""
markdown 생성에 관련된 설정들을 페이지별 Template의 'AI Chat 설정'에서 지정할 수 있도록 해주세요.
"""

  ---
  변경 파일 요약

  src/settings.html

  Template AI Chat 설정 섹션에 두 가지 블록 추가:

  구조적 추출 설정 (레거시 섹션 뒤, 사용자 메시지 판별 앞):
  - 루트 선택자 — 추출 대상 최소 포함 영역 (선택)
  - 사용자 메시지 선택자 — 사용자 메시지 CSS selector
  - 모델 메시지 선택자 — textarea, 한 줄에 하나씩 (다중 지원)
  - 무시 선택자 — 제거할 UI 요소 (구조적 추출 전용)
  - AI 모델명 선택자 — 모델명 추출 CSS selector (선택)
  - 중복 제거 — 체크박스

  대화 형식 섹션에 추가:
  - 제목 포함 — includeTitle 체크박스
  - 사후 보정 규칙 — 동적 목록 (설명/패턴/플래그/치환문자 + 제거 버튼), + 규칙 추가 버튼

  src/styles/settings.scss

  .post-process-rule-row 스타일 추가 — 5열 그리드 (설명 1fr / 패턴 2fr / 플래그 56px / 치환 2fr / 버튼 auto)

  src/managers/template-ui.ts

  - ExtractionConfig, PostProcessRule import 추가
  - populateAIChatFields() — ExtractionConfig 필드 채우기 + includeTitle + renderPostProcessRules() 호출
  - readAIChatFields() — ExtractionConfig 읽어서 siteConfig.extractionConfig 쓰기, includeTitle + postProcessRules 쓰기
  - 신규 함수 3개: renderPostProcessRules(), addPostProcessRuleRow(), readPostProcessRules()
  - showTemplateEditor() — add-post-process-rule-btn 이벤트 연결


======================

"""
google ai studio 의 경우 model 프론트매터의 값이 'Model 7:26 AM' 와 같이 시간으로 설정되네요. {{model}} 값은 어디서 결정되고 있나요?
"""

● {{model}} 값의 결정 흐름을 정리하면:                                                                   
                        
  1. DOM 추출 — ai-chat-extractor.ts extractWithConfig() line 262-263:                                   
  const modelSel = config.modelSelector ?? siteConfig.modelSelector;                                       const modelName = modelSel ? (document.querySelector(modelSel)?.textContent?.trim() ?? '') : '';       
  → AI Studio의 modelSelector는 .chat-turn-container.model .author-label                                 

  2. 변수 매핑 — buildAIChatVariables() line 421:
  const model = modelName || template.authorLabel || template.name;
  → {{model}} = modelName → 최종값

  ---
  원인: AI Studio의 .author-label 요소의 textContent가 모델명 + 타임스탬프를 모두 포함하고 있어서 "Model 
  7:26 AM" 형태로 추출됩니다.

  해결 방법 선택지:

  A) extractWithConfig()에서 타임스탬프 패턴 제거 (범용 수정)
  const modelName = rawModelName.replace(/\s*\d{1,2}:\d{2}\s*(AM|PM)?/gi, '').trim();
  → "Model 7:26 AM" → "Model" (단, "Model"이 실제 모델명이 아니라면 여전히 부정확)

  B) AI Studio 전용 더 정확한 selector 사용
  - 브라우저 DevTools에서 .author-label 내부 구조를 확인하여 모델명만 담긴 child element의 selector를    
  찾아야 합니다

  가장 먼저 확인할 것은 .author-label의 실제 DOM 구조입니다. AI Studio 페이지에서 DevTools → 해당 요소를 
  inspect해서 자식 요소 구조를 확인할 수 있나요? 아니면 A안(타임스탬프 제거)으로 바로 수정할까요?

=================

"""
model은 설정 화면에서 Edit template 상단 부분(Properties 윗부분)에 model 값을 지정하는 input을 추가해주세요.
그리고 그 model 값을 이후 Properties {{model}}에 사용할 수 있도록 해주세요.
"""

---

  변경 내역                                                                                              
                                                                                                           src/types/types.ts                                                                                                                                                                                              
  Template 인터페이스에 model?: string 필드 추가 (AI chat 전용 섹션 위)

  src/settings.html

  Properties 섹션 바로 위에 Model 입력 필드 추가:
  - {{model}} 변수로 참조할 모델명 설명 포함
  - id="template-model", placeholder: e.g. gpt-4o, claude-3-5-sonnet

  src/managers/template-ui.ts

  - showTemplateEditor(): editingTemplate.model 값으로 input 채우기
  - updateTemplateFromForm(): input 값을 template.model로 저장

  src/utils/ai-chat-extractor.ts — buildAIChatVariables()

  // 변경 전
  const model = modelName || template.authorLabel || template.name;
  // 변경 후
  const model = template.model || modelName || template.authorLabel || template.name;

  src/core/popup.ts — 두 곳 동일하게

  initializePageContent() 호출 직전에 model 주입 추가:
  if (currentTemplate.model) {
      extraVariables = extraVariables ?? {};
      extraVariables['{{model}}'] = currentTemplate.model;
  }

  ---
  동작 방식:
  - AI Chat 템플릿: template.model → DOM 추출 modelName → authorLabel → template 이름 순으로 {{model}}   
  결정
  - 일반 템플릿: template.model이 설정된 경우 {{model}}로 사용 가능 (예: Properties에서 model: {{model}})


==========================

"""
템플릿에 있는 'AI Chat 설정'에서

대화 형식(사용자 메시지 제목, AI 메시지 제목, 턴 구분자, Q&A 구분자, 제목 포함), 사후 보정 규칙 등은
Settings > General로 이동해주세요.

그리고 사후 보정 규칙에

제목(H1, H2, ...)앞 줄바꿈, 제목(H1, H2, ...)뒤 줄바꿈 규칙을 추가해주세요.
"""

---
제목앞 줄바꿈	\n#	\n\n#
제목뒤 줄바꿈	^(#+)(.+)\n	$1$2\n\n
---

  ---                                                                                                                               완료된 작업 요약                                                                                                                
                                                                                                                                    대화 형식 설정을 Template → General로 이동                                                                                                                                                                                                                        
  변경 내용

  ┌───────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────┐  
  │                 파일                  │                                     변경 사항                                      │  
  ├───────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────┤  
  │ src/core/popup.ts                     │ sendExtractAIChat 2곳 + formatQASession 2곳 모두 generalSettings.chatFormat 사용   │  
  ├───────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────┤  
  │ src/settings.html                     │ General 섹션에 AI Chat 대화 형식 블록 추가 (general-chat-* ID), Template AI Chat   │  
  │                                       │ 설정에서 대화 형식 섹션 제거                                                       │  
  ├───────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────┤  
  │ src/managers/general-settings.ts      │ initializeChatFormatSettings() 추가 — General UI 필드 초기화 + 변경 시 저장        │  
  ├───────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────┤  
  │ src/managers/template-ui.ts           │ renderPostProcessRules/addPostProcessRuleRow/readPostProcessRules export,          │  
  │                                       │ 시그니처를 container 인자 방식으로 변경; chatFormat 관련 populate/read 코드 제거   │  
  ├───────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────┤  
  │ src/data/default-ai-chat-templates.ts │ 5개 기본 템플릿에서 chatFormat 필드 제거                                           │  
  └───────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────┘  

  동작 방식

  - General Settings 페이지에서 사용자 메시지 제목, AI 메시지 제목, 턴/Q&A 구분자, 제목 포함, 사후 보정 규칙을 전역으로 설정      
  - aiTitleFormat의 {{siteEmoji}}, {{aiLabel}}는 클리핑 시 각 템플릿의 emoji/authorLabel 값으로 치환됨
  - 기본값은 storage-utils.ts의 DEFAULT_CHAT_FORMAT에 정의 (줄 끝 공백, 리스트 빈줄, 제목 앞·뒤 줄바꿈 규칙 포함)


================

"""
General Settings 페이지에서 사후 보정 규칙을 규칙 1개당 1줄로 UI를 수정해주세요. 지금은 여러줄로 되어 있네요.
"""

● 빌드 성공. 변경 내용:                                                                                                                                                                                                                                             
  settings.scss에 #general-post-process-rules-list > .post-process-rule-row 그리드 스타일 블록 추가:                                - 5열 그리드: 1fr 2fr 56px 2fr auto (설명 / 패턴 / 플래그 / 치환 / 삭제버튼)                                                    
  - gap: 4px, align-items: center — 1줄 레이아웃                                                                                    - &:empty { display: none } — 규칙 없을 때 컨테이너 숨김                                                                                                                                                                                                            이제 General Settings에서 사후 보정 규칙 각 항목이 한 줄에 표시됩니다. 

====================

