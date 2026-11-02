import os
import re
import json
import base64
import zipfile
import io
import httpx
import anthropic
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File
from models import ExtractRequest, ExtractResponse
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

router = APIRouter(prefix="/api/extract", tags=["extract"])

CV_PATH = os.environ.get(
    "CV_PATH",
    "cv.md"
)

MAX_FILE_BYTES = 15 * 1024 * 1024
ALLOWED_DOCUMENT_EXTENSIONS = {"pdf", "doc", "docx"}

EXTRACTION_FIELDS = """Return ONLY a JSON object with these exact keys (use null for any field you cannot find):

{
  "company": "Company name",
  "job_title": "Job title / role name",
  "location": "City, Country or Remote",
  "company_size": "e.g. 50-200, Series B, etc.",
  "salary": "Salary range if listed, else null",
  "role_requirements": "Key skills and requirements as a short bullet list",
  "product_description": "One or two sentences describing what the company/product does",
  "fit_level": "High, Medium, or Low - based on how well the CV matches the role. Use High for strong alignment, Medium for partial match with gaps, Low for poor match",
  "why_it_fits": "2-3 sentences explaining the fit or lack of fit based on the CV"
}

Return only the JSON object, no markdown fences, no explanation."""

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def load_cv() -> str:
    # CV_CONTENT env var takes priority (useful for hosted deployments)
    cv_content = os.environ.get("CV_CONTENT")
    if cv_content:
        return cv_content
    try:
        with open(CV_PATH, "r") as f:
            return f.read()
    except FileNotFoundError:
        return "[CV not found - fit assessment will be skipped]"


def fetch_soup(url: str) -> BeautifulSoup:
    try:
        resp = httpx.get(url, headers=HEADERS, timeout=15, follow_redirects=True)
        resp.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not fetch URL: {e}")
    return BeautifulSoup(resp.text, "html.parser")


def extract_logo(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    # apple-touch-icon is usually the cleanest company logo
    for rel in ["apple-touch-icon", "apple-touch-icon-precomposed"]:
        tag = soup.find("link", rel=lambda r: r and rel in r)
        if tag and tag.get("href"):
            return urljoin(base_url, tag["href"])
    # og:image is a good fallback
    tag = soup.find("meta", property="og:image")
    if tag and tag.get("content"):
        return urljoin(base_url, tag["content"])
    # regular favicon
    for rel in ["icon", "shortcut icon"]:
        tag = soup.find("link", rel=lambda r: r and rel in (r if isinstance(r, list) else [r]))
        if tag and tag.get("href"):
            href = tag["href"]
            if not href.startswith("data:"):
                return urljoin(base_url, href)
    # Clearbit fallback for JS-rendered pages (e.g. Greenhouse, Workday)
    # that have no logo tags in their HTML shell
    parts = urlparse(base_url).netloc.split(".")
    if len(parts) >= 2:
        domain = ".".join(parts[-2:])
        return f"https://logo.clearbit.com/{domain}"
    return None


def soup_to_text(soup: BeautifulSoup) -> str:
    """Return cleaned text from a soup, preferring meta/JSON-LD for JS-rendered pages."""
    meta_text = _extract_meta_and_jsonld(soup)
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    body_text = soup.get_text(separator="\n", strip=True)
    text = body_text if len(body_text) > len(meta_text) else meta_text
    return text[:12000]


def _extract_meta_and_jsonld(soup: BeautifulSoup) -> str:
    parts = []
    for prop in ["og:title", "og:description"]:
        tag = soup.find("meta", property=prop)
        if tag and tag.get("content"):
            parts.append(tag["content"])
    for script in soup.find_all("script", type="application/ld+json"):
        if script.string:
            try:
                data = json.loads(script.string)
                parts.append(json.dumps(data, indent=2))
            except json.JSONDecodeError:
                parts.append(script.string)
    return "\n\n".join(parts)


def extract_docx_text(data: bytes) -> str:
    """.docx is a zip of XML - pull text runs out of word/document.xml directly."""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        xml = z.read("word/document.xml").decode("utf-8", errors="ignore")
    lines = []
    for paragraph in re.findall(r"<w:p[ >].*?</w:p>", xml, re.DOTALL):
        line = "".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", paragraph))
        if line.strip():
            lines.append(line)
    return "\n".join(lines)


def extract_doc_text(data: bytes) -> str:
    """Legacy binary .doc has no easy structured parse without external tools -
    text runs are readable ASCII stretches interspersed with binary formatting,
    so a crude scan is good enough context for the LLM."""
    decoded = data.decode("latin-1", errors="ignore")
    chunks = re.findall(r"[\x20-\x7E\n]{4,}", decoded)
    return "\n".join(chunks)


def parse_extraction_response(raw: str) -> Optional[dict]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        return json.loads(match.group()) if match else None


def call_claude(content) -> dict:
    client = anthropic.Anthropic()
    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": content}],
    )
    raw = message.content[0].text.strip()
    data = parse_extraction_response(raw)
    if data is None:
        return {"raw_error": f"Could not parse LLM response: {raw[:500]}"}
    return data


