 의 기능을 jnj-obsidian-clipper 에 덮어씀

- 현재 ai-chat-exporter(C:\JnJ\Developments\Projects\@chrome-extension\jnj-obsidian-clipper\reference\ai-chat-exporter)는 AI web chat 내용에서 markdown을 추출하여 Downloads 폴더에 저장하는 기능이 구현 중이예요. chatgpt, claude, gemini, google ai studio, genspark 등의 사이트에 대해 클리핑 설정이 별도로 되어 있고, markdown을 생성하는 기본 설정이 되어 있어요.
- jnj-obsidian-clipper 은 각 사이트별 템플릿을 기반으로 웹 클리핑을 하며, 프론트매터를 자동으로 생성하는데 장점이 있고, 클리핑 내용을 json으로 임시 저장하고, 최종적으로는 옵시디언 폴더에 마크다운으로 저장하는 구조예요.

- jnj-obsidian-clipper 에서 UI와 전체적인 폴더 구조는 차용하고, ai-chat-exporter 의 AI web chat 사이트들에 대한 마크다운 추출, 기본 설정은 jnj-obsidian-clipper 의 템플릿, 일반 설정의 폼을 변경하여, AI web chat 사이트 및 향후 다른 사이트들의 페이지를 마크다운으로 옵시디언에 저장되도록 합니다.

- 이를 위해 현재, jnj-obsidian-clipper의 source(src) 구조와 클리핑과 관련된 ai-chat-export의 함수들의 기능을 정리해주세요.



(C:\JnJ\Developments\Projects\@chrome-extension\jnj-obsidian-clipper\reference\ai-chat-exporter) 의 기능을 jnj-obsidian-clipper 에 덮어쓰는 