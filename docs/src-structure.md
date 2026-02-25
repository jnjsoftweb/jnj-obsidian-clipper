# src/ 폴더 구조도

> Chrome Extension (Manifest V3) — TypeScript + Webpack 빌드
>
> **Webpack 번들 출력** (`dist/`):
> - `popup.js` (96.6 KiB) — popup.ts + core 모듈 전체
> - `settings.js` (45.5 KiB) — settings.ts + managers 전체
> - `content.js` (6.2 KiB) — content.ts + ai-chat-extractor (의존성 없음)
> - `background.js` (0.7 KiB) — background.ts 단독
> - `style.css` (21.5 KiB) — style.scss 컴파일 결과

---

```
src/
│
├── manifest.json                   # MV3 manifest — 진입점·권한·단축키 정의
│                                   #   popup: popup.html
│                                   #   options_page: settings.html
│                                   #   service_worker: background.js
│                                   #   content_scripts: content.js (<all_urls>)
│                                   #   commands: Ctrl+Shift+O (popup), Ctrl+Shift+X (quick_clip)
│
├── popup.html                      # 팝업 UI HTML — popup.js 로드
├── settings.html                   # 설정 페이지 HTML — settings.js 로드
│
├── style.scss                      # 전역 스타일 진입점 — styles/*.scss 전부 @use
│
│
├── ─── 진입점 스크립트 ────────────────────────────────────────────────────────
│
├── background.ts                   # [SERVICE WORKER] 백그라운드 상주 스크립트
│                                   #   - quick_clip 단축키(Ctrl+Shift+X) 수신
│                                   #   - 현재 탭에 popup 열기 또는 빠른 클리핑 트리거
│
├── content.ts                      # [CONTENT SCRIPT] 모든 페이지에 자동 주입
│                                   #   - "getPageContent" 메시지 → document HTML·선택영역·schema.org 반환
│                                   #   - "extractContent" 메시지 → CSS selector로 DOM 요소 추출
│                                   #   - "extractAIChat" 메시지 → extractAIChatContent() 호출 → 대화 마크다운 반환
│
│
├── core/                           # 페이지별 메인 UI 로직
│   ├── popup.ts                    # [POPUP] 클리핑 전체 흐름 조율
│   │                               #   1. extractPageContent() — content script에서 HTML 수집
│   │                               #   2. findMatchingTemplate() — URL/schema 기반 템플릿 자동 선택
│   │                               #   3. siteConfig 유무에 따라 분기:
│   │                               #      - AI chat: sendExtractAIChat() → buildAIChatVariables()
│   │                               #      - 일반:    initializePageContent() → Readability 파싱
│   │                               #   4. initializeTemplateFields() — properties + noteContent 렌더링
│   │                               #   5. saveToObsidian() — obsidian://new URI로 vault 저장
│   │
│   └── settings.ts                 # [SETTINGS PAGE] 설정 페이지 진입점
│                                   #   - URL 쿼리(?section=general|templates) 기반 탭 라우팅
│                                   #   - template-manager, general-settings 초기화 조율
│
│
├── data/                           # 정적 데이터
│   └── default-ai-chat-templates.ts  # 5개 기본 AI chat 템플릿 상수
│                                     #   ChatGPT / Claude / Gemini / Google AI Studio / Genspark
│                                     #   각 템플릿: siteConfig(hostname·selector) + chatFormat + properties
│
│
├── managers/                       # Settings 페이지 UI 매니저
│   ├── template-manager.ts         # 템플릿 CRUD + 저장소 관리
│   │                               #   - lz-string UTF-16 압축 → chrome.storage.sync 청크 저장
│   │                               #   - 최초 설치 시 기본 템플릿 6개 자동 생성 (general 1 + AI chat 5)
│   │                               #   - loadTemplates() / saveTemplateSettings()
│   │
│   ├── template-ui.ts              # 템플릿 편집 폼 UI
│   │                               #   - showTemplateEditor() — 선택한 템플릿 폼에 값 채우기
│   │                               #   - updateTemplateFromForm() — 폼 → Template 객체 동기화
│   │                               #   - updateTemplateList() — 사이드바 목록 렌더링
│   │                               #   - [AI chat] populateAIChatFields() — siteConfig/chatFormat 필드 채우기
│   │                               #   - [AI chat] renderUserAttrFields() — userAttribute 타입별 동적 입력 필드
│   │                               #   - [AI chat] readAIChatFields() — 폼 → siteConfig/chatFormat 읽기
│   │
│   ├── general-settings.ts         # 일반 설정 UI (vault 목록·단축키)
│   │                               #   - updateVaultList() — vault 목록 렌더링 + 드래그 정렬
│   │                               #   - initializeGeneralSettings() — 설정 값 폼 반영
│   │
│   └── general-settings-ui.ts      # 일반/템플릿 탭 전환 UI
│                                   #   - showGeneralSettings() / showTemplatesSection()
│                                   #   - URL 쿼리 파라미터 갱신 (routing.ts 호출)
│
│
├── utils/                          # 범용 유틸리티 모듈
│   │
│   │── [AI Chat 추출 엔진] ──────────────────────────────────────────────────
│   ├── ai-chat-extractor.ts        # AI chat DOM → 마크다운 변환 (content script 전용)
│   │                               #   - detectUser() — 메시지 요소가 사용자 발화인지 판별 (4가지 전략)
│   │                               #   - scrollAllTurns() — 가상 스크롤 대응 (AI Studio)
│   │                               #   - convertAIChatToMarkdown() — DOM → 마크다운 (자체 파서, 외부 의존성 없음)
│   │                               #   - extractAIChatContent() — 페이지 전체 대화 추출 오케스트레이션
│   │                               #   - buildAIChatVariables() — {{chatContent}} 등 변수 맵 생성 (popup용)
│   │
│   │── [콘텐츠 추출 파이프라인] ─────────────────────────────────────────────
│   ├── content-extractor.ts        # 변수 맵 구축 + 변수 치환 파이프라인
│   │                               #   - initializePageContent() — Readability 파싱 + 메타 변수 맵 구축
│   │                               #     (extraVariables 있으면 AI chat 변수 병합)
│   │                               #   - replaceVariables() — {{변수}}/{{selector:css}}/{{schema:key}} 치환
│   │                               #   - extractPageContent() — content script에 getPageContent 메시지 전송
│   │                               #   - sendExtractAIChat() — content script에 extractAIChat 메시지 전송
│   │                               #   - extractContentBySelector() — CSS selector 기반 DOM 추출
│   │                               #   - getMetaContent() — <meta> 태그 값 추출
│   │
│   ├── markdown-converter.ts       # HTML → Markdown 변환
│   │                               #   - createMarkdownContent() — Readability + Turndown GFM 파이프라인
│   │                               #   - extractReadabilityContent() — Readability 단독 실행
│   │
│   ├── obsidian-note-creator.ts    # Obsidian 저장
│   │                               #   - saveToObsidian() — obsidian://new?... URI 생성 → 탭 이동
│   │                               #   - generateFrontmatter() — YAML frontmatter 생성 (타입별 포맷)
│   │                               #   - sanitizeFileName() — 파일명 특수문자 제거
│   │
│   ├── triggers.ts                 # 템플릿 자동 선택
│   │                               #   - findMatchingTemplate() — URL/schema 기반 최적 템플릿 선택
│   │                               #   - matchPattern() — URL prefix / /regex/ / schema:@type 매칭
│   │
│   ├── filters.ts                  # {{변수|필터}} 파이프라인
│   │                               #   - applyFilters() — 20+개 필터 순차 적용
│   │                               #     (blockquote, callout, capitalize, date, join, slice, wikilink 등)
│   │
│   ├── storage-utils.ts            # chrome.storage 래퍼
│   │                               #   - loadGeneralSettings() / saveGeneralSettings()
│   │                               #   - GeneralSettings 타입 정의 (showMoreActionsButton, vaults)
│   │
│   │── [Settings 페이지 유틸] ──────────────────────────────────────────────
│   ├── auto-save.ts                # 설정 폼 자동 저장
│   │                               #   - initializeAutoSave() — input 이벤트 → 300ms debounce → 저장
│   │
│   ├── drag-and-drop.ts            # 드래그 정렬
│   │                               #   - initializeDragAndDrop() — 템플릿 목록·properties·vault 목록 정렬
│   │
│   ├── import-export.ts            # 템플릿 가져오기/내보내기
│   │                               #   - exportTemplate() — 선택한 템플릿 → JSON 파일 다운로드
│   │                               #   - importTemplate() — JSON 파일 → 템플릿 복원
│   │
│   ├── hotkeys.ts                  # 단축키 정보 조회
│   │                               #   - getCommands() — chrome.commands.getAll() 래퍼
│   │
│   ├── routing.ts                  # URL 쿼리 기반 탭 라우팅
│   │                               #   - updateUrl(section, templateId?) — history.pushState로 URL 갱신
│   │
│   │── [공통 유틸] ──────────────────────────────────────────────────────────
│   ├── debounce.ts                 # 범용 debounce 함수
│   ├── string-utils.ts             # 문자열 유틸 (escapeValue, unescapeValue, formatVariables 등)
│   └── ui-utils.ts                 # UI 공통 유틸 (initializeToggles — checkbox ↔ toggle 연동)
│
│
├── types/                          # TypeScript 타입 정의
│   ├── types.ts                    # 핵심 도메인 타입
│   │                               #   Template — 모든 설정을 담는 중심 타입
│   │                               #     (id, name, behavior, noteNameFormat, path, properties[],
│   │                               #      triggers[], siteConfig?, chatFormat?, emoji?, authorLabel?)
│   │                               #   Property — 프론트매터 속성 (id, name, value, type)
│   │                               #   ExtractedContent — { [key: string]: string }
│   │
│   ├── site-config.ts              # AI chat 전용 타입
│   │                               #   UserAttribute — 사용자 메시지 판별 유니온 (4가지 전략)
│   │                               #   SiteConfig — AI chat 사이트 추출 설정
│   │                               #   ChatFormat — 대화 출력 형식 (헤딩·구분자)
│   │
│   └── turndown-plugin-gfm.d.ts    # turndown-plugin-gfm 타입 선언 (패키지 미제공분)
│
│
├── styles/                         # SCSS 분할 스타일시트
│   ├── _variables.scss             # 색상·사이즈 CSS 변수
│   ├── popup.scss                  # 팝업 전용 스타일
│   ├── settings.scss               # 설정 페이지 스타일 (템플릿 편집·AI chat 섹션 포함)
│   ├── buttons.scss                # 버튼 공통 스타일
│   ├── inputs.scss                 # 입력 필드 공통 스타일
│   ├── toggles.scss                # 체크박스 ↔ 토글 스위치 스타일
│   ├── icons.scss                  # lucide 아이콘 스타일
│   ├── dragging.scss               # 드래그 정렬 상태 스타일
│   └── inspect-variables.scss      # 변수 목록 인스펙터 패널 스타일
│
│
└── icons/                          # 확장 아이콘 에셋
    ├── icon16.png                  # 툴바 아이콘 (16×16)
    ├── icon48.png                  # 확장 목록 아이콘 (48×48)
    ├── icon128.png                 # 스토어 아이콘 (128×128)
    ├── icon128-chrome-store.png    # 크롬 스토어 배너용
    ├── icons.ts                    # lucide 아이콘 임포트·등록 (createIcons 래퍼)
    └── icons.d.ts                  # lucide 타입 선언
```

