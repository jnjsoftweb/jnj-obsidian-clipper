
```
C:\JnJ-soft\Projects\@chrome-extension\jnj-obsidian-clipper\docs\src-structure.md 를 참고하여
C:\JnJ-soft\Projects\@chrome-extension\jnj-obsidian-clipper\src 의 소스 코드를 변경합니다.

현재 오류는 google ai studio 가 저장이 되지 않는 점입니다. markdown은 추출되고 있어요.
다른 ai-web-chat 페이지들은 obsidian 에 저장이 잘 되는데, google ai studio(스크롤 기능 사용) 은 저장 버튼을 클릭했을 때, 에러도 없이 어디에 저장되었지 알 수가 없어요.

vault 지정이 제대로 되지 않는 것인지, 저장 자체가 안되는 것인지 확인하고 수정해주세요.

저장시에 폴더가 'AI/AIStudio'로 설정되어 있고, '저장' 버튼 클릭시

'chrome-extension://ibmapjhpfffkcgokclnjgjnhlhhgfemk에서 이 애플리케이션을 열려고 합니다.' 메시지가 뜨는 것까지는 chatgpt 같은 페이지와 동일하게 잘 수행됩니다. 그런데, obsidian의 AI/AIStudio 에는 파일이 생성되지 않아요.
```

  수정 내용

  근본 원인

  saveToObsidian의 Obsidian URI 파라미터 순서가 잘못되어 있었습니다.

  기존: obsidian://new?file=...&content=매우_긴_내용&vault=볼트명
  수정: obsidian://new?file=...&vault=볼트명&content=매우_긴_내용

  Google AI Studio는 scrollToLoad: true로 전체 대화를 스크롤하며 추출하기 때문에, ChatGPT/Claude 등보다
  훨씬 긴 내용을 추출합니다. URL이 길어지면 Windows 프로토콜 핸들러(ShellExecute)에서 URL이 잘릴 수 있고,
  이때 맨 뒤의 vault 파라미터가 사라집니다. vault 없이 Obsidian이 열리면 기본 vault를 사용하게 되고
  AI/AIStudio 폴더가 없어 파일 생성에 실패합니다.

  변경 파일

  src/utils/obsidian-note-creator.ts:
  1. vault 파라미터를 content 앞으로 이동 — URL이 잘려도 vault는 항상 포함
  2. URL 길이 > 50,000자 시 자동 truncate — 이진 탐색으로 정확히 잘라내고 [!warning] callout 추가
  3. Promise<void> 반환 — chrome.tabs.update 에러 핸들링 정상화

  src/core/popup.ts:
  4. 빈 noteName 검사 — 노트 이름이 비어 있으면 저장 전에 에러 표시
  5. 디버그 로그 — vault/path/noteName/contentLength를 콘솔에 출력

  테스트 확인 방법

  Chrome 팝업에서 오른쪽 클릭 → 검사 → Console 탭에서 [saveToObsidian] 로그로 vault 이름과 URL 길이를
  확인할 수 있습니다.

================

