const { parseIntentText, renderHTML } = require('./packages/core/dist');
const fs = require('fs');

console.log('🚀 IntentText v1.0 Demo');
console.log('========================\n');

// Example 1: Parse a simple .it file directly
console.log('📝 Example 1: Simple IntentText');
const simpleText = `title: *My Project* Plan
summary: This is a _sample_ document.

section: Tasks
task: Complete documentation | owner: John | due: Friday
done: Setup repository | time: Monday

note: Remember to review the code.`;

const simpleDoc = parseIntentText(simpleText);
console.log('📊 Parsed JSON:');
console.log(JSON.stringify(simpleDoc, null, 2));

console.log('\n🎨 Rendered HTML:');
console.log(renderHTML(simpleDoc));

console.log('\n' + '='.repeat(50) + '\n');

// Example 2: Parse from file
console.log('📁 Example 2: Parse from .it file');
try {
  const fileContent = fs.readFileSync('./examples/sample.it', 'utf-8');
  const fileDoc = parseIntentText(fileContent);
  
  console.log(`📋 Document: ${fileDoc.metadata?.title}`);
  console.log(`📄 Blocks: ${fileDoc.blocks.length}`);
  console.log(`🌐 Language: ${fileDoc.metadata?.language}`);
  
  // Show first few blocks
  console.log('\n🔍 First 3 blocks:');
  fileDoc.blocks.slice(0, 3).forEach((block, i) => {
    console.log(`${i + 1}. ${block.type}: ${block.content}`);
  });
  
  // Save HTML to file
  const html = renderHTML(fileDoc);
  fs.writeFileSync('./sample-output.html', html);
  console.log('\n💾 HTML saved to: sample-output.html');
  console.log('🌐 Open this file in your browser to see the rendered result!');
  
} catch (error) {
  console.log('❌ Error reading file:', error.message);
}

console.log('\n✨ Demo complete!');
