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
                            content: `請翻譯以下古文：

古文：${text}
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
                            text: `你是古文兼佛法的翻譯專家，將古代的佛學用語或文言文翻譯成現代口語化白話文。

要求：
1. 準確：忠實原文意思
2. 口語化：使用現代日常用詞
3. 流暢：自然通順
4. 易懂：避免文雅詞彙

風格：
- 保持原文語氣和情感
- 最後產生逐字/詞的翻譯
- 不用分段落
- 只輸出整理後的白話文，不要重複附上大師解釋

請翻譯以下古文：

古文：${text}
${oralExplanation ? `參考佛學大師的口語化解釋：${oralExplanation}` : ''}

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
                            content: `請翻譯以下古文：

古文：${text}
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
    }
}

// API Key 設置功能
function setupAPIKey() {
    const options = [
        '1. Google Gemini API Key（推薦，免費額度大）',
        '2. OpenAI API Key（有免費額度）',
        '3. DeepSeek API Key（免費額度）',
        '4. Hugging Face Token（免費）',
        '5. 使用規則翻譯（無需 API Key）'
    ].join('\n');
    
    const choice = prompt(`請選擇翻譯服務：\n\n${options}\n\n輸入 1、2、3、4 或 5：`);
    
    if (choice === '1') {
        setupGeminiKey();
    } else if (choice === '2') {
        setupOpenAIKey();
    } else if (choice === '3') {
        setupDeepSeekKey();
    } else if (choice === '4') {
        setupHuggingFaceToken();
    } else if (choice === '5') {
        alert('將使用規則翻譯，適合常見古文詞彙。');
    }
}

// Gemini API Key 設置
function setupGeminiKey() {
    const hasAccount = confirm('您是否已經有 Google 帳號？\n\n點擊「確定」：已有帳號，直接輸入 API Key\n點擊「取消」：沒有帳號，前往註冊');
    
    if (hasAccount) {
        // 提供快速導航選項
        const quickNav = confirm('需要快速導航到 Gemini API 頁面嗎？\n\n點擊「確定」：開啟 Gemini API 頁面\n點擊「取消」：直接輸入 API Key');
        
        if (quickNav) {
            window.open('https://aistudio.google.com/app/apikey', '_blank');
            alert('已開啟 Gemini API 頁面！\n\n請：\n1. 點擊 "Create API Key"\n2. 複製 API Key\n3. 回到這裡輸入 API Key');
        }
        
        const apiKey = prompt('請輸入您的 Gemini API Key：');
        if (apiKey) {
            translator.geminiKey = apiKey;
            alert('Gemini API Key 設置成功！現在可以使用免費的高品質 AI 翻譯。');
        }
    } else {
        // 開啟註冊頁面
        const registerWindow = window.open('https://accounts.google.com/signup', '_blank');
        alert('已開啟 Google 註冊頁面。\n\n註冊完成後，請：\n1. 前往 https://aistudio.google.com/app/apikey\n2. 點擊 "Create API Key"\n3. 複製 API Key\n4. 重新點擊「設置 API Key」按鈕');
    }
}

// OpenAI API Key 設置
function setupOpenAIKey() {
    const hasAccount = confirm('您是否已經有 OpenAI 帳號？\n\n點擊「確定」：已有帳號，直接輸入 API Key\n點擊「取消」：沒有帳號，前往註冊');
    
    if (hasAccount) {
        // 提供快速導航選項
        const quickNav = confirm('需要快速導航到 API Keys 頁面嗎？\n\n點擊「確定」：開啟 API Keys 頁面\n點擊「取消」：直接輸入 API Key');
        
        if (quickNav) {
            window.open('https://platform.openai.com/api-keys', '_blank');
            alert('已開啟 API Keys 頁面！\n\n請：\n1. 點擊 "Create new secret key"\n2. 複製 API Key（只顯示一次！）\n3. 回到這裡輸入 API Key');
        }
        
        const apiKey = prompt('請輸入您的 OpenAI API Key：');
        if (apiKey && apiKey.startsWith('sk-')) {
            translator.apiKey = apiKey;
            alert('OpenAI API Key 設置成功！現在可以使用高品質 AI 翻譯。');
        } else {
            alert('API Key 格式不正確，請確認是否以 "sk-" 開頭。');
        }
    } else {
        // 開啟註冊頁面
        const registerWindow = window.open('https://platform.openai.com/signup', '_blank');
        alert('已開啟 OpenAI 註冊頁面。\n\n註冊完成後，請：\n1. 前往 https://platform.openai.com/api-keys\n2. 點擊 "Create new secret key"\n3. 複製 API Key（只顯示一次！）\n4. 重新點擊「設置 API Key」按鈕');
    }
}

// Hugging Face Token 設置
function setupHuggingFaceToken() {
    const hasAccount = confirm('您是否已經有 Hugging Face 帳號？\n\n點擊「確定」：已有帳號，直接輸入 Token\n點擊「取消」：沒有帳號，前往註冊');
    
    if (hasAccount) {
        const token = prompt('請輸入您的 Hugging Face Token：');
        if (token && token.startsWith('hf_')) {
            translator.huggingfaceToken = token;
            alert('Hugging Face Token 設置成功！現在可以使用免費 AI 翻譯。');
        } else {
            alert('Token 格式不正確，請確認是否以 "hf_" 開頭。');
        }
    } else {
        // 開啟註冊頁面
        const registerWindow = window.open('https://huggingface.co/join', '_blank');
        alert('已開啟 Hugging Face 註冊頁面。\n\n註冊完成後，請：\n1. 前往 https://huggingface.co/settings/tokens\n2. 點擊 "New token"\n3. 複製 Token\n4. 重新點擊「設置 API Key」按鈕');
    }
}

// DeepSeek API Key 設置
function setupDeepSeekKey() {
    const hasAccount = confirm('您是否已經有 DeepSeek 帳號？\n\n點擊「確定」：已有帳號，直接輸入 API Key\n點擊「取消」：沒有帳號，前往註冊');
    
    if (hasAccount) {
        const apiKey = prompt('請輸入您的 DeepSeek API Key：');
        if (apiKey) {
            translator.deepseekKey = apiKey;
            alert('DeepSeek API Key 設置成功！現在可以使用免費 AI 翻譯。');
        }
    } else {
        // 開啟註冊頁面
        const registerWindow = window.open('https://platform.deepseek.com/signup', '_blank');
        alert('已開啟 DeepSeek 註冊頁面。\n\n註冊完成後，請：\n1. 前往 https://platform.deepseek.com/api_keys\n2. 創建新的 API Key\n3. 複製 API Key\n4. 重新點擊「設置 API Key」按鈕');
    }
}

// 添加 API Key 設置按鈕
document.addEventListener('DOMContentLoaded', function() {
    const controls = document.querySelector('.controls');
    
    // 設置 API Key 按鈕
    const apiKeyBtn = document.createElement('button');
    apiKeyBtn.className = 'btn btn-secondary';
    apiKeyBtn.innerHTML = '<i class="fas fa-key"></i> 設置 API Key';
    apiKeyBtn.onclick = setupAPIKey;
    controls.appendChild(apiKeyBtn);
    
    // 查看當前設置按鈕
    const statusBtn = document.createElement('button');
    statusBtn.className = 'btn btn-secondary';
    statusBtn.innerHTML = '<i class="fas fa-info-circle"></i> 查看設置';
    statusBtn.onclick = showCurrentSettings;
    controls.appendChild(statusBtn);
    
    // 列出可用模型按鈕
    const listModelsBtn = document.createElement('button');
    listModelsBtn.className = 'btn btn-secondary';
    listModelsBtn.innerHTML = '<i class="fas fa-list"></i> 列出模型';
    listModelsBtn.onclick = listAvailableModels;
    controls.appendChild(listModelsBtn);
});

// 顯示當前設置
function showCurrentSettings() {
    let status = '當前翻譯服務設置：\n\n';
    
    if (translator.geminiKey) {
        status += '✅ Google Gemini API Key：已預設設置\n';
        status += '   - 翻譯品質：最高\n';
        status += '   - 費用：免費額度大\n';
        status += '   - 中文支援：優秀\n';
        status += '   - 狀態：已啟用，無需額外設置\n\n';
    }
    
    if (translator.apiKey) {
        status += '✅ OpenAI API Key：已設置\n';
        status += '   - 翻譯品質：最高\n';
        status += '   - 費用：有免費額度\n\n';
    }
    
    if (translator.deepseekKey) {
        status += '✅ DeepSeek API Key：已設置\n';
        status += '   - 翻譯品質：高\n';
        status += '   - 費用：有免費額度\n\n';
    }
    
    if (translator.huggingfaceToken) {
        status += '✅ Hugging Face Token：已設置\n';
        status += '   - 翻譯品質：中等\n';
        status += '   - 費用：免費\n\n';
    }
    
    if (!translator.geminiKey && !translator.apiKey && !translator.deepseekKey && !translator.huggingfaceToken) {
        status += '❌ 未設置任何 AI 服務\n';
        status += '   - 當前使用：規則翻譯\n';
        status += '   - 翻譯品質：基礎\n';
        status += '   - 費用：免費\n\n';
    }
    
    status += '💡 提示：\n';
    status += '- 點擊「設置 API Key」可添加新的翻譯服務\n';
    status += '- 多個服務會按優先級自動選擇\n';
    status += '- Gemini > OpenAI > DeepSeek > Hugging Face > 規則翻譯';
    
    alert(status);
}

// 列出可用的 Gemini 模型
async function listAvailableModels() {
    if (!translator.geminiKey) {
        alert('請先設置 Gemini API Key！');
        return;
    }

    try {
        const models = await translator.listGeminiModels();
        
        if (models.length === 0) {
            alert('沒有找到可用的模型。');
            return;
        }

        let modelList = '可用的 Gemini 模型：\n\n';
        
        models.forEach((model, index) => {
            modelList += `${index + 1}. ${model.name}\n`;
            if (model.supportedGenerationMethods) {
                modelList += `   支援的方法：${model.supportedGenerationMethods.join(', ')}\n`;
            }
            if (model.description) {
                modelList += `   描述：${model.description}\n`;
            }
            modelList += '\n';
        });

        // 找出支援 generateContent 的模型
        const supportedModels = models.filter(model => 
            model.supportedGenerationMethods && 
            model.supportedGenerationMethods.includes('generateContent')
        );

        if (supportedModels.length > 0) {
            modelList += '\n支援 generateContent 的模型：\n';
            supportedModels.forEach((model, index) => {
                modelList += `${index + 1}. ${model.name}\n`;
            });
        }

        alert(modelList);
        
        // 如果有支援的模型，詢問是否要更新
        if (supportedModels.length > 0) {
            const updateModel = confirm('是否要使用第一個支援的模型？');
            if (updateModel) {
                const modelName = supportedModels[0].name;
                // 移除可能存在的 models/ 前綴，避免重複
                const cleanModelName = modelName.replace('models/', '');
                translator.geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent`;
                alert(`已更新為使用模型：${cleanModelName}`);
            }
        }
        
    } catch (error) {
        alert(`列出模型時發生錯誤：${error.message}`);
        console.error('List models error:', error);
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
