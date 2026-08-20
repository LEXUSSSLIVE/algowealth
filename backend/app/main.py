import os

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from .admin import AdminRedirect, router as admin_router
from .api import router
from .db import init_db
from .legal import router as legal_router
from .portfolio import router as portfolio_router
from .quotes import router as quotes_router


def create_app() -> FastAPI:
    app = FastAPI(title="AlgoWealth API", docs_url=None, redoc_url=None)
    init_db()
    app.include_router(portfolio_router)
    app.include_router(quotes_router)
    app.include_router(router)
    app.include_router(admin_router)
    app.include_router(legal_router)

    @app.exception_handler(AdminRedirect)
    async def admin_redirect_handler(request: Request, exc: AdminRedirect):
        return RedirectResponse("/admin/login", status_code=303)

    uploads = os.environ.get("ALGOWEALTH_UPLOADS", "/data/uploads")
    os.makedirs(uploads, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=uploads), name="uploads")
    return app


app = create_app()
