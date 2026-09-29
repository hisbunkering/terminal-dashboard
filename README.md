# 광양터미널 운영 대시보드

엑셀(.xlsx)을 업로드하면 브라우저에서 바로 표와 차트로 보여주는 React + Vite 대시보드. 백엔드/DB 없음.

- 실행: `run.bat` (또는 `npm install && npm run dev`)
- 빌드: `npm run build` → `dist/`
- 라이브러리: xlsx(파일 읽기), recharts(차트)
- 실적/예상 기준월: `src/parse.js`의 `ACTUAL_UNTIL`
