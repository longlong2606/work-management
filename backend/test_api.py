"""
WorkShiftPro API Verification Test Script
Tests against live C# ASP.NET Core (.NET 10) Backend on http://127.0.0.1:8000
Uses only standard library (urllib, json) with 0 external dependencies.
"""
import urllib.request
import urllib.error
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

def request(path, method="GET", data=None, token=None):
    url = BASE_URL + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            return response.status, json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = {"error": err_body}
        return e.code, parsed

def run_tests():
    print("=== STARTING C# .NET 10 BACKEND VERIFICATION ===")

    # 1. Health & 9 Shifts Templates
    code, data = request("/")
    assert code == 200, f"Root endpoint failed: {code}"
    print(f"[PASS] Root Health check OK: {data.get('service')}, shifts_count={data.get('shifts_count')}")

    code, shifts = request("/api/shifts/templates")
    assert code == 200, f"Shifts templates failed: {code}"
    assert len(shifts) == 9, f"Expected 9 shifts, got {len(shifts)}"
    print("[PASS] Verified 9 standard shifts:")
    for s in shifts:
        print(f"       Ca {s['id']}: {s['start_time']} - {s['end_time']} ({s['label']})")

    # 2. Staff & Admin Login
    code, staff_login = request("/api/auth/login", method="POST", data={"username": "nv_an", "password": "123456"})
    assert code == 200, f"Staff login failed: {code} {staff_login}"
    staff_token = staff_login["access_token"]
    staff_user = staff_login["user"]
    print(f"[PASS] Staff login successful: {staff_user['full_name']} ({staff_user['role']})")

    code, admin_login = request("/api/auth/login", method="POST", data={"username": "admin", "password": "admin123"})
    assert code == 200, f"Admin login failed: {code} {admin_login}"
    admin_token = admin_login["access_token"]
    print(f"[PASS] Admin login successful: {admin_login['user']['full_name']} ({admin_login['user']['role']})")

    # 3. Clean up test date
    test_date = "2026-09-25"
    for sid in range(1, 10):
        request(f"/api/shifts/register?shift_id={sid}&work_date={test_date}&user_id={staff_user['id']}", method="DELETE", token=admin_token)

    # 4. Staff registers Ca 2
    code, reg_res = request("/api/shifts/register", method="POST", data={
        "shift_id": 2,
        "work_date": test_date,
        "note": "??ng k? ca 2 (09:35 - 11:05)"
    }, token=staff_token)
    assert code == 200, f"Shift register failed: {code} {reg_res}"
    reg_id = reg_res["registration_id"]
    print(f"[PASS] Staff registered for Shift 2: reg_id={reg_id}")

    # 5. Verify direct delete by staff is BLOCKED (400 - requires manager approval)
    del_code, del_err = request(f"/api/shifts/register?shift_id=2&work_date={test_date}", method="DELETE", token=staff_token)
    assert del_code == 400, f"Direct delete by staff should be 400, got {del_code}"
    print(f"[PASS] Direct delete correctly blocked with 400: {del_err.get('detail')}")

    # 6. Staff submits cancellation request with reason
    code, cancel_req = request("/api/shifts/request-cancel", method="POST", data={
        "registration_id": reg_id,
        "shift_id": 2,
        "work_date": test_date,
        "reason": "B?n vi?c ??t xu?t c?n ngh? ca"
    }, token=staff_token)
    assert code == 200, f"Request cancel failed: {code} {cancel_req}"
    print(f"[PASS] Cancellation request submitted: {cancel_req.get('message')}")

    # 7. Admin checks pending requests and approves
    code, pending = request("/api/shifts/pending-requests", method="GET", token=admin_token)
    assert code == 200, f"Pending requests failed: {code}"
    assert any(p["id"] == reg_id for p in pending), "Registration should be in pending list"
    print(f"[PASS] Pending list contains request (total pending: {len(pending)})")

    code, approve_res = request("/api/shifts/approve-request", method="POST", data={
        "registration_id": reg_id,
        "action": "approve"
    }, token=admin_token)
    assert code == 200, f"Approve cancel failed: {code} {approve_res}"
    print(f"[PASS] Admin approved cancellation: {approve_res.get('message')}")

    # 8. Test Change Shift Workflow
    code, reg_ch = request("/api/shifts/register", method="POST", data={
        "shift_id": 1,
        "work_date": test_date,
        "note": "??ng k? ca 1"
    }, token=staff_token)
    reg_ch_id = reg_ch["registration_id"]

    code, change_req = request("/api/shifts/request-change", method="POST", data={
        "registration_id": reg_ch_id,
        "current_shift_id": 1,
        "current_work_date": test_date,
        "target_shift_id": 4,
        "target_work_date": test_date,
        "reason": "Tr?ng l?ch h?c th?c h?nh, xin ??i sang ca chi?u"
    }, token=staff_token)
    assert code == 200, f"Request change failed: {code} {change_req}"

    code, approve_ch = request("/api/shifts/approve-request", method="POST", data={
        "registration_id": reg_ch_id,
        "action": "approve"
    }, token=admin_token)
    assert code == 200, f"Approve change failed: {code} {approve_ch}"
    print(f"[PASS] Admin approved shift change: {approve_ch.get('message')}")

    # 9. Audit Log / History verification
    code, history = request("/api/shifts/history", method="GET", token=staff_token)
    assert code == 200, f"Get shift history failed: {code} {history}"
    actions = [h["action"] for h in history]
    assert "APPROVED_CANCEL" in actions and "APPROVED_CHANGE" in actions
    print(f"[PASS] Audit Log verified ({len(history)} entries). Latest events:")
    for h in history[:4]:
        print(f"       [{h['action']}] {h['full_name']} | {h['shift_name']} ({h['shift_label']}) | Date: {h['work_date']} | Note: {h['note']}")

    # 10. Shift Notes (B?o b?n ??t xu?t)
    code, note_res = request("/api/shift-notes", method="POST", data={
        "shift_id": 1,
        "work_date": test_date,
        "original_time": "08:00 - 09:30",
        "adjusted_time": "08:30 - 09:30",
        "reason": "K?t xe do m?a l?n, xin ??n mu?n 30 ph?t",
        "note_type": "adjusted_hours"
    }, token=staff_token)
    assert code == 200, f"Shift note creation failed: {code} {note_res}"
    note_id = note_res["note_id"]

    code, note_app = request(f"/api/shift-notes/{note_id}/status", method="PUT", data={
        "status": "approved",
        "admin_response": "?? duy?t, b?n ch? ? an to?n."
    }, token=admin_token)
    assert code == 200, f"Approve note failed: {code} {note_app}"
    print(f"[PASS] Admin approved shift note {note_id}")

    # 11. Admin publishes weekly schedule
    code, pub_res = request("/api/shifts/publish", method="POST", data={
        "week_start": "2026-09-22",
        "send_email": True,
        "announcement": "Th?ng b?o 9 ca l?m vi?c m?i theo khung gi? chu?n."
    }, token=admin_token)
    assert code == 200, f"Publish schedule failed: {code} {pub_res}"
    print(f"[PASS] Published schedule successfully. Emails sent: {pub_res.get('emails_sent')}")

    # 12. Email Outbox & Staff Notifications
    code, emails = request("/api/emails/outbox", method="GET", token=admin_token)
    assert code == 200, f"Outbox failed: {code}"
    print(f"[PASS] Email outbox verified ({len(emails)} emails logged)")

    code, notifs = request("/api/notifications", method="GET", token=staff_token)
    assert code == 200, f"Notifications failed: {code}"
    print(f"[PASS] Staff notifications verified ({len(notifs)} notifications)")

    print("\nALL 12 TESTS PASSED! C# .NET 10 BACKEND IS 100% OPERATIONAL WITH APPROVAL WORKFLOW!")

if __name__ == "__main__":
    run_tests()
