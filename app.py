from flask import Flask, request, Response, jsonify
import requests
import json
import time
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # 启用跨域支持

# AI API密钥
AI_API_KEY = 'sk-pxmeadiyndbhhtvzvblpgnmyalwvhvvkikllrfjmkqzwtnvo'

@app.route('/api/generate', methods=['POST'])
def generate_content():
    data = request.json
    title = data.get('title', '')
    
    if not title:
        return jsonify({"error": "标题不能为空"}), 400
    
    def generate():
        # 发送请求到AI API
        try:
            headers = {
                'Authorization': f'Bearer {AI_API_KEY}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                "model": "Qwen/QwQ-32B",
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一位热搜解读专家，请根据热搜标题生成一段生动有趣的解读，包含表情符号，语气活泼，像社交媒体博主的风格。内容要有深度但不要太长。"
                    },
                    {
                        "role": "user",
                        "content": f"请解读这条热搜：{title}"
                    }
                ],
                "stream": True,
                "max_tokens": 512,
                "temperature": 0.7,
                "top_p": 0.7,
                "response_format": {
                    "type": "text"
                }
            }
            
            # 使用流式请求
            with requests.post('https://api.siliconflow.cn/v1/chat/completions', 
                              headers=headers, 
                              json=payload, 
                              stream=True) as response:
                
                if response.status_code != 200:
                    yield f"data: {json.dumps({'error': f'API错误: {response.status_code}'})}\n\n"
                    return
                
                # 处理流式响应
                for line in response.iter_lines():
                    if line:
                        line = line.decode('utf-8')
                        if line.startswith('data: '):
                            if line == 'data: [DONE]':
                                yield f"data: {json.dumps({'done': True})}\n\n"
                                continue
                                
                            try:
                                data = json.loads(line[6:])  # 去掉 'data: ' 前缀
                                if data.get('choices') and data['choices'][0].get('delta') and data['choices'][0]['delta'].get('content'):
                                    content = data['choices'][0]['delta']['content']
                                    yield f"data: {json.dumps({'content': content})}\n\n"
                            except json.JSONDecodeError:
                                continue
        
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return Response(generate(), mimetype='text/event-stream')

@app.route('/api/hot-news', methods=['GET'])
def get_hot_news():
    platform = request.args.get('platform', 'weibo')
    api_key = 'eb50731204ecb974aa2fcc8f22478f42'  # 天行API密钥
    
    # 根据平台选择不同的API接口
    api_endpoints = {
        'weibo': 'weibohot',
        'toutiao': 'toutiaohot',
        'baidu': 'nethot'
    }
    
    endpoint = api_endpoints.get(platform, 'weibohot')
    api_url = f'https://apis.tianapi.com/{endpoint}/index?key={api_key}'
    
    try:
        response = requests.get(api_url)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"code": 500, "msg": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000) 