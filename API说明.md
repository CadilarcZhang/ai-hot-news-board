▼
热搜榜单API： 接口信息
查询抖音App热门搜索榜单列表

接口地址：https://apis.tianapi.com/douyinhot/index 
请求示例：https://apis.tianapi.com/douyinhot/index?key=eb50731204ecb974aa2fcc8f22478f42
支持协议：http/https
请求方式：get/post
返回格式：utf-8 json
▼ 请求参数
post方式请求时，enctype应为application/x-www-form-urlencoded

上传文件二进制数据流方式，enctype必须为multipart/form-data

参数url、base64中有特殊字符时，建议对值urlencode编码后传递

名称	类型	必须	示例值/默认值	说明
key	string	是	您自己的APIKEY（注册账号后获得）	API密钥
▼ 返回示例
接口数据样例仅作为预览参考，请以实际测试结果为准

旧域名返回的json结构和现在略有不同，请点击此处查看说明

	
	
成功调用，返回内容并产生计费：


	{
  "code": 200,
  "msg": "success",
  "result": {
    "list": [
      {
        "hotindex": 9023742,
        "label": 1,
        "word": "赵丽颖张慧雯斗舞"
      },
      {
        "hotindex": 7956448,
        "label": 3,
        "word": "小S得知高以翔去世大哭"
      },
      {
        "hotindex": 7658224,
        "label": 0,
        "word": "吴世勋8秒视频"
      },
      {
        "hotindex": 7449241,
        "label": 3,
        "word": "药监局回应幼儿园厨师事件"
      },
      {
        "hotindex": 7270640,
        "label": 0,
        "word": "夏之光模仿李佳琦"
      }
    ]
  }
}

	
	
	
失败调用，查看接口错误码释义：


	{
  "code": 150,
  "msg": "API可用次数不足"
}

	
    
▼ 返回参数
公共参数指所有接口都会返回的参数，应用参数每个接口都不同

名称	类型	示例值	说明
公共参数
code	int	200	状态码
msg	string	success	错误信息
result	object	{}	返回结果集
应用参数
hotindex	int	9023742	热搜榜指数
label	int	1	标签类型，1新，2荐，3热
word	string	赵丽颖张慧雯斗舞	热点话题
▼ 接口价格
用户等级	免费接口数	每日可用次数	会员价格	说明
普通会员	10个	100次	免费	每个免费接口100次/天
高级会员	不限	1万次	20元/月、120元/年(限时)	每个免费接口1W次/天
黄金会员	不限	50万次	65元/月、390元/年(限时)	每个免费接口50W次/天
本接口为会员免费类接口，如业务有更高需求可点此升级会员获得更高每日请求配额（年付限时优惠）
▼ 返回状态码
错误信息可能会有所调整，请根据错误状态码(code)进行流程判断

错误状态码	错误信息	解释帮助
100	内部服务器错误	报此错误码请及时反馈或等待官方修复
110	当前API已下线	接口已下线无法使用，可关注相关通知
120	API暂时维护中	接口暂时关闭维护中，请注意相关公告
130	API调用频率超限	超过每秒请求数上限，可在控制台-接口管理中查询
140	API没有调用权限	请检查是否自行在接口管理中停用或被禁用了该接口
150	API可用次数不足	免费类接口套餐超限或计次类接口余额不足，点此查看说明
160	账号未申请该API	请先在接口文档页面申请该接口，点此查看说明
170	Referer请求来源受限	设置了Referer白名单，但来源Referer不在白名单内
180	IP请求来源受限	设置了IP白名单，但来源IP不在白名单内
190	当前key不可用	通常为账号无效，此状态无法恢复
230	key错误或为空	请检查apikey是否填写错误，点此查看帮助
240	缺少key参数	请检查是否传递了key参数或者编码格式是否符合要求
250	数据返回为空	数据查询或转换失败，请检查输入值或注意中文编码问题
260	参数值不得为空	请检查关键参数是否传递了空值
270	参数值不符合要求	参数值不符合基本格式要求，点此查看说明
280	缺少必要的参数	缺少必填的参数，请根据接口文档检查
290	超过最大输入限制	参数值超过输入范围，请查看接口文档的说明
错误码1开头的是系统级错误，2开头的是用户级错误，其中200表示请求成功处理并计费。
▼ 参考代码
此处代码仅演示关键请求片段，实际使用请根据具体环境修改

如需深入学习参考，可点击此处查看部分第三方完整开源项目

大模型对话生成API：
curl --request POST \
  --url https://api.siliconflow.cn/v1/chat/completions \
  --header 'Authorization: Bearer sk-pxmeadiyndbhhtvzvblpgnmyalwvhvvkikllrfjmkqzwtnvo' \
  --header 'Content-Type: application/json' \
  --data '{
  "model": "Qwen/QwQ-32B",
  "messages": [
    {
      "role": "user",
      "content": "What opportunities and challenges will the Chinese large model industry face in 2025?"
    }
  ],
  "stream": false,
  "max_tokens": 512,
  "stop": null,
  "temperature": 0.7,
  "top_p": 0.7,
  "top_k": 50,
  "frequency_penalty": 0.5,
  "n": 1,
  "response_format": {
    "type": "text"
  },
  "tools": [
    {
      "type": "function",
      "function": {
        "description": "<string>",
        "name": "<string>",
        "parameters": {},
        "strict": false
      }
    }
  ]
}'
