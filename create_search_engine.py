#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
建立佛法經文搜尋引擎
從 JSON 資料建立可搜尋的資料庫
"""

import json
import re
from difflib import SequenceMatcher

class BuddhistTextSearcher:
    def __init__(self, db_file='data/nanshan_data.json'):
        """初始化搜尋引擎"""
        with open(db_file, 'r', encoding='utf-8') as f:
            self.data = json.load(f)
        
        # 建立索引
        self.build_index()
    
    def build_index(self):
        """建立搜尋索引"""
        print("正在建立搜尋索引...")
        
        # 建立反向索引
        self.index = {}
        
        for item in self.data:
            # 提取所有可能的關鍵字
            keywords = self.extract_all_keywords(item['original_text'])
            
            for keyword in keywords:
                if keyword not in self.index:
                    self.index[keyword] = []
                self.index[keyword].append(item)
        
        print(f"索引建立完成！共有 {len(self.index)} 個關鍵字")
    
    def extract_all_keywords(self, text):
        """提取文本中的所有關鍵字"""
        if not text:
            return []
        
        # 移除標點符號
        text = re.sub(r'[，。！？；：、\s]+', ' ', text)
        
        # 提取所有詞（過濾掉太短的詞）
        words = [w for w in text.split() if len(w) >= 2]
        
        return words
    
    def search(self, query, limit=5):
        """搜尋相關內容"""
        results = []
        query_keywords = self.extract_all_keywords(query)
        
        # 計算每個項目與查詢的相似度
        scored_items = {}
        
        for keyword in query_keywords:
            if keyword in self.index:
                for item in self.index[keyword]:
                    # 計算相似度
                    content = item.get('content', '') or ' '.join(item.get('paragraphs', []))
                    similarity = self.calculate_similarity(query, content)
                    
                    item_url = item.get('url', f"page_{item['page']}")
                    if item_url not in scored_items or scored_items[item_url]['score'] < similarity:
                        scored_items[item_url] = {
                            'item': item,
                            'score': similarity
                        }
        
        # 排序並返回前 N 個結果
        sorted_items = sorted(scored_items.values(), key=lambda x: x['score'], reverse=True)
        
        return [item['item'] for item in sorted_items[:limit]]
    
    def calculate_similarity(self, text1, text2):
        """計算兩個文本的相似度"""
        if not text1 or not text2:
            return 0.0
        
        return SequenceMatcher(None, text1, text2).ratio()
    
    def find_best_match(self, query):
        """找出最佳匹配的解釋"""
        results = self.search(query, limit=1)
        
        if results:
            item = results[0]
            return item.get('content', '') or ' '.join(item.get('paragraphs', []))
        else:
            return None
    
    def get_explanation(self, text):
        """根據經文獲取解釋"""
        best_match = self.find_best_match(text)
        
        if best_match:
            return best_match
        else:
            # 如果找不到，返回相似內容
            all_results = self.search(text, limit=3)
            if all_results:
                item = all_results[0]
                return item.get('content', '') or ' '.join(item.get('paragraphs', []))
            else:
                return "未找到相關解釋"
    
    def export_to_js(self, output_file='js/buddhist_data.js'):
        """匯出為 JavaScript 可用的格式"""
        print(f"正在匯出到 {output_file}...")
        
        # 建立簡化的資料庫
        simplified_db = {}
        
        for item in self.data:
            # 使用 URL 作為 key
            simplified_db[item.get('url', f"page_{item['page']}")] = {
                'title': item.get('title', ''),
                'content': item.get('content', ''),
                'paragraphs': item.get('paragraphs', [])
            }
        
        js_content = f"""
// 南山律在家備覽略編資料庫
const BuddhistData = {json.dumps(simplified_db, ensure_ascii=False, indent=2)};

// 簡單的搜尋函數
function searchBuddhistText(query) {{
    const results = [];
    const queryKeywords = query.split(/[\\s，。！？；：、]+/).filter(w => w.length >= 2);
    
    for (const [url, data] of Object.entries(BuddhistData)) {{
        let matchCount = 0;
        const content = data.content || data.paragraphs.join(' ') || '';
        
        for (const keyword of queryKeywords) {{
            if (content.includes(keyword)) {{
                matchCount++;
            }}
        }}
        
        if (matchCount > 0) {{
            results.push({{
                url: url,
                title: data.title,
                explanation: data.content || data.paragraphs.join(' '),
                matchCount: matchCount
            }});
        }}
    }}
    
    results.sort((a, b) => b.matchCount - a.matchCount);
    return results.slice(0, 5);
}}

function getBuddhistExplanation(text) {{
    const results = searchBuddhistText(text);
    return results.length > 0 ? results[0].explanation : null;
}}
"""
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(js_content)
        
        print(f"✓ 已匯出到 {output_file}")


if __name__ == "__main__":
    searcher = BuddhistTextSearcher('data/nanshan_data.json')
    
    # 匯出為 JavaScript
    searcher.export_to_js('js/buddhist_data.js')
    
    print("\n✓ 搜尋引擎已準備完成！")
