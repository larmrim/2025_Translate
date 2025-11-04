#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
菩提道次第廣論資料採集工具
從福智全球資訊網下載手抄稿內容
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
from urllib.parse import urljoin

class Lamrim1DataCollector:
    def __init__(self):
        self.base_url = "https://www.blisswisdom.org/teachings/lamrim1/"
        self.data = []
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
    
    def download_page(self, page_id):
        """下載單頁內容"""
        url = f"{self.base_url}{page_id}"
        print(f"正在下載: {url}")
        
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            response.encoding = 'utf-8'
            return response.text
        except Exception as e:
            print(f"下載失敗 {url}: {e}")
            return None
    
    def extract_content(self, html_content, page_id):
        """從 HTML 中提取內容，分類原文和解釋"""
        soup = BeautifulSoup(html_content, 'html.parser')
        
        result = {
            'page': page_id,
            'url': f"{self.base_url}{page_id}",
            'title': '',
            'items': []  # 每個項目包含原文和解釋
        }
        
        try:
            # 提取標題
            title_tag = soup.find('h1') or soup.find('h2', class_='entry-title')
            if title_tag:
                result['title'] = title_tag.get_text(strip=True)
            else:
                result['title'] = f"廣論手抄稿 - {page_id}"
            
            # 找到包含經文的主要內容區域
            # 根據網頁結構，可能需要找到特定的內容區域
            main_content = soup.find('div', class_='content') or soup.find('main') or soup.find('article')
            
            if not main_content:
                # 如果找不到，嘗試找 body 內的內容
                main_content = soup.find('body')
            
            if not main_content:
                return result
            
            # 找到所有 <h4> 標籤（這些是原文）
            h4_tags = main_content.find_all('h4')
            
            if not h4_tags:
                print(f"  警告：頁面 {page_id} 沒有找到 <h4> 標籤")
                return result
            
            # 處理每個 h4 標籤
            for idx, h4 in enumerate(h4_tags):
                # 提取原文（h4 標籤內的文字）
                original_text = h4.get_text(strip=True)
                
                if not original_text:
                    continue
                
                # 提取解釋（從這個 h4 之後到下一個 h4 之前）
                explanation_parts = []
                
                # 找到下一個 h4 標籤（在整個文檔中）
                next_h4 = None
                if idx + 1 < len(h4_tags):
                    next_h4 = h4_tags[idx + 1]
                
                # 獲取當前 h4 的父元素
                parent = h4.parent
                if not parent:
                    parent = main_content
                
                # 方法：從 h4 開始，找到所有後續元素，直到下一個 h4
                # 使用 find_all_next 但限制範圍
                all_elements = parent.find_all(['p', 'div', 'span', 'h4', 'br', 'strong', 'em'])
                
                # 找到當前 h4 在列表中的位置
                h4_index = -1
                for i, elem in enumerate(all_elements):
                    if elem == h4:
                        h4_index = i
                        break
                
                # 如果找到當前 h4，提取它之後到下一個 h4 之間的所有文本
                if h4_index >= 0:
                    for i in range(h4_index + 1, len(all_elements)):
                        elem = all_elements[i]
                        
                        # 如果遇到下一個 h4，停止
                        if elem == next_h4 or elem.name == 'h4':
                            break
                        
                        # 提取文本（排除 br 和空元素）
                        if elem.name != 'br':
                            text = elem.get_text(strip=True)
                            if text and len(text) > 5:
                                explanation_parts.append(text)
                
                # 如果上述方法沒有找到內容，嘗試從 h4 的 next_siblings 獲取
                if not explanation_parts:
                    current = h4.next_sibling
                    while current:
                        # 如果遇到下一個 h4，停止
                        if next_h4 and (current == next_h4 or 
                                       (hasattr(current, 'find') and current.find('h4') == next_h4)):
                            break
                        
                        if hasattr(current, 'name') and current.name == 'h4':
                            break
                        
                        # 提取文本
                        if hasattr(current, 'get_text'):
                            text = current.get_text(strip=True)
                            if text and len(text) > 5:
                                explanation_parts.append(text)
                        elif isinstance(current, str):
                            text = current.strip()
                            if text and len(text) > 5:
                                explanation_parts.append(text)
                        
                        current = current.next_sibling
                
                # 組合成解釋
                explanation = ' '.join(explanation_parts) if explanation_parts else ''
                
                # 加入結果（即使沒有解釋，也保留原文）
                result['items'].append({
                    'original': original_text,
                    'explanation': explanation
                })
                    
        except Exception as e:
            print(f"內容提取失敗: {e}")
            import traceback
            traceback.print_exc()
        
        return result
    
    def collect_all(self, start_id=6049, end_id=6097, start_suffix=1, end_suffix=42):
        """採集所有頁面
        
        Args:
            start_id: 起始 ID（如 6049）
            end_id: 結束 ID（如 6097）
            start_suffix: 起始後綴（如 01）
            end_suffix: 結束後綴（如 42）
        """
        print(f"開始採集從 {start_id}-{start_suffix:02d} 到 {end_id}-{end_suffix:02d}...")
        
        current_id = start_id
        current_suffix = start_suffix
        
        while True:
            # 構建頁面 ID（格式：6049-01）
            page_id = f"{current_id}-{current_suffix:02d}"
            
            html = self.download_page(page_id)
            if html:
                data = self.extract_content(html, page_id)
                self.data.append(data)
                print(f"已完成: {page_id} (項目數: {len(data['items'])})")
            else:
                print(f"失敗: {page_id}")
            
            # 移動到下一個頁面
            current_suffix += 1
            
            # 檢查是否到達當前 ID 的最後一頁
            # 根據規律，每個 ID 可能有不同數量的頁面
            # 先簡單處理：如果下載失敗，可能是下一個 ID 的開始
            if current_suffix > 100:  # 安全上限，避免無限循環
                break
            
            # 檢查是否到達結束 ID 和後綴
            if current_id > end_id or (current_id == end_id and current_suffix > end_suffix):
                break
            
            # 避免被封鎖，每次請求間隔
            time.sleep(1)
        
        print(f"\n採集完成！共獲得 {len(self.data)} 條資料")
    
    def collect_by_range(self, page_ids):
        """根據指定的頁面 ID 列表採集"""
        print(f"開始採集 {len(page_ids)} 個頁面...")
        
        for page_id in page_ids:
            html = self.download_page(page_id)
            if html:
                data = self.extract_content(html, page_id)
                self.data.append(data)
                print(f"已完成: {page_id} (項目數: {len(data['items'])})")
            else:
                print(f"失敗: {page_id}")
            
            # 避免被封鎖，每次請求間隔
            time.sleep(1)
        
        print(f"\n採集完成！共獲得 {len(self.data)} 條資料")
    
    def save_to_json(self, filename='data/lamrim1_data.json'):
        """儲存為 JSON"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)
        print(f"資料已儲存到 {filename}")
    
    def create_search_database(self, filename='data/lamrim1_search_db.json'):
        """建立搜尋資料庫（關鍵字 -> 解釋）"""
        search_db = {}
        
        for page_data in self.data:
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
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(search_db, f, ensure_ascii=False, indent=2)
        print(f"搜尋資料庫已建立: {filename}")
    
    def extract_keywords(self, text):
        """從文本中提取關鍵字"""
        # 簡單的關鍵字提取
        words = text.split()
        return [w for w in words[:10] if len(w) > 2][:5]  # 取前5個詞


if __name__ == "__main__":
    import sys
    
    collector = Lamrim1DataCollector()
    
    # 檢查是否為測試模式
    test_mode = '--test' in sys.argv or '-t' in sys.argv
    
    if test_mode:
        print("=" * 60)
        print("測試模式：只下載第一頁")
        print("=" * 60)
        
        # 只下載第一頁進行測試
        collector.collect_by_range(['6049-01'])
        
        # 儲存測試資料
        collector.save_to_json('data/lamrim1_data_test.json')
        
        print("\n測試完成！請檢查 data/lamrim1_data_test.json")
        print("\n如果測試成功，執行以下命令下載全部資料：")
        print("  python download_lamrim1_data.py")
    else:
        print("=" * 60)
        print("開始下載廣論手抄稿資料")
        print("=" * 60)
        
        # 生成所有頁面 ID
        # 從 6049-01 到 6097-42
        # 規律：6049-01, 6050-02, 6051-03, ..., 6097-42
        # 後綴 = ID - 6048，但最大後綴為 42
        page_ids = []
        
        for page_id in range(6049, 6098):  # 6049 到 6097
            suffix = page_id - 6048  # 6049-01 (1), 6050-02 (2), ...
            if suffix <= 42:  # 只到 42
                page_ids.append(f"{page_id}-{suffix:02d}")
            else:
                # 如果後綴超過 42，停止（因為用戶說最後是 6097-42）
                break
        
        # 採集資料
        collector.collect_by_range(page_ids)
        
        # 儲存原始資料
        collector.save_to_json('data/lamrim1_data.json')
        
        # 建立搜尋資料庫
        collector.create_search_database('data/lamrim1_search_db.json')
        
        print("\n所有資料已準備完成！")

