import httpx

DOCKER_SOCK = "/var/run/docker.sock"


def docker_api(method: str, path: str, json_body: dict | None = None,
               params: dict | None = None, timeout: float = 10.0):
    """Rechtstreeks tegen de Docker Engine API over de unix-socket - geen
    docker-py SDK (niet in requirements.txt, past niet bij de bestaande
    httpx-gebaseerde stijl van dit project)."""
    transport = httpx.HTTPTransport(uds=DOCKER_SOCK)
    with httpx.Client(transport=transport, base_url="http://docker", timeout=timeout) as c:
        r = c.request(method, path, json=json_body, params=params)
        r.raise_for_status()
        return r.json() if r.content else None
