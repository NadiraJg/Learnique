# Langflow Integration — build your actual AI Agent

The web app is ready to call Langflow, but a live AI Agent **does not exist** in this repository until you build and test one in your own Langflow workspace.

## First simple workflow (recommended)
1. Open a running Langflow instance.
2. Create a flow from a starter **Simple Agent** template, or manually connect **Chat Input → Agent → Chat Output** (the Agent requires a configured chat model/provider).
3. Configure your own provider API key privately in Langflow. A chat model may have usage costs; check credits / academic access first.
4. Put the instructions from `agent_prompt.txt` into the Agent instructions / system prompt.
5. In Langflow's Playground, send: `I don't understand inorder traversal. Help me think through it without giving the final answer immediately.` Check that it responds with one guided question instead of a giant solution.
6. Get your **flow ID** from the flow's API/code view. Follow the API snippet for your Langflow version.
7. At repository root, copy `.env.example` to `.env` and set `LANGFLOW_URL`, `LANGFLOW_FLOW_ID`, and `LANGFLOW_API_KEY` (if your server requires it).
8. Restart `python server.py`. The badge should change to **Langflow configured**.
9. Send a custom question via the text box. Verify the response in the web UI and Langflow Playground; take your actual workflow screenshot after testing.

Flow diagram:
```
Chat Input ──> Agent (configured LLM) ──> Chat Output
                  │
                  └─ optional Run Flow tools: Study Guide / Smart Notes
```

## Phase 2 (after the above works)
Add separate Langflow subflows/tools such as:
- `guidance_tool`: generate one reasoning checkpoint with a hint, not the answer.
- `notes_tool`: recommend concise notes based on actual student mistakes.
- `learning_strategy_tool`: suggest explain / hint / visualize / quiz based on observable performance.

If you want these tools to control app UI directly, agree on a strict **JSON output schema** (e.g. `type`, `message`, `note`, `visualization_id`) and update the backend/UI to parse and validate it. The current UI does not yet support this protocol.

## Important architecture
- **IBM Bob**: optional developer IDE to edit/test code; not a runtime agent in the student learning loop.
- **Langflow**: actual agent workflow that runs on server/API, after you've set up the flow.
- **Learnique backend**: proxy to Langflow, prevents exposing private keys in the browser.

Langflow official docs:
- https://docs.langflow.org/agents
- https://docs.langflow.org/api-flows-run
- https://docs.langflow.org/session-id

Never put API keys in GitHub or in screenshots.
