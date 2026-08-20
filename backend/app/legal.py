"""Public Privacy/Terms pages — their URLs are required by the App Store listing (SPEC §9).
DRAFT: copy pending review before submission."""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter()

_STYLE = """<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
       max-width: 720px; margin: 40px auto; padding: 0 20px; color: #323232; line-height: 1.65; }
h1 { font-size: 28px; } h2 { font-size: 20px; margin-top: 36px; }
.muted { color: #787878; font-size: 14px; }
</style>"""

PRIVACY = _STYLE + """
<h1>AlgoWealth — Privacy Policy</h1>
<p class="muted">AlgoWealth is a personal, invite-only portfolio tracker.</p>
<h2>Data we store</h2>
<p>Email and password (stored only as an irreversible hash); portfolio data uploaded by the administrator;
your watchlist; interface language.</p>
<h2>How we use it</h2>
<p>Solely to display your portfolio. Your data is never sold or shared. The app contains no ads and
no analytics trackers. Quotes are fetched from public financial services without your personal data.</p>
<h2>Deletion</h2>
<p>You can delete your account in the app Settings; this removes your account and watchlist.</p>
<p class="muted">Contact: a.lutsenko@quantillions.com</p>
"""

TERMS = _STYLE + """
<h1>AlgoWealth — Terms of Service</h1>
<p>1. AlgoWealth is a personal information service for portfolio tracking. Access is provided
by invitation from the administrator.</p>
<p>2. The app displays data uploaded by the administrator and market quotes from public sources.
All information is for reference only and does not constitute investment advice.</p>
<p>3. We do not guarantee uninterrupted service or the accuracy of third-party quotes.</p>
<p>4. Do not share your credentials with third parties.</p>
<p>5. Your account can be deleted by you in Settings or by the administrator.</p>
<p class="muted">Contact: a.lutsenko@quantillions.com</p>
"""


@router.get("/privacy", response_class=HTMLResponse)
def privacy():
    return PRIVACY


@router.get("/terms", response_class=HTMLResponse)
def terms():
    return TERMS
