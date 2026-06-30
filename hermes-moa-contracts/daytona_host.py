"""Host a local file in a public Daytona sandbox and yield its public URL.

Unsiloed's tools fetch a document by public URL, so we serve the PDF from a
throwaway sandbox and hand Unsiloed that URL. The sandbox MUST be public — a
private one token-gates the preview, and Unsiloed (which fetches anonymously)
would get a 400. The sandbox is deleted on exit.
"""

import time
import contextlib
from pathlib import Path

_PORT = 3000


@contextlib.contextmanager
def serve_public(pdf: Path, api_key: str, log=lambda _msg: None):
    """Yield a public URL serving `pdf`; tear the sandbox down afterwards.

    `log` is an optional progress callback (str -> None) so this module stays
    free of any presentation concerns.
    """
    from daytona import Daytona, DaytonaConfig, CreateSandboxFromSnapshotParams

    daytona = Daytona(DaytonaConfig(api_key=api_key))
    log("creating public Daytona sandbox…")
    sandbox = daytona.create(CreateSandboxFromSnapshotParams(public=True))
    try:
        remote = f"/home/daytona/www/{pdf.name}"
        sandbox.process.exec("mkdir -p /home/daytona/www")
        try:                                       # SDK signature varies by version
            sandbox.fs.upload_file(pdf.read_bytes(), remote)
        except TypeError:
            sandbox.fs.upload_file(str(pdf), remote)
        # setsid + </dev/null so the server survives after this exec call returns
        sandbox.process.exec(
            f"setsid sh -c 'cd /home/daytona/www && python3 -m http.server {_PORT} "
            ">/tmp/http.log 2>&1' </dev/null >/dev/null 2>&1 &"
        )
        time.sleep(3)
        url = f"{sandbox.get_preview_link(_PORT).url.rstrip('/')}/{pdf.name}"
        log(f"sandbox serving {pdf.name}")
        yield url
    finally:
        with contextlib.suppress(Exception):
            sandbox.delete()
            log("sandbox torn down")