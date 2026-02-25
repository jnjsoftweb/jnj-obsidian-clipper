# AI Chat Clipper 통합 계획

> **목표**: `ai-chat-exporter`의 AI 웹 채팅 추출 기능을 `jnj-obsidian-clipper`에 통합하여,
> AI 채팅 내용을 Obsidian vault에 마크다운으로 저장한다.

---

## 1. 통합 방향 요약

| 항목 | 채택 | 이식 |
|------|------|------|
| 전체 폴더/파일 구조 | jnj-obsidian-clipper (TypeScript + Webpack) | — |
| Popup UI | jnj-obsidian-clipper | — |
| Settings UI (탭 구조) | jnj-obsidian-clipper | — |
| 템플릿 / 프론트매터 시스템 | jnj-obsidian-clipper | — |
| Obsidian 저장 (`obsidian://new`) | jnj-obsidian-clipper | — |
| 필터 파이프라인 | jnj-obsidian-clipper | — |
| **AI chat 메시지 추출 로직** | — | **ai-chat-exporter** |
| **사이트별 DOM 셀렉터 설정** | — | **ai-chat-exporter** |
| **사용자/AI 메시지 판별** | — | **ai-chat-exporter** |
| **대화 구조 마크다운 조립** | — | **ai-chat-exporter** |
| **가상 스크롤 대응** | — | **ai-chat-exporter** |

**핵심 원칙**:
- ai-chat-exporter의 `SiteConfig`를 jnj-obsidian-clipper의 `Template`에 내장 필드로 통합
- AI chat 추출 결과(`{{chatContent}}`)를 기존 변수 파이프라인에 주입
- Turndown 기반 마크다운 변환은 유지하되, AI chat 전용 DOM 전처리 단계 추가

---

## 2. 현황 분석

### 2.1 두 프로젝트의 핵심 차이

| 비교 항목 | jnj-obsidian-clipper | ai-chat-exporter |
|-----------|---------------------|-----------------|
| 빌드 | TypeScript + Webpack | Vanilla JS (빌드 없음) |
| 저장 대상 | Obsidian vault | Downloads 폴더 |
| 마크다운 변환 | Readability + Turndown GFM | 자체 DOM 파서 |
| 설정 단위 | Template (다목적) | SiteConfig (사이트 특화) |
| 프론트매터 | `properties[]` 배열 구조 | 문자열 템플릿 (`{title}` 플레이스홀더) |
| 트리거 | URL prefix / regex / schema:@type | hostname 매칭 |
| 대화 추출 | 없음 | 핵심 기능 |

### 2.2 ai-chat-exporter가 해결한 문제

1. **사용자/AI 메시지 판별** — 4가지 방법(속성값, 태그명, 컨테이너 클래스, HTML 매칭)
2. **코드블록 언어 추출** — `<pre>` 헤더 텍스트에서 언어명 자동 감지
3. **가상 스크롤 대응** — Google AI Studio의 뷰포트 외 콘텐츠 렌더링
4. **중복 제거** — Genspark의 중복 메시지 필터링
5. **대화 구조화** — Q&A 구분자, 사용자/AI 헤딩 포맷

### 2.3 jnj-obsidian-clipper가 제공하는 인프라

1. **Template 시스템** — 사이트별 다른 프론트매터, 경로, 파일명 설정
2. **`{{변수|필터}}` 파이프라인** — 20+개 필터 (wikilink, callout, date 등)
3. **자동 템플릿 매칭** — URL/schema 기반 트리거
4. **Obsidian 저장** — `obsidian://new` URI로 vault에 직접 생성
5. **Popup 미리보기 편집** — 저장 전 내용 확인/수정
6. **lz-string 압축 저장** — Chrome storage quota 대응

---

## 3. 데이터 모델 설계

### 3.1 새 타입 (신규 파일: `src/types/site-config.ts`)

