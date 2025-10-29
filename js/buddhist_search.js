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

    // 從文本中提取關鍵字（優化中文處理）
    extractKeywords(text) {
        if (!text) return [];
        
        // 移除標點符號但保留中文字符
        const cleaned = text.replace(/[，。！？；：、\s《》「」『』【】〔〕〈〉()（）]+/g, '');
        
        // 對於中文，提取2-3字的詞組（平衡索引大小和匹配準確度）
        const keywords = [];
        const seen = new Set();
        
        // 提取2-3字的詞組
        for (let len = 3; len >= 2; len--) {
            for (let i = 0; i <= cleaned.length - len; i++) {
                const keyword = cleaned.substring(i, i + len);
                if (!seen.has(keyword)) {
                    keywords.push(keyword);
                    seen.add(keyword);
                }
            }
        }
        
        return keywords;
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
        
        // 如果通過關鍵字沒有找到候選，嘗試直接相似度匹配
        if (candidates.size === 0) {
            console.log('關鍵字匹配無結果，嘗試相似度匹配...');
            
            // 遍歷所有資料進行相似度計算（限制前200個項目以提高性能）
            let count = 0;
            for (const page of this.data) {
                for (const item of page.items || []) {
                    if (!item.original || !item.explanation) continue;
                    if (count++ > 200) break; // 限制搜索範圍
                    
                    const similarity = this.calculateSimilarity(query, item.original);
                    if (similarity > 0.1) { // 只保留相似度大於0.1的
                        candidates.set(item.original, {
                            original: item.original,
                            explanation: item.explanation,
                            page: page.page,
                            title: page.title,
                            score: similarity,
                            keywordMatches: 0
                        });
                    }
                }
            }
        }
        
        // 排序並返回最佳匹配
        const sorted = Array.from(candidates.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
        
        if (sorted.length > 0) {
            console.log(`找到 ${sorted.length} 個候選，最佳分數：${sorted[0].score.toFixed(3)}`);
        }
        
        // 降低閾值以提高匹配率
        return sorted.length > 0 && sorted[0].score > 0.15 ? sorted[0] : null;
    }

    // 獲取解釋（主要介面）
    getExplanation(originalText) {
        console.log('搜尋解釋，查詢文字：', originalText.substring(0, 50));
        const result = this.search(originalText, 1);
        if (result) {
            console.log('找到匹配結果，分數：', result.score);
            return result.explanation;
        } else {
            console.log('未找到匹配結果');
            return null;
        }
    }
}

// 全域搜尋器實例（會在資料載入後初始化）
let buddhistSearcher = null;

// 載入資料並初始化搜尋器
async function loadBuddhistData() {
    try {
        console.log('開始載入佛法資料...');
        const response = await fetch('data/nanshan_data.json');
        if (!response.ok) {
            console.error('無法載入佛法資料，HTTP 狀態碼：', response.status);
            console.warn('將使用手動輸入模式');
            return false;
        }
        
        const data = await response.json();
        console.log(`資料載入成功，共有 ${data.length} 頁`);
        
        buddhistSearcher = new BuddhistTextSearcher(data);
        buddhistSearcher.buildIndex();
        
        console.log('✅ 佛法資料載入完成，自動推算功能已啟用');
        console.log(`索引大小：${buddhistSearcher.index ? buddhistSearcher.index.size : 0} 個關鍵字`);
        
        return true;
    } catch (error) {
        console.error('❌ 載入佛法資料失敗：', error);
        console.error('錯誤詳情：', error.message, error.stack);
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
