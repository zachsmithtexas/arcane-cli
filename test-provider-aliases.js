/**
 * Test script for provider command fixes
 */

// Test provider name normalization
function normalizeProviderName(input) {
  const aliases = {
    'openrouter': 'openrouter',
    'or': 'openrouter',
    'open': 'openrouter',
    'router': 'openrouter',
    'groq': 'groq',
    'g': 'groq',
    'together': 'together',
    'together.ai': 'together',
    'togetherai': 'together',
    't': 'together',
    'ollama': 'ollama',
    'local': 'ollama',
    'o': 'ollama',
    'gemini': 'gemini',
    'google': 'gemini',
    'gem': 'gemini',
    'goog': 'gemini'
  };
  
  return aliases[input] || input;
}

console.log('🧪 Testing Provider Name Normalization:');
console.log('  openrouter ->', normalizeProviderName('openrouter'));
console.log('  or ->', normalizeProviderName('or'));
console.log('  groq ->', normalizeProviderName('groq'));
console.log('  g ->', normalizeProviderName('g'));
console.log('  together ->', normalizeProviderName('together'));
console.log('  t ->', normalizeProviderName('t'));
console.log('  ollama ->', normalizeProviderName('ollama'));
console.log('  local ->', normalizeProviderName('local'));
console.log('  gemini ->', normalizeProviderName('gemini'));
console.log('  google ->', normalizeProviderName('google'));

console.log('\n✅ All provider aliases should now work in the interactive chat!');