---

## 데이터 흐름 요약

### 일반 웹 클리핑 흐름
```
[popup.html 열림]
  → popup.ts
    → content-extractor.ts: extractPageContent()   # content.ts에 getPageContent 전송
    → triggers.ts: findMatchingTemplate()           # URL/schema 기반 템플릿 선택
    → content-extractor.ts: initializePageContent() # Readability + 메타 → 변수 맵
    → content-extractor.ts: replaceVariables()      # {{변수}} 치환 + filters.ts 적용
    → obsidian-note-creator.ts: saveToObsidian()    # obsidian://new URI → vault 저장
```

### AI Chat 클리핑 흐름
```
[popup.html 열림 (AI chat 사이트)]
  → popup.ts
    → content-extractor.ts: extractPageContent()   # HTML·메타 수집
    → triggers.ts: findMatchingTemplate()           # siteConfig 있는 템플릿 매칭
    → content-extractor.ts: sendExtractAIChat()     # content.ts에 extractAIChat 전송
      → content.ts → ai-chat-extractor.ts:
          scrollAllTurns()                          # 가상 스크롤 대응 (AI Studio)
          extractAIChatContent()                    # DOM → 대화 마크다운
    → ai-chat-extractor.ts: buildAIChatVariables()  # {{chatContent}} 등 변수 생성
    → content-extractor.ts: initializePageContent(extraVariables)  # 변수 맵 병합
    → content-extractor.ts: replaceVariables()      # {{변수}} 치환
    → obsidian-note-creator.ts: saveToObsidian()    # vault 저장
```