```typescript
// 사용자 메시지 판별 방법 (4가지 유니온)
export type UserAttribute =
  | { attr: string; value: string }              // ChatGPT, Claude
  | { tag: string }                              // Gemini
  | { containerSelector: string; userClass: string[]; aiClass: string[] }  // AI Studio
  | { htmlMatch: string[] };                     // Genspark

// AI chat 사이트 추출 설정
export interface SiteConfig {
  hostname: string;           // 매칭 대상 hostname
  messageSelector: string;    // 메시지 요소 CSS 셀렉터
  userAttribute: UserAttribute;
  contentSelector?: string;   // 실제 내용 영역 셀렉터 (선택적)
  ignoreSelector?: string;    // 제거할 UI 요소 셀렉터
  deduplicate?: boolean;      // 중복 메시지 제거
  scrollToLoad?: boolean;     // 가상 스크롤 대응 (AI Studio)
}

// 대화 출력 형식
export interface ChatFormat {
  userTitleFormat: string;    // "### 👤 사용자 (User)"
  aiTitleFormat: string;      // "### {emoji} {authorLabel}" → 템플릿에서 치환
  turnSeparator: string;      // Q&A 내부 구분자
  qaSeparator: string;        // Q&A 세트 구분자
}
```

### 3.2 Template 타입 확장 (`src/types/types.ts`)

```typescript
export interface Template {
  // 기존 필드 (변경 없음)
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

  // 신규 필드 (AI chat 전용, 선택적)
  siteConfig?: SiteConfig;    // 있으면 AI chat 템플릿으로 동작
  chatFormat?: ChatFormat;    // 대화 출력 형식
  emoji?: string;             // AI 아이콘 (예: "🤖")
  authorLabel?: string;       // AI 이름 (예: "챗GPT (ChatGPT)")
  titlePrefix?: string;       // 마크다운 H1 제목 (예: "ChatGPT 대화 내역")
}
```

### 3.3 GeneralSettings 확장 (`src/utils/storage-utils.ts`)

```typescript
export interface GeneralSettings {
  showMoreActionsButton: boolean;
  vaults: string[];
  // 신규: AI chat 전역 기본값
  defaultChatFormat?: ChatFormat;
}
```

### 3.4 새 변수 (currentVariables 맵 추가)

| 변수 | 값 |
|------|-----|
| `{{chatContent}}` | 전체 대화 마크다운 (메인 본문) |
| `{{messageCount}}` | 메시지 수 |
| `{{model}}` | AI 모델명 (예: "ChatGPT") |
| `{{titlePrefix}}` | 사이트 제목 접두사 |
| `{{aiLabel}}` | AI 이름 (authorLabel) |
| `{{siteEmoji}}` | 사이트 이모지 |

---

## 4. 파일별 변경 계획

### 4.1 신규 생성 파일

#### `src/utils/ai-chat-extractor.ts`
ai-chat-exporter의 content.js 핵심 로직을 TypeScript로 이식.

```
주요 함수:
- extractAIChatContent(config: SiteConfig, fmt: ChatFormat): string
  └─ parseWithConfig() 이식
- detectUser(msg: Element, userAttr: UserAttribute, index: number): boolean
  └─ detectUser() 이식
- convertAIChatToMarkdown(element: Element, ignoreSelector?: string): string
  └─ convertToMarkdown() 이식 (Turndown과 병행)
- scrollAllTurns(messageSelector: string): Promise<void>
  └─ scrollAllTurns() 이식 (AI Studio 전용)
- buildAIChatVariables(content: string, config: SiteConfig): Record<string, string>
  └─ chatContent, messageCount, model 등 변수 생성
```

> **마크다운 변환 선택**: 기본은 Turndown 기반(`createMarkdownContent`) 사용.
> 단, AI chat 특유의 코드블록 언어 감지(pre 헤더 파싱)는 Turndown 커스텀 룰로 추가.

#### `src/types/site-config.ts`
위 3.1의 타입 정의.

