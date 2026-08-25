#!/usr/bin/env python3
"""
Backend API Test Suite for Grand Aceh Kuliner POS - AI Admin Assistant
Tests the new AI assistant endpoints with real Gemini API integration
"""

import requests
import json
import sys
from typing import Optional, Dict, Any

# Base URL from frontend/.env
BASE_URL = "https://git-sync-hub-4.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_CREDS = {"email": "taqim2609@gmail.com", "password": "GrandAceh#2026"}
KASIR_CREDS = {"email": "kasir@grandaceh.com", "password": "kasir123"}
INPUT_CREDS = {"email": "input@grandaceh.com", "password": "input123"}

# Global tokens
admin_token: Optional[str] = None
kasir_token: Optional[str] = None
input_token: Optional[str] = None

# Track created entities for cleanup
created_entities = {
    "categories": [],
    "vendors": [],
    "payment_methods": [],
    "products": []
}

def print_test(name: str):
    """Print test name"""
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_pass(msg: str):
    """Print pass message"""
    print(f"✅ PASS: {msg}")

def print_fail(msg: str):
    """Print fail message"""
    print(f"❌ FAIL: {msg}")

def print_info(msg: str):
    """Print info message"""
    print(f"ℹ️  INFO: {msg}")

def login(email: str, password: str) -> Optional[str]:
    """Login and return JWT token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("token")  # Backend returns "token" not "access_token"
        else:
            print_fail(f"Login failed for {email}: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print_fail(f"Login exception for {email}: {e}")
        return None

def setup_tokens():
    """Setup all tokens"""
    global admin_token, kasir_token, input_token
    
    print_test("SETUP: Login all users")
    
    admin_token = login(ADMIN_CREDS["email"], ADMIN_CREDS["password"])
    if admin_token:
        print_pass(f"Admin logged in: {admin_token[:20]}...")
    else:
        print_fail("Admin login failed")
        sys.exit(1)
    
    kasir_token = login(KASIR_CREDS["email"], KASIR_CREDS["password"])
    if kasir_token:
        print_pass(f"Kasir logged in: {kasir_token[:20]}...")
    else:
        print_fail("Kasir login failed")
    
    input_token = login(INPUT_CREDS["email"], INPUT_CREDS["password"])
    if input_token:
        print_pass(f"Input logged in: {input_token[:20]}...")
    else:
        print_fail("Input login failed")

def test_auth_rbac():
    """Test 1: AUTH/RBAC - admin only for assistant endpoints"""
    print_test("1. AUTH/RBAC: Admin-only enforcement")
    
    # Test /ai/assistant/chat with kasir token (should be 403)
    print_info("Testing /ai/assistant/chat with kasir token...")
    resp = requests.post(
        f"{BASE_URL}/ai/assistant/chat",
        json={"message": "Test"},
        headers={"Authorization": f"Bearer {kasir_token}"},
        timeout=10
    )
    if resp.status_code == 403:
        print_pass("Kasir blocked from /ai/assistant/chat (403)")
    else:
        print_fail(f"Kasir should get 403, got {resp.status_code}: {resp.text}")
    
    # Test /ai/assistant/chat with input token (should be 403)
    print_info("Testing /ai/assistant/chat with input token...")
    resp = requests.post(
        f"{BASE_URL}/ai/assistant/chat",
        json={"message": "Test"},
        headers={"Authorization": f"Bearer {input_token}"},
        timeout=10
    )
    if resp.status_code == 403:
        print_pass("Input blocked from /ai/assistant/chat (403)")
    else:
        print_fail(f"Input should get 403, got {resp.status_code}: {resp.text}")
    
    # Test /ai/assistant/chat with admin token (should work)
    print_info("Testing /ai/assistant/chat with admin token...")
    resp = requests.post(
        f"{BASE_URL}/ai/assistant/chat",
        json={"message": "Halo"},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30
    )
    if resp.status_code == 200:
        print_pass("Admin can access /ai/assistant/chat (200)")
    else:
        print_fail(f"Admin should get 200, got {resp.status_code}: {resp.text}")
    
    # Test /ai/assistant/apply with kasir token (should be 403)
    print_info("Testing /ai/assistant/apply with kasir token...")
    resp = requests.post(
        f"{BASE_URL}/ai/assistant/apply",
        json={"action": {"type": "create_category", "name": "Test", "kind": "retail"}},
        headers={"Authorization": f"Bearer {kasir_token}"},
        timeout=10
    )
    if resp.status_code == 403:
        print_pass("Kasir blocked from /ai/assistant/apply (403)")
    else:
        print_fail(f"Kasir should get 403, got {resp.status_code}: {resp.text}")
    
    # Test /ai/assistant/apply with input token (should be 403)
    print_info("Testing /ai/assistant/apply with input token...")
    resp = requests.post(
        f"{BASE_URL}/ai/assistant/apply",
        json={"action": {"type": "create_category", "name": "Test", "kind": "retail"}},
        headers={"Authorization": f"Bearer {input_token}"},
        timeout=10
    )
    if resp.status_code == 403:
        print_pass("Input blocked from /ai/assistant/apply (403)")
    else:
        print_fail(f"Input should get 403, got {resp.status_code}: {resp.text}")

def test_get_ai_settings():
    """Test 2: GET /api/settings/ai - verify assistant feature and provider field"""
    print_test("2. GET /api/settings/ai: Verify structure")
    
    resp = requests.get(
        f"{BASE_URL}/settings/ai",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10
    )
    
    if resp.status_code != 200:
        print_fail(f"GET /settings/ai failed: {resp.status_code} - {resp.text}")
        return
    
    data = resp.json()
    print_info(f"Response: {json.dumps(data, indent=2)}")
    
    # Check features exists
    if "features" not in data:
        print_fail("Response missing 'features' key")
        return
    
    features = data["features"]
    
    # Check assistant feature exists
    if "assistant" not in features:
        print_fail("Features missing 'assistant' entry")
        return
    
    print_pass("Features includes 'assistant' entry")
    
    # Check each feature has provider field
    all_have_provider = True
    for feat_name, feat_data in features.items():
        if "provider" not in feat_data:
            print_fail(f"Feature '{feat_name}' missing 'provider' field")
            all_have_provider = False
        else:
            print_info(f"Feature '{feat_name}' has provider: {feat_data['provider']}")
    
    if all_have_provider:
        print_pass("All features include 'provider' field")
    
    # Check assistant provider is gemini (default)
    assistant_provider = features["assistant"].get("provider")
    if assistant_provider == "gemini":
        print_pass(f"Assistant provider is 'gemini' (default): {assistant_provider}")
    else:
        print_info(f"Assistant provider is: {assistant_provider} (expected 'gemini' as default)")

def test_put_ai_settings():
    """Test 3: PUT /api/settings/ai - save and verify provider persistence"""
    print_test("3. PUT /api/settings/ai: Save provider for assistant")
    
    # Save provider=gemini for assistant
    print_info("Setting assistant provider to 'gemini'...")
    resp = requests.put(
        f"{BASE_URL}/settings/ai",
        json={"feature": "assistant", "provider": "gemini"},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10
    )
    
    if resp.status_code != 200:
        print_fail(f"PUT /settings/ai failed: {resp.status_code} - {resp.text}")
        return
    
    data = resp.json()
    if data.get("ok"):
        print_pass("PUT /settings/ai returned ok:true")
    else:
        print_fail(f"PUT /settings/ai returned: {data}")
        return
    
    # Verify persistence with GET
    print_info("Verifying persistence with GET...")
    resp = requests.get(
        f"{BASE_URL}/settings/ai",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10
    )
    
    if resp.status_code != 200:
        print_fail(f"GET /settings/ai failed: {resp.status_code} - {resp.text}")
        return
    
    data = resp.json()
    assistant_provider = data.get("features", {}).get("assistant", {}).get("provider")
    
    if assistant_provider == "gemini":
        print_pass(f"Assistant provider persisted correctly: {assistant_provider}")
    else:
        print_fail(f"Assistant provider not persisted correctly. Expected 'gemini', got: {assistant_provider}")
    
    # Optional: Test setting provider on description feature
    print_info("Testing provider persistence on 'description' feature...")
    resp = requests.put(
        f"{BASE_URL}/settings/ai",
        json={"feature": "description", "provider": "gemini"},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10
    )
    
    if resp.status_code == 200 and resp.json().get("ok"):
        # Verify
        resp = requests.get(
            f"{BASE_URL}/settings/ai",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        desc_provider = resp.json().get("features", {}).get("description", {}).get("provider")
        if desc_provider == "gemini":
            print_pass(f"Description provider also persists correctly: {desc_provider}")

def test_assistant_chat():
    """Test 4: POST /ai/assistant/chat - test with real Gemini API"""
    print_test("4. POST /ai/assistant/chat: Test with Gemini")
    
    # Test chat with a request to create a category
    message = "Tolong buatkan kategori baru bernama Kopi untuk minuman"
    print_info(f"Sending message: '{message}'")
    print_info("NOTE: This will make a REAL call to Google Gemini API (may take a few seconds)...")
    
    resp = requests.post(
        f"{BASE_URL}/ai/assistant/chat",
        json={"message": message},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30
    )
    
    if resp.status_code != 200:
        print_fail(f"POST /ai/assistant/chat failed: {resp.status_code} - {resp.text}")
        return None
    
    data = resp.json()
    print_info(f"Response: {json.dumps(data, indent=2)}")
    
    # Check required fields
    if "session_id" not in data:
        print_fail("Response missing 'session_id'")
        return None
    
    if "reply" not in data:
        print_fail("Response missing 'reply'")
        return None
    
    if "action" not in data:
        print_fail("Response missing 'action'")
        return None
    
    session_id = data["session_id"]
    reply = data["reply"]
    action = data["action"]
    
    print_pass(f"Got session_id: {session_id}")
    print_pass(f"Got reply: {reply[:100]}..." if len(reply) > 100 else f"Got reply: {reply}")
    
    if action:
        print_pass(f"Got action: {json.dumps(action, indent=2)}")
        
        # Verify action structure for create_category
        if action.get("type") == "create_category":
            print_pass("Action type is 'create_category' as expected")
            if "name" in action:
                print_pass(f"Action has 'name': {action['name']}")
            if "kind" in action:
                print_pass(f"Action has 'kind': {action['kind']}")
        else:
            print_info(f"Action type is '{action.get('type')}' (expected 'create_category' but model may vary)")
    else:
        print_info("No action returned (model may not have generated one)")
    
    # Test multi-turn with same session_id
    print_info(f"Testing multi-turn with same session_id: {session_id}")
    resp2 = requests.post(
        f"{BASE_URL}/ai/assistant/chat",
        json={"session_id": session_id, "message": "Terima kasih"},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30
    )
    
    if resp2.status_code == 200:
        data2 = resp2.json()
        if data2.get("session_id") == session_id:
            print_pass(f"Multi-turn works: same session_id returned")
        else:
            print_fail(f"Multi-turn failed: different session_id returned")
    else:
        print_fail(f"Multi-turn request failed: {resp2.status_code} - {resp2.text}")
    
    return action

def test_assistant_apply():
    """Test 5: POST /ai/assistant/apply - test all action types"""
    print_test("5. POST /ai/assistant/apply: Test all action types")
    
    # 5a. Create category
    print_info("5a. Testing create_category...")
    action = {"type": "create_category", "name": "UjiKategoriAI", "kind": "retail"}
    resp = requests.post(
        f"{BASE_URL}/ai/assistant/apply",
        json={"action": action},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10
    )
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok"):
            print_pass(f"create_category success: {data.get('message')}")
            # Get category ID for cleanup
            cat_resp = requests.get(
                f"{BASE_URL}/categories",
                headers={"Authorization": f"Bearer {admin_token}"},
                timeout=10
            )
            if cat_resp.status_code == 200:
                cats = cat_resp.json()
                for cat in cats:
                    if cat.get("name") == "UjiKategoriAI":
                        created_entities["categories"].append(cat["id"])
                        print_info(f"Tracked category ID for cleanup: {cat['id']}")
                        break
        else:
            print_fail(f"create_category returned ok:false - {data}")
    else:
        print_fail(f"create_category failed: {resp.status_code} - {resp.text}")
    
    # 5b. Create vendor
    print_info("5b. Testing create_vendor...")
    action = {"type": "create_vendor", "name": "UjiVendorAI"}
    resp = requests.post(
        f"{BASE_URL}/ai/assistant/apply",
        json={"action": action},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10
    )
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok"):
            print_pass(f"create_vendor success: {data.get('message')}")
            # Get vendor ID for cleanup
            vendor_resp = requests.get(
                f"{BASE_URL}/vendors",
                headers={"Authorization": f"Bearer {admin_token}"},
                timeout=10
            )
            if vendor_resp.status_code == 200:
                vendors = vendor_resp.json()
                for vendor in vendors:
                    if vendor.get("name") == "UjiVendorAI":
                        created_entities["vendors"].append(vendor["id"])
                        print_info(f"Tracked vendor ID for cleanup: {vendor['id']}")
                        break
        else:
            print_fail(f"create_vendor returned ok:false - {data}")
    else:
        print_fail(f"create_vendor failed: {resp.status_code} - {resp.text}")
    
    # 5c. Create payment method
    print_info("5c. Testing create_payment_method...")
    action = {"type": "create_payment_method", "name": "UjiQRIS_AI", "pm_type": "qris"}
    resp = requests.post(
        f"{BASE_URL}/ai/assistant/apply",
        json={"action": action},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10
    )
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok"):
            print_pass(f"create_payment_method success: {data.get('message')}")
            # Get payment method ID for cleanup
            pm_resp = requests.get(
                f"{BASE_URL}/payment-methods",
                headers={"Authorization": f"Bearer {admin_token}"},
                timeout=10
            )
            if pm_resp.status_code == 200:
                pms = pm_resp.json()
                for pm in pms:
                    if pm.get("name") == "UjiQRIS_AI":
                        created_entities["payment_methods"].append(pm["id"])
                        print_info(f"Tracked payment method ID for cleanup: {pm['id']}")
                        break
        else:
            print_fail(f"create_payment_method returned ok:false - {data}")
    else:
        print_fail(f"create_payment_method failed: {resp.status_code} - {resp.text}")
    
    # 5d. Create product
    print_info("5d. Testing create_product...")
    action = {
        "type": "create_product",
        "name": "UjiProdukAI",
        "price": 12345,
        "kind": "retail",
        "category_name": "UjiKategoriAI"
    }
    resp = requests.post(
        f"{BASE_URL}/ai/assistant/apply",
        json={"action": action},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10
    )
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok"):
            print_pass(f"create_product success: {data.get('message')}")
            # Get product ID for cleanup
            prod_resp = requests.get(
                f"{BASE_URL}/products",
                headers={"Authorization": f"Bearer {admin_token}"},
                timeout=10
            )
            if prod_resp.status_code == 200:
                products = prod_resp.json()
                for prod in products:
                    if prod.get("name") == "UjiProdukAI":
                        created_entities["products"].append(prod["id"])
                        print_info(f"Tracked product ID for cleanup: {prod['id']}")
                        # Verify SKU was generated
                        if prod.get("sku"):
                            print_pass(f"Product has generated SKU: {prod['sku']}")
                        break
        else:
            print_fail(f"create_product returned ok:false - {data}")
    else:
        print_fail(f"create_product failed: {resp.status_code} - {resp.text}")
    
    # 5e. Update product
    print_info("5e. Testing update_product...")
    action = {"type": "update_product", "name": "UjiProdukAI", "price": 15000}
    resp = requests.post(
        f"{BASE_URL}/ai/assistant/apply",
        json={"action": action},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10
    )
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok"):
            print_pass(f"update_product success: {data.get('message')}")
            # Verify price was updated
            prod_resp = requests.get(
                f"{BASE_URL}/products",
                headers={"Authorization": f"Bearer {admin_token}"},
                timeout=10
            )
            if prod_resp.status_code == 200:
                products = prod_resp.json()
                for prod in products:
                    if prod.get("name") == "UjiProdukAI":
                        if prod.get("price") == 15000:
                            print_pass(f"Product price updated correctly to 15000")
                        else:
                            print_fail(f"Product price not updated. Expected 15000, got {prod.get('price')}")
                        break
        else:
            print_fail(f"update_product returned ok:false - {data}")
    else:
        print_fail(f"update_product failed: {resp.status_code} - {resp.text}")

def test_validation():
    """Test 6: Validation - duplicate, not found, unknown action"""
    print_test("6. Validation: Test error cases")
    
    # 6a. Duplicate category
    print_info("6a. Testing duplicate category (should get 400)...")
    action = {"type": "create_category", "name": "UjiKategoriAI", "kind": "retail"}
    resp = requests.post(
        f"{BASE_URL}/ai/assistant/apply",
        json={"action": action},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10
    )
    
    if resp.status_code == 400:
        print_pass(f"Duplicate category rejected with 400: {resp.json().get('detail')}")
    else:
        print_fail(f"Duplicate category should return 400, got {resp.status_code}: {resp.text}")
    
    # 6b. Update non-existent product
    print_info("6b. Testing update non-existent product (should get 404)...")
    action = {"type": "update_product", "name": "TidakAdaProdukXYZ", "price": 10}
    resp = requests.post(
        f"{BASE_URL}/ai/assistant/apply",
        json={"action": action},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10
    )
    
    if resp.status_code == 404:
        print_pass(f"Non-existent product rejected with 404: {resp.json().get('detail')}")
    else:
        print_fail(f"Non-existent product should return 404, got {resp.status_code}: {resp.text}")
    
    # 6c. Unknown action type
    print_info("6c. Testing unknown action type (should get 400)...")
    action = {"type": "unknown_x"}
    resp = requests.post(
        f"{BASE_URL}/ai/assistant/apply",
        json={"action": action},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10
    )
    
    if resp.status_code == 400:
        print_pass(f"Unknown action type rejected with 400: {resp.json().get('detail')}")
    else:
        print_fail(f"Unknown action type should return 400, got {resp.status_code}: {resp.text}")

def cleanup():
    """Test 7: Cleanup - delete all test entities"""
    print_test("7. CLEANUP: Delete all test entities")
    
    # Delete products
    for prod_id in created_entities["products"]:
        print_info(f"Deleting product {prod_id}...")
        resp = requests.delete(
            f"{BASE_URL}/products/{prod_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        if resp.status_code == 200:
            print_pass(f"Product {prod_id} deleted")
        else:
            print_fail(f"Failed to delete product {prod_id}: {resp.status_code} - {resp.text}")
    
    # Delete categories
    for cat_id in created_entities["categories"]:
        print_info(f"Deleting category {cat_id}...")
        resp = requests.delete(
            f"{BASE_URL}/categories/{cat_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        if resp.status_code == 200:
            print_pass(f"Category {cat_id} deleted")
        else:
            print_fail(f"Failed to delete category {cat_id}: {resp.status_code} - {resp.text}")
    
    # Delete vendors
    for vendor_id in created_entities["vendors"]:
        print_info(f"Deleting vendor {vendor_id}...")
        resp = requests.delete(
            f"{BASE_URL}/vendors/{vendor_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        if resp.status_code == 200:
            print_pass(f"Vendor {vendor_id} deleted")
        else:
            print_fail(f"Failed to delete vendor {vendor_id}: {resp.status_code} - {resp.text}")
    
    # Payment methods - check if delete endpoint exists
    for pm_id in created_entities["payment_methods"]:
        print_info(f"Attempting to delete payment method {pm_id}...")
        resp = requests.delete(
            f"{BASE_URL}/payment-methods/{pm_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        if resp.status_code == 200:
            print_pass(f"Payment method {pm_id} deleted")
        elif resp.status_code == 404 or resp.status_code == 405:
            print_info(f"Payment method delete endpoint not available (status {resp.status_code}). Leaving payment method in DB.")
        else:
            print_fail(f"Failed to delete payment method {pm_id}: {resp.status_code} - {resp.text}")
    
    print_pass("Cleanup completed")

def main():
    """Main test runner"""
    print("\n" + "="*80)
    print("AI ADMIN ASSISTANT BACKEND TEST SUITE")
    print("Testing Grand Aceh Kuliner POS - AI Assistant with Gemini API")
    print("="*80)
    
    try:
        # Setup
        setup_tokens()
        
        # Run tests
        test_auth_rbac()
        test_get_ai_settings()
        test_put_ai_settings()
        chat_action = test_assistant_chat()
        test_assistant_apply()
        test_validation()
        
        # Cleanup
        cleanup()
        
        print("\n" + "="*80)
        print("ALL TESTS COMPLETED")
        print("="*80)
        
        if chat_action:
            print("\n📋 ACTION RETURNED BY CHAT:")
            print(json.dumps(chat_action, indent=2))
        
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
