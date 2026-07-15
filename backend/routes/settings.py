from fastapi import APIRouter
from services.deps import service_registry

router = APIRouter()


@router.get("/settings/services")
async def get_services():
    """利用可能なLLMサービス一覧を返す"""
    return [
        {"id": s.id, "name": s.name, "type": s.type, "model": s.model}
        for s in service_registry.get_services()
    ]
