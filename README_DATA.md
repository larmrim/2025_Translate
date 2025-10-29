# 佛法資料採集與整合說明

## 📋 概述

這個專案包含三個主要部分：
1. **資料採集工具**：從大慈恩譯經基金會下載手抄稿
2. **資料處理工具**：建立可搜尋的資料庫
3. **自動推算功能**：整合到翻譯系統

## 🚀 使用步驟

### 步驟 1：安裝依賴套件

```bash
pip install -r requirements.txt
```

### 步驟 2：下載資料

```bash
python download_data.py
```

這會下載所有 160 個講次的資料到 `data/nanshan_data.json`

### 步驟 3：建立搜尋資料庫

```bash
python create_search_engine.py
```

這會生成：
- `data/nanshan_search_db.json`：Python 搜尋資料庫
- `js/buddhist_data.js`：JavaScript 資料檔

### 步驟 4：整合到翻譯系統

資料準備完成後，可以：
1. 在前端自動載入解釋
2. 根據經文內容自動匹配相關解釋
3. 提供多個解釋候選

## 📁 檔案結構

```
lamrim/
├── download_data.py          # 資料採集工具
├── create_search_engine.py   # 建立搜尋引擎
├── requirements.txt          # Python 依賴套件
├── data/                     # 資料目錄
│   ├── nanshan_data.json           # 原始資料
│   └── nanshan_search_db.json     # 搜尋資料庫
├── js/
│   ├── translator.js        # 翻譯核心（現有）
│   └── buddhist_data.js     # 佛法資料（新增）
└── index.html               # 前端頁面
```

## ⚙️ 自訂設定

### 調整下載範圍

在 `download_data.py` 中修改：

```python
collector.collect_all(1, 160)  # 從 1 到 160
```

### 調整搜尋精度

在 `create_search_engine.py` 中修改相似度閾值：

```python
def calculate_similarity(self, text1, text2):
    # 調整 similarity 計算邏輯
    similarity = SequenceMatcher(None, text1, text2).ratio()
    return similarity
```

## 🔧 使用 Word 檔案

如果您有原始的 Word 檔案，可以使用以下腳本：

```python
from docx import Document

def parse_word_file(word_file):
    doc = Document(word_file)
    
    data = []
    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()
        if text:
            # 這裡需要根據 Word 檔案結構解析
            data.append(text)
    
    return data
```

## 📝 注意事項

1. **網路連接**：確保可以連接到 `www.amrtf.org`
2. **下載時間**：約 160 個頁面，預計需要 5-10 分鐘
3. **儲存空間**：每個頁面約 10-20KB，總計約 2-3MB
4. **尊重網站**：遵守網站的 robots.txt 和使用條款

## 🎯 下一步

1. ✅ 資料採集與整理
2. ⏳ 建立自動匹配系統
3. ⏳ 整合到翻譯流程
4. ⏳ 測試與優化

## 💡 進階功能建議

- **模糊匹配**：處理經文變體
- **多源資料**：整合多個佛學資料來源
- **快取機制**：提高搜尋速度
- **使用者回饋**：讓使用者可以標記有用的解釋
