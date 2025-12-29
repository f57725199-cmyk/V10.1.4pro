from playwright.sync_api import sync_playwright
import json

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a mobile viewport
        context = browser.new_context(viewport={'width': 375, 'height': 812})
        page = context.new_page()

        try:
            print("Navigating to app...")
            page.goto("http://localhost:5003/")
            page.wait_for_timeout(2000)

            print("Injecting mock user into localStorage...")
            
            mock_user = {
                "id": "test_student",
                "name": "Test Student",
                "role": "STUDENT",
                "credits": 100,
                "isPremium": True,
                "board": "CBSE",
                "classLevel": "12",
                "stream": "Science",
                "mobile": "1234567890",
                "email": "test@test.com",
                "password": "password",
                "createdAt": "2023-01-01",
                "streak": 0,
                "lastLoginDate": "2023-01-01",
                "redeemedCodes": [],
                "progress": {},
                "isAutoDeductEnabled": False,
                "subscriptionLevel": "ULTRA", # Ensure access
                "subscriptionEndDate": "2025-01-01T00:00:00.000Z"
            }

            page.evaluate(f"""() => {{
                localStorage.setItem('nst_current_user', '{json.dumps(mock_user)}');
                localStorage.setItem('nst_terms_accepted', 'true');
                localStorage.setItem('nst_has_seen_welcome', 'true');
            }}""")

            print("Reloading page to apply login...")
            page.reload()
            page.wait_for_timeout(3000)

            print("Checking for My Courses (Dashboard)...")
            try:
                page.wait_for_selector("text=My Courses", timeout=10000)
                print("Dashboard loaded successfully.")
            except:
                print("Dashboard not found. Taking screenshot.")
                page.screenshot(path="verification/dashboard_fail.png")
                raise Exception("Dashboard failed to load")

            print("Navigating to My Courses...")
            page.get_by_text("My Courses").click()
            page.wait_for_timeout(1000)
            
            print("Selecting Subject (Physics) from Notes Library...")
            # Video is 1st, Notes is 2nd, MCQ is 3rd
            # We want the 2nd one (index 1)
            page.get_by_text("Physics").nth(1).click()

            page.wait_for_timeout(2000)
            
            print("Selecting Chapter...")
            # Click specific chapter title shown in screenshot
            if page.get_by_text("Electric Charges and Fields").is_visible():
                print("Found Electric Charges and Fields. Clicking...")
                page.get_by_text("Electric Charges and Fields").click()
            else:
                 # Fallback
                 print("Specific chapter not found. Trying text=CH")
                 page.locator("text=CH").first.click()

            page.wait_for_timeout(5000) # Wait for PDF view to load
            
            print("Taking screenshot of PDF View...")
            page.screenshot(path="verification/pdf_view_verification.png")
            
            # Verification Logic
            # The fixed PdfView should show "Free Notes" and "Premium Notes" buttons
            if page.get_by_text("Free Notes").is_visible():
                print("SUCCESS: PDF View loaded.")
            else:
                print("WARNING: 'Free Notes' not found. Possible crash or wrong view.")
                page.screenshot(path="verification/pdf_view_crash.png")
                
                # Check if we are in Video view by mistake
                if page.get_by_text("Video Lectures").is_visible():
                    print("ERROR: Landed in Video Lectures view instead of PDF View.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    run()
