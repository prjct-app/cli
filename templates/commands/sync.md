---
allowed-tools: [Bash, AskUserQuestion]
---

# p. sync $ARGUMENTS

## Step 1: Run CLI sync
```bash
prjct sync $ARGUMENTS --md
```
If CLI output is JSON with `options`, present them to the user with AskUserQuestion and execute the chosen command.

Follow the instructions in the CLI output.

## Step 2: LLM Analysis (hybrid pipeline)
After CLI sync completes successfully, run the analysis payload builder:
```bash
prjct analysis-payload --md
```

If the output says "Analysis is current", skip to Step 3.

Otherwise, the output contains a JSON payload with project data. Analyze it thoroughly and produce a structured `LLMAnalysis` JSON object with these fields:

```json
{
  "version": 1,
  "commitHash": "from payload git data",
  "analyzedAt": "ISO timestamp",
  "architecture": {
    "style": "monolith|monorepo|microservices|modular-monolith",
    "insights": ["key architectural observations"],
    "domains": ["identified modules/domains"]
  },
  "patterns": [{"name": "", "description": "", "locations": [], "confidence": 0.0, "category": ""}],
  "antiPatterns": [{"issue": "", "reasoning": "", "files": [], "suggestion": "", "severity": "low|medium|high", "confidence": 0.0}],
  "techDebt": [{"description": "", "area": "", "effort": "small|medium|large", "impact": "", "priority": "low|medium|high"}],
  "riskAreas": [{"path": "", "reason": "", "risk": "", "severity": "low|medium|high"}],
  "refactorSuggestions": [{"description": "", "files": [], "benefit": "", "effort": "small|medium|large"}],
  "projectInsights": ["key insights about the project"],
  "conventions": [{"category": "naming|file-structure|imports|error-handling", "rule": "", "example": ""}]
}
```

Save the analysis:
```bash
prjct analysis-save-llm '<your JSON here>' --md
```

## Step 3: Present results
After running sync, present the output clearly:
- Use the tables and sections as-is from CLI markdown
- If LLM analysis was performed, summarize key findings:
  - Architecture style and top insights
  - Critical anti-patterns (high severity)
  - Top tech debt items
  - Key conventions discovered
- Add a brief interpretation of what changed and why
