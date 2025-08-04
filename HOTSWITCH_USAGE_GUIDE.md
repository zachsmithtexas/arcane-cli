# 🚀 Arcane CLI Hotswitch & Usage Tracking Guide

## 🔥 **Interactive Chat Commands**

### **Model Switching**
```bash
/model                    # List all available models
/model list              # Same as above
/m                       # Short alias
/model deepseek/deepseek-r1:free  # Switch to specific model
/m llama-3.3-70b-versatile       # Quick switch with alias
```

### **Provider Switching**
```bash
/provider                 # List all providers
/provider list           # Same as above  
/p                       # Short alias
/provider groq           # Switch to Groq (uses default model)
/p openrouter           # Quick switch with alias
/provider status        # Detailed provider health & stats
```

### **Usage Tracking**
```bash
/usage                   # Show detailed usage statistics
/stats                   # Alias for usage
/track                   # Another alias
/usage reset            # Clear all usage statistics
```

## 🔑 **Multiple API Key Support**

### **Method 1: Environment Variables (Recommended)**
Set multiple API keys separated by commas:

```bash
# Multiple Gemini keys for high free tier usage
export GEMINI_API_KEY="key1,key2,key3,key4,key5"

# Multiple OpenRouter keys
export OPENROUTER_API_KEY="sk-or-v1-key1,sk-or-v1-key2"

# Multiple Groq keys  
export GROQ_API_KEY="gsk_key1,gsk_key2,gsk_key3"

# Multiple Together.ai keys
export TOGETHER_API_KEY="together_key1,together_key2"
```

### **Method 2: providers.json Configuration**
Edit `providers.json` to add multiple keys:

```json
{
  "providers": [
    {
      "id": "gemini",
      "name": "Google Gemini",
      "enabled": true,
      "apiKeys": [
        "your-gemini-key-1",
        "your-gemini-key-2",
        "your-gemini-key-3",
        "your-gemini-key-4",
        "your-gemini-key-5"
      ]
    },
    {
      "id": "openrouter",
      "apiKeys": [
        "sk-or-v1-key1",
        "sk-or-v1-key2"
      ]
    }
  ]
}
```

## ⚙️ **API Key Rotation Features**

### **Automatic Rotation**
- ✅ **Same-Provider Rotation**: Automatically rotates through multiple keys for the same provider
- ✅ **Cross-Provider Fallback**: Falls back to other providers when all keys are rate-limited
- ✅ **Rate Limit Detection**: Automatically detects 429 errors and switches keys
- ✅ **Environment Variable Priority**: Environment variables override config file keys

### **Rotation Logic**
1. **Primary**: Use current key for selected provider
2. **Same-Provider**: Try other keys for same provider if rate limited
3. **Cross-Provider**: Fall back to other providers if all keys fail
4. **Statistics**: Track usage per key and provider

## 📊 **Usage Tracking Features**

### **Real-Time Statistics**
- **Per-Provider**: Requests, success rate, failures, rate limits
- **Per-API-Key**: Individual key performance tracking
- **Response Times**: Average response time tracking
- **Success Rates**: Percentage success rates per provider
- **Rate Limit Monitoring**: Track when keys hit limits

### **Example Usage Output**
```
📊 Provider Usage Statistics

Overall Summary:
   Total Requests: 45
   Success Rate: 89.2%
   Rate Limits: 3

Provider Breakdown:
💎 Google Gemini:
   Requests: 25 (92.0% success)
   Failures: 2 | Rate Limits: 1
   Avg Response: 1200ms
   API Keys:
     AIzaSyC*...abc123: 15 requests (93.3% success)
     AIzaSyD*...def456: 10 requests (90.0% success)

🌐 OpenRouter:
   Requests: 20 (85.0% success)
   Failures: 3 | Rate Limits: 2
   Avg Response: 800ms
```

## 🎯 **Usage Examples**

### **Maximizing Gemini Free Tier**
```bash
# Set up 5 Gemini API keys for maximum free usage
export GEMINI_API_KEY="key1,key2,key3,key4,key5"

# Start interactive chat
./arcane

# Switch to Gemini model
/model gemini-1.5-flash-latest

# Monitor usage
/usage

# When keys hit limits, system automatically rotates
```

### **Quick Provider/Model Switching**
```bash
# In interactive chat:
/m deepseek/deepseek-r1:free    # Switch to OpenRouter model
/p groq                         # Switch to Groq provider
/m llama-3.3-70b-versatile     # Switch to specific Groq model
/provider status                # Check all provider health
/usage                         # Monitor usage statistics
```

### **Fallback Priority Adjustment**
Edit `providers.json` fallbackOrder:
```json
{
  "fallbackOrder": [
    "gemini",        # Try Gemini first (with multiple keys)
    "groq",          # Then Groq
    "openrouter",    # Then OpenRouter
    "together",      # Then Together.ai
    "ollama"         # Finally local Ollama
  ]
}
```

## 🔧 **Advanced Features**

### **Manual Key Rotation**
```javascript
// Programmatically rotate keys (for advanced users)
enhancedProviderRouter.rotateApiKey('gemini');
```

### **Reset Statistics**
```bash
/usage reset    # Clear all usage statistics
```

### **Provider Health Monitoring**
```bash
/provider status    # Check which providers are healthy
```

## 💡 **Pro Tips**

1. **Environment Variables First**: Always use environment variables for API keys - they take precedence over config files
2. **Multiple Gemini Keys**: Set up 5+ Gemini keys to maximize free tier usage
3. **Monitor Usage**: Use `/usage` regularly to track which providers are working best
4. **Quick Switching**: Use short aliases (`/m`, `/p`) for faster model switching
5. **Provider Status**: Use `/provider status` to check API key health before important tasks

This system provides intelligent, resilient AI model access with automatic failover and detailed usage tracking! 🎯
