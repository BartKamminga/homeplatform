class AppError(Exception):
    """Domain-level error that maps to a JSON HTTP response."""

    def __init__(self, detail: str, status_code: int = 400, code: str | None = None, extra: dict | None = None):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code
        self.code = code
        self.extra = extra  # structured payload voor de client (bv. duplicate-file details)
