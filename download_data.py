#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
南山律資料採集工具
從大慈恩譯經基金會網站下載手抄稿內容
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
from urllib.parse import urljoin

class NanshanDataCollector:
    def __init__(self):
        self.base_url = "https://www.amrtf.org/zh-hant/nanshan-vinaya-transcripts1991-"
        self.data = []
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    
    def download_page(self, page_num):
        """下載單頁內容"""
        url = f"{self.base_url}{page_num:03d}/"
        print(f"正在下載: {url}")
        
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            response.encoding = 'utf-8'
            return response.text
        except Exception as e:
            print(f"下載失敗 {url}: {e}")
            return None
    
    def extract_content(self, html_content, page_num):
        """從 HTML 中提取內容，分類原文和解釋"""
        soup = BeautifulSoup(html_content, 'html.parser')
        
        result = {
            'page': page_num,
            'url': f"{self.base_url}{page_num:03d}/",
            'title': '',
            'items': [],  # 改為項目列表，每個項目包含原文和解釋
            'pending_explanation': None  # 待延續的解釋（最後一個 blockquote 的解釋可能跨頁）
        }
        
        try:
            # 提取標題
            title_tag = soup.find('h1') or soup.find('h2', class_='entry-title')
            if title_tag:
                result['title'] = title_tag.get_text(strip=True)
            else:
                result['title'] = f"南山律在家備覽略編 - {page_num:03d}"
            
            # 找到包含經文的主要內容區域
            main_content = soup.find('div', id='lang_body_default') or soup.find('main')
            
            if not main_content:
                return result
            
            # 找到所有 <blockquote> 標籤（這些是原文）
            blockquotes = main_content.find_all('blockquote')
            
            if blockquotes:
                # 處理每個 blockquote
                for idx, blockquote in enumerate(blockquotes):
                    # 提取原文（blockquote 內的所有文字）
                    original_text = blockquote.get_text(strip=True)
                    
                    if not original_text:
                        continue
                    
                    # 提取解釋（從這個 blockquote 之後到下一個 blockquote 或 h2 之前）
                    explanation_parts = []
                    current_element = blockquote.find_next_sibling()
                    
                    # 收集解釋段落，直到下一個 blockquote、h2 或頁面結束
                    while current_element:
                        # 遇到下一個 blockquote 或標題，停止收集
                        if current_element.name == 'blockquote' or current_element.name == 'h2':
                            break
                        
                        # 收集段落文本
                        if current_element.name == 'p':
                            text = current_element.get_text(strip=True)
                            if text and len(text) > 5:  # 過濾太短的段落
                                explanation_parts.append(text)
                        
                        current_element = current_element.find_next_sibling()
                    
                    # 組合成解釋
                    explanation = ' '.join(explanation_parts) if explanation_parts else ''
                    
                    # 檢查這是否是頁面最後一個 blockquote
                    is_last_blockquote = (idx == len(blockquotes) - 1)
                    
                    if is_last_blockquote:
                        # 最後一個 blockquote，解釋可能延續到下一頁
                        result['pending_explanation'] = {
                            'original': original_text,
                            'explanation': explanation
                        }
                    else:
                        # 完整配對，加入結果
                        result['items'].append({
                            'original': original_text,
                            'explanation': explanation
                        })
            else:
                # 有找到標楷體，按照結構分類
                current_item = None
                
                for element in main_content.find_all(['span', 'p', 'h2', 'blockquote']):
                    # 檢查是否是原文（標楷體）
                    if element.name == 'span' and 'scripture-kai' in element.get('class', []):
                        # 如果有待處理的項目，先加入結果
                        if current_item and current_item['explanation']:
                            result['items'].append(current_item)
                        
                        # 開始新的項目
                        current_item = {
                            'original': element.get_text(strip=True),
                            'explanation': ''
                        }
                    
                    # 檢查是否是解釋（普通段落）
                    elif current_item and element.name == 'p':
                        text = element.get_text(strip=True)
                        
                        # 檢查下一個同級元素是否是原文（blockquote + scripture-kai）
                        next_elem = element.find_next_sibling()
                        if next_elem and next_elem.name == 'blockquote':
                            kai_text = next_elem.find('span', class_='scripture-kai')
                            if kai_text:
                                # 遇到下一個原文，結束當前解釋
                                if current_item['explanation']:
                                    result['items'].append(current_item)
                                current_item = None
                                continue
                        
                        if text and len(text) > 5:
                            if current_item['explanation']:
                                current_item['explanation'] += ' '
                            current_item['explanation'] += text
                
                # 加入最後一個項目
                if current_item and current_item['explanation']:
                    result['items'].append(current_item)
                    
        except Exception as e:
            print(f"內容提取失敗: {e}")
            import traceback
            traceback.print_exc()
        
        return result
    
    def collect_all(self, start=1, end=160, test_mode=False):
        """採集所有頁面"""
        if test_mode:
            print(f"測試模式：只下載頁面 {start}")
            end = start
        
        print(f"開始採集 {start} 到 {end} 頁...")
        
        pending_explanation = None
        for i in range(start, end + 1):
            html = self.download_page(i)
            if html:
                data = self.extract_content(html, i)
                
                # 處理跨頁解釋合併
                if pending_explanation:
                    # 如果這頁有新的 blockquote，先完成上一個解釋
                    if data.get('items') and len(data['items']) > 0:
                        # 完成上一個解釋，添加到上一頁的最後
                        if len(self.data) > 0:
                            self.data[-1]['items'].append(pending_explanation)
                    else:
                        # 這頁還沒有新的原文，繼續合併解釋
                        if data.get('pending_explanation'):
                            # 合併解釋
                            pending_explanation['explanation'] += ' ' + data['pending_explanation'].get('explanation', '')
                            data['pending_explanation'] = pending_explanation
                        else:
                            # 這頁沒有 blockquote，說明解釋延續
                            pending_explanation = None
                
                # 檢查是否有待延續的解釋
                if data.get('pending_explanation'):
                    pending_explanation = data['pending_explanation']
                    # 如果這是最後一頁，直接加入
                    if i == end:
                        data['items'].append(pending_explanation)
                        data['pending_explanation'] = None
                
                self.data.append(data)
                print(f"已完成: {i}/{end}")
                if test_mode:
                    print(f"\n測試資料預覽:")
                    print(f"標題: {data['title']}")
                    print(f"配對數量: {len(data['items'])}")
                    print(f"\n前三個配對:")
                    for idx, item in enumerate(data['items'][:3], 1):
                        print(f"\n配對 {idx}:")
                        print(f"  原文: {item['original'][:100]}...")
                        print(f"  解釋: {item['explanation'][:100]}...")
            else:
                print(f"失敗: {i}/{end}")
            
            # 避免被封鎖，每次請求間隔
            time.sleep(1)
        
        print(f"\n採集完成！共獲得 {len(self.data)} 條資料")
    
    def save_to_json(self, filename='nanshan_data.json'):
        """儲存為 JSON"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)
        print(f"資料已儲存到 {filename}")
    
    def create_search_database(self, filename='data/nanshan_search_db.json'):
        """建立搜尋資料庫（關鍵字 -> 解釋）"""
        search_db = {}
        
        # 處理跨頁解釋合併
        pending = None
        for idx, page_data in enumerate(self.data):
            # 如果有待合併的解釋，先處理
            if pending:
                # 如果這頁有新的 blockquote，先完成上一個解釋
                if page_data.get('items') and len(page_data['items']) > 0:
                    # 完成上一個解釋
                    final_item = {
                        'original': pending['original'],
                        'explanation': pending['explanation']
                    }
                    # 找到應該插入的位置（上一個頁面的最後）
                    if idx > 0:
                        self.data[idx-1]['items'].append(final_item)
                    pending = None
            
            # 處理當前頁面的項目
            for item in page_data.get('items', []):
                original = item.get('original', '')
                if original:
                    keywords = self.extract_keywords(original)
                    for keyword in keywords:
                        if keyword not in search_db:
                            search_db[keyword] = []
                        search_db[keyword].append({
                            'page': page_data['page'],
                            'title': page_data['title'],
                            'original': original,
                            'explanation': item.get('explanation', '')
                        })
            
            # 檢查是否有待延續的解釋
            if page_data.get('pending_explanation'):
                pending = page_data['pending_explanation']
                # 如果這是最後一頁，直接加入
                if idx == len(self.data) - 1:
                    page_data['items'].append(pending)
                    pending = None
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(search_db, f, ensure_ascii=False, indent=2)
        print(f"搜尋資料庫已建立: {filename}")
    
    def extract_keywords(self, text):
        """從文本中提取關鍵字"""
        # 簡單的關鍵字提取
        # 可以改進為更智能的方式
        # 目前返回文本的前幾個詞
        words = text.split()
        return [w for w in words[:10] if len(w) > 2][:5]  # 取前5個詞


if __name__ == "__main__":
    import sys
    
    collector = NanshanDataCollector()
    
    # 檢查是否為測試模式
    test_mode = '--test' in sys.argv or '-t' in sys.argv
    
    if test_mode:
        print("=" * 60)
        print("測試模式：只下載第一頁")
        print("=" * 60)
        
        # 只下載第一頁進行測試
        collector.collect_all(1, 1, test_mode=True)
        
        # 儲存測試資料
        collector.save_to_json('data/nanshan_data_test.json')
        
        print("\n測試完成！請檢查 data/nanshan_data_test.json")
        print("\n如果測試成功，執行以下命令下載全部資料：")
        print("  python download_data.py")
    else:
        print("=" * 60)
        print("開始下載全部 160 頁資料")
        print("=" * 60)
        
        # 採集資料
        collector.collect_all(1, 160)  # 從 1 到 160
        
        # 儲存原始資料
        collector.save_to_json('data/nanshan_data.json')
        
        # 建立搜尋資料庫
        collector.create_search_database('data/nanshan_search_db.json')
        
        print("\n所有資料已準備完成！")