#### `src/data/default-ai-chat-templates.ts`
5개 기본 AI chat 템플릿 데이터 (ChatGPT, Claude, Gemini, AI Studio, Genspark).

```typescript
export const DEFAULT_AI_CHAT_TEMPLATES: Template[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    emoji: '🤖',
    authorLabel: 'ChatGPT',
    titlePrefix: 'ChatGPT 대화 내역',
    behavior: 'create',
    noteNameFormat: '{{title}}',
    path: 'AI/ChatGPT',
    noteContentFormat: '{{chatContent}}',
    properties: [/* title, url, model, createdAt, tags */],
    triggers: ['https://chatgpt.com/'],
    siteConfig: {
      hostname: 'chatgpt.com',
      messageSelector: '[data-message-author-role]',
      userAttribute: { attr: 'data-message-author-role', value: 'user' },
      ignoreSelector: "button, svg, img, [aria-hidden='true'], .sr-only"
    },
    chatFormat: {
      userTitleFormat: '### 👤 사용자 (User)',
      aiTitleFormat: '### 🤖 ChatGPT',
      turnSeparator: '---',
      qaSeparator: '---'
    }
  },
  // Claude, Gemini, AI Studio, Genspark ...
];
```

---

### 4.2 수정 파일

#### `src/types/types.ts`
- `Template` 인터페이스에 `siteConfig?`, `chatFormat?`, `emoji?`, `authorLabel?`, `titlePrefix?` 추가

#### `src/content.ts`
AI chat 사이트 감지 및 대화 추출 분기 추가.

```
변경 내용:
1. getPageContent 핸들러 확장
   - 응답에 chatMessages?: ChatMessage[] 추가
   - siteConfig 매칭 여부를 popup이 아닌 content에서 판단하지 않음
     (popup이 판단하여 extractAIChat 메시지를 별도 전송)

2. 새 메시지 핸들러 추가: "extractAIChat"
   - config: SiteConfig를 받아 대화 추출 실행
   - scrollToLoad가 true이면 scrollAllTurns() 먼저 실행
   - 결과: { markdown: string, messageCount: number } 반환
```

#### `src/utils/content-extractor.ts`
AI chat 변수 주입.

```
변경 내용:
initializePageContent()에서 chatContent 관련 변수를 받아
currentVariables 맵에 추가:
  {{chatContent}}, {{messageCount}}, {{model}}, {{titlePrefix}},
  {{aiLabel}}, {{siteEmoji}}
```

#### `src/utils/markdown-converter.ts`
Turndown에 AI chat 코드블록 커스텀 룰 추가.

```
변경 내용:
createMarkdownContent()에 옵션 파라미터 추가:
  skipReadability는 기존 유지
  + aiChatMode?: boolean (true면 pre 헤더 언어 추출 룰 활성화)

추가 Turndown 룰:
- pre 태그의 언어 감지 (ChatGPT: 헤더 텍스트, Gemini: .code-block-decoration)
```

#### `src/core/popup.ts`
AI chat 사이트 감지 시 추출 흐름 분기.

```
변경 내용:
extractPageContent() 호출 후:
- currentTemplate.siteConfig가 있으면:
  → content script에 "extractAIChat" 메시지 전송 (siteConfig 전달)
  → 응답 결과를 buildAIChatVariables()로 변수 맵에 추가
  → initializePageContent()는 일반 메타데이터용으로 유지
- siteConfig가 없으면: 기존 Readability 흐름 그대로
```

#### `src/managers/template-manager.ts`
기본 AI chat 템플릿 초기화 추가.

```
변경 내용:
createDefaultTemplate() 외에 createDefaultAIChatTemplates() 추가.
loadTemplates()에서 template_list가 비어있으면
  기본 general template 1개 + 기본 AI chat templates 5개 생성.
```

#### `src/managers/template-ui.ts`
Settings 페이지에 siteConfig 편집 섹션 추가.

