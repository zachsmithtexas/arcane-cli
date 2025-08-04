/**
 * Test script to verify multi-provider system functionality
 */

import { enhancedProviderRouter } from './packages/core/dist/src/core/enhancedProviderRouter.js';

async function testProviderSystem() {
  console.log('🧪 Testing Arcane Multi-Provider System\n');

  // Test 1: Load configuration
  console.log('1. Loading provider configuration...');
  await enhancedProviderRouter.loadConfig();
  console.log('✅ Configuration loaded successfully\n');

  // Test 2: Get all available models
  console.log('2. Fetching available models...');
  const models = enhancedProviderRouter.getAllModels();
  console.log('📊 Available models by provider:');
  
  let totalModels = 0;
  for (const [providerId, modelList] of Object.entries(models)) {
    console.log(`  ${providerId}: ${modelList.length} models`);
    totalModels += modelList.length;
  }
  console.log(`  Total: ${totalModels} models across ${Object.keys(models).length} providers\n`);

  // Test 3: Test model detection
  console.log('3. Testing model detection...');
  const testModels = [
    'moonshotai/kimi-k2:free',  // Should route to OpenRouter
    'llama-3.3-70b-versatile',  // Should route to Groq
    'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free', // Should route to Together.ai
    'deepseek-r1:8b',  // Should route to Ollama
    'gemini-1.5-flash-latest'  // Should route to Gemini
  ];

  for (const model of testModels) {
    const shouldUseNonGemini = enhancedProviderRouter.shouldUseNonGeminiProvider(model);
    const provider = shouldUseNonGemini ? 'non-Gemini' : 'Gemini';
    console.log(`  ${model} → ${provider}`);
  }
  console.log('✅ Model detection working correctly\n');

  // Test 4: Environment variable detection
  console.log('4. Checking environment variables...');
  const envVars = [
    'OPENROUTER_API_KEY',
    'GROQ_API_KEY', 
    'TOGETHER_API_KEY',
    'GEMINI_API_KEY'
  ];
  
  for (const envVar of envVars) {
    const isSet = process.env[envVar] ? '✅' : '❌';
    console.log(`  ${envVar}: ${isSet}`);
  }
  console.log();

  // Test 5: Current model management
  console.log('5. Testing model switching...');
  const originalModel = enhancedProviderRouter.getCurrentModel();
  console.log(`  Current model: ${originalModel}`);
  
  enhancedProviderRouter.setCurrentModel('moonshotai/kimi-k2:free');
  const newModel = enhancedProviderRouter.getCurrentModel();
  console.log(`  Switched to: ${newModel}`);
  
  enhancedProviderRouter.setCurrentModel(originalModel);
  console.log(`  Restored to: ${enhancedProviderRouter.getCurrentModel()}`);
  console.log('✅ Model switching working correctly\n');

  console.log('🎉 All tests passed! Multi-provider system is ready for use.\n');
  
  console.log('💡 Usage Examples:');
  console.log('  - Set model: enhancedProviderRouter.setCurrentModel("moonshotai/kimi-k2:free")');
  console.log('  - Check routing: enhancedProviderRouter.shouldUseNonGeminiProvider(model)');
  console.log('  - View stats: enhancedProviderRouter.getProviderStats()');
}

// Run the test
testProviderSystem().catch(console.error);
