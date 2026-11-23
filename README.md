# 李承諺個人網站

Mac 桌面風格的靜態網站，不需要建置工具。

## 本機預覽

直接用瀏覽器開啟 `index.html`，或在這個資料夾執行：

```
npx serve .
```

## 修改內容

文字和連結都在 [js/data.js](js/data.js)：經歷、技能、論文、獎項、作品、聯絡方式。

portfolio 視窗只列出個人專案（`cases`）；想換縮圖時，把圖片放進 `assets/works/`，再到 `works` 加一筆 `{ case, image }`。

個人專案寫在 `cases`，目前有 Health Heroes、BabyGo、ODD City、7.ZIP、木與弦、線上報修系統、拖曳式網站 CMS、詞彙學習和線上施測系統。portfolio 側欄的「個人專案」會打開全螢幕卡片牌組（[js/projects.js](js/projects.js)、[css/projects.css](css/projects.css)），可用滾輪、滑動或方向鍵切換，點卡片進入專案介紹頁。

新增專案時：
- 截圖轉成 webp 放進 `dir` 指定的資料夾（例如 `assets/babygo/01.webp`），手機截圖的編號列在 `phones`，其他一律用瀏覽器外框。
- `mock` 是卡片封面上的筆電與兩支手機；只有電腦版的專案把 `phones` 留空，改用 `badges` 放幾個圓形貼紙（例如 ODD City 的結局徽章）。`theme` 是封面背景的三個顏色。
- `groups` 決定截圖分段（每段的標題與小字），`shots` 的 `group` 對應到段落名稱。
- 選填段落：`collage`（截圖拼貼，x / y / w 是百分比位置）、`feature`（左深色標題、右卡片截圖的重點畫面）、`logic`（業務邏輯）、`stories`（開發心得）、`architecture`（系統架構）。

作品方格加上 `case: '<id>'` 時，預覽列會多一顆「專案介紹」按鈕直接開介紹頁。

## 上線

整個資料夾上傳到任何靜態空間即可，例如 GitHub Pages、Netlify 或 Cloudflare Pages。
