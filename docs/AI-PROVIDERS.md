# CF Bossnusilelo — AI Provider Setup

The chat API supports automatic fallback across multiple providers. **Auto only uses providers whose server-side API key is configured.** Never put API keys in frontend code.

## Providers

| ID | Environment key | Default model | Notes |
|---|---|---|---|
| SiliconFlow | `SILICONFLOW_API_KEY` | `deepseek-ai/DeepSeek-V3` | OpenAI-compatible gateway |
| Qwen / Alibaba DashScope | `DASHSCOPE_API_KEY` | `qwen3.6-flash` | OpenAI-compatible endpoint |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek-v4-flash` | Official OpenAI-compatible API |
| Z.ai / GLM | `ZHIPU_API_KEY` | `glm-4-flash-250414` | GLM has free API models; availability can change |
| Moonshot / Kimi | `MOONSHOT_API_KEY` | `moonshot-v1-8k` | OpenAI-compatible endpoint |
| MiniMax | `MINIMAX_API_KEY` | `MiniMax-M2.7` | OpenAI-compatible endpoint |
| Doubao / Volcengine Ark | `DOUBAO_API_KEY` | must be set | Set the Ark endpoint/model ID in Vercel |
| Tencent Hunyuan | `HUNYUAN_API_KEY` | `hunyuan-lite` | OpenAI-compatible endpoint; free availability varies |
| Baichuan | `BAICHUAN_API_KEY` | `Baichuan4-Air` | OpenAI-compatible endpoint; account/model availability varies |
| iFlytek Spark | `SPARK_API_KEY` | `4.0Ultra` | OpenAI-compatible endpoint; account/model availability varies |
| Baidu ERNIE / Qianfan | `ERNIE_API_KEY` | `ernie-4.5-turbo-128k` | Qianfan endpoint; account/model availability varies |
| OpenRouter | `OPENROUTER_API_KEY` | set in `OPENROUTER_MODEL` | Global aggregator |
| Groq | `GROQ_API_KEY` | `openai/gpt-oss-20b` | Global fast fallback |

Optional variables follow the same pattern: `PROVIDER_MODEL` and `PROVIDER_BASE` where supported by the code.

## Auto routing

Current order:

`SiliconFlow → Qwen → DeepSeek → Z.ai → Moonshot → MiniMax → Doubao → Hunyuan → Baichuan → Spark → ERNIE → OpenRouter → Groq`

Providers without keys are skipped automatically. A provider that returns an HTTP error is also skipped so the next configured provider can answer.

## Free-tier warning

"Free" is not permanent or universal. Some providers offer free models, trial credits, or new-user quotas; limits, models, region availability, and eligibility can change. The UI therefore reports **configured / not configured**, rather than falsely claiming that every provider is permanently free.

For example, Z.ai currently documents GLM-4-Flash-250414 as a free API model, while Alibaba Cloud documents OpenAI-compatible Qwen endpoints and current model names. Verify the provider's own console before relying on a quota.