@router.post("/", response_model=ExtractResponse)
def extract_job(payload: ExtractRequest):
    soup = fetch_soup(payload.url)
    logo_url = extract_logo(soup, payload.url)
    page_text = soup_to_text(soup)
    cv_text = load_cv()

    prompt = f"""You are helping extract structured data from a job posting page.

Here is the raw text from the job posting page:
<job_page>
{page_text}
</job_page>

Here is the candidate's CV:
<cv>
{cv_text}
</cv>

Extract the following fields from the job page and assess fit against the CV.
{EXTRACTION_FIELDS}"""

    data = call_claude(prompt)
    if data.get("raw_error"):
        return ExtractResponse(raw_error=data["raw_error"])

    return ExtractResponse(
        company=data.get("company"),
        job_title=data.get("job_title"),
        location=data.get("location"),
        company_size=data.get("company_size"),
        salary=data.get("salary"),
        role_requirements=data.get("role_requirements"),
        product_description=data.get("product_description"),
        fit_level=data.get("fit_level"),
        why_it_fits=data.get("why_it_fits"),
        careers_page_url=payload.url,
        logo_url=logo_url,
    )


@router.post("/document", response_model=ExtractResponse)
async def extract_job_document(file: UploadFile = File(...)):
    filename = (file.filename or "").lower()
    ext = filename.rsplit(".", 1)[-1] if "." in filename else ""
    if ext not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise HTTPException(status_code=422, detail="File must be a PDF, DOC, or DOCX")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=422, detail="File is empty")
    if len(file_bytes) > MAX_FILE_BYTES:
        raise HTTPException(status_code=422, detail="File is too large (max 15MB)")

    cv_text = load_cv()

    if ext == "pdf":
        prompt = f"""You are helping extract structured data from a job posting document (attached as a PDF).

Here is the candidate's CV:
<cv>
{cv_text}
</cv>

Extract the following fields from the attached job posting and assess fit against the CV.
{EXTRACTION_FIELDS}"""

        content = [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": base64.b64encode(file_bytes).decode("utf-8"),
                },
            },
            {"type": "text", "text": prompt},
        ]
    else:
        try:
            doc_text = extract_docx_text(file_bytes) if ext == "docx" else extract_doc_text(file_bytes)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Could not read {ext.upper()} file: {e}")

        content = f"""You are helping extract structured data from a job posting document.

Here is the raw text extracted from the job posting document:
<job_document>
{doc_text[:12000]}
</job_document>

Here is the candidate's CV:
<cv>
{cv_text}
</cv>

Extract the following fields from the job document and assess fit against the CV.
{EXTRACTION_FIELDS}"""

    data = call_claude(content)
    if data.get("raw_error"):
        return ExtractResponse(raw_error=data["raw_error"])

    return ExtractResponse(
        company=data.get("company"),
        job_title=data.get("job_title"),
        location=data.get("location"),
        company_size=data.get("company_size"),
        salary=data.get("salary"),
        role_requirements=data.get("role_requirements"),
        product_description=data.get("product_description"),
        fit_level=data.get("fit_level"),
        why_it_fits=data.get("why_it_fits"),
    )
