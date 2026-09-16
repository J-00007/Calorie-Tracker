import streamlit as st
import google.generativeai as genai
from PIL import Image
import os

# -----------------------------------------------------------------------------
# 1. Configuration & Setup
# -----------------------------------------------------------------------------
# In a production MNC environment, we load credentials securely. 
# For local testing, set this in your terminal: export GEMINI_API_KEY="your_key"
API_KEY = os.environ.get("GEMINI_API_KEY")
genai.configure(api_key=API_KEY)
# Using Gemini 3.6 Flash as it is lightning fast for both text and image processing
MODEL_NAME = 'gemini-3.6-flash' 

# -----------------------------------------------------------------------------
# 2. Core Logic Engine
# -----------------------------------------------------------------------------
def analyze_meal(input_data, is_image=False):
    """
    Sends the text or image to the model with strict prompt instructions.
    """
    model = genai.GenerativeModel(MODEL_NAME)
    
    # Strict prompt engineering to ensure it ONLY outputs calories and focuses on Indian Cuisine
    system_prompt = """
    You are an expert algorithmic calorie counter specializing in Indian Cuisine. 
    Analyze the provided food (either by image or text description).
    
    Strict Rules:
    1. Calculate the total calories.
    2. Account for hidden calories typical in Indian cooking (e.g., ghee, oil, coconut).
    3. Output ONLY the total calories and a brief itemized breakdown.
    4. Do not provide any greetings, dietary advice, or extra conversation.
    
    Required Output Format:
    Total Calories: [X] kcal
    - [Item 1]: [X] kcal
    - [Item 2]: [X] kcal
    """
    
    try:
        if is_image:
            # Multimodal request: Image + Prompt
            response = model.generate_content([system_prompt, input_data])
        else:
            # Text request: User description + Prompt
            text_payload = f"User meal description: {input_data}"
            response = model.generate_content([system_prompt, text_payload])
            
        return response.text
    except Exception as e:
        return f"System Error: {str(e)}"

# -----------------------------------------------------------------------------
# 3. Streamlit User Interface
# -----------------------------------------------------------------------------
"""
Indian Cuisine Calorie Tracker — Streamlit app.

Three ways in: live camera scan, photo upload, or a typed description.
Each path calls `analyze_meal()` and renders the result as a receipt-style
card. Wire your real analysis logic into `analyze_meal()` — everything
else (UI, styling, state handling) is ready to go.
"""

import streamlit as st
from PIL import Image

st.set_page_config(
    page_title="Indian Cuisine Calorie Tracker",
    page_icon="🍛",
    layout="centered",
)


