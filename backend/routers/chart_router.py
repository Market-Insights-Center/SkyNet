from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any
import logging
import json
import asyncio

from backend.integration.chart_command import stream_chart_completion

router = APIRouter()
logger = logging.getLogger("chart_router")

class ChartCompletionRequest(BaseModel):
    tickers: List[str]
    columns: List[str]

@router.post("/api/chart-completion")
async def get_chart_completion(request: ChartCompletionRequest):
    """
    Accepts a list of tickers and a list of column headers.
    Returns a streamed NDJSON response with real-time updates.
    """
    logger.info(f"Received chart completion request: {len(request.tickers)} tickers, {len(request.columns)} columns")
    
    async def event_generator():
        try:
            async for update in stream_chart_completion(request.tickers, request.columns):
                yield json.dumps(update, default=str) + "\n"
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(
        event_generator(),
        media_type="application/x-ndjson",
        headers={"X-Accel-Buffering": "no"}
    )
