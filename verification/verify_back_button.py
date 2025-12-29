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
                "subscriptionLevel": "ULTRA", 
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
            # We want the 2nd one (index 1) for Notes
            page.get_by_text("Physics").nth(1).click()

            page.wait_for_timeout(2000)
            
            # Verify we are in Chapter Selection
            # Looking for "Syllabus & Chapters" or similar header
            if page.get_by_text("Syllabus & Chapters").is_visible():
                print("In Chapter Selection View.")
            else:
                print("WARNING: Not in Chapter Selection?")
                page.screenshot(path="verification/chapter_view_fail.png")

            print("Clicking Back Button...")
            # We need to find the Back button.
            # In ChapterSelection, there is a prop onBack.
            # The component renders an ArrowLeft icon likely.
            # Or text "Back"?
            # Looking at previous screenshot `pdf_view_crash.png`, the back button is top left.
            # It's usually a button with ArrowLeft.
            
            # Let's try to click the first button on the page, or the one with ArrowLeft icon.
            # Or a button with text "Back".
            # The previous UI code for PdfView had a back button.
            # ChapterSelection usually has one too.
            # Let's try to find it.
            
            # Assuming it's the first button in the header.
            # Or use `page.get_by_role("button").first`?
            
            if page.get_by_text("Back").is_visible():
                 page.get_by_text("Back").click()
            else:
                 # Try clicking top left area or first button
                 print("Text 'Back' not found. Clicking first button...")
                 page.get_by_role("button").first.click()

            page.wait_for_timeout(2000)
            
            print("Checking if we are back in My Courses (Study Hub)...")
            # We should see "Notes Library" text again.
            if page.get_by_text("Notes Library").is_visible():
                print("SUCCESS: Returned to Study Hub.")
                page.screenshot(path="verification/back_success.png")
            else:
                print("FAILURE: Did not return to Study Hub. Possible Blank Screen.")
                page.screenshot(path="verification/back_fail.png")
                if page.content().strip() == "<html><head></head><body></body></html>":
                     print("Confirmed: Blank Screen")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    run()
