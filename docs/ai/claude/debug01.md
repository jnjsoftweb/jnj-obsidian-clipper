"""
chrome extension에 설치해서 사용하면, 다른 웹페이지들은 정상적으로 동작하는데,

google ai studio(https://aistudio.google.com/)에서 클리핑을 시도하면,  아래와 같은 에러가 발생해요. C:\JnJ-soft\Projects\@chrome-extension\jnj-obsidian-clipper\docs\src-structure.md 를 참고하여 C:\JnJ-soft\Projects\@chrome-extension\jnj-obsidian-clipper\src에 있는 소스 코드를 수정해주세요.

getPageContent 오류: Could not establish connection. Receiving end does not exist.
컨텍스트
popup.html
스택 추적
popup.js:2 (익명의 함수)
"""

  ---
  수정 내용

  원인

  Google AI Studio는 SPA(Single Page Application)로, 페이지 내비게이션이 일어날 때 Chrome이 content script를 자동으로     
  재주입하지 않는 경우가 있습니다. 팝업이 열릴 때 content script가 없는 탭에 메시지를 보내면 "Could not establish
  connection" 에러가 발생합니다.

  변경 파일 2개

  src/manifest.json
  - "scripting" 권한 추가 — chrome.scripting.executeScript() 사용에 필요

  src/utils/content-extractor.ts — extractPageContent() 수정
  - parsePageContentResponse() 헬퍼 함수 분리 (응답 파싱 중복 제거)
  - 연결 실패 시 자동 복구 로직 추가:
    a. "Could not establish connection" 에러 감지
    b. chrome.scripting.executeScript() 로 content.js 직접 주입
    c. 주입 완료 후 즉시 재시도
    d. 재시도도 실패하면 null 반환 (기존 에러 처리 유지)

  적용 방법

  chrome://extensions/ → 새로고침 버튼 클릭 후 Google AI Studio에서 다시 시도해 주세요.