import streamlit as st
import google.generativeai as genai
from PIL import Image
import os
import json
import datetime
import re

# -----------------------------------------------------------------------------
# 1. Configuration & Setup
# -----------------------------------------------------------------------------
API_KEY = os.environ.get("GEMINI_API_KEY") 
genai.configure(api_key=API_KEY)

# AI Model
MODEL_NAME = 'gemini-3.6-flash' 

HISTORY_FILE = "meal_history.json"

# -----------------------------------------------------------------------------
# 2. History Helpers (Simplified for single-user/global view)
# -----------------------------------------------------------------------------
def load_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r") as f:
            try:
                data = json.load(f)
                # Ensure it returns a list (handles previous dict-based format if needed)
                return data if isinstance(data, list) else []
            except json.JSONDecodeError:
                return []
    return []

def save_history(meal_desc, result_dict):
    history = load_history()
    
    entry = {
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "meal": meal_desc,
        "result": result_dict
    }
    history.insert(0, entry) # Add newest entry to the top
    
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
    2. Output ONLY a valid JSON object. Do not include markdown formatting or extra text.
    
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
            
        # Extract JSON even if the AI adds markdown blocks
        raw_text = response.text.strip()
        clean_json = re.sub(r'```(?:json)?\n?(.*?)\n?```', r'\1', raw_text, flags=re.DOTALL).strip()
        return json.loads(clean_json)
        
    except Exception as e:
        return {
            "dish_name": "Analysis Error",
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

def render_result(result: dict) -> None:
    st.success("Analysis Complete!")
    st.subheader(result.get('dish_name', 'Analyzed Meal'))
    st.metric(label="Total Calories", value=f"{result.get('total_calories', 'N/A')} kcal")
    
    with st.expander("View Calorie Breakdown", expanded=True):
        st.markdown(result.get('breakdown', 'No breakdown available.'))

def main(): 
    # Sidebar: History
    with st.sidebar:
        st.write("### 🕒 Recent History")
        history = load_history()
        
        if not history:
            st.info("No meals tracked yet.")
        else:
            for item in history[:10]: # Show last 10 entries
                st.markdown(f"**{item['result'].get('dish_name', 'Meal')}**")
                st.caption(f"{item['timestamp']} • {item['result'].get('total_calories', 'N/A')} kcal")
                st.divider()

    # Main App Layout
    st.title("🍛 Indian Cuisine Calorie Tracker")
    st.write("Scan a plate, upload a photo, or describe your meal.")

    tab1, tab2, tab3 = st.tabs(["Scan Food", "Upload Image", "Describe Meal"])

    with tab1:
        camera_photo = st.camera_input("Take a picture", label_visibility="collapsed")
        if camera_photo and st.button("Calculate from Camera", type="primary"):
            img = Image.open(camera_photo)
            with st.spinner("Analyzing ingredients..."):
                result = analyze_meal(img, is_image=True)
                save_history("Camera Scan", result)
            render_result(result)

    with tab2:
        uploaded_file = st.file_uploader("Upload photo", type=["jpg", "jpeg", "png"], label_visibility="collapsed")
        if uploaded_file and st.button("Calculate from Upload", type="primary"):
            img = Image.open(uploaded_file)
            with st.spinner("Analyzing ingredients..."):
                result = analyze_meal(img, is_image=True)
                save_history("Image Upload", result)
            render_result(result)

    with tab3:
        meal_text = st.text_area("Describe your meal", placeholder="e.g. 2 rotis and dal makhani", label_visibility="collapsed")
        if st.button("Calculate from Text", type="primary", disabled=not meal_text.strip()):
            with st.spinner("Analyzing ingredients..."):
                result = analyze_meal(meal_text, is_image=False)
                save_history(meal_text, result)
            render_result(result)

if __name__ == "__main__":
    main()
