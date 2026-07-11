# Prompt Refinement and Learning Workflow

## Objective
Capture prompt refinement history and maintain a persistent, centralized "Prompt Learnings Log" to enable continuous self-improvement across agent sessions and prevent future prompt failures.

## Problem Context
When prompting an agent, the user often refines their requirements over multiple turns (e.g., "I don't like this color", "Use library X instead of Y"). If this feedback is only processed in the current chat session, the agent will forget these constraints in future sessions. Documenting prompt iterations and extracting rules closes this learning gap.

## Prerequisites
- `prompt_learnings.md` (root directory)
- `prompt_history/TEMPLATE.md` (template for logging refinements)

## Execution Steps

### 1. Identify a Refinement Loop
When a user provides course-correcting feedback on your output (e.g., *"I don't like X, make it do Y"* or *"You should have done Z instead"*), recognize that a prompt refinement has occurred.

### 2. Document the Iteration
At the end of the task, or during a pause in execution:
1. Create a log file in `prompt_history/` named `YYYY-MM-DD-<task-name>.md` by copying `prompt_history/TEMPLATE.md`.
2. Document:
   - The initial prompt given.
   - The user's feedback/critique (what they liked/disliked).
   - The refined prompt version(s).
   - The final, successful prompt.

### 3. Extract General Rules
Analyze the difference between the failed prompt and the working prompt. Translate the specific correction into a general, reusable instruction.
- *Specific feedback:* "Don't use purple for buttons."
- *General rule:* "Use high-contrast theme-specific colors for interactive elements, avoiding low-visibility or arbitrary purple accents unless branded."

### 4. Update the Learnings Log
Open `prompt_learnings.md` and append the general rule under the appropriate category (e.g., UI/UX, Code Style, Formatting).

### 5. Load Learnings in Future Tasks
At the start of every new task or session, read `prompt_learnings.md` and integrate active rules directly into your thinking and planning.

## Best Practices
- **Conciseness:** Keep rules in `prompt_learnings.md` bulleted, brief, and highly actionable.
- **Scope:** Only promote rules to the master log that are likely to apply to future tasks. Keep specific local rules in the individual history file.
- **Maintainability:** Do not let `prompt_learnings.md` grow so large that it consumes the entire token window. Consolidate similar rules periodically.
