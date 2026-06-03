# AGENTS.md

This file is for guiding code agents (like Claude Code, GitHub Copilot, OpenAI Codex, etc.) to work in LangBot project.

## Project Overview

LangBot is a open-source LLM native instant messaging bot development platform, aiming to provide an out-of-the-box IM robot development experience, with Agent, RAG, MCP and other LLM application functions, supporting global instant messaging platforms, and providing rich API interfaces, supporting custom development.

LangBot has a comprehensive frontend, all operations can be performed through the frontend. The project splited into these major parts:

- `./src/langbot`: The main python package of the project, below are the main modules in this package:
    - `./pkg`: The core python package of the project backend.
        - `./pkg/platform`: The platform module of the project, containing the logic of message platform adapters, bot managers, message session managers, etc.
        - `./pkg/provider`: The provider module of the project, containing the logic of LLM providers, tool providers, etc.
        - `./pkg/pipeline`: The pipeline module of the project, containing the logic of pipelines, stages, query pool, etc.
        - `./pkg/api`: The api module of the project, containing the http api controllers and services.
        - `./pkg/plugin`: LangBot bridge for connecting with plugin system.
    - `./libs`: Some SDKs we previously developed for the project, such as `qq_official_api`, `wecom_api`, etc.
    - `./templates`: Templates of config files, components, etc.
    - `./web`: Frontend codebase, built with Next.js + **shadcn** + **Tailwind CSS**.
    - `./docker`: docker-compose deployment files.

## Backend Development

We use `uv` to manage dependencies.

```bash
pip install uv
uv sync --dev
```

Start the backend and run the project in development mode.

```bash
uv run main.py
```

Then you can access the project at `http://127.0.0.1:5300`.

## Frontend Development

We use `pnpm` to manage dependencies.

```bash
cd web
cp .env.example .env
pnpm install
pnpm dev
```

Then you can access the project at `http://127.0.0.1:3000`.

## Plugin System Architecture

LangBot is composed of various internal components such as Large Language Model tools, commands, messaging platform adapters, LLM requesters, and more. To meet extensibility and flexibility requirements, we have implemented a production-grade plugin system.

Each plugin runs in an independent process, managed uniformly by the Plugin Runtime. It has two operating modes: `stdio` and `websocket`. When LangBot is started directly by users (not running in a container), it uses `stdio` mode, which is common for personal users or lightweight environments. When LangBot runs in a container, it uses `websocket` mode, designed specifically for production environments.

Plugin Runtime automatically starts each installed plugin and interacts through stdio. In plugin development scenarios, developers can use the lbp command-line tool to start plugins and connect to the running Runtime via WebSocket for debugging.

> Plugin SDK, CLI, Runtime, and entities definitions shared between LangBot and plugins are contained in the [`langbot-plugin-sdk`](https://github.com/langbot-app/langbot-plugin-sdk) repository.

## Some Development Tips and Standards

- LangBot is a global project, any comments in code should be in English, and user experience should be considered in all aspects.
- Thus you should consider the i18n support in all aspects.
- LangBot is widely adopted in both toC and toB scenarios, so you should consider the compatibility and security in all aspects.
- If you were asked to make a commit, please follow the commit message format: 
    - format: <type>(<scope>): <subject>
    - type: must be a specific type, such as feat (new feature), fix (bug fix), docs (documentation), style (code style), refactor (refactoring), perf (performance optimization), etc.
    - scope: the scope of the commit, such as the package name, the file name, the function name, the class name, the module name, etc.
    - subject: the subject of the commit, such as the description of the commit, the reason for the commit, the impact of the commit, etc.
- LangBot uses [Alembic](https://alembic.sqlalchemy.org/) to manage database migrations, supporting both SQLite and PostgreSQL. Migration files are located in `src/langbot/pkg/persistence/alembic/versions/`. If you changed the definition of database entities (ORM models), generate a new migration script by running `uv run python -m langbot.pkg.persistence.alembic_runner autogenerate "description of your change"` in the project root (requires `data/config.yaml` to exist). Review and edit the generated script before committing. Migrations are executed automatically on LangBot startup. For data migrations (e.g. modifying JSON field content), you need to manually add the migration code in the generated script.

## Some Principles

- Keep it simple, stupid.
- Entities should not be multiplied unnecessarily
- 八荣八耻

    以瞎猜接口为耻，以认真查询为荣。
    以模糊执行为耻，以寻求确认为荣。
    以臆想业务为耻，以人类确认为荣。
    以创造接口为耻，以复用现有为荣。
    以跳过验证为耻，以主动测试为荣。
    以破坏架构为耻，以遵循规范为荣。
    以假装理解为耻，以诚实无知为荣。
    以盲目修改为耻，以谨慎重构为荣。

<!-- CODEGRAPH_START -->
## CodeGraph

This project has a CodeGraph MCP server (`codegraph_*` tools) configured. CodeGraph is a tree-sitter-parsed knowledge graph of every symbol, edge, and file. Reads are sub-millisecond and return structural information grep cannot.

### When to prefer codegraph over native search

Use codegraph for **structural** questions — what calls what, what would break, where is X defined, what is X's signature. Use native grep/read only for **literal text** queries (string contents, comments, log messages) or after you already have a specific file open.

| Question | Tool |
|---|---|
| "Where is X defined?" / "Find symbol named X" | `codegraph_search` |
| "What calls function Y?" | `codegraph_callers` |
| "What does Y call?" | `codegraph_callees` |
| "How does X reach/become Y? / trace the flow from X to Y" | `codegraph_trace` (one call = the whole path, incl. callback/React/JSX dynamic hops) |
| "What would break if I changed Z?" | `codegraph_impact` |
| "Show me Y's signature / source / docstring" | `codegraph_node` |
| "Give me focused context for a task/area" | `codegraph_context` |
| "See several related symbols' source at once" | `codegraph_explore` |
| "What files exist under path/" | `codegraph_files` |
| "Is the index healthy?" | `codegraph_status` |

### Rules of thumb

- **Answer directly — don't delegate exploration.** For "how does X work" / architecture questions, answer with 2-3 codegraph calls: `codegraph_context` first, then ONE `codegraph_explore` for the source of the symbols it surfaces. For a specific **flow** ("how does X reach Y") start with `codegraph_trace` from→to — one call returns the whole path with dynamic hops bridged — then ONE `codegraph_explore` for the bodies; don't rebuild the path with `codegraph_search` + `codegraph_callers`. Codegraph IS the pre-built index, so spawning a separate file-reading sub-task/agent — or running a grep + read loop — repeats work codegraph already did and costs more for the same answer.
- **Trust codegraph results.** They come from a full AST parse. Do NOT re-verify them with grep — that's slower, less accurate, and wastes context.
- **Don't grep first** when looking up a symbol by name. `codegraph_search` is faster and returns kind + location + signature in one call.
- **Don't chain `codegraph_search` + `codegraph_node`** when you just want context — `codegraph_context` is one call.
- **Don't loop `codegraph_node` over many symbols** — one `codegraph_explore` call returns several symbols' source grouped in a single capped call, while each separate node/Read call re-reads the whole context and costs far more.
- **Index lag**: the file watcher debounces ~500ms behind writes; don't re-query immediately after editing a file in the same turn.

### If `.codegraph/` doesn't exist

The MCP server returns "not initialized." Ask the user: *"I notice this project doesn't have CodeGraph initialized. Want me to run `codegraph init -i` to build the index?"*
<!-- CODEGRAPH_END -->
