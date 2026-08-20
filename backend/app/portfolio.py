import sqlite3

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from . import db, goapi
from .api import current_user

router = APIRouter(prefix="/api/app/portfolio")

READ_PATHS = {"check", "bank/list", "instrument-type/list", "balance",
              "instruments-type/distribution", "instruments", "banks"}
PASS_PARAMS = {"days", "bank", "type", "q", "order_by", "order_direction",
               "offset", "limit", "timestamp", "lastUpdate", "date"}
GO_UNAVAILABLE = "Portfolio service is temporarily unavailable"


def _forward_params(request: Request) -> list[tuple[str, str]]:
    return [(k, v) for k, v in request.query_params.multi_items()
            if k in PASS_PARAMS]


def _go_response(r: httpx.Response) -> Response:
    return Response(content=r.content, status_code=r.status_code,
                    media_type=r.headers.get("content-type", "application/json"))


@router.post("/csv-upload")
async def csv_upload(request: Request, user_email: str,
                     user: sqlite3.Row = Depends(current_user),
                     client: httpx.AsyncClient = Depends(goapi.get_go_client)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    target = db.get_user_by_email(user_email)
    if target is None:
        raise HTTPException(status_code=404, detail="No such user")
    async with client:
        try:
            r = await client.post(
                f"/api/{target['group_id']}/csv-upload",
                params=_forward_params(request),
                content=await request.body(),
                headers={"Content-Type": request.headers.get("content-type", "")},
            )
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail=GO_UNAVAILABLE)
    return _go_response(r)


@router.get("/{sub:path}")
async def portfolio_read(sub: str, request: Request,
                         user: sqlite3.Row = Depends(current_user),
                         client: httpx.AsyncClient = Depends(goapi.get_go_client)):
    if sub not in READ_PATHS:
        raise HTTPException(status_code=404, detail="Not found")
    async with client:
        try:
            r = await client.get(f"/api/{user['group_id']}/{sub}",
                                 params=_forward_params(request))
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail=GO_UNAVAILABLE)
    return _go_response(r)
