"""
Entry point for Windows.
Must set ProactorEventLoop policy BEFORE uvicorn creates its event loop,
otherwise browser_use's create_subprocess_exec fails with NotImplementedError.
"""
import asyncio
import sys

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import uvicorn

if __name__ == '__main__':
    # reload=True spawns a worker subprocess on Windows, losing the ProactorEventLoop policy.
    # Run without reload — restart manually when backend code changes.
    uvicorn.run('main:app', host='127.0.0.1', port=8000, reload=False)
