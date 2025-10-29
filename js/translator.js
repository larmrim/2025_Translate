// AI 翻譯 API 整合
class AncientTextTranslator {
    constructor() {
        this.apiKey = null; // 實際使用時需要設置 API Key
        this.baseUrl = 'https://api.openai.com/v1/chat/completions';
    }

    async translate(text) {
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
                            content: '你是一個專業的古文翻譯專家。請將輸入的古文翻譯成現代白話文，要求準確、流暢、易懂。'
                        },
                        {
                            role: 'user',
                            content: `請翻譯以下古文：${text}`
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.3
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
    async translateWithRules(text) {
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

        return result + '（規則翻譯結果）';
    }
}

// 初始化翻譯器
const translator = new AncientTextTranslator();

// 更新翻譯函數
async function translateText() {
    const inputText = document.getElementById('inputText').value.trim();
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
            translation = await translator.translate(inputText);
        } else {
            // 使用規則翻譯作為備用
            translation = await translator.translateWithRules(inputText);
        }
        
        outputText.value = translation;
    } catch (error) {
        // 如果 AI API 失敗，使用規則翻譯
        try {
            const fallbackTranslation = await translator.translateWithRules(inputText);
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
