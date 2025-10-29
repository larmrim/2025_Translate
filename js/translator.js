// AI 翻譯 API 整合
class AncientTextTranslator {
    constructor() {
        this.apiKey = null; // 實際使用時需要設置 API Key
        this.baseUrl = 'https://api.openai.com/v1/chat/completions';
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
            '學而': '學習並且'
        };

        let result = text;
        for (const [ancient, modern] of Object.entries(rules)) {
            result = result.replace(new RegExp(ancient, 'g'), modern);
        }

        // 如果有口語解釋，嘗試結合
        if (oralExplanation) {
            result = `${result}\n\n（結合您的理解：${oralExplanation}）`;
        }

        return result + '（規則翻譯結果）';
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
        
        // 嘗試使用 AI API
        if (translator.apiKey) {
            translation = await translator.translate(inputText, oralExplanation);
        } else {
            // 使用規則翻譯作為備用
            translation = await translator.translateWithRules(inputText, oralExplanation);
        }
        
        outputText.value = translation;
    } catch (error) {
        // 如果 AI API 失敗，使用規則翻譯
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
    const apiKey = prompt('請輸入您的 OpenAI API Key（留空則使用規則翻譯）：');
    if (apiKey) {
        translator.apiKey = apiKey;
        alert('API Key 設置成功！現在可以使用 AI 翻譯功能。');
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