```
변경 내용:
템플릿 편집 폼에 "AI Chat 설정" 접이식 섹션 추가:
- siteConfig.hostname
- siteConfig.messageSelector
- userAttribute 타입 선택 + 동적 입력 필드 (ai-chat-exporter의 renderAttrFields 이식)
- contentSelector / ignoreSelector
- deduplicate / scrollToLoad 토글
- chatFormat.userTitleFormat / aiTitleFormat / turnSeparator / qaSeparator
- emoji / authorLabel / titlePrefix
```

#### `src/managers/general-settings.ts`
전역 기본 chatFormat 설정 UI 추가.

```
변경 내용:
"AI Chat 기본 형식" 섹션 추가:
- defaultChatFormat 편집 (각 AI chat 템플릿의 기본값으로 사용)
```

#### `src/utils/storage-utils.ts`
`GeneralSettings`에 `defaultChatFormat?` 추가.

#### `src/manifest.json`
AI chat 사이트 host_permissions 추가 (현재 `<all_urls>` content script이므로 불필요할 수 있음, 검토 필요).

---

### 4.3 HTML 수정

#### `src/settings.html`
template-ui.ts가 동적으로 삽입하는 방식이므로 큰 구조 변경 없음.
단, siteConfig 섹션용 CSS 클래스 추가 (`src/styles/settings.scss`).

---

## 5. 단계별 구현 순서

### Phase 1 — 타입 정의 (기반 작업)
- [ ] `src/types/site-config.ts` 생성 (SiteConfig, UserAttribute, ChatFormat)
- [ ] `src/types/types.ts` — Template에 신규 필드 추가

### Phase 2 — AI chat 추출 엔진 이식
- [ ] `src/utils/ai-chat-extractor.ts` 생성
  - ai-chat-exporter의 content.js → TypeScript 변환
  - detectUser, scrollAllTurns, convertAIChatToMarkdown, extractAIChatContent
  - buildAIChatVariables (변수 맵 생성)
- [ ] `src/utils/markdown-converter.ts` — Turndown 코드블록 언어 감지 룰 추가

### Phase 3 — content.ts 확장
- [ ] "extractAIChat" 메시지 핸들러 추가
- [ ] scrollToLoad 대응 (AI Studio 가상 스크롤)

### Phase 4 — 변수 파이프라인 통합
- [ ] `src/utils/content-extractor.ts` — AI chat 변수 주입 처리
- [ ] `src/core/popup.ts` — siteConfig 유무에 따른 흐름 분기

### Phase 5 — 기본 템플릿 데이터
- [ ] `src/data/default-ai-chat-templates.ts` — 5개 기본 템플릿
- [ ] `src/managers/template-manager.ts` — 초기화 시 AI chat 템플릿 생성

### Phase 6 — Settings UI
- [ ] `src/managers/template-ui.ts` — siteConfig 편집 섹션 추가
- [ ] userAttribute 타입별 동적 입력 필드
- [ ] chatFormat 편집 필드
- [ ] `src/managers/general-settings.ts` — defaultChatFormat UI

### Phase 7 — 검증 및 디버그
- [ ] ChatGPT 클리핑 테스트
- [ ] Claude 클리핑 테스트
- [ ] Gemini 클리핑 테스트
- [ ] Google AI Studio 클리핑 테스트 (가상 스크롤)
- [ ] Genspark 클리핑 테스트 (중복 제거)
- [ ] 일반 웹페이지 클리핑 기존 기능 회귀 테스트

---

## 6. 저장소 구조 (chrome.storage)

### sync 저장소
```
template_list: ["chatgpt", "claude", "gemini", "aistudio", "genspark", "<default_id>"]
template_chatgpt: [<lz-string 압축 청크>]   // Template with siteConfig
template_claude:  [<lz-string 압축 청크>]
template_gemini:  [<lz-string 압축 청크>]
template_aistudio:[<lz-string 압축 청크>]
template_genspark:[<lz-string 압축 청크>]
template_<id>:    [<lz-string 압축 청크>]   // 일반 웹 클리핑용
general_settings: { showMoreActionsButton, defaultChatFormat }
vaults: ["MyVault"]
```

