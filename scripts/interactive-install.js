#!/usr/bin/env node

/**
 * Interactive Editor Selection for prjct-cli
 *
 * Provides interactive UI for selecting which AI editors to install commands to.
 * Uses prompts for checkbox selection with visual feedback.
 *
 * @version 0.3.1
 */

const prompts = require('prompts');

// Load command installer
const installer = require('../core/command-installer');

async function main() {
  try {
    console.log('');
    console.log('🔍 Detecting AI editors...');
    console.log('');

    // Detect all available editors
    const detected = await installer.detectEditors();

    // Create choices for prompts (different format than inquirer)
    const choices = Object.entries(installer.editors).map(([key, editor]) => {
      const info = detected[key];
      const isDetected = info && info.detected;

      return {
        title: isDetected
          ? `${editor.name} (${info.path})`
          : `${editor.name} (not found)`,
        value: key,
        selected: isDetected, // Pre-select detected editors
        disabled: !isDetected
      };
    });

    // Check if any editors were detected
    const detectedCount = choices.filter(c => !c.disabled).length;

    if (detectedCount === 0) {
      console.log('❌ No AI editors detected on this system.');
      console.log('');
      console.log('Supported editors:');
      console.log('  • Claude Code (~/.claude)');
      console.log('  • Cursor AI (~/.cursor)');
      console.log('  • Windsurf/Codeium (~/.windsurf)');
      console.log('  • OpenAI Codex (~/.codex)');
      console.log('');
      console.log('Please install at least one AI editor and try again.');
      process.exit(1);
    }

    // Show interactive selection
    const response = await prompts({
      type: 'multiselect',
      name: 'selectedEditors',
      message: 'Select AI editors to install commands to:',
      choices: choices,
      min: 1,
      hint: '- Space to select. Return to submit',
      instructions: false
    });

    // Check if user cancelled or selected nothing
    if (!response.selectedEditors || response.selectedEditors.length === 0) {
      console.log('');
      console.log('Installation cancelled.');
      process.exit(0);
    }

    console.log('');
    console.log('📦 Installing commands to selected editors...');
    console.log('');

    // Install to selected editors
    const result = await installer.installToSelected(response.selectedEditors, false);

    // Output result as JSON for bash script to parse
    console.log('__RESULT_START__');
    console.log(JSON.stringify(result, null, 2));
    console.log('__RESULT_END__');

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error('');
    console.error('❌ Installation failed:', error.message);
    console.error('');

    // Output error result
    const errorResult = {
      success: false,
      message: error.message,
      editors: [],
      results: {}
    };

    console.log('__RESULT_START__');
    console.log(JSON.stringify(errorResult, null, 2));
    console.log('__RESULT_END__');

    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = main;
