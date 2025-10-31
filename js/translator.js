// AI 翻譯 API 整合
class AncientTextTranslator {
    constructor() {
        this.apiKey = null; // OpenAI API Key
        this.geminiKeys = [
            "AIzaSyAoBrMaD-ZXSGV3Cc0WLu5mBj2Hrs7qiL0", // 原始 Key
            "AIzaSyBWDcpo8Mv86AI_xIR7_m4x3tRwK_BRdjQ"  // 新的 Key
        ]; // Google Gemini API Keys 列表
        this.currentGeminiKeyIndex = 0; // 當前使用的 Key 索引
        this.huggingfaceToken = null; // Hugging Face Token
        this.deepseekKey = null; // DeepSeek API Key
        this.baseUrl = 'https://api.openai.com/v1/chat/completions';
        this.geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
        this.deepseekUrl = 'https://api.deepseek.com/v1/chat/completions';
        this.freeServices = {
            huggingface: 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium'
        };
    }

    async translate(text, oralExplanation = '') {
        try {
            // 使用 OpenAI API 進行古文翻譯
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: `你是一個專業的古文翻譯專家，專精於將古文翻譯成現代口語化的白話文。

翻譯要求：
1. **準確性**：忠實於原文意思，不添加或刪減內容
2. **口語化**：使用現代人日常對話的語調和用詞
3. **流暢性**：語句自然通順，符合現代中文表達習慣
4. **易懂性**：避免過於文雅的詞彙，讓一般人都能理解

翻譯風格：
- 使用「你」、「我」、「我們」等現代人稱
- 適當使用「啊」、「呢」、「吧」等語氣詞
- 保持原文的語氣和情感色彩
- 如果原文是疑問句，保持疑問語氣
- 如果原文是感嘆句，保持感嘆語氣`
                        },
                        {
                            role: 'user',
                            content: `請翻譯以下佛法：

佛法：${text}
${oralExplanation ? `用戶的口語理解：${oralExplanation}` : ''}

請提供口語化、準確、流暢、易懂的現代翻譯。`
                        }
                    ],
                    max_tokens: 600,
                    temperature: 0.2
                })
            });

            if (!response.ok) {
                throw new Error(`API 錯誤: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error('Translation API error:', error);
            throw error;
        }
    }

    // 自動選擇最適合的 Gemini 模型
    async selectBestGeminiModel() {
        try {
            const models = await this.listGeminiModels();
            
            // 優先選擇配額較寬鬆且確實可用的模型
            const preferredModels = [
                'gemini-pro',           // 最穩定且配額較寬鬆
                'gemini-1.5-flash',     // 如果支援的話
                'gemini-1.5-pro',       // 如果支援的話
                'gemini-2.5-flash',     // 如果支援的話
                'gemini-2.5-pro-preview-03-25'  // 備用選項
            ];
            
            for (const preferredModel of preferredModels) {
                const model = models.find(m => m.name.includes(preferredModel));
                if (model && model.supportedGenerationMethods && model.supportedGenerationMethods.includes('generateContent')) {
                    const cleanModelName = model.name.replace('models/', '');
                    this.geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent`;
                    console.log(`已選擇模型: ${cleanModelName}`);
                    return cleanModelName;
                }
            }
            
            // 如果沒有找到偏好的模型，使用第一個支援的模型
            const supportedModel = models.find(m => 
                m.supportedGenerationMethods && 
                m.supportedGenerationMethods.includes('generateContent')
            );
            
            if (supportedModel) {
                const cleanModelName = supportedModel.name.replace('models/', '');
                this.geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent`;
                console.log(`已選擇模型: ${cleanModelName}`);
                return cleanModelName;
            }
            
            throw new Error('沒有找到支援 generateContent 的模型');
            
        } catch (error) {
            console.error('選擇模型時發生錯誤:', error);
            throw error;
        }
    }

    // 列出可用的 Gemini 模型
    async listGeminiModels() {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.getCurrentGeminiKey()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`List Models API 錯誤: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            return data.models || [];
        } catch (error) {
            console.error('List models error:', error);
            throw error;
        }
    }

    // 獲取當前使用的 Gemini API Key
    getCurrentGeminiKey() {
        return this.geminiKeys[this.currentGeminiKeyIndex];
    }

    // 切換到下一個 Gemini API Key
    switchToNextGeminiKey() {
        this.currentGeminiKeyIndex = (this.currentGeminiKeyIndex + 1) % this.geminiKeys.length;
        console.log(`切換到 Key ${this.currentGeminiKeyIndex + 1}/${this.geminiKeys.length}`);
    }

    // 測試所有 Gemini API Keys 的可用性
    async testAllGeminiKeys() {
        const results = [];
        
        for (let i = 0; i < this.geminiKeys.length; i++) {
            const originalIndex = this.currentGeminiKeyIndex;
            this.currentGeminiKeyIndex = i;
            
            try {
                const models = await this.listGeminiModels();
                results.push({
                    keyIndex: i,
                    key: this.geminiKeys[i].substring(0, 20) + '...',
                    status: '可用',
                    modelsCount: models.length
                });
            } catch (error) {
                results.push({
                    keyIndex: i,
                    key: this.geminiKeys[i].substring(0, 20) + '...',
                    status: '錯誤: ' + error.message,
                    modelsCount: 0
                });
            }
            
            this.currentGeminiKeyIndex = originalIndex;
        }
        
        return results;
    }

    // Gemini 翻譯方法
    async translateWithGemini(text, oralExplanation = '') {
        try {
            // 如果還沒有選擇模型，自動選擇最佳模型
            if (!this.geminiUrl || this.geminiUrl.includes('gemini-pro:generateContent')) {
                await this.selectBestGeminiModel();
            }
            
            const response = await fetch(`${this.geminiUrl}?key=${this.getCurrentGeminiKey()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `你是佛法翻譯專家，參考日常師父的口語化解釋，將古代的佛學用語或文言文翻譯成現代口語化白話文。

要求：
1. 準確：忠實原文意思
2. 口語化：使用現代日常用詞
3. 流暢：自然通順
4. 易懂：避免文雅詞彙

風格：
- 保持原文語氣和情感
- 不用分段落
- 只輸出整理後的白話文，不要重複附上師父解釋

輸出格式：
- 翻譯後的白話文(段落)
- 逐字/詞的翻譯
- 不要使用任何 Markdown 格式符號（如 **、*、# 等）

請翻譯以下佛法：

佛法：${text}
${oralExplanation ? `參考日常師父的口語化解釋：${oralExplanation}` : ''}

請提供口語化、準確、流暢、易懂的現代翻譯。`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 4000,
                        topP: 0.9,
                        topK: 50
                    },
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_HATE_SPEECH",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Gemini API Error:', errorData);
                
                // 處理配額錯誤
                if (response.status === 429) {
                    // 嘗試切換到下一個 Key
                    if (this.geminiKeys.length > 1) {
                        this.switchToNextGeminiKey();
                        throw new Error(`當前 Key 配額已用完，已自動切換到下一個 Key。請重試。`);
                    } else {
                        throw new Error(`配額已用完！\n\n免費配額限制：\n- 每日請求次數有限\n- 每分鐘請求次數有限\n- 每分鐘 token 數量有限\n\n建議：\n1. 等待明天重置配額\n2. 使用規則翻譯功能\n3. 考慮升級到付費方案`);
                    }
                }
                
                throw new Error(`Gemini API 錯誤: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            
            // 更寬鬆的回應解析邏輯
            if (data.candidates && data.candidates.length > 0) {
                const candidate = data.candidates[0];
                
                // 檢查不同的回應結構
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    return candidate.content.parts[0].text.trim();
                } else if (candidate.text) {
                    return candidate.text.trim();
                } else if (candidate.parts && candidate.parts.length > 0) {
                    return candidate.parts[0].text.trim();
                } else if (candidate.content && candidate.content.role === 'model') {
                    // 處理只有 role 沒有 parts 的情況
                    console.warn('Gemini API 回應只有 role 沒有 parts，可能是 token 限制或模型問題');
                    throw new Error('Gemini API 回應不完整：可能是 token 限制或模型問題，請嘗試縮短輸入文字或使用其他模型');
                } else {
                    console.error('Unexpected candidate structure:', candidate);
                    throw new Error('Gemini API 回應格式異常：無法解析候選回應');
                }
            } else {
                console.error('Unexpected Gemini response format:', data);
                throw new Error('Gemini API 回應格式異常：沒有候選回應');
            }
        } catch (error) {
            console.error('Gemini translation error:', error);
            throw error;
        }
    }

    // DeepSeek 翻譯方法
    async translateWithDeepSeek(text, oralExplanation = '') {
        try {
            const response = await fetch(this.deepseekUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.deepseekKey}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        {
                            role: 'system',
                            content: `你是佛法翻譯專家，將古代的佛學用語或文言文翻譯成現代口語化白話文。

翻譯要求：
1. **準確性**：忠實於原文意思，不添加或刪減內容
2. **口語化**：使用現代人日常對話的語調和用詞
3. **流暢性**：語句自然通順，符合現代中文表達習慣
4. **易懂性**：避免過於文雅的詞彙，讓一般人都能理解

翻譯風格：
- 使用「你」、「我」、「我們」等現代人稱
- 適當使用「啊」、「呢」、「吧」等語氣詞
- 保持原文的語氣和情感色彩
- 如果原文是疑問句，保持疑問語氣
- 如果原文是感嘆句，保持感嘆語氣`
                        },
                        {
                            role: 'user',
                            content: `請翻譯以下佛法：

佛法：${text}
${oralExplanation ? `用戶的口語理解：${oralExplanation}` : ''}

請提供口語化、準確、流暢、易懂的現代翻譯。`
                        }
                    ],
                    max_tokens: 600,
                    temperature: 0.2
                })
            });

            if (!response.ok) {
                throw new Error(`DeepSeek API 錯誤: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error('DeepSeek translation error:', error);
            throw error;
        }
    }

    // 免費 AI 翻譯方法
    async translateWithFreeAI(text, oralExplanation = '') {
        try {
            // 使用 Hugging Face 的免費 API
            const token = this.huggingfaceToken || 'hf_your_token_here';
            const response = await fetch(this.freeServices.huggingface, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    inputs: `請將以下古文翻譯成現代白話文：${text}${oralExplanation ? `\n用戶理解：${oralExplanation}` : ''}`,
                    parameters: {
                        max_length: 200,
                        temperature: 0.3
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`免費 API 錯誤: ${response.status}`);
            }

            const data = await response.json();
            return data[0]?.generated_text || '免費 AI 翻譯暫時不可用';
        } catch (error) {
            console.error('Free AI translation error:', error);
            throw error;
        }
    }

    // 備用翻譯方法 - 使用本地規則
    async translateWithRules(text, oralExplanation = '') {
        const rules = {
            // 常見古文詞彙對照
            '子曰': '孔子說',
            '不亦': '不是',
            '乎': '嗎',
            '之': '它/的',
            '而': '並且/而',
            '時習': '按時複習',
            '說': '愉快',
            '樂': '快樂',
            '慍': '生氣',
            '君子': '君子',
            '己所不欲': '自己不想要的',
            '勿施於人': '不要強加給別人',
            '有朋': '有朋友',
            '自遠方來': '從遠方來',
            '人不知': '別人不了解',
            '學而': '學習並且',
            '人': '別人',
            '知': '了解',
            '不': '不',
            '慍': '生氣',
            '亦': '也',
            '君子': '君子',
            '乎': '嗎',
            '己': '自己',
            '所': '所',
            '欲': '想要',
            '勿': '不要',
            '施': '強加',
            '於': '給',
            '人': '別人'
        };

        let result = text;
        
        // 應用規則替換
        for (const [ancient, modern] of Object.entries(rules)) {
            result = result.replace(new RegExp(ancient, 'g'), modern);
        }

        // 如果有口語解釋，嘗試結合
        if (oralExplanation) {
            result = `${result}\n\n💡 結合您的理解：${oralExplanation}`;
        }

        // 添加說明
        result += '\n\n📝 這是規則翻譯結果。如需更準確的 AI 翻譯，請設置 OpenAI API Key。';

        return result;
    }

    // 生成大綱與重點
    async generateOutlineAndKeyPoints(text, oralExplanation = '') {
        console.log('=== 開始生成大綱與重點 ===');
        console.log('輸入經文長度:', text.length);
        console.log('解釋長度:', oralExplanation.length);
        
        try {
            // 如果還沒有選擇模型，自動選擇最佳模型
            if (!this.geminiUrl || this.geminiUrl.includes('gemini-pro:generateContent')) {
                await this.selectBestGeminiModel();
            }
            
            const url = `${this.geminiUrl}?key=${this.getCurrentGeminiKey()}`;
            console.log('API URL:', url.replace(/key=[^&]+/, 'key=***'));
            
            const promptText = `你是佛法學習專家，請根據以下佛法經文和日常師父的解釋，整理出大綱與重點。

要求：
1. 提取核心概念和主要論點
2. 整理成清晰的層次結構
3. 標示重點內容
4. 簡潔明瞭，便於學習

輸出格式：
- 使用層次化的條列式結構
- 每個重點用簡短的句子說明
- 不要使用 Markdown 格式符號（如 **、*、# 等）

佛法經文：${text}
${oralExplanation ? `日常師父的解釋：${oralExplanation}` : ''}

請提供大綱與重點：`;
            
            const requestBody = {
                contents: [{
                    parts: [{ text: promptText }]
                }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 2000,
                    topP: 0.9,
                    topK: 50
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            };
            
            console.log('Prompt 長度:', promptText.length);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            console.log('Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Response error text:', errorText.substring(0, 500));
                throw new Error(`API 錯誤: ${response.status} - ${errorText.substring(0, 200)}`);
            }

            const data = await response.json();
            console.log('Response data structure:', {
                hasCandidates: !!data.candidates,
                candidatesLength: data.candidates?.length || 0,
                firstCandidate: data.candidates?.[0] ? {
                    hasContent: !!data.candidates[0].content,
                    hasParts: !!data.candidates[0].content?.parts,
                    partsLength: data.candidates[0].content?.parts?.length || 0,
                    hasText: !!data.candidates[0].text,
                    finishReason: data.candidates[0].finishReason,
                    role: data.candidates[0].content?.role
                } : null
            });
            
            // 使用與 translateWithGemini 相同的寬鬆解析邏輯
            if (data.candidates && data.candidates.length > 0) {
                const candidate = data.candidates[0];
                console.log('Candidate finishReason:', candidate.finishReason);
                
                // 檢查不同的回應結構
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    const result = candidate.content.parts[0].text.trim();
                    console.log('✅ 成功解析大綱與重點，長度:', result.length);
                    return result;
                } else if (candidate.text) {
                    const result = candidate.text.trim();
                    console.log('✅ 成功解析大綱與重點（text字段），長度:', result.length);
                    return result;
                } else if (candidate.parts && candidate.parts.length > 0) {
                    const result = candidate.parts[0].text.trim();
                    console.log('✅ 成功解析大綱與重點（parts字段），長度:', result.length);
                    return result;
                } else if (candidate.content && candidate.content.role === 'model') {
                    // 處理只有 role 沒有 parts 的情況
                    console.warn('⚠️ Gemini API 回應只有 role 沒有 parts');
                    console.warn('Finish reason:', candidate.finishReason);
                    throw new Error('Gemini API 回應不完整：可能是 token 限制或模型問題，請嘗試縮短輸入文字');
                } else {
                    console.error('❌ Unexpected candidate structure:', JSON.stringify(candidate, null, 2).substring(0, 1000));
                    throw new Error('Gemini API 回應格式異常：無法解析候選回應');
                }
            } else {
                console.error('❌ Unexpected Gemini response format:', JSON.stringify(data, null, 2).substring(0, 500));
                throw new Error('Gemini API 回應格式異常：沒有候選回應');
            }
        } catch (error) {
            console.error('Generate outline error:', error);
            throw error;
        }
    }

    // 生成學習題綱
    async generateStudyQuestions(text, oralExplanation = '') {
        console.log('=== 開始生成學習題綱 ===');
        console.log('輸入經文長度:', text.length);
        console.log('解釋長度:', oralExplanation.length);
        
        try {
            // 計算題目數量（根據經文長度，最少3題，最多10題）
            const textLength = text.length;
            let questionCount = 3;
            if (textLength > 200) questionCount = 5;
            if (textLength > 500) questionCount = 7;
            if (textLength > 1000) questionCount = 10;
            
            console.log('計算的題目數量:', questionCount);
            
            // 如果還沒有選擇模型，自動選擇最佳模型
            if (!this.geminiUrl || this.geminiUrl.includes('gemini-pro:generateContent')) {
                await this.selectBestGeminiModel();
            }
            
            const url = `${this.geminiUrl}?key=${this.getCurrentGeminiKey()}`;
            console.log('API URL:', url.replace(/key=[^&]+/, 'key=***'));
            
            const promptText = `你是佛法學習專家，請根據以下佛法經文和日常師父的解釋，設計 ${questionCount} 道學習題綱。

要求：
1. 題目要能幫助理解經文的核心內容
2. 包含理解性問題和思考性問題
3. 題目要具體明確，易於回答
4. 難度適中，適合學習者自我檢視

輸出格式：
- 每題編號清楚
- 直接列出問題，不需要答案
- 不要使用 Markdown 格式符號（如 **、*、# 等）

佛法經文：${text}
${oralExplanation ? `日常師父的解釋：${oralExplanation}` : ''}

請提供 ${questionCount} 道學習題綱：`;
            
            const requestBody = {
                contents: [{
                    parts: [{ text: promptText }]
                }],
                generationConfig: {
                    temperature: 0.5,
                    maxOutputTokens: 2000,
                    topP: 0.9,
                    topK: 50
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            };
            
            console.log('Prompt 長度:', promptText.length);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            console.log('Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Response error text:', errorText.substring(0, 500));
                throw new Error(`API 錯誤: ${response.status} - ${errorText.substring(0, 200)}`);
            }

            const data = await response.json();
            console.log('Response data structure:', {
                hasCandidates: !!data.candidates,
                candidatesLength: data.candidates?.length || 0,
                firstCandidate: data.candidates?.[0] ? {
                    hasContent: !!data.candidates[0].content,
                    hasParts: !!data.candidates[0].content?.parts,
                    partsLength: data.candidates[0].content?.parts?.length || 0,
                    hasText: !!data.candidates[0].text,
                    finishReason: data.candidates[0].finishReason,
                    role: data.candidates[0].content?.role
                } : null
            });
            
            // 使用與 translateWithGemini 相同的寬鬆解析邏輯
            if (data.candidates && data.candidates.length > 0) {
                const candidate = data.candidates[0];
                console.log('Candidate finishReason:', candidate.finishReason);
                
                // 檢查不同的回應結構
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    const result = candidate.content.parts[0].text.trim();
                    console.log('✅ 成功解析學習題綱，長度:', result.length);
                    return result;
                } else if (candidate.text) {
                    const result = candidate.text.trim();
                    console.log('✅ 成功解析學習題綱（text字段），長度:', result.length);
                    return result;
                } else if (candidate.parts && candidate.parts.length > 0) {
                    const result = candidate.parts[0].text.trim();
                    console.log('✅ 成功解析學習題綱（parts字段），長度:', result.length);
                    return result;
                } else if (candidate.content && candidate.content.role === 'model') {
                    // 處理只有 role 沒有 parts 的情況
                    console.warn('⚠️ Gemini API 回應只有 role 沒有 parts');
                    console.warn('Finish reason:', candidate.finishReason);
                    throw new Error('Gemini API 回應不完整：可能是 token 限制或模型問題，請嘗試縮短輸入文字');
                } else {
                    console.error('❌ Unexpected candidate structure:', JSON.stringify(candidate, null, 2).substring(0, 1000));
                    throw new Error('Gemini API 回應格式異常：無法解析候選回應');
                }
            } else {
                console.error('❌ Unexpected Gemini response format:', JSON.stringify(data, null, 2).substring(0, 500));
                throw new Error('Gemini API 回應格式異常：沒有候選回應');
            }
        } catch (error) {
            console.error('❌ Generate questions error:', error);
            throw error;
        }
    }
}

// 初始化翻譯器
const translator = new AncientTextTranslator();

// 更新翻譯函數
async function translateText() {
    const inputText = document.getElementById('inputText').value.trim();
    const oralExplanation = document.getElementById('oralExplanation').value.trim();
    
    if (!inputText) {
        alert('請輸入要翻譯的古文！');
        return;
    }

    const translateBtn = document.getElementById('translateBtn');
    const loading = document.getElementById('loading');
    const outputText = document.getElementById('outputText');

    translateBtn.disabled = true;
    loading.style.display = 'block';

    try {
        let translation;
        
        // 優先使用 Gemini API（免費且對中文支援好）
        if (translator.geminiKeys && translator.geminiKeys.length > 0) {
            translation = await translator.translateWithGemini(inputText, oralExplanation);
        } else if (translator.apiKey) {
            // 使用 OpenAI API
            translation = await translator.translate(inputText, oralExplanation);
        } else if (translator.deepseekKey) {
            // 使用 DeepSeek API
            translation = await translator.translateWithDeepSeek(inputText, oralExplanation);
        } else if (translator.huggingfaceToken) {
            // 使用 Hugging Face API
            translation = await translator.translateWithFreeAI(inputText, oralExplanation);
        } else {
            // 使用規則翻譯
            translation = await translator.translateWithRules(inputText, oralExplanation);
        }
        
        outputText.value = translation;
        
        // 翻譯完成後，分別獨立生成大綱與重點和學習題綱（使用 Gemini API 時才生成）
        // 兩個請求完全獨立，互不影響，失敗也不會中斷另一個
        if (translator.geminiKeys && translator.geminiKeys.length > 0) {
            const outlineText = document.getElementById('outlineText');
            const questionsText = document.getElementById('questionsText');
            const regenerateOutlineBtn = document.getElementById('regenerateOutlineBtn');
            const regenerateQuestionsBtn = document.getElementById('regenerateQuestionsBtn');
            
            // 第一個請求：生成大綱與重點（完全獨立執行）
            (async () => {
                try {
                    if (outlineText) {
                        outlineText.value = '正在生成大綱與重點...';
                    }
                    const outline = await translator.generateOutlineAndKeyPoints(inputText, oralExplanation);
                    if (outlineText) {
                        outlineText.value = outline;
                        if (regenerateOutlineBtn) {
                            regenerateOutlineBtn.style.display = 'flex';
                        }
                    }
                } catch (error) {
                    console.error('Generate outline error:', error);
                    if (outlineText) {
                        outlineText.value = '生成失敗：' + (error.message || '未知錯誤') + '\n\n提示：您可以點擊「重新生成」按鈕再次嘗試。';
                        if (regenerateOutlineBtn) {
                            regenerateOutlineBtn.style.display = 'flex';
                        }
                    }
                }
            })();
            
            // 第二個請求：生成學習題綱（完全獨立執行，與第一個請求並行）
            (async () => {
                try {
                    if (questionsText) {
                        questionsText.value = '正在生成學習題綱...';
                    }
                    const questions = await translator.generateStudyQuestions(inputText, oralExplanation);
                    if (questionsText) {
                        questionsText.value = questions;
                        if (regenerateQuestionsBtn) {
                            regenerateQuestionsBtn.style.display = 'flex';
                        }
                    }
                } catch (error) {
                    console.error('Generate questions error:', error);
                    if (questionsText) {
                        questionsText.value = '生成失敗：' + (error.message || '未知錯誤') + '\n\n提示：您可以點擊「重新生成」按鈕再次嘗試。';
                        if (regenerateQuestionsBtn) {
                            regenerateQuestionsBtn.style.display = 'flex';
                        }
                    }
                }
            })();
        }
    } catch (error) {
        // 如果所有方法都失敗，使用規則翻譯
        try {
            const fallbackTranslation = await translator.translateWithRules(inputText, oralExplanation);
            outputText.value = fallbackTranslation;
        } catch (fallbackError) {
            outputText.value = '翻譯失敗，請稍後再試。';
            console.error('Translation error:', fallbackError);
        }
    } finally {
        translateBtn.disabled = false;
        loading.style.display = 'none';
        if (loading.querySelector('p')) {
            loading.querySelector('p').textContent = 'AI 正在翻譯中，請稍候...';
        }
    }
}

// 重新生成大綱與重點
async function regenerateOutline() {
    const inputText = document.getElementById('inputText').value.trim();
    const oralExplanation = document.getElementById('oralExplanation').value.trim();
    const outlineText = document.getElementById('outlineText');
    const btn = document.getElementById('regenerateOutlineBtn');
    
    if (!inputText) {
        alert('請先輸入佛法經文！');
        return;
    }
    
    btn.disabled = true;
    outlineText.value = '正在重新生成...';
    
    try {
        const outline = await translator.generateOutlineAndKeyPoints(inputText, oralExplanation);
        outlineText.value = outline;
        if (typeof showNotification === 'function') {
            showNotification('✅ 大綱與重點已重新生成', 'success');
        }
    } catch (error) {
        outlineText.value = '生成失敗，請稍後再試。';
        if (typeof showNotification === 'function') {
            showNotification('❌ 生成失敗：' + (error.message || '未知錯誤'), 'error');
        }
        console.error('Regenerate outline error:', error);
    } finally {
        btn.disabled = false;
    }
}

// 重新生成學習題綱
async function regenerateQuestions() {
    const inputText = document.getElementById('inputText').value.trim();
    const oralExplanation = document.getElementById('oralExplanation').value.trim();
    const questionsText = document.getElementById('questionsText');
    const btn = document.getElementById('regenerateQuestionsBtn');
    
    if (!inputText) {
        alert('請先輸入佛法經文！');
        return;
    }
    
    btn.disabled = true;
    questionsText.value = '正在重新生成...';
    
    try {
        const questions = await translator.generateStudyQuestions(inputText, oralExplanation);
        questionsText.value = questions;
        if (typeof showNotification === 'function') {
            showNotification('✅ 學習題綱已重新生成', 'success');
        }
    } catch (error) {
        questionsText.value = '生成失敗，請稍後再試。';
        if (typeof showNotification === 'function') {
            showNotification('❌ 生成失敗：' + (error.message || '未知錯誤'), 'error');
        }
        console.error('Regenerate questions error:', error);
    } finally {
        btn.disabled = false;
    }
}


// 測試所有 Gemini API Keys
async function testAllKeys() {
    if (!translator.geminiKeys || translator.geminiKeys.length === 0) {
        alert('沒有設置任何 Gemini API Key！');
        return;
    }

    try {
        const results = await translator.testAllGeminiKeys();
        
        let resultText = 'Gemini API Keys 測試結果：\n\n';
        
        results.forEach((result, index) => {
            resultText += `Key ${index + 1}: ${result.key}\n`;
            resultText += `狀態: ${result.status}\n`;
            if (result.modelsCount > 0) {
                resultText += `可用模型數量: ${result.modelsCount}\n`;
            }
            resultText += '\n';
        });

        // 找出可用的 Keys
        const availableKeys = results.filter(r => r.status === '可用');
        if (availableKeys.length > 0) {
            resultText += `✅ 可用 Keys: ${availableKeys.length}/${results.length}\n`;
            resultText += `當前使用: Key ${translator.currentGeminiKeyIndex + 1}`;
        } else {
            resultText += '❌ 沒有可用的 Keys';
        }

        alert(resultText);
        
    } catch (error) {
        alert(`測試 Keys 時發生錯誤：${error.message}`);
        console.error('Test keys error:', error);
    }
}
