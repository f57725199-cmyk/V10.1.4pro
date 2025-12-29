
import os
import json
from playwright.sync_api import sync_playwright

def verify_mcq_flow():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        page.on("dialog", lambda dialog: dialog.accept())
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        page.goto("http://localhost:3000")
        
        user_json = '{"id":"test-user","name":"Test User","credits":100,"role":"STUDENT","classLevel":"10","board":"CBSE","stream":"Science","isPremium":true}'
        page.evaluate(f"localStorage.setItem('nst_current_user', '{user_json}')")
        page.evaluate("localStorage.setItem('nst_users', JSON.stringify([JSON.parse(localStorage.getItem('nst_current_user'))]))")
        page.evaluate("localStorage.setItem('nst_terms_accepted', 'true')")
        page.evaluate("localStorage.setItem('nst_has_seen_welcome', 'true')")
        page.reload()

        page.wait_for_selector("text=Test User", timeout=10000)
        
        page.get_by_text("My Courses").click()
        page.get_by_role("button", name="Mathematics").last.click() 
        
        page.evaluate("""
            localStorage.setItem('nst_custom_chapters_CBSE-10-Mathematics-English', JSON.stringify([
                {id:'real-numbers', title:'Real Numbers'}
            ]));
        """)
        
        page.reload()
        page.get_by_text("My Courses").click()
        page.get_by_role("button", name="Mathematics").last.click()

        page.wait_for_selector("text=Real Numbers", timeout=10000)
        
        mcq_data = []
        for i in range(55):
            mcq_data.append({
                "question": f"Question {i+1}",
                "options": ["A", "B", "C", "D"],
                "correctAnswer": 0,
                "explanation": f"Explanation for {i+1}"
            })
        
        import json
        final_data_str = json.dumps({"manualMcqData": mcq_data})
        key = "nst_content_CBSE_10_Mathematics_real-numbers" 
        page.evaluate(f"localStorage.setItem('{key}', '{final_data_str}')")

        page.get_by_text("Real Numbers").first.click()
        page.get_by_text("Free Practice").click()
        page.wait_for_selector("text=MCQ Test", timeout=15000)
        
        print("Answering 50 questions on Page 1...")
        for i in range(50):
             page.locator(f"xpath=(//div[contains(@class, 'bg-white p-5 rounded-2xl border')])[{i+1}]//button").first.click()
        
        print("Answered 50 questions. Taking screenshot before Next Page...")
        page.screenshot(path="verification/before_next_page.png")

        # Scroll to bottom just in case
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        
        if page.get_by_text("Next Page").is_visible():
            print("Next Page button is visible. Clicking...")
            page.get_by_text("Next Page").click()
        else:
            print("Next Page button NOT visible!")
            page.screenshot(path="verification/next_page_missing.png")
            raise Exception("Next Page button missing")
        
        page.wait_for_selector("text=Batch 2", timeout=15000)
        page.screenshot(path="verification/mcq_batch_page2_verified.png")
        
        if page.get_by_text("Submit Final").is_visible():
            print("Submit Final is visible")
            page.get_by_text("Submit Final").click()
        elif page.get_by_text("Submit").is_visible():
            print("Submit (Intermediate) is visible - This implies hasMore=True")
            page.get_by_text("Submit").click()
        else:
            print("No Submit button visible!")
            page.screenshot(path="verification/no_submit_btn.png")
        
        # Check for Submit confirmation
        page.wait_for_selector("text=Submit Test?", timeout=5000)
        page.get_by_text("Yes, Submit").click()
        
        # Check for Analysis Unlock
        page.wait_for_selector("text=Unlock Analysis?", timeout=10000)
        page.get_by_text("Unlock Now").click()
        
        page.wait_for_selector("text=Analysis Mode", timeout=10000)
        page.screenshot(path="verification/mcq_analysis_view.png")
        
        browser.close()

if __name__ == "__main__":
    try:
        verify_mcq_flow()
        print("Verification Script Ran Successfully")
    except Exception as e:
        print(f"Verification Failed: {e}")
