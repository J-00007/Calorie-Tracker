import streamlit as st
import google.generativeai as genai
from PIL import Image
import os
import json
import datetime

# -----------------------------------------------------------------------------
# 1. Configuration & Setup
# -----------------------------------------------------------------------------
API_KEY = os.environ.get("GEMINI_API_KEY") 
genai.configure(api_key=API_KEY)
MODEL_NAME = 'gemini-1.5-flash' # Using 1.5-flash for speed and reliability

HISTORY_FILE = "meal_history.json"

# -----------------------------------------------------------------------------
# 2. History & Auth Helpers
# -----------------------------------------------------------------------------
def load_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return {}
    return {}

def save_history(username, meal_desc, result_dict):
    history = load_history()
    if username not in history:
        history[username] = []
    
    entry = {
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "meal": meal_desc,
        "result": result_dict
    }
    history[username].insert(0, entry) # Add newest entry to the top
    
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=4)

# -----------------------------------------------------------------------------
# 3. Core Logic Engine
# -----------------------------------------------------------------------------
def analyze_meal(input_data, is_image=False):
    model = genai.GenerativeModel(MODEL_NAME)
    
    system_prompt = """
    You are an expert calorie counter specializing in Indian Cuisine. 
    Analyze the provided food.
    
    Strict Rules:
    1. Calculate ONLY the calories (no protein, carbs, or fat).
    2. Output ONLY a valid JSON object. Do not include markdown formatting or backticks.
    
    Required JSON Format:
    {
      "dish_name": "Name of the Dish",
      "total_calories": 500,
      "breakdown": "- Item 1: 300 kcal\n- Item 2: 200 kcal"
    }
    """
    
    try:
        if is_image:
            response = model.generate_content([system_prompt, input_data])
        else:
            text_payload = f"User meal description: {input_data}"
            response = model.generate_content([system_prompt, text_payload])
            
        raw_text = response.text.strip()
        
        # Strip markdown code blocks if the AI accidentally adds them
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[-1]
            if raw_text.endswith("```"):
                raw_text = raw_text.rsplit("\n", 1)[0]
                
        return json.loads(raw_text)
        
    except Exception as e:
        # Fallback so the app never crashes
        return {
            "dish_name": "Meal Analysis",
            "total_calories": "N/A",
            "breakdown": f"Raw Response:\n{response.text if 'response' in locals() else str(e)}"
        }

# -----------------------------------------------------------------------------
# 4. Streamlit User Interface
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="Indian Cuisine Calorie Tracker",
    page_icon="🍛",
    layout="centered",
)

