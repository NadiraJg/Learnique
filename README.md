# Learnique
**Because everyone learns differently.**

A hackathon MVP of an adaptive study companion: guided reasoning, interactive visualization, smart notes, and session progress. Designed to let students think for themselves.

## What works right now

Learnique v1.4 is a functional hackathon MVP integrating a Python web application with a Langflow AI Agent.

### Core Features

- **Adaptive AI Study Chat:** Uses Langflow and Gemini to guide students through concepts with questions, explanations, and hints instead of immediately revealing answers.
- **Guided Reasoning:** Provides three interactive questions with feedback and hints for inorder, preorder, and postorder BST traversal. The Agent selects the traversal, while the questions are locally predefined.
- **AI-Controlled Interactive Visualization:** The Agent can call BUILD_VISUALIZATION to select the traversal, and the website updates its interactive BST diagram.
- **AI Smart Notes:** The Agent can call BUILD_NOTE to generate contextual note suggestions. Students choose whether to save them.
- **Learning Profile:** Tracks exercise progress, correct answers, and hints used in the local browser.
- **Demo Mode:** Provides limited local functionality when Langflow is not configured.

### AI Agent Integration

Langflow orchestrates the AI tutor and its two custom tools:
- BUILD_NOTE
- BUILD_VISUALIZATION

The Python backend communicates with Langflow through its API. Agent responses can include structured directives that update Smart Notes and Visualization in the frontend.

### Current Limitations

Learnique currently demonstrates learning with a fixed Binary Search Tree. Guided Reasoning multiple-choice questions are predefined, and learning progress is stored locally. Cross-session personalized mastery modeling has not yet been implemented.

## IBM Bob Contribution

IBM Bob was used during the development and quality assurance of Learnique v1.4.

- Reviewed the Python backend and Langflow API integration
- Identified weaknesses in error diagnostics
- Improved error handling in server.py
- Added automated test cases for response extraction and safe logging
- Verified that all 18 automated tests passed

The changes are documented in the GitHub commit:
`fix: improve Langflow error diagnostics with IBM Bob`

Evidence is available in `screenshots/04-bob-integration.png`.

## Launch on Windows (no npm, no pip)
1. Unzip the project.
2. Install Python 3 if necessary (check **Add Python to PATH**).
3. Double-click `start_windows.bat` or open the project folder in VS Code terminal and run `python server.py`.
4. Open <http://127.0.0.1:8000> in Chrome.
5. Try **Explain simply**, **I'm stuck**, **Next step**, **Add to notes**.
6. Keep the terminal open while testing. To stop, press Ctrl+C.

## Launch on macOS/Linux
```bash
python3 server.py
```
Open <http://127.0.0.1:8000>.

## Connect real Langflow when ready
See **[`langflow/SETUP.md`](langflow/SETUP.md)** and **[`langflow/agent_prompt.txt`](langflow/agent_prompt.txt)**. Copy `.env.example` as `.env` and replace example configuration with your Langflow flow ID, instance URL, and key if needed. Restart server. The badge changes from **Demo mode** to **Langflow configured**. You must still verify actual replies arrive from your flow.

The backend calls the official Langflow `POST /api/v1/run/{flow_id}` API with `input_value`, `input_type`, `output_type`, and `session_id`. Secrets stay in `.env` on the backend. Source: https://docs.langflow.org/api-flows-run

## Hackathon / screenshots
Recommended honest evidence after integration and testing:

1. `01-user-interface.png`: working Learnique page in the browser.
2. `02-learning-process.png`: guided reasoning + visualization in action.
3. `03-langflow-workflow.png`: **your actual** Langflow canvas and connected nodes.
4. `04-bob-integration.png`: **your actual** IBM Bob session or IDE working on the project, if required. It cannot be replaced by a fabricated screenshot.
5. `05-output.png`: saved notes and updated progress after doing the walkthrough.

The `screenshots/` folder includes a genuine screenshot of this **Demo mode** interface generated during local testing. It is **not** proof of Langflow or Bob integration.

## GitHub
Create a repository named `learnique`, then from the project folder:
```bash
git init
git add .
git commit -m "Initial Learnique MVP"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/learnique.git
git push -u origin main
```
Do not upload `.env` or API keys. GitHub is for your code; this local Python server is not hosted by GitHub Pages. A live site with the backend requires separate hosting.

## Project structure
```text
learnique_mvp/
├── server.py              # local web server and Langflow API proxy
├── static/
│   ├── index.html         # interface
│   ├── styles.css         # minimal, responsive visual design
│   └── app.js             # demo functionality + live chat client
├── langflow/
│   ├── SETUP.md           # workflow to build in Langflow
│   └── agent_prompt.txt   # AI tutor system instructions
├── screenshots/           # true local testing screenshots
├── .env.example           # safe configuration template
├── .gitignore
├── start_windows.bat
└── README.md
```

## Tech stack
Plain HTML/CSS/JavaScript, Python 3 standard library, optional external Langflow instance; optional IBM Bob can inspect or refine the project with the user's authorized account.

## Limitations and next steps
- The demo is scoped to **one fixed Binary Search Tree**, with inorder, preorder, and postorder traversal practice.
- No sign-in/database, document upload, AI-created visualization, or reliable multi-topic mastery tracking yet.
- Local notes are saved in this browser only; clearing browser storage removes them.
- In Langflow mode, normal chat goes to the connected agent. The agent may choose the traversal, but quiz questions and the fixed BST visual renderer remain locally prewritten; they are not generated per student by the AI.
- IBM Bob **has not been used to create this version**; if the competition requires proof of Bob usage, a team member must actually use Bob and capture their own work. Do not claim the assistant-generated code as an IBM Bob run.


