from fastapi import APIRouter, HTTPException
from backend.schemas import (
    ChatCreateRequest, ChatMessageRequest, ChatReadRequest, ChatDeleteRequest
)
from backend.config import get_mod_list
from backend.database import read_chats, save_chats
import uuid
from datetime import datetime

router = APIRouter()

@router.post("/api/chat/create")
def create_chat(req: ChatCreateRequest):
    chats = read_chats()
    now = datetime.utcnow().isoformat()
    new_chat = {
        "id": str(uuid.uuid4()), "type": req.type,
        "participants": list(set(req.participants + [req.creator_email])),
        "messages": [], 
        "last_updated": now,
        "last_message_preview": req.initial_message or "New conversation",
        "last_read": {req.creator_email: now}
    }
    if req.initial_message:
        new_chat["messages"].append({"sender": req.creator_email, "text": req.initial_message, "timestamp": now})
    chats.append(new_chat)
    save_chats(chats)
    return new_chat

@router.get("/api/chat/list")
def list_user_chats(email: str, all_chats: bool = False):
    chats = read_chats()
    if all_chats: return chats
    user_chats = [c for c in chats if email in c.get('participants', [])]
    user_chats.sort(key=lambda x: x.get('last_updated', ''), reverse=True)
    return user_chats

@router.get("/api/chat/{chat_id}/messages")
def get_messages(chat_id: str, email: str):
    chats = read_chats()
    chat = next((c for c in chats if c["id"] == chat_id), None)
    if not chat: raise HTTPException(status_code=404, detail="Chat not found")
    mods = get_mod_list()
    if email not in chat["participants"] and email not in mods:
        raise HTTPException(status_code=403, detail="Access denied")
    return chat.get("messages", [])

@router.post("/api/chat/{chat_id}/message")
def send_message(chat_id: str, req: ChatMessageRequest):
    chats = read_chats()
    for chat in chats:
        if chat["id"] == chat_id:
            now = datetime.utcnow().isoformat()
            msg = {"sender": req.sender, "text": req.text, "timestamp": now}
            chat.setdefault("messages", []).append(msg)
            chat["last_updated"] = msg["timestamp"]
            chat["last_message_preview"] = req.text
            if "last_read" not in chat: chat["last_read"] = {}
            chat["last_read"][req.sender] = now
            save_chats(chats)
            return {"status": "success"}
    raise HTTPException(status_code=404, detail="Chat not found")

@router.post("/api/chat/{chat_id}/read")
def mark_chat_read(chat_id: str, req: ChatReadRequest):
    chats = read_chats()
    found = False
    for chat in chats:
        if chat["id"] == chat_id:
            if "last_read" not in chat: chat["last_read"] = {}
            chat["last_read"][req.email] = datetime.utcnow().isoformat()
            found = True
            break
    if found:
        save_chats(chats)
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Chat not found")

@router.post("/api/chat/delete")
def delete_chat(req: ChatDeleteRequest):
    chats = read_chats()
    updated_chats = []
    found = False
    mods = get_mod_list()
    for chat in chats:
        if chat["id"] == req.chat_id:
            if req.email in chat["participants"] or req.email in mods:
                found = True
                continue 
            else:
                updated_chats.append(chat)
        else:
            updated_chats.append(chat)
    if found:
        save_chats(updated_chats)
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Chat not found")
