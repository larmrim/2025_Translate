#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
處理廣論資料中的時間戳
從 explanation 中提取時間戳（如 1A, 2B），移除時間戳，並將第一個時間戳添加到 title 後面
"""

import json
import re

def extract_timestamp(text):
    """從文本中提取時間戳（如 1A, 2B, 160B 等）
    格式：數字(1-160) + A或B
    """
    # 匹配模式：數字(1-160) + A或B，後面可能有空格和時間
    # 例如：1A, 2B, 160B, 1A 02:34, 2B 05:19
    pattern = r'\b(\d{1,3}[AB])\s*(?:\d{2}:\d{2})?'
    matches = re.findall(pattern, text)
    
    # 返回第一個匹配的時間戳（如果有的話）
    if matches:
        return matches[0]  # 例如 "1A" 或 "2B"
    return None

def remove_timestamps(text):
    """從文本中移除所有時間戳"""
    if not text:
        return text
    
    # 移除時間戳模式：數字(1-160) + A或B + 可選的時間 + 可選的重複
    # 例如：1A 02:3402:34 1A 02:3402:34 1A 02:3402:34 1A 02:34
    # 或者：2A 05:1901:17 2A 05:1901:17 2A 05:1901:17 2A 05:19
    
    # 先移除重複的時間戳模式
    # 匹配：時間戳 + 空格 + 數字數字:數字數字 + 空格 + (重複的時間戳)
    pattern1 = r'\b\d{1,3}[AB]\s+\d{2}:\d{2}\d{2}:\d{2}\s+(?:\d{1,3}[AB]\s+\d{2}:\d{2}\d{2}:\d{2}\s+)*\d{1,3}[AB]\s+\d{2}:\d{2}'
    text = re.sub(pattern1, '', text)
    
    # 移除簡單的時間戳模式：數字 + A/B + 空格 + 時間
    pattern2 = r'\b\d{1,3}[AB]\s+\d{2}:\d{2}'
    text = re.sub(pattern2, '', text)
    
    # 移除單獨的時間戳（數字 + A/B）
    pattern3 = r'\b\d{1,3}[AB]\b'
    text = re.sub(pattern3, '', text)
    
    # 移除殘留的重複時間格式：例如 4:08:50 4:08:50 4:08:50 4:08:50
    # 匹配：數字:數字:數字（重複多次）
    pattern4 = r'\b\d{1,2}:\d{2}:\d{2}(?:\s+\d{1,2}:\d{2}:\d{2}){2,}'
    text = re.sub(pattern4, '', text)
    
    # 移除其他可能的時間格式：例如 08:50 08:50 08:50
    pattern5 = r'\b\d{2}:\d{2}(?:\s+\d{2}:\d{2}){2,}'
    text = re.sub(pattern5, '', text)
    
    # 清理多餘的空格
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    return text

def process_data_file(input_file, output_file):
    """處理資料文件，提取時間戳並更新 title"""
    print(f"正在讀取 {input_file}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"找到 {len(data)} 個關鍵字項目")
    
    processed_count = 0
    timestamp_count = 0
    
    # 處理每個關鍵字下的項目
    for keyword, items in data.items():
        for item in items:
            processed_count += 1
            
            # 提取時間戳
            explanation = item.get('explanation', '')
            if explanation:
                timestamp = extract_timestamp(explanation)
                
                if timestamp:
                    timestamp_count += 1
                    # 將時間戳添加到 title 後面
                    original_title = item.get('title', '廣論南普陀版手抄稿')
                    if timestamp not in original_title:
                        item['title'] = f"{original_title}{timestamp}"
                
                # 無論是否有時間戳，都清理殘留的時間戳格式
                item['explanation'] = remove_timestamps(explanation)
    
    print(f"處理完成：")
    print(f"  總項目數：{processed_count}")
    print(f"  找到時間戳的項目：{timestamp_count}")
    
    # 保存處理後的資料
    print(f"正在保存到 {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 處理完成！")

def process_main_data_file(input_file, output_file):
    """處理主要的資料文件（lamrim1_data.json）"""
    print(f"正在讀取 {input_file}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"找到 {len(data)} 頁資料")
    
    processed_pages = 0
    processed_items = 0
    timestamp_count = 0
    
    # 處理每一頁
    for page in data:
        page_timestamp = None
        
        # 處理該頁的所有項目
        for item in page.get('items', []):
            processed_items += 1
            explanation = item.get('explanation', '')
            
            if explanation:
                timestamp = extract_timestamp(explanation)
                
                if timestamp:
                    timestamp_count += 1
                    # 記錄第一個時間戳作為頁面的時間戳
                    if not page_timestamp:
                        page_timestamp = timestamp
                
                # 無論是否有時間戳，都清理殘留的時間戳格式
                item['explanation'] = remove_timestamps(explanation)
        
        # 如果找到時間戳，更新頁面標題
        if page_timestamp:
            original_title = page.get('title', '廣論南普陀版手抄稿')
            if page_timestamp not in original_title:
                page['title'] = f"{original_title}{page_timestamp}"
                processed_pages += 1
    
    print(f"處理完成：")
    print(f"  總頁數：{len(data)}")
    print(f"  更新標題的頁數：{processed_pages}")
    print(f"  總項目數：{processed_items}")
    print(f"  找到時間戳的項目：{timestamp_count}")
    
    # 保存處理後的資料
    print(f"正在保存到 {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 處理完成！")

if __name__ == "__main__":
    import sys
    
    # 處理搜尋資料庫
    print("=" * 60)
    print("處理搜尋資料庫")
    print("=" * 60)
    process_data_file('data/lamrim1_search_db.json', 'data/lamrim1_search_db.json')
    
    print("\n" + "=" * 60)
    print("處理主要資料文件")
    print("=" * 60)
    process_main_data_file('data/lamrim1_data.json', 'data/lamrim1_data.json')
    
    print("\n所有處理完成！")