### v1.1 — Feedback Guided Reasoning
Incorrect answers in Guided Reasoning are now highlighted, with clear hints to help students understand their mistakes. At this stage, the feature still operated in Demo Mode, before the live Langflow AI integration was implemented.


### v1.2 — Langflow → Smart Notes panel (experimental)
The `/api/chat` proxy now accepts an optional final-response directive of the form
`[[LEARNIQUE_NOTE]]{"text":"...","simple_text":"..."}[[/LEARNIQUE_NOTE]]`.
After a successful `BUILD_NOTE` call, an Agent instruction can request this directive.
The proxy removes the directive from chat and sends its data as `note_suggestion`
to the web UI. The Smart Notes card updates and users can choose **Add to notes**.
It **does not automatically save** notes, and it does **not directly read Langflow tool traces**.

**Required Langflow step:** append the rule in `langflow/smart_notes_output_instruction.txt`
to your Agent Instructions (existing teaching rules remain intact). Without this
rule, tool calls may succeed but the web UI won't receive structured suggestions.
Do NOT add API keys to a public repository.


### v1.3 — Langflow Agent → Interactive Visualization (experimental)

The `/api/chat` proxy can now parse this optional **final Chat Output** directive:

```text
[[LEARNIQUE_VISUALIZATION]]
{"visualization_type":"bst_traversal","traversal":"preorder","visit_order":[8,4,2,6,12,10,14]}
[[/LEARNIQUE_VISUALIZATION]]
```

After the Agent successfully calls `BUILD_VISUALIZATION`, its instructions
may request this directive. The backend checks that the traversal/order match
the **fixed 7-node BST** and strips the directive from visible chat. The browser
then switches its tree animation to the selected traversal, resets the animation
to step 0, and displays an **AI selected** label. The student can click **Next
step**, **Previous**, or **Reset** as before. Existing local notes and guided
quiz progress are preserved. `BUILD_NOTE` suggestions still work, too.

**IMPORTANT:** v1.3 parses structured text included in the Agent's final
response. It does not independently read Langflow tool traces or prove the
Agent called the tool. Verify the actual `BUILD_VISUALIZATION` call in
Playground or Langflow logs. The Guided Reasoning three-question card still
specifically demonstrates **inorder**; it has not been generalized to all
traversal types. The visualized tree is currently fixed, not arbitrary.

Append the instructions in `langflow/visualization_output_instruction.txt` to
your existing Langflow Agent Instructions (in addition to Smart Notes). No new
API keys or `.env` modifications are required.

**Testing v1.3:** With Langflow open, ask the website:
"Please use BUILD_VISUALIZATION to show me **preorder** traversal on our BST."
Once the Agent responds, look for **AI selected · Preorder** in the right panel.
Press Next step: the first highlighted node should be **8**; the complete order
should be **8 → 4 → 2 → 6 → 12 → 10 → 14**. Try postorder as well.

To update an existing installation: stop the local Python server, replace the
source files with the new ZIP contents, **preserve `.env`**, restart, and do a
hard-refresh in Chrome (Ctrl+Shift+R). No keys or tokens should be in screenshots.


### v1.4 — AI-selected traversal also synchronizes Guided Reasoning

In v1.3, an Agent-selected preorder visualization could still leave the **inorder**
Guided Reasoning question card visible. **v1.4 fixes that mismatch**:

- Valid Langflow visualization directives now set the traversal for **both** the
  animation and the local three-question Guided Reasoning practice.
- Starting a new AI-selected traversal resets **only the current exercise** to
  step 1 of 3 and opens its quiz automatically. It does **not** delete saved
  notes, chat history, or cumulative answer/hint counts.
- Each traversal (inorder, preorder, postorder) has different locally scripted
  questions, correct choices, and hints. A wrong answer gets a visible hint;
  the wrong button is disabled to avoid repeat counting.
- The question card shows the currently selected traversal. Completion messages
  and sidebar progress also follow the selected traversal.
- Saved AI Smart Notes suggestions are **not overwritten** when a local guided
  practice finishes. A v1.3 saved session with stale inorder-only quiz progress
  is migrated safely when preorder/postorder had been selected.

**Honest MVP boundary:** The Langflow Agent chooses the traversal, but the
three interactive practice questions are predefined in JavaScript. This is a
synchronized local practice module, not yet AI-generated assessment content.
The fixed BST is still 8, 4, 12, 2, 6, 10, 14.

**Test v1.4:**
1. Start Langflow and Learnique. In chat request a **preorder** visualization
   using `BUILD_VISUALIZATION`. Wait for **AI selected · Preorder**.
2. Under Guided Reasoning, look for **PREORDER** and **Step 1 / 3**. Select an
   intentionally wrong answer to see feedback; then choose **Root → Left → Right**.
   Verify progress is **1/3**. In Visual Lab, Next step should visit **8** first.
3. Request a **postorder** visualization. Guided Reasoning must reset to
   **POSTORDER — Step 1 / 3**, and Next step should visit **2** first.
4. Check that your old saved notes remain. Existing `.env` / Langflow API key
   configuration does **not** need to change.

**Update Windows:** Stop the Learnique server (Ctrl+C), copy the new project's
files over your existing `learnique_mvp` folder, keeping your `.env` unchanged,
start `start_windows.bat` and hard-refresh Chrome (Ctrl+Shift+R). Leave Langflow
running while testing. No need to re-export the flow simply for this UI fix.
