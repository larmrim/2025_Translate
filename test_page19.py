#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
測試特定頁面（第 19 頁）
"""

from download_data import NanshanDataCollector

def test_page_19():
    collector = NanshanDataCollector()
    
    print("=" * 60)
    print("測試第 19 頁（應該有更多標楷體內容）")
    print("=" * 60)
    
    collector.collect_all(19, 19, test_mode=True)
    collector.save_to_json('data/nanshan_data_test19.json')
    
    print(f"\n測試完成！")
    print("請檢查 data/nanshan_data_test19.json")

if __name__ == "__main__":
    test_page_19()
