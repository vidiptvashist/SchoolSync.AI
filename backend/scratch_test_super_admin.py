import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_flow():
    print("=== Running Super Admin Endpoint Verification Tests ===")

    # Clean up existing test data from previous runs
    from sqlalchemy import create_engine, text
    db_url = "postgresql://vidiptvashist@localhost:5432/schoolvoice"
    engine = create_engine(db_url)
    with engine.connect() as conn:
        with conn.begin():
            # Find school IDs
            res = conn.execute(text("SELECT id FROM schools WHERE name LIKE 'Beta Academy%'"))
            school_ids = [row[0] for row in res.all()]
            if school_ids:
                # Delete associated users
                conn.execute(text("DELETE FROM users WHERE school_id IN :ids"), {"ids": tuple(school_ids)})
                # Delete associated call logs if any
                conn.execute(text("DELETE FROM call_logs WHERE school_id IN :ids"), {"ids": tuple(school_ids)})
                # Delete schools
                conn.execute(text("DELETE FROM schools WHERE id IN :ids"), {"ids": tuple(school_ids)})
            # Delete user if orphan
            conn.execute(text("DELETE FROM users WHERE email = 'beta_admin@example.com'"))
            print("Database cleaned up of 'Beta Academy' test records.")

    # 1. Login as Super Admin
    login_url = f"{BASE_URL}/super-admin/auth/login"
    login_payload = {
        "email": "superadmin@example.com",
        "password": "superpassword123"
    }
    print("1. Logging in as Super Admin...")
    r = requests.post(login_url, json=login_payload)
    if r.status_code != 200:
        print(f"Failed to log in: {r.status_code} - {r.text}")
        sys.exit(1)
    
    login_data = r.json()
    token = login_data["access_token"]
    role = login_data["role"]
    school_id = login_data["school_id"]
    print(f"Logged in successfully. Role: {role}, School ID: {school_id}")
    assert role == "super_admin"
    assert school_id is None

    headers = {
        "Authorization": f"Bearer {token}"
    }

    # 2. Get all schools
    schools_url = f"{BASE_URL}/super-admin/schools"
    print("\n2. Fetching all schools...")
    r = requests.get(schools_url, headers=headers)
    if r.status_code != 200:
        print(f"Failed to fetch schools: {r.status_code} - {r.text}")
        sys.exit(1)
    
    schools = r.json()
    print(f"Found {len(schools)} schools.")
    for s in schools:
        print(f"- School: {s['name']}, City: {s['city']}, Active: {s['is_active']}, Stats: {s['stats']}")

    # 3. Create a new school + its admin
    print("\n3. Creating new school 'Beta Academy'...")
    create_url = f"{BASE_URL}/super-admin/schools"
    create_payload = {
        "school_name": "Beta Academy",
        "city": "San Francisco",
        "exotel_number": "0119876543",
        "admin_email": "beta_admin@example.com",
        "admin_name": "Beta Admin User"
    }
    r = requests.post(create_url, json=create_payload, headers=headers)
    if r.status_code != 200:
        print(f"Failed to create school: {r.status_code} - {r.text}")
        sys.exit(1)

    create_data = r.json()
    new_school_id = create_data["school"]["id"]
    admin_email = create_data["admin_user"]["email"]
    generated_password = create_data["generated_password"]
    print(f"School created! ID: {new_school_id}")
    print(f"Admin Email: {admin_email}, Temp Password: {generated_password}")
    assert len(generated_password) == 12

    # 4. Get school detail
    detail_url = f"{BASE_URL}/super-admin/schools/{new_school_id}"
    print(f"\n4. Fetching details for school {new_school_id}...")
    r = requests.get(detail_url, headers=headers)
    if r.status_code != 200:
        print(f"Failed to fetch school details: {r.status_code} - {r.text}")
        sys.exit(1)
    
    detail_data = r.json()
    print(f"Detail name: {detail_data['name']}, Admins count: {len(detail_data['admins'])}, Monthly Volume count: {len(detail_data['monthly_volume'])}")
    assert detail_data["name"] == "Beta Academy"

    # 5. Patch school details
    print("\n5. Updating school details (changing city)...")
    patch_url = f"{BASE_URL}/super-admin/schools/{new_school_id}"
    patch_payload = {
        "city": "Los Angeles"
    }
    r = requests.patch(patch_url, json=patch_payload, headers=headers)
    if r.status_code != 200:
        print(f"Failed to update school details: {r.status_code} - {r.text}")
        sys.exit(1)
    print(f"Updated school details: City is now {r.json()['city']}")
    assert r.json()["city"] == "Los Angeles"

    # 6. Deactivate the school
    print("\n6. Deactivating the school...")
    status_url = f"{BASE_URL}/super-admin/schools/{new_school_id}/status"
    status_payload = {"is_active": False}
    r = requests.patch(status_url, json=status_payload, headers=headers)
    if r.status_code != 200:
        print(f"Failed to deactivate school: {r.status_code} - {r.text}")
        sys.exit(1)
    print(f"Deactivated. Status is_active: {r.json()['is_active']}")
    assert r.json()["is_active"] is False

    # 7. Try regular login as deactivated school admin
    print("\n7. Attempting login as deactivated school admin...")
    admin_login_url = f"{BASE_URL}/auth/login"
    admin_login_payload = {
        "email": admin_email,
        "password": generated_password
    }
    r = requests.post(admin_login_url, json=admin_login_payload)
    print(f"Status code: {r.status_code}, Response detail: {r.json().get('detail')}")
    assert r.status_code == 403
    assert "deactivated" in r.json().get("detail", "").lower()

    # 8. Reactivate school
    print("\n8. Reactivating school...")
    status_payload = {"is_active": True}
    r = requests.patch(status_url, json=status_payload, headers=headers)
    assert r.status_code == 200
    assert r.json()["is_active"] is True

    # 9. Login again
    print("\n9. Attempting login as reactivated school admin...")
    r = requests.post(admin_login_url, json=admin_login_payload)
    if r.status_code != 200:
        print(f"Failed to login: {r.status_code} - {r.text}")
        sys.exit(1)
    admin_login_data = r.json()
    admin_token = admin_login_data["access_token"]
    print(f"Login success! Role: {admin_login_data['role']}, School: {admin_login_data['school_id']}")
    assert admin_login_data["role"] == "school_admin"
    assert admin_login_data["school_id"] == new_school_id

    # 9.2 Test mid-session deactivation and immediate cache eviction
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("9.2 Verifying normal access works for active admin...")
    r_test = requests.get(f"{BASE_URL}/students", headers=admin_headers)
    assert r_test.status_code == 200

    print("9.3 Deactivating school mid-session...")
    status_payload = {"is_active": False}
    requests.patch(status_url, json=status_payload, headers=headers)

    print("9.4 Verifying mid-session access is blocked immediately...")
    r_test2 = requests.get(f"{BASE_URL}/students", headers=admin_headers)
    print(f"Status code: {r_test2.status_code}, detail: {r_test2.json().get('detail')}")
    assert r_test2.status_code == 403
    assert "deactivated" in r_test2.json().get("detail", "").lower()

    print("9.5 Reactivating school for subsequent tests...")
    status_payload = {"is_active": True}
    requests.patch(status_url, json=status_payload, headers=headers)

    # 10. Test Super Admin bypass (GET /students?school_id=...)
    # First, let's find the Test Academy school id to get students from it
    print("\n10. Finding Test Academy ID...")
    r = requests.get(schools_url, headers=headers)
    test_academy_id = None
    for s in r.json():
        if "Test Academy" in s["name"]:
            test_academy_id = s["id"]
            break
    
    if test_academy_id:
        print(f"Test Academy ID found: {test_academy_id}. Testing bypass...")
        students_url = f"{BASE_URL}/students?school_id={test_academy_id}"
        r = requests.get(students_url, headers=headers)
        if r.status_code != 200:
            print(f"Bypass failed: {r.status_code} - {r.text}")
            sys.exit(1)
        print(f"Bypass succeeded! Retrieved students: {len(r.json())}")
    else:
        print("Test Academy ID not found, skipping bypass test.")

    # 11. Soft delete the school
    print("\n11. Soft-deleting the school...")
    delete_url = f"{BASE_URL}/super-admin/schools/{new_school_id}"
    r = requests.delete(delete_url, headers=headers)
    if r.status_code != 200:
        print(f"Failed to soft delete: {r.status_code} - {r.text}")
        sys.exit(1)
    print(f"Delete response: {r.json()}")

    # Fetch school details again to verify soft deleted name and is_active=False
    print("Verifying school is inactive and name updated...")
    r = requests.get(detail_url, headers=headers)
    detail_data = r.json()
    print(f"Name after deletion: {detail_data['name']}, Active: {detail_data['is_active']}")
    assert detail_data["is_active"] is False
    assert "_deleted_" in detail_data["name"]

    print("\n=== All Tests Passed Successfully! ===")

if __name__ == "__main__":
    test_flow()
