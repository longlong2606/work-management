import hmac
import hashlib
import base64
import json
import time
from typing import Optional
from fastapi import HTTPException, Header, Depends
from database import get_db_connection

SECRET_KEY = "work_mgmt_secret_jwt_key_2026!#"

def create_token(user_id: int, username: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": int(time.time()) + 86400 * 7 # 7 days
    }
    payload_json = json.dumps(payload, separators=(',', ':'))
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode().rstrip('=')
    
    signature = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{signature}"

def verify_token(token: str) -> Optional[dict]:
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_b64, signature = parts
        
        expected_sig = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return None
            
        # Add padding back if necessary
        padding = '=' * (4 - len(payload_b64) % 4) if len(payload_b64) % 4 != 0 else ''
        payload_str = base64.urlsafe_b64decode(payload_b64 + padding).decode()
        payload = json.loads(payload_str)
        
        if payload.get("exp", 0) < time.time():
            return None # Expired
            
        return payload
    except Exception:
        return None

def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Vui lòng đăng nhập để tiếp tục")
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Token không hợp lệ")
        
    token = parts[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập đã hết hạn hoặc không hợp lệ")
        
    conn = get_db_connection()
    user = conn.execute("SELECT id, username, full_name, email, phone, role, department, status FROM users WHERE id = ?", (payload["user_id"],)).fetchone()
    conn.close()
    
    if not user:
        raise HTTPException(status_code=401, detail="Tài khoản không tồn tại")
        
    if user["status"] != "active":
        raise HTTPException(status_code=403, detail="Tài khoản đã bị tạm khóa")
        
    return dict(user)

def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Bạn không có quyền quản trị viên (Admin) để thực hiện thao tác này")
    return current_user
