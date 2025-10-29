// AI 翻譯 API 整合
class AncientTextTranslator {
    constructor() {
        this.apiKey = null; // 實際使用時需要設置 API Key
        this.baseUrl = 'https://api.openai.com/v1/chat/completions';
        this.freeServices = {
            huggingface: 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
            cohere: 'https://api.cohere.ai/v1/generate', // 需要免費 API Key
            deepseek: 'https://api.deepseek.com/v1/chat/completions' // 需要免費 API Key
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
        
        // 優先使用 OpenAI API
        if (translator.apiKey) {
            translation = await translator.translate(inputText, oralExplanation);
        } else {
            // 嘗試免費 AI 服務
            try {
                translation = await translator.translateWithFreeAI(inputText, oralExplanation);
            } catch (freeError) {
                // 如果免費 AI 失敗，使用規則翻譯
                translation = await translator.translateWithRules(inputText, oralExplanation);
            }
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
        '1. OpenAI API Key（推薦，有免費額度）',
        '2. Hugging Face Token（免費）',
        '3. 使用規則翻譯（無需 API Key）'
    ].join('\n');
    
    const choice = prompt(`請選擇翻譯服務：\n\n${options}\n\n輸入 1、2 或 3：`);
    
    if (choice === '1') {
        const apiKey = prompt('請輸入您的 OpenAI API Key：');
        if (apiKey) {
            translator.apiKey = apiKey;
            alert('OpenAI API Key 設置成功！現在可以使用高品質 AI 翻譯。');
        }
    } else if (choice === '2') {
        const token = prompt('請輸入您的 Hugging Face Token：');
        if (token) {
            translator.huggingfaceToken = token;
            alert('Hugging Face Token 設置成功！現在可以使用免費 AI 翻譯。');
        }
    } else if (choice === '3') {
        alert('將使用規則翻譯，適合常見古文詞彙。');
    }
}

// 添加 API Key 設置按鈕
document.addEventListener('DOMContentLoaded', function() {
    const controls = document.querySelector('.controls');
    const apiKeyBtn = document.createElement('button');
    apiKeyBtn.className = 'btn btn-secondary';
    apiKeyBtn.innerHTML = '<i class="fas fa-key"></i> 設置 API Key';
    apiKeyBtn.onclick = setupAPIKey;
    controls.appendChild(apiKeyBtn);
});