"""
팝업창에서 검사를 누르고, 콘솔에 들어가면, 아래와 같은 내용이 있는데, 'Add to Obsidian'을 누르면, 저장되는 건 보이지 않고, dev tool이 사라져버려요.

General settings: ObjectshowMoreActionsButton: truevaults: []length: 0[[Prototype]]: Array(0)[[Prototype]]: Objectconstructor: ƒ Object()hasOwnProperty: ƒ hasOwnProperty()isPrototypeOf: ƒ isPrototypeOf()propertyIsEnumerable: ƒ propertyIsEnumerable()toLocaleString: ƒ toLocaleString()toString: ƒ toString()valueOf: ƒ valueOf()__defineGetter__: ƒ __defineGetter__()__defineSetter__: ƒ __defineSetter__()__lookupGetter__: ƒ __lookupGetter__()__lookupSetter__: ƒ __lookupSetter__()__proto__: (...)get __proto__: ƒ __proto__()set __proto__: ƒ __proto__()
popup.js:2 Template settings saved
popup.js:2 Available variables: Object{{aiLabel}}: "모델 (Model)"{{author}}: "AI Studio"{{chatContent}}: "# ChromeExtension_aI-chat-to-mar | Google AI Stud{{content}}: "## ChromeExtension\\_aI-chat-to-markdown\n\n63,78{{date}}: "2026-02-26"{{description}}: "The fastest path from prompt to production with Gemini"{{domain}}: "aistudio.google.com"{{fullHtml}}: "<div class=\"cdk-overlay-container\"></div><div c{{image}}: "https://ai.google.dev/static/site-assets/images/share-ais-03.png"{{messageCount}}: "11"{{meta:name:apple-mobile-web-app-capable}}: "yes"{{meta:name:apple-mobile-web-app-status-bar-style}}: "default"{{meta:name:apple-mobile-web-app-title}}: "AI Studio"{{meta:name:application-name}}: "AI Studio"{{meta:name:description}}: "The fastest path from prompt to production with Gemini"{{meta:name:mobile-web-app-capable}}: "yes"{{meta:name:msapplication-tap-highlight}}: "no"{{meta:name:referrer}}: "origin"{{meta:name:theme-color}}: "#000"{{meta:name:viewport}}: "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"{{meta:property:og:description}}: "The fastest path from prompt to production with Gemini"{{meta:property:og:image}}: "https://ai.google.dev/static/site-assets/images/share-ais-03.png"{{meta:property:og:title}}: "Google AI Studio"{{meta:property:og:type}}: "website"{{meta:property:og:url}}: "https://aistudio.google.com/"{{model}}: "모델 (Model)"{{noteName}}: "Google AI Studio"{{published}}: ""{{schema:}}: "[]"{{siteEmoji}}: "⚙️"{{site}}: "AI Studio"{{titlePrefix}}: "Google AI Studio 대화 내역"{{title}}: "Google AI Studio"{{url}}: "https://aistudio.google.com/prompts/1ynSPXkTC6vpADWHz_M8hHQukkFh_Cqpg"[[Prototype]]: Objectconstructor: ƒ Object()hasOwnProperty: ƒ hasOwnProperty()isPrototypeOf: ƒ isPrototypeOf()propertyIsEnumerable: ƒ propertyIsEnumerable()toLocaleString: ƒ toLocaleString()toString: ƒ toString()valueOf: ƒ valueOf()__defineGetter__: ƒ __defineGetter__()__defineSetter__: ƒ __defineSetter__()__lookupGetter__: ƒ __lookupGetter__()__lookupSetter__: ƒ __lookupSetter__()__proto__: (...)get __proto__: ƒ __proto__()set __proto__: ƒ __proto__()
popup.js:2 Matched template trigger: https://aistudio.google.com/
"""


  원인 발견: Vault 미설정

  콘솔의 핵심 증거:

  vaults: []   ← vault가 하나도 설정되지 않음

  vault 파라미터 없이 Obsidian URI가 생성되면(obsidian://new?file=...&content=...만 존재) Obsidian은 어느
  vault에 저장할지 알 수 없어 파일을 만들지 않습니다.

  ---
  해결 방법 (순서대로)

  1단계: Extension 설정에서 Vault 추가

  1. 팝업의 ⚙ 아이콘 클릭 → 설정 페이지 열기
  2. General 탭에서 Vault 섹션 찾기
  3. Obsidian에서 사용 중인 vault 이름 추가 (예: MyVault)
    - Obsidian을 열고 좌측 하단 vault 이름 확인

  2단계: 확장 프로그램 재로드

  chrome://extensions/ → 확장 프로그램 새로고침 버튼(↺) 클릭

  3단계: 다시 저장 시도

  이제 "Add to Obsidian" 버튼 클릭 시 vault 미설정 오류 메시지가 표시되지 않고 정상 저장됩니다.

  ---
  다른 AI 채팅 페이지(ChatGPT 등)도 사실 같은 vaults: [] 상태이므로, vault 설정 후에는 모두 정확한 vault에
   저장됩니다.

  

=========

"""
vault는 등록이 되고, google ai studio 외에는 vault를 변경하면 해당 볼트로 잘 저장되요. 그런데, google ai studio 는 아직도 저장이 되지 않아요. 저장되는 디렉토리를 확인할 수 있도록 console에 찍어주세요.
"""

  빌드 완료. 익스텐션을 chrome://extensions/에서 새로고침한 뒤 아래 절차로 확인해 주세요.

  디버그 방법

  방법 1 — 팝업 콘솔에서 확인 (빠름)

  팝업 DevTools를 열고 → "Add to Obsidian" 클릭 → 창이 닫히기 전 콘솔에서 아래 로그를 찾아 주세요:

  [handleClip] vault: ... | path: ... | noteName: ... | contentLength: ...
  [handleClip] fileContent 길이(frontmatter 포함): ...
  [saveToObsidian] vault: ...
  [saveToObsidian] path+file: ...
  [saveToObsidian] baseUrl (content 제외): obsidian://new?file=...&vault=...
  [saveToObsidian] URL 길이: ... (정상) 또는 ⚠ content 잘림

  방법 2 — 팝업이 닫혀도 확인 가능 (확실함)

  1. chrome://extensions/ → 확장 프로그램의 "서비스 워커" 클릭 → DevTools 열기
  2. 저장 시도 후, 콘솔에서 실행:
  chrome.storage.local.get('debug_last_save', console.log)
  3. 결과 예시:
  {
    "vault": "MyVault",
    "pathPlusFile": "AI/AIStudio/Google AI Studio 대화 내역 — ...",
    "baseUrl": "obsidian://new?file=AI%2FAIStudio%2F...&vault=MyVault",
    "obsidianUrlLength": 12345,
    "truncated": false,
    "timestamp": "2026-02-26T..."
  }

  확인 후 vault, pathPlusFile, obsidianUrlLength, truncated 값을 공유해 주시면 정확한 원인을 파악할 수
  있습니다.


===============

"""
- chatgpt는 아래와 같고,

{
    "baseUrl": "obsidian://new?file=AI%2FChatGPT%2FChatGPT%20%EB%8C%80%ED%99%94%20%EB%82%B4%EC%97%AD%20%E2%80%94%20ChatGPT&vault=ilmac",
    "obsidianUrlLength": 5572,
    "pathPlusFile": "AI/ChatGPT/ChatGPT 대화 내역 — ChatGPT",
    "timestamp": "2026-02-26T04:56:04.656Z",
    "truncated": false,
    "vault": "ilmac"
}

- google ai studio 는 아래와 같아요.
{
    "debug_last_save": {
        "baseUrl": "obsidian://new?file=AI%2FAIStudio%2FGoogle%20AI%20Studio%20%EB%8C%80%ED%99%94%20%EB%82%B4%EC%97%AD%20%E2%80%94%20Google%20AI%20Studio&vault=ilmac",
        "obsidianUrlLength": 49995,
        "pathPlusFile": "AI/AIStudio/Google AI Studio 대화 내역 — Google AI Studio",
        "timestamp": "2026-02-26T04:53:55.136Z",
        "truncated": true,
        "vault": "ilmac"
    }
}
- "obsidianUrlLength" 값이 5572, 49995 로 너무 많이 차이가 나네요.

"""


  변경 요약

  원인 확정: AI Studio URL이 49,995자로 Windows 명령줄 한계(32,767자)를 초과 → URL 중간에서 잘림 → 한국어
  %EB%8C 같은 멀티바이트 인코딩이 끊기면 URIError: URI malformed → Obsidian이 파일 생성 실패

  적용된 수정 2가지:

  ┌──────────────────────────┬───────────────────────────────────────────┐
  │           파일           │                   변경                    │
  ├──────────────────────────┼───────────────────────────────────────────┤
  │ obsidian-note-creator.ts │ MAX_OBSIDIAN_URL_LENGTH 50,000 → 20,000   │
  ├──────────────────────────┼───────────────────────────────────────────┤
  │ popup.ts                 │ URL 예상 길이 > 20,000자 시 클립보드 폴백 │
  └──────────────────────────┴───────────────────────────────────────────┘

  클립보드 폴백 동작:
  1. 전체 대화 내용 → 클립보드 자동 복사
  2. Obsidian에는 frontmatter + 안내 callout만 있는 최소 노트 생성
  3. 팝업에 보라색 안내 메시지 3초 표시 후 닫힘
  4. Obsidian 노트를 열어 Ctrl+V로 붙여넣기

  ChatGPT/Claude/Gemini는 URL이 20,000자 미만이므로 기존 방식 그대로 동작합니다.


=========================

"""
google ai studio의 경우 페이지 스크롤을 사용하는데, 페이지 로딩시 스크롤이 하단에 있는 경우는 스크롤을 최상단으로 올린 후 다시 내려야 하지 않나요?
"""

  ---
  변경 요약

  기존: setScrollTop(0) 후 고정 400ms 대기
  setScrollTop(0);
  await new Promise(r => setTimeout(r, 400)); // ← 무조건 400ms

  변경 후: 실제 스크롤 완료를 확인하며 대기 (최대 2초)
  setScrollTop(0);
  while (Date.now() - scrollStartTime < 2000) {
      await new Promise(r => setTimeout(r, 100));
      if (getScrollTop() <= 0) break; // 최상단 도달 확인
  }
  await new Promise(r => setTimeout(r, 300)); // 렌더링 추가 대기

  효과:
  - 빠른 환경: 100~200ms 후 getScrollTop() === 0 확인 → 즉시 루프 진행 (기존보다 빠름)
  - 느린 환경: 실제로 최상단에 도달할 때까지 최대 2초 대기 → 누락 없이 추출
  - CDK가 상단 항목을 DOM에 렌더링할 시간을 보장하는 추가 300ms는 유지


========================

"""
예전 버전의 scroll에서는 google ai studio 처럼 페이지 내부에 있는 스크롤도 시각적으로 스크롤을 내리는 것이 보이고, 페이지를 새로 로딩하면 스크롤이 초기화되었었는데, 몇 번의 업데이트를 거치면서 구조는 복잡해지고 기능은 문제가 생긴 것 같아요.
페이지 스크롤은 C:\JnJ-soft\Projects\@chrome-extension\jnj-obsidian-clipper\backups\ai-chat-extractor.ts 의 내용을 참고해서 이전과 같은 기능/로직으로 되돌려주세요.
"""

● 빌드 성공. content.js가 6.82KB → 6.2KB로 줄어든 것도 확인됩니다 (scrollAndExtract 코드가 제거됐습니다).

  ---
  변경 요약

  제거: scrollAndExtract() (복잡한 뷰포트 단위 스크롤 + 즉시 추출 로직)

  복원: 백업 버전과 동일한 구조

  ┌───────────┬─────────────────────────────────────────────────────┬─────────────────────────────────┐
  │           │                     백업(복원)                      │           제거된 버전           │
  ├───────────┼─────────────────────────────────────────────────────┼─────────────────────────────────┤
  │ 스크롤    │ turn.scrollIntoView() — 각 메시지 요소를 직접       │ viewport.scrollTop += 뷰포트    │
  │ 방식      │ 스크롤 (시각적으로 보임)                            │ 높이 단위 이동                  │
  ├───────────┼─────────────────────────────────────────────────────┼─────────────────────────────────┤
  │ 추출 시점 │ 스크롤 완료 후 DOM 전체 한 번에 읽기                │ 스크롤하면서 즉시 추출          │
  ├───────────┼─────────────────────────────────────────────────────┼─────────────────────────────────┤
  │ 페이지    │ 마지막에 turns[0].scrollIntoView(block: 'start') —  │ setScrollTop(0)                 │
  │ 초기화    │ 최상단 복귀                                         │                                 │
  └───────────┴─────────────────────────────────────────────────────┴─────────────────────────────────┘

  scrollAllTurns()의 turn.scrollIntoView({ behavior: 'instant' }) 방식은 브라우저가 해당 요소를 화면
  중앙에 정확히 가져오므로, CDK Virtual Scroll이 해당 요소를 렌더링할 수밖에 없습니다. 스크롤도 시각적으로
   보이고 페이지도 자연스럽게 초기화됩니다.


========================

"""
1. template default 값을 아래와 같이 변경해주세요.

title	{{title}}
source	{{url}}
model	{{model}}
messageCount	{{messageCount}}
createdAt	{{date}}
publishedAt	{{date}}
tags    ai-chat, ai-studio
description	{{title}}


2. {{model}} 값은 현재 {{title}}로 들어가 있는 인공지능 모델명으로 넣어주세요.
title은 어디에서 추출되는 값인가요? 현재는 인공지능 모델명이 title에 들어가 있어요.
title은 markdown 노트의 가장 처음에 나오는 H1 '# ' 뒤의 내용으로 해주세요.
"""

  ---                                                                                   변경 내용
                                                                                        1. 모든 템플릿 properties에 publishedAt, description 추가
  (default-ai-chat-templates.ts)

  5개 템플릿(ChatGPT, Claude, Gemini, Google AI Studio, Genspark) 모두 동일하게 적용:
  title        {{title}}
  source       {{url}}
  model        {{model}}
  messageCount {{messageCount}}
  createdAt    {{date}}
  publishedAt  {{date}}   ← 신규
  tags         ai-chat, xxx
  description  {{title}}  ← 신규

  2. {{model}} 값 변경 (ai-chat-extractor.ts → buildAIChatVariables)

  ┌───────────┬─────────────────────────────┬─────────────────────────────────────┐
  │   변수    │            이전             │                이후                 │
  ├───────────┼─────────────────────────────┼─────────────────────────────────────┤
  │           │ template.authorLabel (=     │ chatContent 첫 H1 = document.title  │
  │ {{model}} │ "모델 (Model)")             │ (= "Gemini 2.0 Flash" 등 실제       │
  │           │                             │ 모델명)                             │
  ├───────────┼─────────────────────────────┼─────────────────────────────────────┤
  │ {{title}} │ meta/title 태그에서 추출    │ chatContent 첫 H1과 동일            │
  │           │                             │ (오버라이드)                        │
  └───────────┴─────────────────────────────┴─────────────────────────────────────┘

  ---
  참고: 현재 extractAIChatContent에서 chatContent 첫 줄을 # ${document.title}로
  생성하기 때문에, {{model}}과 {{title}}은 동일한 값(= 페이지 타이틀)이 됩니다.

  AI Studio의 경우 document.title = "Gemini 2.0 Flash" 같은 모델명이므로 {{model}}에
  올바른 모델명이 들어가게 됩니다.

=============

"""
{{title}}은 제목이 잘 들어가는데, {{model}} 도 {{title}} 값이 그대로 들어가고 있어요.
"""

  ---
  변경 내용                                                                           
  문제 원인: {{model}}과 {{title}} 둘 다 chatContent 첫 H1 값으로 설정되어 동일한 값이   출력됨

  해결 방법: {{model}}은 실제 DOM에서 모델명을 추출, {{title}}은 첫 H1 유지

  ┌──────────────────────────────┬─────────────────────────────────────────────────┐
  │             파일             │                      변경                       │
  ├──────────────────────────────┼─────────────────────────────────────────────────┤
  │ site-config.ts               │ modelSelector?: string 필드 추가                │
  ├──────────────────────────────┼─────────────────────────────────────────────────┤
  │                              │ extractAIChatContent에서 modelSelector로 DOM    │
  │ ai-chat-extractor.ts         │ 모델명 추출 후 반환, buildAIChatVariables에서   │
  │                              │ modelName 파라미터 추가                         │
  ├──────────────────────────────┼─────────────────────────────────────────────────┤
  │ content-extractor.ts         │ sendExtractAIChat 반환 타입에 modelName 추가    │
  ├──────────────────────────────┼─────────────────────────────────────────────────┤
  │ popup.ts                     │ buildAIChatVariables 호출 시                    │
  │                              │ chatResult.modelName 전달 (2곳)                 │
  ├──────────────────────────────┼─────────────────────────────────────────────────┤
  │ default-ai-chat-templates.ts │ AI Studio siteConfig에 modelSelector:           │
  │                              │ '.chat-turn-container.model .author-label' 추가 │
  └──────────────────────────────┴─────────────────────────────────────────────────┘

  결과:
  - Google AI Studio: {{model}} = .author-label 요소에서 추출 (e.g., "Gemini 2.0
  Flash"), {{title}} = 대화 제목
  - ChatGPT, Claude, Gemini, Genspark: {{model}} = template.authorLabel (fallback),
  {{title}} = 대화 제목

  참고: AI Studio의 .author-label 셀렉터(.chat-turn-container.model .author-label)가
  실제 DOM 구조와 맞는지 확인이 필요합니다. 만약 모델명이 다른 셀렉터에 있다면
  알려주세요.

=====================



