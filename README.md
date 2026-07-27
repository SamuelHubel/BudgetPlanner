### Budget Planner
A local, AI powered (not proper financial advice!!!), Personal Finance App.
Track monthly income, expenses, and more through manual logging or load a statement and let the app track and categorize for you!
Set goals and trak your progress, or also ask AI to help budget (not proper financial advice!!!)



## Tech Stack
Layer	        Choice
App shell	    Tauri 2, desktop targets only for now
Frontend	    React + TypeScript + Vite
Styling	        Tailwind CSS (single desktop layout for now — see Section 10 for responsive work)
Local database	SQLite via tauri-plugin-sql, encrypted with SQLCipher
Key derivation	Argon2id (derive DB encryption key from the lock-screen password)
AI backend	    Ollama, called via local HTTP API (http://localhost:11434) from the Rust core
Fallback AI	    Rules-based insight engine (no LLM), used when Ollama isn't running
File import	    CSV parser for one-time/on-demand bank statement import (OFX/QFX as stretch)
Charts	        Recharts
Packaging	    Tauri CLI (tauri build) — desktop installers only
