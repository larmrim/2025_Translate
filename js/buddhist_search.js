 // 佛法經文搜尋引擎
// 用於自動匹配原文並獲取對應的解釋

class BuddhistTextSearcher {
    constructor(data) {
        this.data = data;
        this.index = null; // 延遲建立索引
    }

    // 建立搜尋索引
    buildIndex() {
        if (this.index) return; // 已建立則跳過
        
        this.index = new Map();
        
        // 為每段原文建立索引
        for (const page of this.data) {
            for (const item of page.items || []) {
                if (!item.original || !item.explanation) continue;
                
                // 提取關鍵字
                const keywords = this.extractKeywords(item.original);
                
                for (const keyword of keywords) {
                    if (!this.index.has(keyword)) {
                        this.index.set(keyword, []);
                    }
                    this.index.get(keyword).push({
                        original: item.original,
                        explanation: item.explanation,
                        page: page.page,
                        title: page.title
                    });
                }
            }
        }
        
        console.log(`搜尋索引建立完成：${this.index.size} 個關鍵字`);
    }

    // 從文本中提取關鍵字
    extractKeywords(text) {
        if (!text) return [];
        
        // 移除標點符號並分割
        const cleaned = text.replace(/[，。！？；：、\s《》「」『』『』【】〔〕〈〉()（）]+/g, ' ');
        const words = cleaned.split(/\s+/).filter(w => w.length >= 2);
        
        return words;
    }

    // 計算文本相似度
    calculateSimilarity(text1, text2) {
        if (!text1 || !text2) return 0;
        
        // 簡單的相似度計算：計算共同字符的比例
        const set1 = new Set(text1.split(''));
        const set2 = new Set(text2.split(''));
        
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        return intersection.size / union.size;
    }

    // 搜尋最匹配的解釋
    search(query, limit = 5) {
        if (!this.index) {
            this.buildIndex();
        }
        
        if (!query || query.trim().length < 2) {
            return null;
        }
        
        const queryKeywords = this.extractKeywords(query);
        if (queryKeywords.length === 0) {
            return null;
        }
        
        // 計算每個候選項目的分數
        const candidates = new Map();
        
        // 首先通過關鍵字匹配找到候選
        for (const keyword of queryKeywords) {
            if (this.index.has(keyword)) {
                const matches = this.index.get(keyword);
                for (const match of matches) {
                    if (!candidates.has(match.original)) {
                        candidates.set(match.original, {
                            ...match,
                            score: 0,
                            keywordMatches: 0
                        });
                    }
                    candidates.get(match.original).keywordMatches++;
                }
            }
        }
        
        // 計算相似度分數
        for (const [original, candidate] of candidates.entries()) {
            const similarity = this.calculateSimilarity(query, original);
            // 綜合關鍵字匹配數和相似度
            candidate.score = candidate.keywordMatches * 0.6 + similarity * 0.4;
        }
        
        // 排序並返回最佳匹配
        const sorted = Array.from(candidates.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
        
        return sorted.length > 0 ? sorted[0] : null;
    }

    // 獲取解釋（主要介面）
    getExplanation(originalText) {
        const result = this.search(originalText, 1);
        return result ? result.explanation : null;
    }
}

// 全域搜尋器實例（會在資料載入後初始化）
let buddhistSearcher = null;

// 載入資料並初始化搜尋器
async function loadBuddhistData() {
    try {
        const response = await fetch('data/nanshan_data.json');
        if (!response.ok) {
            console.warn('無法載入佛法資料，將使用手動輸入模式');
            return false;
        }
        
        const data = await response.json();
        buddhistSearcher = new BuddhistTextSearcher(data);
        buddhistSearcher.buildIndex();
        
        console.log('佛法資料載入完成，自動推算功能已啟用');
        return true;
    } catch (error) {
        console.warn('載入佛法資料失敗：', error);
        return false;
    }
}

// 自動搜尋並填入解釋
function autoFillExplanation(inputText) {
    if (!buddhistSearcher || !inputText || inputText.trim().length < 5) {
        return null;
    }
    
    const explanation = buddhistSearcher.getExplanation(inputText);
    return explanation;
}

// 頁面載入時初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadBuddhistData);
} else {
    loadBuddhistData();
}
