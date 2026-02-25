## pre-requirements
- obsidian
- chrome

## install source code

### clone obisidian git repository

jnj-obsidian-clipper-923946cf6612da51c694167e63afed2524620680.zip

### extract codes

```
C:\JnJ\Developments\Projects\@chrome-extension\jnj-obsidian-clipper
```

### make github remote repository

```powershell
cd C:\JnJ\Developments\Projects\@chrome-extension\jnj-obsidian-clipper

xgit -e make -n jnj-obsidian-clipper -u jnjsoftweb -d "Web clipper for ai-chat-web and other sites to obsidian in markdown by jnjsoft "
```

## install chrome extension

### build

```powershell
cd C:\JnJ\Developments\Projects\@chrome-extension\jnj-obsidian-clipper

npm install

npm run build
```

### chrome extension

- 크롬브라우저: 'chrome://extensions/'
  - '압축해제된 확장 프로그램 로드' 클릭
  - 'C:\JnJ\Developments\Projects\@chrome-extension\jnj-obsidian-clipper\dist' 선택
- 크롬 브라우저: 익스텐션 아이콘 클릭