#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
從目錄頁下載廣論手抄稿資料
先解析目錄頁，提取所有連結，然後下載每個頁面的內容
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
from urllib.parse import urljoin

class Lamrim1DataCollector:
    def __init__(self):
        self.base_url = "https://www.blisswisdom.org/teachings/lamrim1"
        self.data = []
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
    
    def download_page(self, url):
        """下載單頁內容"""
        print(f"正在下載: {url}")
        
        try:
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            response.encoding = 'utf-8'
            return response.text
        except Exception as e:
            print(f"下載失敗 {url}: {e}")
            return None
    
    def extract_links_from_index(self, html_content):
        """從目錄頁提取所有文章連結"""
        soup = BeautifulSoup(html_content, 'html.parser')
        links = []
        
        # 尋找所有指向 lamrim1 的文章連結
        # 從網頁內容看，連結格式應該是 /teachings/lamrim1/XXXX-XX
        for link in soup.find_all('a', href=True):
            href = link.get('href', '')
            # 匹配 lamrim1/ 後面的數字-數字格式
            match = re.search(r'/teachings/lamrim1/(\d+-\d+)', href)
            if match:
                page_id = match.group(1)
                full_url = urljoin(self.base_url + '/', page_id)
                if full_url not in links:
                    links.append(full_url)
        
        # 如果上面方法沒找到，嘗試其他方法
        if not links:
            # 查找所有包含 lamrim1 的連結
            for link in soup.find_all('a', href=True):
                href = link.get('href', '')
                if 'lamrim1' in href and re.search(r'\d+-\d+', href):
                    full_url = urljoin(self.base_url + '/', href)
                    if full_url not in links:
                        links.append(full_url)
        
        # 排序連結（按頁面 ID）
        links.sort(key=lambda x: re.search(r'/(\d+)-(\d+)', x).groups() if re.search(r'/(\d+)-(\d+)', x) else (0, 0))
        
        return links
    
    def extract_content(self, html_content, page_id):
        """從 HTML 中提取內容，分類原文和解釋"""
        soup = BeautifulSoup(html_content, 'html.parser')
        
        result = {
            'page': page_id,
            'url': f"{self.base_url}/{page_id}",
            'title': '',
            'items': []
        }
        
        try:
            # 提取標題
            title_tag = soup.find('h1') or soup.find('h2', class_='entry-title')
            if title_tag:
                result['title'] = title_tag.get_text(strip=True)
            else:
                result['title'] = f"廣論手抄稿 - {page_id}"
            
            # 找到包含經文的主要內容區域
            main_content = soup.find('div', class_='content') or soup.find('main') or soup.find('article')
            
            if not main_content:
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
                all_elements = parent.find_all(['p', 'div', 'span', 'h4', 'br', 'strong', 'em', 'blockquote'])
                
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
                
                # 加入結果
                result['items'].append({
                    'original': original_text,
                    'explanation': explanation
                })
                    
        except Exception as e:
            print(f"內容提取失敗: {e}")
            import traceback
            traceback.print_exc()
        
        return result
    
    def collect_from_index(self, index_url):
        """從目錄頁開始收集所有資料"""
        print("=" * 60)
        print("步驟 1: 下載目錄頁並提取所有連結")
        print("=" * 60)
        
        html = self.download_page(index_url)
        if not html:
            print("無法下載目錄頁！")
            return
        
        links = self.extract_links_from_index(html)
        print(f"\n找到 {len(links)} 個連結")
        
        if len(links) > 0:
            print(f"\n前 5 個連結:")
            for link in links[:5]:
                print(f"  {link}")
            print(f"\n後 5 個連結:")
            for link in links[-5:]:
                print(f"  {link}")
        
        print("\n" + "=" * 60)
        print("步驟 2: 開始下載所有頁面內容")
        print("=" * 60)
        
        for idx, link in enumerate(links, 1):
            # 從 URL 中提取 page_id
            match = re.search(r'/(\d+-\d+)$', link)
            if match:
                page_id = match.group(1)
            else:
                page_id = link.split('/')[-1]
            
            html = self.download_page(link)
            if html:
                data = self.extract_content(html, page_id)
                self.data.append(data)
                print(f"已完成: {idx}/{len(links)} - {page_id} (項目數: {len(data['items'])})")
            else:
                print(f"失敗: {idx}/{len(links)} - {page_id}")
            
            # 避免被封鎖，每次請求間隔
            time.sleep(1)
        
        print(f"\n採集完成！共獲得 {len(self.data)} 條資料")
    
    def save_to_json(self, filename='data/lamrim1_data.json'):
        """儲存為 JSON"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)
        print(f"資料已儲存到 {filename}")
    
    def create_search_database(self, filename='data/lamrim1_search_db.json'):
        """建立搜尋資料庫"""
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
        words = text.split()
        return [w for w in words[:10] if len(w) > 2][:5]


if __name__ == "__main__":
    collector = Lamrim1DataCollector()
    
    # 從目錄頁開始下載
    index_url = "https://www.blisswisdom.org/teachings/lamrim1"
    
    collector.collect_from_index(index_url)
    
    # 儲存原始資料
    collector.save_to_json('data/lamrim1_data.json')
    
    # 建立搜尋資料庫
    collector.create_search_database('data/lamrim1_search_db.json')
    
    print("\n所有資料已準備完成！")

