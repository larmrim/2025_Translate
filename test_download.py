#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
測試下載前 5 頁
"""

from download_data import NanshanDataCollector

def test_download():
    collector = NanshanDataCollector()
    
    print("=" * 60)
    print("測試模式：下載前 5 頁")
    print("=" * 60)
    
    collector.collect_all(1, 5, test_mode=True)
    collector.save_to_json('data/nanshan_data_test5.json')
    
    print(f"\n測試完成！共獲得 {len(collector.data)} 頁資料")
    print("請檢查 data/nanshan_data_test5.json")
    
    # 顯示統計資訊
    total_items = sum(len(page['items']) for page in collector.data)
    print(f"總配對數量: {total_items}")
    
    # 顯示每頁的配對數量
    for page in collector.data:
        print(f"頁面 {page['page']}: {len(page['items'])} 個配對")

if __name__ == "__main__":
    test_download()
