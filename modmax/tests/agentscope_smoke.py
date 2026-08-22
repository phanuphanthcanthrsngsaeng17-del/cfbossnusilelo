"""MOD MAX #1 — AgentScope smoke test.

This deliberately tests only safe, non-destructive capabilities that do not
require an LLM API key: package import, core agent/tool classes, and toolkit
construction. A live-model test can be enabled separately when a provider
secret is configured in the test environment.
"""
import json
import sys


def main() -> int:
    import agentscope
    from agentscope.agent import Agent
    from agentscope.tool import Toolkit, Bash, Grep, Glob, Read, Write, Edit

    toolkit = Toolkit(tools=[Bash(), Grep(), Glob(), Read(), Write(), Edit()])

    result = {
        "package": "agentscope",
        "version": getattr(agentscope, "__version__", "unknown"),
        "python": sys.version.split()[0],
        "agent_import": Agent.__name__,
        "toolkit_import": Toolkit.__name__,
        "tools_constructed": 6,
        "status": "PASS",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
