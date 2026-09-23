from fastapi.testclient import TestClient


client = TestClient(app)

def run_tests():
    print("=== STARTING BACKEND API TESTS ===")
    
    # 1. Root & Shifts templates
    r = client.get("/api/shifts/templates")
    assert r.status_code == 200, f"Templates failed: {r.text}"
    templates = r.json()
    assert len(templates) == 6, f"Expected 6 shifts, got {len(templates)}"
    print(f"[PASS] 6 standard shifts verified: {[s['name'] + ' (' + s['label'] + ')' for s in templates]}")

    # 2. Login Admin
    r = client.post("/api/auth/login", json={"username": "admin", "password": "wrongpassword"})
    assert r.status_code == 400
    r = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200
    admin_data = r.json()
    admin_token = admin_data["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS] Admin login successful")

    # 3. Login Staff
    r = client.post("/api/auth/login", json={"username": "nv_an", "password": "123456"})
    assert r.status_code == 200
    staff_data = r.json()
    staff_token = staff_data["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    print("[PASS] Staff login successful")

    # 4. Admin creates new Staff account
    new_user_payload = {
        "username": "nv_cuong",
        "password": "password123",
        "full_name": "Đặng Quốc Cường",
        "email": "[EMAIL_ADDRESS]",
        "phone": "0933445566",
        "role": "staff",
        "department": "Bộ phận Hỗ trợ kỹ thuật"
    }
    r = client.post("/api/users", json=new_user_payload, headers=admin_headers)
    assert r.status_code in [200, 400] # Might already exist if rerun
    print("[PASS] User creation test passed")

    # 5. Staff registers for Shift 1 on 2026-09-22
    client.delete("/api/shifts/register?shift_id=1&work_date=2026-09-22", headers=staff_headers)
    r = client.post("/api/shifts/register", json={
        "shift_id": 1,
        "work_date": "2026-09-22",
        "note": "Trực sáng ca 1"
    }, headers=staff_headers)
    assert r.status_code == 200
    print("[PASS] Shift 1 registration succeeded")

    # 6. Staff creates Shift Note (báo bận đột xuất 8h-9h thay vì 8h-10h)
    r = client.post("/api/shift-notes", json={
        "shift_id": 1,
        "work_date": "2026-09-22",
        "original_time": "08:00 - 10:00",
        "adjusted_time": "08:00 - 09:00",
        "reason": "Em bị trùng tiết thi giữa kỳ lúc 9h15 ở trường, nên chỉ trực được từ 8h đến 9h ạ",
        "note_type": "adjusted_hours"
    }, headers=staff_headers)
    assert r.status_code == 200
    note_id = r.json()["note_id"]
    print(f"[PASS] Created shift adjustment note ID {note_id}")

    # 7. Admin updates status of the Shift Note
    r = client.put(f"/api/shift-notes/{note_id}/status", json={
        "status": "approved",
        "admin_response": "Quản lý đã duyệt. Đã cử bạn Bình hỗ trợ ca từ 9h-10h."
    }, headers=admin_headers)
    assert r.status_code == 200
    print("[PASS] Admin approved shift note")

    # 8. Admin publishes schedule with Email and App notification
    r = client.post("/api/shifts/publish", json={
        "week_start": "2026-09-22",
        "send_email": True,
        "announcement": "Lịch làm việc tuần mới đã cập nhật đầy đủ 6 ca!"
    }, headers=admin_headers)
    assert r.status_code == 200
    publish_res = r.json()
    assert publish_res["notification_created"] is True
    print(f"[PASS] Published schedule, emails generated: {publish_res['emails_sent']}")

    # 9. Verify Email Outbox
    r = client.get("/api/emails/outbox", headers=admin_headers)
    assert r.status_code == 200
    outbox = r.json()
    assert len(outbox) > 0
    print(f"[PASS] Email outbox verified: {len(outbox)} emails recorded")

    # 10. Staff checks notifications
    r = client.get("/api/notifications", headers=staff_headers)
    assert r.status_code == 200
    notifs = r.json()
    assert len(notifs) > 0
    print(f"[PASS] Staff notifications received: {len(notifs)} items")

    # 11. Company feedback
    r = client.post("/api/feedbacks", json={
        "title": "Nước uống tại phòng trực",
        "content": "Bình nước lọc phòng trực lầu 1 đã hết, nhờ công ty đổi bình mới.",
        "category": "facilities",
        "is_anonymous": False
    }, headers=staff_headers)
    assert r.status_code == 200
    fb_id = r.json()["feedback_id"]

    # Toggle like
    r = client.post(f"/api/feedbacks/{fb_id}/like", headers=admin_headers)
    assert r.status_code == 200

    # Admin replies
    r = client.post(f"/api/feedbacks/{fb_id}/reply", json={
        "admin_reply": "Đã đổi bình nước mới lúc 14h chiều nay.",
        "status": "resolved"
    }, headers=admin_headers)
    assert r.status_code == 200
    print("[PASS] Feedback creation, like, and admin reply tested successfully")

    print("\nALL BACKEND API TESTS PASSED WITH 100% SUCCESS!")

if __name__ == "__main__":
    run_tests()
