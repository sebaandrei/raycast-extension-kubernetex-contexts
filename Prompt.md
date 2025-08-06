I want to build a Raycast extension that helps me manage Kubernetes contexts efficiently from Raycast on macOS. The extension should:
	•	Use shell commands (e.g., kubectl config get-contexts, kubectl config use-context, kubectl config set-context) — it should not directly edit the kubeconfig file.
	•	Be able to:
	•	List all available contexts (from current kubeconfig)
	•	Switch to a selected context
	•	Filter/search through contexts
	•	Show current context (optionally in the Raycast menubar)
	•	Allow namespace selection when switching
	•	Optionally add a new context via command input

I prefer to use Python or Go for implementation. If not possible in Raycast’s ecosystem, fall back to TypeScript.

Please provide a step-by-step implementation plan, broken into tasks, and grouped by milestones/phases (e.g., setup, core features, UX improvements, optional features). Each task should include:
	•	Description
	•	Estimated complexity (easy/medium/hard)
	•	Prerequisites (if any)

Also include:
	•	Guidance on language/runtime support in Raycast (e.g., can I use Python or Go directly? Or do I need to create a wrapper?)
	•	Notes on using shell commands from the extension securely and reliably
	•	Any recommended libraries or tools for kubeconfig parsing (if needed)
	•	How to test/debug the extension during development
	•	How to package or run the extension locally
	•	Common pitfalls (e.g., permission errors, shell env differences in Raycast)

This is intended to be a public available extension, so take in consideration also security and reliability. for the moment will be used locally, but i have in plan to publish it in raycast extensions.           


Save the plan to PLAN.md.
