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

    // 獲取解釋（主要介面，支援多段匹配）
    getExplanation(originalText) {
        console.log('搜尋解釋，查詢文字長度：', originalText.length);
        
        // 如果輸入很長，先用前100字進行初始搜尋以提高效率
        const searchText = originalText.length > 100 ? originalText.substring(0, 100) : originalText;
        const result = this.search(searchText, 1);
        
        if (!result) {
            console.log('未找到匹配結果');
            return null;
        }
        
        console.log('找到匹配結果，分數：', result.score);
        console.log('匹配到的原文：', result.original.substring(0, 80) + '...');
        console.log('匹配段落所在頁面：', result.page);
        
        // 使用完整輸入文字來查找並合併後續相關段落
        const mergedExplanation = this.findAndMergeSubsequentParagraphs(originalText, result);
        
        if (mergedExplanation.splitCount > 1) {
            console.log(`✅ 已合併 ${mergedExplanation.splitCount} 段解釋`);
        }
        
        return mergedExplanation.text;
    }
    
    // 查找並合併後續段落
    findAndMergeSubsequentParagraphs(queryText, firstMatch) {
        let mergedText = firstMatch.explanation;
        let splitCount = 1;
        
        // 找到第一個匹配所在的頁面
        const pageIndex = this.data.findIndex(page => page.page === firstMatch.page);
        if (pageIndex === -1) {
            return { text: mergedText, splitCount: 1 };
        }
        
        const page = this.data[pageIndex];
        const items = page.items || [];
        
        // 找到第一個匹配在 items 中的位置
        // 使用寬鬆的匹配，因為 original 可能有前綴或格式差異
        let startIndex = -1;
        for (let i = 0; i < items.length; i++) {
            // 精確匹配
            if (items[i].original === firstMatch.original && items[i].explanation === firstMatch.explanation) {
                startIndex = i;
                break;
            }
            // 如果精確匹配失敗，嘗試寬鬆匹配（去除前綴、標點後比對）
            const itemClean = items[i].original.replace(/^[^《]*《/, '《').replace(/[，。！？；：、\s《》「」『』【】〔〕〈〉()（）]/g, '');
            const matchClean = firstMatch.original.replace(/^[^《]*《/, '《').replace(/[，。！？；：、\s《》「」『』【】〔〕〈〉()（）]/g, '');
            if (itemClean.includes(matchClean) || matchClean.includes(itemClean)) {
                // 確認 explanation 也相似
                if (items[i].explanation && firstMatch.explanation && 
                    (items[i].explanation.includes(firstMatch.explanation.substring(0, 20)) ||
                     firstMatch.explanation.includes(items[i].explanation.substring(0, 20)))) {
                    startIndex = i;
                    console.log(`  定位到段落位置：${i} (寬鬆匹配)`);
                    break;
                }
            }
        }
        
        if (startIndex === -1) {
            console.log(`  ⚠️ 無法定位匹配段落在資料中的位置`);
            console.log(`  匹配到的 original: ${firstMatch.original.substring(0, 50)}...`);
            return { text: mergedText, splitCount: 1 };
        }
        
        console.log(`  ✅ 找到起始段落位置：${startIndex}，頁面共有 ${items.length} 個段落`);
        
        // 檢查後續項目是否應該包含
        // 策略：檢查用戶輸入中是否包含後續段落的原文
        // 由於資料是連續的，只要用戶輸入包含該段落，就應該包含
        const queryTextClean = queryText.replace(/[，。！？；：、\s《》「」『』【】〔〕〈〉()（）]/g, '');
        let consecutiveMissed = 0; // 連續未匹配的段落數
        const maxConsecutiveMissed = 2; // 允許最多連續2段未匹配
        
        for (let i = startIndex + 1; i < items.length && consecutiveMissed <= maxConsecutiveMissed; i++) {
            const item = items[i];
            if (!item.original || !item.explanation) {
                consecutiveMissed++;
                continue;
            }
            
            // 統一引號以便比對（處理『』和「」的差異）
            const itemOriginalNormalized = item.original.replace(/[''""「」『』《》]/g, '「').replace(/[''""『』《》]/g, '」');
            const queryTextNormalized = queryText.replace(/[''""「」『』《》]/g, '「').replace(/[''""『』《》]/g, '」');
            
            // 清理原文用於比對（去除標點和空白）
            const itemOriginalClean = itemOriginalNormalized.replace(/[，。！？；：、\s【】〔〕〈〉()（）]/g, '');
            
            // 判斷是否應該包含：
            // 1. 用戶輸入中包含完整的段落原文（含標點，考慮引號差異）
            // 2. 用戶輸入中包含段落原文（不含標點）
            // 3. 段落很短（<=20字）且用戶輸入中包含足夠的共同字符（>=60%）
            const isDirectlyIncluded = queryText.includes(item.original) || queryTextNormalized.includes(itemOriginalNormalized);
            const isCleanIncluded = itemOriginalClean.length > 0 && queryTextClean.includes(itemOriginalClean);
            
            // 對於短段落，檢查共同字符比例
            const commonChars = itemOriginalClean.split('').filter(char => queryTextClean.includes(char));
            const charMatchRatio = itemOriginalClean.length > 0 ? commonChars.length / itemOriginalClean.length : 0;
            const isShortAndRelated = item.original.length <= 20 && charMatchRatio > 0.6;
            
            // 額外檢查：如果用戶輸入中包含了該段落的關鍵字（至少3個字符連續匹配）
            let hasKeyPhrase = false;
            if (itemOriginalClean.length >= 3) {
                // 檢查是否有至少3個連續字符在用戶輸入中
                for (let j = 0; j <= itemOriginalClean.length - 3; j++) {
                    const phrase = itemOriginalClean.substring(j, j + 3);
                    if (queryTextClean.includes(phrase)) {
                        hasKeyPhrase = true;
                        break;
                    }
                }
            }
            
            const isIncluded = isDirectlyIncluded || isCleanIncluded || isShortAndRelated || hasKeyPhrase;
            
            // 調試日誌：顯示比對詳情（檢查前10段）
            if (i < startIndex + 10) {
                if (isIncluded) {
                    console.log(`  ✓ 匹配段落 ${i - startIndex + 1}：${item.original.substring(0, 40)}...`);
                } else {
                    console.log(`  ✗ 未匹配段落 ${i - startIndex + 1}：${item.original.substring(0, 40)}...`);
                    console.log(`    直接包含：${isDirectlyIncluded}, 清理後包含：${isCleanIncluded}, 短句相關：${isShortAndRelated}, 關鍵詞組：${hasKeyPhrase} (字符匹配率: ${charMatchRatio.toFixed(2)})`);
                }
            }
            
            if (isIncluded) {
                mergedText += '\n\n' + item.explanation;
                splitCount++;
                consecutiveMissed = 0; // 重置連續未匹配計數
                console.log(`  合併段落 ${splitCount}：${item.original.substring(0, 40)}...`);
            } else {
                consecutiveMissed++;
                // 如果連續多段未匹配，停止查找
                if (consecutiveMissed > maxConsecutiveMissed) {
                    console.log(`  連續 ${consecutiveMissed} 段未匹配，停止查找`);
                    break;
                }
            }
        }
        
        // 也檢查下一頁（如果有的話），以防跨頁情況
        // 如果當前頁最後一段有匹配，繼續檢查下一頁
        if (pageIndex + 1 < this.data.length && consecutiveMissed <= maxConsecutiveMissed) {
            const nextPage = this.data[pageIndex + 1];
            const nextItems = nextPage.items || [];
            let nextConsecutiveMissed = 0;
            
            // 檢查下一頁的多個項目（最多檢查前10段）
            for (let i = 0; i < nextItems.length && i < 10 && nextConsecutiveMissed <= maxConsecutiveMissed; i++) {
                const item = nextItems[i];
                if (!item.original || !item.explanation) {
                    nextConsecutiveMissed++;
                    continue;
                }
                
                // 統一引號以便比對
                const itemOriginalNormalized = item.original.replace(/[''""「」『』《》]/g, '「').replace(/[''""『』《》]/g, '」');
                const queryTextNormalized = queryText.replace(/[''""「」『』《》]/g, '「').replace(/[''""『』《》]/g, '」');
                
                const itemOriginalClean = itemOriginalNormalized.replace(/[，。！？；：、\s【】〔〕〈〉()（）]/g, '');
                const isDirectlyIncluded = queryText.includes(item.original) || queryTextNormalized.includes(itemOriginalNormalized);
                const isCleanIncluded = itemOriginalClean.length > 0 && queryTextClean.includes(itemOriginalClean);
                
                const commonChars = itemOriginalClean.split('').filter(char => queryTextClean.includes(char));
                const charMatchRatio = itemOriginalClean.length > 0 ? commonChars.length / itemOriginalClean.length : 0;
                const isShortAndRelated = item.original.length <= 20 && charMatchRatio > 0.6;
                
                const isIncluded = isDirectlyIncluded || isCleanIncluded || isShortAndRelated;
                
                if (isIncluded) {
                    mergedText += '\n\n' + item.explanation;
                    splitCount++;
                    nextConsecutiveMissed = 0;
                    console.log(`  跨頁合併段落 ${splitCount}：${item.original.substring(0, 40)}...`);
                } else {
                    nextConsecutiveMissed++;
                    if (nextConsecutiveMissed > maxConsecutiveMissed) {
                        break;
                    }
                }
            }
        }
        
        return { text: mergedText, splitCount };
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