# ----------------------------------------------------------------------
# Styling — a warm, dark "spice pantry" theme: Fraunces for the dish
# name, Work Sans for body copy, and a monospace "receipt" treatment
# for the calorie count. Turmeric / chili / cardamom mark the three
# macros throughout instead of one generic accent color.
# ----------------------------------------------------------------------
def inject_css() -> None:
    st.markdown(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Work+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap');

        :root {
            --bg: #1F1610;
            --paper: #2B2019;
            --ink: #F5EFE2;
            --muted: #B8A98C;
            --border: #4A3A2C;
            --turmeric: #E7B23A;
            --chili: #D65B3E;
            --cardamom: #7FAE6F;
        }

        .stApp, [data-testid="stAppViewContainer"] {
            background: var(--bg);
            color: var(--ink);
        }
        [data-testid="stHeader"] { background: transparent; }
        [data-testid="stToolbar"], #MainMenu, footer { visibility: hidden; }

        .stApp, .stApp p, .stApp label, .stApp span, .stApp li {
            font-family: 'Work Sans', sans-serif;
            color: var(--ink);
        }

        .block-container {
            max-width: 680px;
            padding-top: 2.5rem;
            padding-bottom: 3rem;
        }

        .app-header h1 {
            font-family: 'Fraunces', serif;
            font-weight: 600;
            font-size: 2.3rem;
            letter-spacing: -0.01em;
            margin-bottom: 0.3rem;
        }
        .app-header p {
            color: var(--muted);
            font-size: 1.02rem;
            max-width: 48ch;
            margin-top: 0;
            margin-bottom: 1.8rem;
        }

        /* Tabs */
        .stTabs [data-baseweb="tab-list"] {
            gap: 1.6rem;
            border-bottom: 1px solid var(--border);
        }
        .stTabs [data-baseweb="tab"] {
            height: auto;
            padding: 0.5rem 0.1rem;
            background: transparent;
            font-weight: 500;
            color: var(--muted);
        }
        .stTabs [aria-selected="true"] {
            color: var(--turmeric) !important;
            border-bottom: 2px solid var(--turmeric) !important;
        }

        /* Text area */
        .stTextArea textarea {
            background: var(--paper) !important;
            color: var(--ink) !important;
            border: 1px solid var(--border) !important;
            border-radius: 10px !important;
        }
        .stTextArea textarea::placeholder { color: var(--muted); }

        /* File uploader */
        [data-testid="stFileUploaderDropzone"] {
            background: var(--paper);
            border: 1px dashed var(--border);
            border-radius: 10px;
        }
        [data-testid="stFileUploaderDropzone"] * { color: var(--ink) !important; }

        /* Buttons */
        .stButton > button {
            border-radius: 999px;
            border: none;
            padding: 0.55rem 1.6rem;
            font-weight: 600;
            background: var(--border);
            color: var(--ink);
            transition: transform 0.15s ease, opacity 0.15s ease;
        }
        .stButton > button:hover { opacity: 0.9; transform: translateY(-1px); color: var(--ink); }
        .stButton > button:disabled { opacity: 0.4; transform: none; }
        .stButton > button[kind="primary"],
        .stButton > button[data-testid="baseButton-primary"] {
            background: var(--chili);
            color: #FFF8F1;
        }

        /* Result card — styled like a meal receipt */
        .result-card {
            background: var(--paper);
            border-top: 2px dashed var(--border);
            border-bottom: 2px dashed var(--border);
            border-radius: 4px;
            padding: 1.6rem 1.4rem;
            margin-top: 1.6rem;
        }
        .result-dish {
            font-family: 'Fraunces', serif;
            font-style: italic;
            font-weight: 500;
            font-size: 1.15rem;
        }
        .result-calories {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 700;
            font-size: 2.6rem;
            line-height: 1.1;
            margin: 0.4rem 0 1.1rem 0;
        }
        .result-calories span {
            font-size: 1rem;
            font-weight: 500;
            color: var(--muted);
            margin-left: 0.3rem;
        }
        .macro-row {
            display: flex;
            gap: 1.8rem;
            padding-top: 1rem;
            border-top: 1px solid var(--border);
            flex-wrap: wrap;
        }
        .macro { display: flex; flex-direction: column; gap: 0.15rem; }
        .macro-label { font-size: 0.78rem; color: var(--muted); }
        .macro-value {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 600;
            font-size: 1.05rem;
        }
        .macro.protein .macro-label::before { content: "● "; color: var(--cardamom); }
        .macro.carbs .macro-label::before { content: "● "; color: var(--turmeric); }
        .macro.fat .macro-label::before { content: "● "; color: var(--chili); }

        .result-notes {
            margin-top: 1rem;
            font-size: 0.85rem;
            color: var(--muted);
            font-style: italic;
        }

        .app-footer {
            margin-top: 3rem;
            font-size: 0.8rem;
            color: var(--muted);
            text-align: center;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


# ----------------------------------------------------------------------
# Analysis — replace the body of this function with your real logic
# (vision-language model call, nutrition database lookup, etc). Keep
# the same input signature and return shape and the UI needs no changes.
# ----------------------------------------------------------------------
def analyze_meal(meal_input, is_image: bool) -> dict:
    """
    Args:
        meal_input: a PIL.Image (when is_image=True) or a description string.
        is_image: whether meal_input is a photo or typed text.

    Returns:
        {
            "dish_name": str,
            "calories": int,
            "protein_g": float,
            "carbs_g": float,
            "fat_g": float,
            "notes": str,
        }
    """
    # --- placeholder result so the UI is runnable end to end ---
    return {
        "dish_name": "Paneer Butter Masala with Rice" if is_image else str(meal_input).strip().title(),
        "calories": 540,
        "protein_g": 18.5,
        "carbs_g": 62,
        "fat_g": 24,
        "notes": "Estimate based on a standard restaurant-style serving.",
    }


def render_result(result: dict) -> None:
    st.markdown(
        f"""
        <div class="result-card">
          <div class="result-dish">{result['dish_name']}</div>
          <div class="result-calories">{result['calories']}<span>kcal</span></div>
          <div class="macro-row">
            <div class="macro protein">
              <span class="macro-label">Protein</span>
              <span class="macro-value">{result['protein_g']} g</span>
            </div>
            <div class="macro carbs">
              <span class="macro-label">Carbs</span>
              <span class="macro-value">{result['carbs_g']} g</span>
            </div>
            <div class="macro fat">
              <span class="macro-label">Fat</span>
              <span class="macro-value">{result['fat_g']} g</span>
            </div>
          </div>
          <div class="result-notes">{result['notes']}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def main() -> tab1, tab2, tab3 = st.tabs(["Take Photo", "Upload Image", "Describe Meal"]):
    inject_css()

    st.markdown(
        """
        <div class="app-header">
          <h1>🍛 Indian Cuisine Calorie Tracker</h1>
          <p>Scan a plate, upload a photo, or describe your meal — get calories
          and macros in seconds.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    tab1, tab2, tab3 = st.tabs(["Scan Food", "Upload Image", "Describe Meal"])

    with tab1:
        st.caption("Point your camera at your plate and snap a picture.")
        camera_photo = st.camera_input(
            "Take a picture of your meal", key="camera_1", label_visibility="collapsed"
        )
        if camera_photo is not None:
            img = Image.open(camera_photo)
            st.image(img, caption="Scanned meal", use_container_width=True)
            if st.button("Calculate calories", key="btn_scan", type="primary"):
                with st.spinner("Analyzing spices and ingredients..."):
                    result = analyze_meal(img, is_image=True)
                render_result(result)

    with tab2:
        st.caption("Upload a clear photo of your meal from your gallery.")
        uploaded_file = st.file_uploader(
            "Upload a meal photo",
            type=["jpg", "jpeg", "png"],
            key="upload_1",
            label_visibility="collapsed",
        )
        if uploaded_file is not None:
            img = Image.open(uploaded_file)
            st.image(img, caption="Uploaded meal", use_container_width=True)
            if st.button("Calculate calories", key="btn_upload", type="primary"):
                with st.spinner("Analyzing spices and ingredients..."):
                    result = analyze_meal(img, is_image=True)
                render_result(result)

    with tab3:
        st.caption("Describe what you ate, in as much or as little detail as you like.")
        meal_text = st.text_area(
            "Describe your meal",
            placeholder="e.g. 2 rotis, a bowl of dal makhani, and a small portion of jeera rice",
            key="describe_1",
            label_visibility="collapsed",
            height=110,
        )
        if st.button(
            "Calculate calories",
            key="btn_describe",
            type="primary",
            disabled=not meal_text.strip(),
        ):
            with st.spinner("Analyzing spices and ingredients..."):
                result = analyze_meal(meal_text, is_image=False)
            render_result(result)

    st.markdown(
        '<div class="app-footer">Estimates are approximate — always check nutrition '
        "labels or a dietitian for medical decisions.</div>",
        unsafe_allow_html=True,
    )


if __name__ == "__main__":
    main()
   # Method 2: Upload Image
    with tab2:
        uploaded_file = st.file_uploader("Upload an image of your meal")
        if uploaded_file is not None:
            img = Image.open(uploaded_file)
            st.image(img, caption="Uploaded Meal", use_container_width=True)

            if st.button("Calculate Calories", key="btn_upload"):
                with st.spinner("Analyzing spices and ingredients..."):
                    result = analyze_meal(img, is_image=True)
                    st.success(result)
    # Method 3: Describe Meal (Text Input)
    with tab3:
        meal_description = st.text_input("Describe your meal", placeholder="e.g., 2 Idlis and Coconut chutney")
        
        if st.button("Calculate Calories", key="btn_text"):
            if meal_description.strip() == "":
                st.warning("Please enter a meal description.")
            else:
                with st.spinner("Calculating..."):
                    result = analyze_meal(meal_description, is_image=False)
                    st.success(result)

if __name__ == "__main__":
    main()