def inject_css() -> None:
    st.markdown(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Work+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap');

        :root {
            --bg: #1F1610; --paper: #2B2019; --ink: #F5EFE2; --muted: #B8A98C;
            --border: #4A3A2C; --turmeric: #E7B23A; --chili: #D65B3E;
        }

        .stApp, [data-testid="stAppViewContainer"] { background: var(--bg); color: var(--ink); }
        .stApp p, .stApp label, .stApp span, .stApp li { font-family: 'Work Sans', sans-serif; color: var(--ink); }

        .app-header h1 { font-family: 'Fraunces', serif; font-weight: 600; font-size: 2.3rem; margin-bottom: 0.3rem; }
        .app-header p { color: var(--muted); font-size: 1.02rem; margin-bottom: 1.8rem; }

        /* Login Card */
        .login-box { background: var(--paper); padding: 2rem; border-radius: 8px; border: 1px solid var(--border); margin-top: 2rem; }

        /* Result card */
        .result-card { background: var(--paper); border-top: 2px dashed var(--border); border-bottom: 2px dashed var(--border); padding: 1.6rem 1.4rem; margin-top: 1.6rem; }
        .result-dish { font-family: 'Fraunces', serif; font-style: italic; font-weight: 500; font-size: 1.15rem; }
        .result-calories { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 2.6rem; line-height: 1.1; margin: 0.4rem 0 0.5rem 0; color: var(--turmeric); }
        .result-calories span { font-size: 1rem; font-weight: 500; color: var(--muted); margin-left: 0.3rem; }
        
        .result-notes { margin-top: 1rem; font-size: 0.95rem; color: var(--ink); white-space: pre-line; border-top: 1px solid var(--border); padding-top: 1rem;}
        
        /* Buttons */
        .stButton > button[kind="primary"] { background: var(--chili); color: #FFF8F1; border-radius: 999px; }
        </style>
        """,
        unsafe_allow_html=True,
    )

def render_result(result: dict) -> None:
    st.markdown(
        f"""
        <div class="result-card">
          <div class="result-dish">{result.get('dish_name', 'Analyzed Meal')}</div>
          <div class="result-calories">{result.get('total_calories', 'N/A')}<span>kcal</span></div>
          <div class="result-notes">{result.get('breakdown', '')}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

def login_screen():
    st.markdown('<div class="app-header"><h1>🍛 Tracker Login</h1></div>', unsafe_allow_html=True)
    with st.container():
        st.write("Please sign in to view and save your calorie history.")
        user = st.text_input("Username", placeholder="e.g. rahul_99")
        pw = st.text_input("Password", type="password")
        
        if st.button("Login", type="primary"):
            if user.strip() and pw.strip():
                st.session_state['logged_in'] = True
                st.session_state['username'] = user.strip()
                st.rerun()
            else:
                st.error("Please enter a username and password.")

def main(): 
    inject_css()

    # Session State Initialization
    if 'logged_in' not in st.session_state:
        st.session_state['logged_in'] = False
        st.session_state['username'] = ""

    # Route to Login if not authenticated
    if not st.session_state['logged_in']:
        login_screen()
        return

    # Sidebar: History & Logout
    with st.sidebar:
        st.markdown(f"### 👋 Welcome, {st.session_state['username']}")
        if st.button("Logout"):
            st.session_state['logged_in'] = False
            st.session_state['username'] = ""
            st.rerun()
            
        st.divider()
        st.markdown("### 🕒 Recent History")
        user_history = load_history().get(st.session_state['username'], [])
        
        if not user_history:
            st.caption("No meals tracked yet.")
        else:
            for item in user_history[:5]: # Show last 5 entries
                st.markdown(f"**{item['result'].get('dish_name', 'Meal')}**")
                st.caption(f"{item['timestamp']} • {item['result'].get('total_calories', 'N/A')} kcal")
                st.divider()

    # Main App Layout
    st.markdown(
        """
        <div class="app-header">
          <h1>🍛 Indian Cuisine Calorie Tracker</h1>
          <p>Scan a plate, upload a photo, or describe your meal.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    tab1, tab2, tab3 = st.tabs(["Scan Food", "Upload Image", "Describe Meal"])

    with tab1:
        camera_photo = st.camera_input("Take a picture", label_visibility="collapsed")
        if camera_photo and st.button("Calculate", key="btn_scan", type="primary"):
            img = Image.open(camera_photo)
            with st.spinner("Analyzing ingredients..."):
                result = analyze_meal(img, is_image=True)
                save_history(st.session_state['username'], "Camera Scan", result)
            render_result(result)

    with tab2:
        uploaded_file = st.file_uploader("Upload photo", type=["jpg", "jpeg", "png"], label_visibility="collapsed")
        if uploaded_file and st.button("Calculate", key="btn_upload", type="primary"):
            img = Image.open(uploaded_file)
            with st.spinner("Analyzing ingredients..."):
                result = analyze_meal(img, is_image=True)
                save_history(st.session_state['username'], "Image Upload", result)
            render_result(result)

    with tab3:
        meal_text = st.text_area("Describe your meal", placeholder="e.g. 2 rotis and dal makhani", label_visibility="collapsed")
        if st.button("Calculate", key="btn_describe", type="primary", disabled=not meal_text.strip()):
            with st.spinner("Analyzing ingredients..."):
                result = analyze_meal(meal_text, is_image=False)
                save_history(st.session_state['username'], meal_text, result)
            render_result(result)

if __name__ == "__main__":
    main()