### local 저장소 (기존 유지)
```
propertiesCollapsed: boolean
lastSelectedVault: string
```

---

## 7. Popup UI 동작 흐름

### AI chat 사이트인 경우 (siteConfig 있는 템플릿 매칭)
```
팝업 열림
  → extractPageContent() — 기본 HTML/메타데이터 수집
  → findMatchingTemplate() — triggers 매칭 (URL prefix)
  → siteConfig 있음 감지
  → content script에 "extractAIChat" 전송 (siteConfig 전달)
  → AI chat 대화 추출 (scrollToLoad 포함)
  → buildAIChatVariables() — chatContent, messageCount, model 등
  → initializePageContent() — title, url 등 일반 메타 변수
  → 두 변수 맵 병합
  → initializeTemplateFields() — properties + noteContent 렌더링
    → {{chatContent}} → 대화 전체
    → {{title}} → 페이지 제목
    → {{messageCount}} → 대화 수
    → {{model}} → AI 이름
  → 사용자가 확인 후 "Clip" 클릭
  → generateFrontmatter() → saveToObsidian()
```

### 일반 웹 사이트인 경우 (기존 흐름 그대로)
```
팝업 열림
  → extractPageContent()
  → findMatchingTemplate()
  → siteConfig 없음 → 기존 Readability + Turndown 흐름
  → initializePageContent()
  → initializeTemplateFields()
  → "Clip" → saveToObsidian()
```

---

## 8. 주요 기술적 결정 사항

### 8.1 마크다운 변환: Turndown 채택
- ai-chat-exporter의 자체 DOM 파서 대신 기존 Turndown을 사용
- 이유: 이미 GFM(표, 취소선 등) 지원, 커스텀 룰로 확장 가능
- AI chat 특화 처리는 Turndown 룰로 추가:
  - `pre` 태그 언어 감지 (ChatGPT 헤더 텍스트, Gemini `.code-block-decoration`)
  - 불필요 UI 요소 사전 제거 (ignoreSelector 기반 DOM 클리닝)

### 8.2 Readability: AI chat에서 비활성화
- AI chat 사이트는 Readability가 대화 콘텐츠를 오추출함
- `siteConfig`가 있는 템플릿은 `skipReadability: true`로 처리
- 대신 `messageSelector`로 직접 대화 요소 추출

### 8.3 변수 우선순위
- AI chat 변수(`chatContent` 등)가 일반 메타 변수보다 나중에 병합
- 동일 키 충돌 시 AI chat 변수가 덮어씀 (명시적 처리)

### 8.4 기본 템플릿 충돌 방지
- 최초 설치 시 AI chat 템플릿 5개 + 기본 웹 클리핑 템플릿 1개 자동 생성
- 재설치 시 template_list가 이미 있으면 기존 유지 (덮어쓰지 않음)

---

## 9. 미결 검토 사항

| 항목 | 검토 내용 |
|------|----------|
| **Claude.ai CORS** | `claude.ai`는 content script 메시지가 차단될 수 있음 — 실제 테스트 필요 |
| **AI Studio 스크롤 타이밍** | 300ms 지연이 환경에 따라 부족할 수 있음 — 옵션화 검토 |
| **Genspark selector 변동** | `article, [class*='message']` 같은 광범위 셀렉터는 오매칭 위험 |
| **manifest host_permissions** | 현재 `<all_urls>` content script이므로 추가 불필요, 확인 필요 |
| **storage quota** | siteConfig 포함 시 템플릿 크기 증가 — lz-string 압축으로 충분한지 검토 |
| **Popup 높이** | chatFormat 편집 필드 추가 시 settings 페이지 레이아웃 재확인 |