### chrome.storage 구조
```
sync 저장소:
  template_list           → string[]          # 템플릿 ID 목록 (순서 포함)
  template_{id}           → string[]          # lz-string UTF-16 압축 청크 배열
  general_settings        → GeneralSettings   # showMoreActionsButton
  vaults                  → string[]          # Obsidian vault 이름 목록

local 저장소:
  propertiesCollapsed     → boolean           # 속성 패널 접힘 상태
  lastSelectedVault       → string            # 마지막 선택 vault
```

---

## 주요 변수 목록 (`{{변수}}` 치환 시스템)

| 변수 | 출처 | 설명 |
|------|------|------|
| `{{title}}` | og:title / \<title\> | 페이지 제목 |
| `{{url}}` | 현재 탭 URL | 페이지 URL |
| `{{content}}` | Readability + Turndown | 본문 마크다운 |
| `{{author}}` | meta[name=author] | 저자 |
| `{{description}}` | meta[name=description] | 설명 |
| `{{date}}` | 오늘 날짜 | YYYY-MM-DD |
| `{{published}}` | article:published_time | 발행일 |
| `{{domain}}` | URL hostname | 도메인 |
| `{{site}}` | og:site_name | 사이트명 |
| `{{image}}` | og:image | OG 이미지 URL |
| `{{chatContent}}` | ai-chat-extractor | AI 대화 전체 마크다운 (AI chat 전용) |
| `{{messageCount}}` | ai-chat-extractor | 메시지 수 (AI chat 전용) |
| `{{model}}` | Template.authorLabel | AI 모델명 (AI chat 전용) |
| `{{siteEmoji}}` | Template.emoji | 사이트 이모지 (AI chat 전용) |
| `{{selector:css}}` | DOM 직접 추출 | CSS 셀렉터로 DOM 요소 텍스트 |
| `{{schema:key}}` | JSON-LD | schema.org 데이터 |
| `{{meta:name:key}}` | \<meta name\> | 메타 태그 값 |
